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

function createIntegrity(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

function assertAssetSize(label: string, source: string): void {
  if (Buffer.byteLength(source, 'utf8') > maximumRegistryAssetBytes) {
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

async function readLimitedFile(label: string, file: string): Promise<string> {
  if (statSync(file).size > maximumRegistryAssetBytes) {
    throw new Error(`${label} exceeds the 5 MiB registry asset limit`)
  }
  const source = await readFile(file, 'utf8')
  assertAssetSize(label, source)
  return source
}

async function readLimitedUrl(
  label: string,
  url: URL,
): Promise<{ source: string; url: URL }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json, text/plain;q=0.9' },
    })
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
      throw new Error(`${label} exceeds the 5 MiB registry asset limit`)
    }

    const source = await response.text()
    assertAssetSize(label, source)
    return { source, url: new URL(response.url) }
  } finally {
    clearTimeout(timeout)
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
    const response = await readLimitedUrl('Registry manifest', requestedUrl)
    const manifestUrl = response.url
    const raw = response.source
    const registry = parseRegistry(raw)
    const baseUrl = new URL('.', manifestUrl)

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
        const assetUrl = new URL(source, baseUrl)
        const basePath = baseUrl.pathname.endsWith('/')
          ? baseUrl.pathname
          : `${baseUrl.pathname}/`
        if (
          assetUrl.origin !== baseUrl.origin ||
          !assetUrl.pathname.startsWith(basePath)
        ) {
          throw new Error(
            `Registry source escapes its registry root: ${source}`,
          )
        }
        return (await readLimitedUrl(`Registry asset ${source}`, assetUrl))
          .source
      },
    }
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
