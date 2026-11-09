import type { Registry } from '@zeus-web/registry'

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import { validateRegistry } from '@zeus-web/registry'

import { readRegistryAsset } from './registry-assets'

const builtinRegistryReferences = new Set([
  '@zeus-web/registry',
  'builtin',
  'default',
])
const maximumRegistryAssetBytes = 5 * 1024 * 1024

/** Redirects are followed one hop at a time so each target is validated first. */
const maximumRedirects = 5
const fetchTimeoutMs = 15_000

/**
 * A remote registry is fetched over HTTP only for local development. The CLI
 * runs in a project directory, not as a server, so a registry that resolves to
 * a private address is rejected unless the operator opts in explicitly.
 */
const allowPrivateRegistryHostsEnv = 'ZEUS_REGISTRY_ALLOW_PRIVATE_HOSTS'

export type RegistrySourceKind = 'bundled' | 'file' | 'url'

export interface RegistrySourceSnapshot {
  id: string
  kind: RegistrySourceKind
  location: string
  name: string
  version: string
  integrity: string
}

export interface LoadedRegistrySource {
  registry: Registry
  source: RegistrySourceSnapshot
  readSource: (source: string) => Promise<string>
}

export interface RegistryFetchOptions {
  /** Abort a slow registry. Defaults to 15s per request. */
  signal?: AbortSignal
  timeoutMs?: number
  /** Follow redirects? Disabled by tests that assert a single hop. */
  maxRedirects?: number
  /** Injected for tests; defaults to the global fetch. */
  fetch?: typeof fetch
}

function createIntegrity(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

function byteLength(source: string): number {
  return Buffer.byteLength(source, 'utf8')
}

function assertAssetSize(label: string, source: string): void {
  if (byteLength(source) > maximumRegistryAssetBytes) {
    throw new Error(`${label} exceeds the 5 MiB registry asset limit`)
  }
}

function assertSafeRegistrySourcePath(source: string): void {
  if (
    !source ||
    source.includes('\0') ||
    source.includes('\\') ||
    source.startsWith('/') ||
    source.startsWith('//') ||
    source.includes(':') ||
    source.includes('?') ||
    source.includes('#') ||
    source.includes('%') ||
    source
      .split('/')
      .some(
        segment =>
          segment === '.' ||
          segment === '..' ||
          segment === '' ||
          segment.endsWith('.') ||
          segment.endsWith(' '),
      )
  ) {
    throw new Error(`Unsafe registry source path: ${source}`)
  }
}

function assertPathInside(base: string, file: string, source: string): void {
  const target = relative(base, file)
  if (target === '..' || target.startsWith(`..${sep}`) || isAbsolute(target)) {
    throw new Error(`Registry source escapes its registry root: ${source}`)
  }
}

function isUrlWithinRegistryRoot(candidate: URL, base: URL): boolean {
  const basePath = base.pathname.endsWith('/')
    ? base.pathname
    : `${base.pathname}/`
  return (
    candidate.origin === base.origin &&
    candidate.protocol === base.protocol &&
    candidate.pathname.startsWith(basePath) &&
    candidate.username === '' &&
    candidate.password === ''
  )
}

/**
 * A loopback registry is the documented local-development case and is always
 * allowed. Every other private destination is rejected by default: a registry
 * URL can arrive from a script or CI job, and 169.254.169.254, 10/8 or a
 * service-mesh address would otherwise turn `zweb add` into an SSRF probe.
 */
function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    /^127\.\d+\.\d+\.\d+$/.test(host)
  )
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (isLoopbackHostname(host)) return false
  if (host === '::') return true
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) return true
  if (/^fe[89ab][0-9a-f]:/i.test(host)) return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    )
  }
  return false
}

/**
 * Rejecting private destinations closes the SSRF path. The escape hatch exists
 * for a registry served from a developer machine on a LAN address.
 */
function assertRegistryUrlAllowed(url: URL): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported registry protocol: ${url.protocol}`)
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error('Registry URL must not contain credentials')
  }
  if (process.env[allowPrivateRegistryHostsEnv] === '1') return
  if (isPrivateHostname(url.hostname)) {
    throw new Error(
      `Registry host ${url.hostname} is a private address; set ${allowPrivateRegistryHostsEnv}=1 to allow a LAN registry`,
    )
  }
}

async function readLimitedFile(label: string, file: string): Promise<string> {
  if (statSync(file).size > maximumRegistryAssetBytes) {
    throw new Error(`${label} exceeds the 5 MiB registry asset limit`)
  }
  const source = await readFile(file, 'utf8')
  assertAssetSize(label, source)
  return source
}

/**
 * Streams the response and aborts as soon as the accumulated bytes exceed the
 * limit. `response.text()` would already have buffered an unbounded body, so
 * the size check has to happen while reading, not afterwards.
 */
async function readLimitedBody(
  label: string,
  response: Response,
): Promise<string> {
  if (!response.body) {
    const source = await response.text()
    assertAssetSize(label, source)
    return source
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maximumRegistryAssetBytes) {
        throw new Error(`${label} exceeds the 5 MiB registry asset limit`)
      }
      chunks.push(value)
    }
  } catch (error) {
    // Stop the download instead of draining an oversized body.
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }

  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8')
}

interface FetchedResource {
  source: string
  url: URL
}

/**
 * Fetches one registry resource, validating every redirect target *before* the
 * next request is made. A redirect that leaves the allowed root, downgrades
 * the protocol, changes origin or loops is rejected without downloading its
 * body.
 */
async function fetchRegistryResource(
  label: string,
  url: URL,
  root: URL | 'same-origin',
  options: RegistryFetchOptions = {},
): Promise<FetchedResource> {
  const fetcher = options.fetch ?? fetch
  const maxRedirects = options.maxRedirects ?? maximumRedirects
  const timeoutMs = options.timeoutMs ?? fetchTimeoutMs
  let current = url

  const assertTarget = (candidate: URL): void => {
    assertRegistryUrlAllowed(candidate)
    const allowed =
      root === 'same-origin'
        ? candidate.origin === url.origin
        : isUrlWithinRegistryRoot(candidate, root)
    if (!allowed) {
      throw new Error(`Registry source escapes its registry root: ${label}`)
    }
  }

  assertTarget(current)

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = (): void => controller.abort()
    options.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      const response = await fetcher(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { accept: 'application/json, text/plain;q=0.9' },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        await response.body?.cancel().catch(() => undefined)
        if (!location) {
          throw new Error(`${label} returned a redirect without a location`)
        }
        if (hop === maxRedirects) {
          throw new Error(`${label} exceeded the redirect limit`)
        }
        const next = new URL(location, current)
        // Validate the target before the next request instead of after.
        if (next.protocol !== current.protocol) {
          throw new Error(
            `${label} redirect downgrades ${current.protocol} to ${next.protocol}`,
          )
        }
        if (next.origin !== current.origin) {
          throw new Error(`Registry source redirect changes origin: ${label}`)
        }
        assertTarget(next)
        current = next
        continue
      }

      if (!response.ok) {
        throw new Error(
          `${label} returned HTTP ${response.status} ${response.statusText}`.trim(),
        )
      }

      const declaredLength = Number(response.headers.get('content-length'))
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > maximumRegistryAssetBytes
      ) {
        await response.body?.cancel().catch(() => undefined)
        throw new Error(`${label} exceeds the 5 MiB registry asset limit`)
      }

      const source = await readLimitedBody(label, response)
      return { source, url: current }
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', onAbort)
    }
  }

  throw new Error(`${label} exceeded the redirect limit`)
}

/**
 * Fetches the manifest once and derives the root from the URL the bytes
 * actually came from. Assets are then resolved against that root, so a manifest
 * served from `/cdn/registry.json` never reads assets from `/registry/`.
 */
async function loadUrlRegistry(
  requestedUrl: URL,
  options: RegistryFetchOptions,
): Promise<LoadedRegistrySource> {
  assertRegistryUrlAllowed(requestedUrl)
  const manifest = await fetchRegistryResource(
    'Registry manifest',
    requestedUrl,
    'same-origin',
    options,
  )
  const manifestUrl = manifest.url
  const baseUrl = new URL('.', manifestUrl)
  const registryRoot = baseUrl.pathname.endsWith('/')
    ? baseUrl
    : new URL(`${baseUrl.pathname}/`, baseUrl)
  const raw = manifest.source
  const registry = parseRegistry(raw)

  return {
    registry,
    source: createSnapshot({
      kind: 'url',
      location: manifestUrl.href,
      raw,
      registry,
    }),
    readSource: async source => {
      assertSafeRegistrySourcePath(source)
      const assetUrl = new URL(source, registryRoot)
      const response = await fetchRegistryResource(
        `Registry asset ${source}`,
        assetUrl,
        registryRoot,
        options,
      )
      return response.source
    },
  }
}

function parseRegistry(source: string): Registry {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch (error) {
    throw new Error(
      `Registry manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Registry manifest must contain an object')
  }
  const registry = value as Registry
  const validation = validateRegistry(registry)
  if (!validation.valid) {
    throw new Error(
      `Invalid registry manifest: ${validation.errors.join('; ')}`,
    )
  }
  return registry
}

function createSnapshot(params: {
  kind: RegistrySourceKind
  location: string
  raw: string
  registry: Registry
}): RegistrySourceSnapshot {
  return {
    id: params.kind === 'bundled' ? '@zeus-web/registry' : params.location,
    kind: params.kind,
    location: params.location,
    name: params.registry.name,
    version: params.registry.version,
    integrity: createIntegrity(params.raw),
  }
}

function resolveLocalRegistryFile(cwd: string, reference: string): string {
  const candidate = resolve(cwd, reference)
  return existsSync(candidate) && statSync(candidate).isDirectory()
    ? resolve(candidate, 'registry.json')
    : candidate
}

export function createBundledRegistrySource(): LoadedRegistrySource {
  const raw = readRegistryAsset('registry.json')
  const registry = parseRegistry(raw)
  return {
    registry,
    source: createSnapshot({
      kind: 'bundled',
      location: '@zeus-web/registry',
      raw,
      registry,
    }),
    readSource: async source => {
      assertSafeRegistrySourcePath(source)
      return readRegistryAsset(source)
    },
  }
}

export async function loadRegistrySource(
  params: {
    reference?: string
    cwd?: string
    fetchOptions?: RegistryFetchOptions
  } = {},
): Promise<LoadedRegistrySource> {
  const reference = params.reference?.trim()

  if (!reference || builtinRegistryReferences.has(reference)) {
    return createBundledRegistrySource()
  }

  if (/^https?:\/\//i.test(reference)) {
    const requestedUrl = new URL(reference)
    if (requestedUrl.pathname.endsWith('/')) {
      requestedUrl.pathname = `${requestedUrl.pathname}registry.json`
    }
    return loadUrlRegistry(requestedUrl, params.fetchOptions ?? {})
  }

  const registryFile = resolveLocalRegistryFile(
    params.cwd ?? process.cwd(),
    reference,
  )
  const raw = await readLimitedFile('Registry manifest', registryFile)
  const registry = parseRegistry(raw)
  const canonicalRegistryFile = realpathSync(registryFile)
  const registryRoot = dirname(canonicalRegistryFile)
  const location = pathToFileURL(canonicalRegistryFile).href

  return {
    registry,
    source: createSnapshot({
      kind: 'file',
      location,
      raw,
      registry,
    }),
    readSource: async source => {
      assertSafeRegistrySourcePath(source)
      const file = resolve(registryRoot, source)
      assertPathInside(registryRoot, file, source)
      const canonicalFile = realpathSync(file)
      assertPathInside(registryRoot, canonicalFile, source)
      return readLimitedFile(`Registry asset ${source}`, canonicalFile)
    },
  }
}
