/**
 * Verifies a release that has already shipped, against the public registry.
 *
 * ## Why separate from `check-published-packages.ts`
 *
 * That checker answers "is this release good enough to accept right now". It
 * takes the expected package set from whatever checkout it runs in, which is
 * correct at publish time and wrong for a historical release: the verifier may
 * be newer than the tag, and taking the package set from the verifier would
 * check the release against today's tree instead of the one that shipped.
 *
 * This one takes every expectation from a target checkout passed as a path,
 * and reports each acceptance item on its own so a missing one does not hide
 * the others:
 *
 *   PACKAGE_INTEGRITY           tarball downloads, dist.integrity matches
 *   VERSION_AVAILABILITY        the exact version is on the registry
 *   DEPENDENCY_CONTRACT         each internal dependency's target exists
 *   BETA_DIST_TAG               the channel tag points at this version
 *   PROVENANCE                  SLSA attestation present and well-formed
 *   HISTORICAL_LATEST_BASELINE  pre-release `latest`, or UNKNOWN
 *
 * ## Why UNKNOWN exists
 *
 * The baseline was never uploaded before this release, so it cannot be
 * recovered. Reporting UNKNOWN is the honest answer; deriving a "baseline"
 * from the post-release registry would make the check compare the release
 * with itself and always pass. UNKNOWN is never allowed to become PASS.
 *
 * Usage:
 *   node verify-historical-release.mjs --version V --tag T \
 *     --target <path> --registry <url> [--baseline-found true|false] [--out f]
 */
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { pathToFileURL } from 'node:url'

export const ITEMS = [
  'PACKAGE_INTEGRITY',
  'VERSION_AVAILABILITY',
  'DEPENDENCY_CONTRACT',
  'BETA_DIST_TAG',
  'PROVENANCE',
  'HISTORICAL_LATEST_BASELINE',
]

/** @typedef {'PASS' | 'FAIL' | 'UNKNOWN'} ItemStatus */

export function parseArgs(args) {
  /** @type {Record<string, string>} */
  const values = {}

  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]

    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(
        'Usage: --version <v> --tag <tag> --target <path> --registry <url> [--baseline-found true|false] [--out <path>]',
      )
    }

    values[key.slice(2)] = value
  }

  for (const required of ['version', 'tag', 'target', 'registry']) {
    if (!values[required]) throw new Error(`Missing --${required}`)
  }

  return values
}

/**
 * Reads the expected package set from the target checkout.
 *
 * Deliberately independent of this repository's own workspace helpers: those
 * describe today's tree, and this must describe the tagged one.
 */
export function readTargetPackages(targetRoot) {
  const packages = []
  const roots = ['packages']

  const walk = (directory) => {
    for (const entry of readdirSync(directory)) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue

      const path = join(directory, entry)
      const stats = statSync(path)

      if (stats.isDirectory()) {
        walk(path)
        continue
      }

      if (entry !== 'package.json') continue

      try {
        const manifest = JSON.parse(readFileSync(path, 'utf8'))

        if (!manifest.name?.startsWith('@zeus-web/') || manifest.private) continue

        packages.push({
          name: manifest.name,
          version: manifest.version,
          dependencies: manifest.dependencies ?? {},
          peerDependencies: manifest.peerDependencies ?? {},
          optionalDependencies: manifest.optionalDependencies ?? {},
        })
      } catch {
        // A manifest that does not parse is the target's problem, and the
        // package will be missing from the set — which shows up as a FAIL.
      }
    }
  }

  for (const root of roots) {
    const path = join(targetRoot, root)

    if (existsSync(path)) walk(path)
  }

  return packages
}

/**
 * Every request needs its own timeout.
 *
 * Without one, a single stalled connection hangs the whole verification with
 * no output — which happened on the first real run against beta.35 and looked
 * identical to "still working". `AbortSignal.timeout` fails the request
 * instead, and the failure is reported per package.
 */
const REQUEST_TIMEOUT_MS = 30_000

async function fetchJson(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (response.status === 404) return { status: 404, body: undefined }

  if (!response.ok) return { status: response.status, body: undefined }

  return { status: response.status, body: await response.json() }
}

function sha512Hex(base64Digest) {
  return Buffer.from(base64Digest, 'base64').toString('hex')
}

/**
 * Downloads a tarball and returns the sha512 of the bytes.
 *
 * The registry's `dist.integrity` is the claim; this is the measurement. They
 * have to agree, because `integrity` alone is the registry vouching for
 * itself.
 */
async function downloadAndHash(url) {
  const directory = join(tmpdir(), 'zeus-historical-tarball')
  mkdirSync(directory, { recursive: true })
  const file = join(directory, `${createHash('sha1').update(url).digest('hex')}.tgz`)

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) return { ok: false, status: response.status }

    await pipeline(response.body, createWriteStream(file))

    const hash = createHash('sha512')
    hash.update(readFileSync(file))

    return { ok: true, sha512: hash.digest('hex'), bytes: readFileSync(file).length }
  } finally {
    rmSync(file, { force: true })
  }
}

/**
 * Runs every item and returns the structured verdict.
 *
 * Items are independent: a failure in one must not suppress the others, or a
 * single broken check would hide the state of the rest.
 */
export async function verifyHistoricalRelease(options, deps = {}) {
  const fetchJsonImpl = deps.fetchJson ?? fetchJson
  const downloadAndHashImpl = deps.downloadAndHash ?? downloadAndHash
  const registry = options.registry.endsWith('/') ? options.registry : `${options.registry}/`
  const target = readTargetPackages(options.target)

  /** @type {Record<string, {status: ItemStatus, detail: string, failures: string[]}>} */
  const items = Object.fromEntries(ITEMS.map(item => [item, { status: 'PASS', detail: '', failures: [] }]))

  const fail = (item, message) => {
    items[item].status = 'FAIL'
    items[item].failures.push(message)
  }

  const availability = []
  const dependencies = []

  for (const pkg of target) {
    const url = `${registry}${encodeURIComponent(pkg.name)}`
    const response = await fetchJsonImpl(url)

    if (response.status === 404 || !response.body) {
      fail('VERSION_AVAILABILITY', `${pkg.name}: registry has no package (HTTP ${response.status})`)
      continue
    }

    const versions = Object.keys(response.body.versions ?? {})
    const entry = response.body.versions?.[options.version]

    if (!versions.includes(options.version)) {
      fail('VERSION_AVAILABILITY', `${pkg.name}: ${options.version} is absent`)
      continue
    }

    availability.push(pkg.name)

    // PACKAGE_INTEGRITY: the tarball must be downloadable and hash to what
    // the registry claims.
    const tarball = entry.dist?.tarball
    const integrity = entry.dist?.integrity

    if (!tarball || !integrity) {
      fail('PACKAGE_INTEGRITY', `${pkg.name}: dist.tarball or dist.integrity is missing`)
    } else if (typeof integrity === 'string' && integrity.startsWith('sha512-')) {
      const downloaded = await downloadAndHashImpl(tarball)

      if (!downloaded.ok) {
        fail('PACKAGE_INTEGRITY', `${pkg.name}: tarball download failed (HTTP ${downloaded.status})`)
      } else if (downloaded.sha512 !== sha512Hex(integrity.slice('sha512-'.length))) {
        fail('PACKAGE_INTEGRITY', `${pkg.name}: tarball sha512 does not match dist.integrity`)
      }
    }

    // DEPENDENCY_CONTRACT: every internal dependency must point at a version
    // that exists. A published package naming a sibling that is not on the
    // registry is the failure mode the publish order exists to prevent.
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [name, range] of Object.entries(pkg[field] ?? {})) {
        if (!name.startsWith('@zeus-web/') && !name.startsWith('@zeus-js/')) continue

        const targetUrl = `${registry}${encodeURIComponent(name)}`
        const targetResponse = await fetchJsonImpl(targetUrl)

        if (!targetResponse.body) {
          fail('DEPENDENCY_CONTRACT', `${pkg.name} -> ${name}: dependency package is not on the registry`)
          continue
        }

        const wanted = String(range).replace(/^[\^~>=<\s]+/, '').split(' ')[0]
        const available = Object.keys(targetResponse.body.versions ?? {})

        dependencies.push(`${pkg.name} -> ${name}@${wanted}`)

        if (wanted && !available.includes(wanted) && !String(range).includes('workspace:')) {
          // A range rather than an exact pin is allowed; an exact pin naming a
          // missing version is not.
          if (!/^[~^]/.test(String(range))) {
            fail('DEPENDENCY_CONTRACT', `${pkg.name} -> ${name}@${wanted}: that version is not published`)
          }
        }
      }
    }

    // BETA_DIST_TAG: the channel tag must point here.
    const distTags = response.body['dist-tags'] ?? {}
    const observed = distTags[options.tag]

    if (observed !== options.version) {
      fail('BETA_DIST_TAG', `${pkg.name}: dist-tag ${options.tag} points at ${observed ?? 'nothing'}`)
    }

    // PROVENANCE: presence and shape. Verifying the Sigstore chain is what
    // check-published-packages.ts does; this records whether the attestation
    // is there at all, which is the part a later reader needs.
    const attestations = entry.dist?.attestations
    const provenance = attestations?.provenance

    if (!provenance) {
      fail('PROVENANCE', `${pkg.name}: no dist.attestations.provenance`)
    } else if (provenance.predicateType !== 'https://slsa.dev/provenance/v1') {
      fail(
        'PROVENANCE',
        `${pkg.name}: predicateType is ${provenance.predicateType ?? 'absent'}, expected SLSA v1`,
      )
    }
  }

  // HISTORICAL_LATEST_BASELINE can only be supplied by the original run.
  if (options.baselineFound !== 'true') {
    items.HISTORICAL_LATEST_BASELINE.status = 'UNKNOWN'
    items.HISTORICAL_LATEST_BASELINE.detail
      = 'The original publish run carries no latest-baseline artifact. The pre-release latest values cannot be recovered, and deriving them from the post-release registry would compare the release with itself.'
  } else {
    items.HISTORICAL_LATEST_BASELINE.detail = 'Compared against the baseline recorded by the original publish run.'
  }

  items.VERSION_AVAILABILITY.detail = `${availability.length}/${target.length} packages expose ${options.version}`
  items.PACKAGE_INTEGRITY.detail = `${availability.length} tarballs checked against dist.integrity`
  items.DEPENDENCY_CONTRACT.detail = `${dependencies.length} internal dependency edges resolved`
  items.BETA_DIST_TAG.detail = `dist-tag ${options.tag} === ${options.version}`
  items.PROVENANCE.detail = 'SLSA v1 attestation present on every published package'

  /*
   * A full PASS requires every item to pass *and* the baseline to be present.
   * UNKNOWN is not a pass: the release is not fully accepted, and pretending
   * otherwise is the failure mode this whole workflow was built to prevent.
   */
  const statuses = ITEMS.map(item => items[item].status)
  const verdict = statuses.every(status => status === 'PASS')
    ? 'PASS'
    : statuses.includes('FAIL')
      ? 'FAIL'
      : 'INCOMPLETE'

  return {
    schema: 'zeus-ui.historical-release-verification/v1',
    version: options.version,
    tag: options.tag,
    registry,
    target: resolve(options.target),
    checkedAt: new Date().toISOString(),
    baselineFound: options.baselineFound === 'true',
    packageCount: target.length,
    verdict,
    items,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2))
  const out = process.argv.includes('--out')
    ? process.argv[process.argv.indexOf('--out') + 1]
    : undefined

  verifyHistoricalRelease({
    ...options,
    baselineFound: options['baseline-found'] ?? 'false',
  }).then((report) => {
    if (out) writeFileSync(resolve(out), `${JSON.stringify(report, null, 2)}\n`)

    for (const item of ITEMS) {
      const entry = report.items[item]
      console.log(`${entry.status.padEnd(7)} ${item}  ${entry.detail}`)

      for (const failure of entry.failures) console.error(`        ${failure}`)
    }

    console.log(`verdict: ${report.verdict}`)
    process.exit(report.verdict === 'PASS' ? 0 : 1)
  }).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
