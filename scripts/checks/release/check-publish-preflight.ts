/**
 * Fail-closed publish preflight and partial-release recovery report.
 *
 * `@baicie/release` implements `skipExisting` by running
 * `npm view <name>@<version> version` and treating a non-zero exit as "not
 * published". A registry outage, an expired token or a DNS failure therefore
 * looks exactly like "this version does not exist yet", and the publish loop
 * proceeds to re-publish packages that are already on the registry. npm rejects
 * those with 409, which the CLI classifies as retryable, so an outage turns
 * into a retry storm instead of a clear failure.
 *
 * This preflight draws the same distinction the dist-tag gates already draw:
 *
 *   - HTTP 200            -> PUBLISHED (a retry must skip it)
 *   - explicit 404        -> ABSENT    (a retry must publish it)
 *   - anything else       -> FAILED    (the release must not start)
 *
 * It never writes to the registry. Its report is the recovery record: which
 * packages a retry has to publish and which it must leave alone.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import pc from 'picocolors'

import { resolveChannel } from '../../release/channel'
import { listPublishablePackages } from '../../release/workspace'

export const PUBLISH_PREFLIGHT_SCHEMA = 'zeus-ui.publish-preflight/v1'

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 1_000
const REQUEST_TIMEOUT_MS = 15_000

export type PackagePublishState = 'PUBLISHED' | 'ABSENT' | 'FAILED'

export interface PackagePublishStatus {
  readonly name: string
  readonly state: PackagePublishState
  readonly detail?: string
}

export interface PublishPreflightReport {
  readonly schema: typeof PUBLISH_PREFLIGHT_SCHEMA
  readonly version: string
  readonly tag: string
  readonly registry: string
  readonly packages: readonly PackagePublishStatus[]
  readonly published: readonly string[]
  readonly absent: readonly string[]
  readonly failed: readonly string[]
  readonly ok: boolean
}

export interface PublishPreflightOptions {
  readonly version: string
  readonly tag: string
  readonly registry?: string
  readonly root?: string
  readonly packageNames?: readonly string[]
  readonly fetcher?: typeof fetch
  readonly sleep?: (ms: number) => Promise<void>
  readonly attempts?: number
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function versionUrl(registry: string, name: string, version: string): string {
  // The version endpoint returns 200 for a published version and 404 when the
  // package or the version is absent, which is exactly the distinction the
  // publish loop cannot make on its own.
  return `${registry}${encodeURIComponent(name)}/${encodeURIComponent(version)}`
}

async function queryVersion(
  url: string,
  options: PublishPreflightOptions,
): Promise<{ state: PackagePublishState; detail?: string }> {
  const fetcher = options.fetcher ?? fetch
  const attempts = options.attempts ?? MAX_ATTEMPTS
  const sleep = options.sleep ?? delay
  let lastDetail = ''

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetcher(url, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      })
      await response.body?.cancel().catch(() => undefined)

      if (response.status === 200) return { state: 'PUBLISHED' }
      if (response.status === 404) return { state: 'ABSENT' }

      // 401/403/5xx are never "not published".
      lastDetail = `HTTP ${response.status}`
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : String(error)
    } finally {
      clearTimeout(timeout)
    }

    if (attempt < attempts) await sleep(RETRY_DELAY_MS * attempt)
  }

  return { state: 'FAILED', detail: lastDetail }
}

export async function runPublishPreflight(
  options: PublishPreflightOptions,
): Promise<PublishPreflightReport> {
  const channel = resolveChannel(options.version)
  if (channel.errors.length > 0) {
    throw new Error(channel.errors.join('\n'))
  }
  if (options.tag !== channel.channel) {
    throw new Error(
      `Version ${options.version} must be published under dist-tag "${channel.channel}", not "${options.tag}"`,
    )
  }

  const root = options.root ?? process.cwd()
  const registry = (options.registry ?? DEFAULT_REGISTRY).endsWith('/')
    ? (options.registry ?? DEFAULT_REGISTRY)
    : `${options.registry ?? DEFAULT_REGISTRY}/`
  const names =
    options.packageNames ?? listPublishablePackages(root).map(pkg => pkg.name)

  if (names.length === 0) {
    throw new Error('No publishable packages were discovered')
  }

  const packages: PackagePublishStatus[] = []
  for (const name of names) {
    const result = await queryVersion(
      versionUrl(registry, name, options.version),
      options,
    )
    packages.push({
      name,
      state: result.state,
      ...(result.detail ? { detail: result.detail } : {}),
    })
  }

  const published = packages
    .filter(entry => entry.state === 'PUBLISHED')
    .map(entry => entry.name)
  const absent = packages
    .filter(entry => entry.state === 'ABSENT')
    .map(entry => entry.name)
  const failed = packages
    .filter(entry => entry.state === 'FAILED')
    .map(entry => entry.name)

  return {
    schema: PUBLISH_PREFLIGHT_SCHEMA,
    version: options.version,
    tag: options.tag,
    registry,
    packages,
    published,
    absent,
    failed,
    ok: failed.length === 0,
  }
}

function writeReport(report: PublishPreflightReport, out: string): void {
  const file = path.resolve(out)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      version: { type: 'string' },
      tag: { type: 'string' },
      registry: { type: 'string' },
      root: { type: 'string' },
      out: { type: 'string', default: 'temp/release/publish-preflight.json' },
    },
  })

  if (!values.version) throw new Error('--version is required')
  if (!values.tag) throw new Error('--tag is required')

  return runPublishPreflight({
    version: values.version,
    tag: values.tag,
    ...(values.registry ? { registry: values.registry } : {}),
    ...(values.root ? { root: values.root } : {}),
  }).then(report => {
    writeReport(report, values.out!)
    console.log(
      `publish preflight ${report.ok ? 'PASS' : 'FAIL'}: ${report.published.length} published, ${report.absent.length} absent, ${report.failed.length} failed`,
    )
    for (const entry of report.packages) {
      if (entry.state === 'PUBLISHED') {
        console.log(`  ${pc.gray('PUBLISHED')} ${entry.name}`)
      } else if (entry.state === 'ABSENT') {
        console.log(`  ${pc.green('ABSENT')}    ${entry.name}`)
      } else {
        console.log(
          `  ${pc.red('FAILED')}    ${entry.name} — ${entry.detail ?? 'unknown error'}`,
        )
      }
    }
    if (!report.ok) {
      console.error(
        'BLOCKER the registry could not be queried; refusing to start a publish that may overwrite released versions',
      )
      process.exitCode = 1
    }
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error((error as Error).message)
    process.exit(1)
  })
}
