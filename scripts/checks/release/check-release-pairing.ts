import type { ReleaseChannel } from '../../release/channel'
/**
 * Immutable Core/UI pairing for a Zeus UI release — Core-anchored.
 *
 * ## What was wrong
 *
 * The previous protocol kept a record in **both** repositories, each naming the
 * other's commit:
 *
 *   Core   `release-pairing/v<version>.json` → `uiCommit`
 *   UI     `release-pairing/v<version>.json` → `coreCommit`, `uiCommit`
 *
 * Two problems, one fatal:
 *
 * 1. The UI record named its **own** commit — the commit that contains the
 *    file. Writing a commit's SHA into a file changes that commit's SHA, so
 *    the record could only ever be correct for a commit that is not the one
 *    carrying it. The README told maintainers to amend repeatedly until the
 *    two matched, which never converges: it is a fixed-point problem with no
 *    fixed point.
 * 2. Across the two repositories the references form a cycle: Core names UI,
 *    UI names Core. Neither can be finalised first without the other being
 *    finalised first.
 *
 * ## What replaces it
 *
 * Core is the anchor, and the dependency is one-way.
 *
 * 1. The UI release candidate is committed and pushed. Its SHA is whatever git
 *    computed; nothing needs to know it in advance.
 * 2. **Core** commits `release-pairing/v<version>.json` naming that UI SHA, and
 *    Core is tagged. This is the authoritative record — it is in the tagged
 *    tree, so it cannot change without changing what the tag points at.
 * 3. The UI release reads Core's tag, resolves it to a commit, reads the
 *    record **from that commit**, and requires its own release SHA to equal
 *    the `uiCommit` the record names.
 *
 * Nothing in the UI repository names the UI commit. Nothing in the UI
 * repository names a Core commit either — Core is resolved from the tag. The
 * UI tree does not need to know any SHA, which is what makes the protocol
 * constructible.
 *
 * ## Static and online
 *
 * `evaluateStatic` answers everything that can be answered from the tree alone:
 * version line, pins, channel. It runs in a UI pull request and never touches
 * the network, so a PR is not blocked by a Core tag that does not exist yet.
 *
 * `evaluatePairing` adds the online half: resolve the Core tag, read the record
 * from that commit, compare. It runs at release time, where the tag exists.
 *
 * A failed lookup is a failure, never a skip. "I could not reach GitHub" and
 * "the record matches" are different answers.
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { parseArgs } from 'node:util'
import pc from 'picocolors'

import { resolveChannel } from '../../release/channel'

/**
 * The shape of **Core's** record, which is the authority.
 *
 * Deliberately not the same schema as anything in the UI repository: the UI no
 * longer keeps a record, and a shared schema would invite one back.
 */
export const CORE_PAIRING_SCHEMA = 'zeus.release-pairing/v1'
export const CORE_PAIRING_DIRECTORY = 'release-pairing'

const FULL_SHA = /^[0-9a-f]{40}$/i
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9a-z]+(?:[.-][0-9a-z]+)*)?$/i

/**
 * Core packages versioned outside the fixed release group, mirroring
 * `INDEPENDENT_PACKAGE_VERSIONS` in the UI baseline check. Every other
 * `@zeus-js/*` pin must equal the paired Core version exactly.
 */
export const INDEPENDENT_CORE_PINS: Readonly<Record<string, string>> = {
  '@zeus-js/vite-plugin': '0.0.5',
}

/** Core's record, as read from the commit a Core tag resolves to. */
export interface CorePairingRecord {
  readonly schema: string
  readonly coreVersion: string
  readonly uiCommit: string
  readonly uiVersion: string
  readonly verifiedAt: string
  readonly firstPublish?: readonly string[]
}

export interface CorePin {
  readonly file: string
  readonly name: string
  readonly version: string
}

/**
 * What the UI can check without the network.
 *
 * `uiRoot` is the checkout under test; `uiVersion` comes from the manifest or
 * the dispatch input, never from a record.
 */
export interface StaticPairingInput {
  readonly uiRoot: string
  readonly uiVersion: string
  readonly coreVersion?: string
  readonly requirePairing?: boolean
  readonly listCorePins?: (uiRoot: string) => CorePin[]
}

/** Adds the online half: Core's tag, Core's record, the comparison. */
export interface OnlinePairingInput extends StaticPairingInput {
  /** The UI commit being released. Taken from the workflow's checkout. */
  readonly uiCommit: string
  /** Resolves `v<coreVersion>` on Core to a commit, or explains why not. */
  readonly resolveCoreTag?: (tag: string) => string | undefined
  /** Reads a file from a Core commit. */
  readonly readCoreFile?: (commit: string, file: string) => string | undefined
}

export interface PairingResult {
  readonly ok: boolean
  readonly channel?: ReleaseChannel
  readonly record?: CorePairingRecord
  readonly errors: readonly string[]
}

/**
 * Everything answerable from the UI tree alone.
 *
 * No network. A pull request runs this; a Core tag may not exist yet, and
 * requiring one here would make every UI PR fail until after the Core release
 * — the deadlock this split exists to avoid.
 */
export function evaluateStatic(input: StaticPairingInput): PairingResult {
  const errors: string[] = []
  const channelResult = resolveChannel(input.uiVersion)
  if (channelResult.errors.length > 0) {
    return { ok: false, errors: [...channelResult.errors] }
  }
  const channel = channelResult.channel!
  const coreVersion = input.coreVersion ?? input.uiVersion

  if (coreVersion !== input.uiVersion) {
    errors.push(
      `Core version ${coreVersion} must equal the UI version ${input.uiVersion}; Zeus Core and Zeus UI release on one version line`,
    )
  }
  if (!EXACT_VERSION.test(input.uiVersion)) {
    errors.push(`UI version ${input.uiVersion} is not an exact version`)
  }

  /*
   * The pins are the UI's own statement about which Core it was built against.
   * They are checkable offline, so they are checked offline — a wrong pin is a
   * mistake to catch in the PR, not at release time.
   */
  const pins = (input.listCorePins ?? listCorePins)(input.uiRoot)
  if (pins.length === 0) {
    errors.push('No @zeus-js/* pins were found in the UI workspace')
  }
  for (const pin of pins) {
    const independent = INDEPENDENT_CORE_PINS[pin.name]
    if (independent !== undefined) {
      if (pin.version !== independent) {
        errors.push(
          `${pin.file}: ${pin.name} ${pin.version} != independent Core version ${independent}`,
        )
      }
      continue
    }
    if (pin.version !== coreVersion) {
      errors.push(
        `${pin.file}: ${pin.name} ${pin.version} != paired Core version ${coreVersion}`,
      )
    }
  }

  return { ok: errors.length === 0, channel, errors }
}

/**
 * The full check: static, plus Core's tag and Core's record.
 *
 * Runs at release time. Every failure mode — tag missing, record missing,
 * record malformed, record naming a different UI commit, GitHub unreachable —
 * is an error, and none of them degrades to a pass.
 */
export function evaluatePairing(input: OnlinePairingInput): PairingResult {
  const staticResult = evaluateStatic(input)
  const errors = [...staticResult.errors]
  const channel = staticResult.channel
  if (channel === undefined) return { ok: false, errors }

  const coreVersion = input.coreVersion ?? input.uiVersion
  const requirePairing = input.requirePairing ?? channel !== 'beta'

  if (!FULL_SHA.test(input.uiCommit)) {
    errors.push('release SHA must be a full 40-character UI commit SHA')
  }

  if (!requirePairing) {
    /*
     * Beta is the pre-contract channel: no Core tag, no record. Skipping is
     * correct here and nowhere else, and it is reported rather than silent.
     */
    return {
      ok: errors.length === 0,
      channel,
      errors: errors.length === 0 ? [] : errors,
    }
  }

  const resolveCoreTag = input.resolveCoreTag ?? resolveCoreTagOnGitHub
  const tagCommit = resolveCoreTag(`v${coreVersion}`)
  if (tagCommit === undefined) {
    errors.push(
      `Core tag v${coreVersion} cannot be resolved; the paired Core release does not exist or GitHub could not be reached`,
    )
    return { ok: false, channel, errors }
  }
  if (!FULL_SHA.test(tagCommit)) {
    errors.push(`Core tag v${coreVersion} did not resolve to a commit`)
    return { ok: false, channel, errors }
  }

  /*
   * The record is read **from the tagged commit**, not from the UI checkout and
   * not from a branch. A record that only exists on `main` after the tag says
   * nothing about what was released.
   */
  const recordPath = `${CORE_PAIRING_DIRECTORY}/v${coreVersion}.json`
  const readCoreFile = input.readCoreFile ?? readCoreFileAtCommit
  const raw = readCoreFile(tagCommit, recordPath)
  if (raw === undefined) {
    errors.push(
      `Core tag v${coreVersion} points at ${tagCommit}, which has no ${recordPath}`,
    )
    return { ok: false, channel, errors }
  }

  const parsed = parseCorePairingRecord(raw, errors)
  if (!parsed) return { ok: false, channel, errors }

  if (parsed.coreVersion !== coreVersion) {
    errors.push(
      `Core record coreVersion ${parsed.coreVersion} != expected ${coreVersion}`,
    )
  }
  if (parsed.uiVersion !== input.uiVersion) {
    errors.push(
      `Core record uiVersion ${parsed.uiVersion} != release version ${input.uiVersion}`,
    )
  }
  /*
   * The authoritative comparison. Core names the UI commit it paired with; the
   * release must be that commit. This is what replaces the UI writing its own
   * SHA into its own tree.
   */
  if (parsed.uiCommit.toLowerCase() !== input.uiCommit.toLowerCase()) {
    errors.push(
      `Core record at v${coreVersion} names UI commit ${parsed.uiCommit}, but this release is ${input.uiCommit}`,
    )
  }

  return {
    ok: errors.length === 0,
    channel,
    ...(errors.length === 0 ? { record: parsed } : { record: parsed }),
    errors,
  }
}

function parseCorePairingRecord(
  raw: string,
  errors: string[],
): CorePairingRecord | undefined {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (error) {
    errors.push(
      `Core pairing record is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
    return undefined
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('Core pairing record must be a JSON object')
    return undefined
  }
  const record = value as Partial<CorePairingRecord>
  const typeErrors: string[] = []
  if (record.schema !== CORE_PAIRING_SCHEMA) {
    typeErrors.push(`Core pairing record schema must be ${CORE_PAIRING_SCHEMA}`)
  }
  for (const field of ['coreVersion', 'uiVersion'] as const) {
    if (
      typeof record[field] !== 'string' ||
      !EXACT_VERSION.test(record[field]!)
    ) {
      typeErrors.push(`Core pairing record ${field} must be an exact version`)
    }
  }
  if (typeof record.uiCommit !== 'string' || !FULL_SHA.test(record.uiCommit)) {
    typeErrors.push(
      'Core pairing record uiCommit must be a full 40-character SHA',
    )
  }
  if (typeErrors.length > 0) {
    errors.push(...typeErrors)
    return undefined
  }
  return record as CorePairingRecord
}

/** `@zeus-js/*` pins declared anywhere in the UI workspace. */
export function listCorePins(uiRoot: string): CorePin[] {
  const pins: CorePin[] = []
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        visit(absolute)
        continue
      }
      if (entry.name !== 'package.json') continue
      let manifest: Record<string, unknown>
      try {
        manifest = JSON.parse(readFileSync(absolute, 'utf8')) as Record<
          string,
          unknown
        >
      } catch {
        continue
      }
      for (const field of [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ]) {
        const block = manifest[field]
        if (!block || typeof block !== 'object') continue
        for (const [name, version] of Object.entries(
          block as Record<string, unknown>,
        )) {
          if (!name.startsWith('@zeus-js/')) continue
          if (typeof version !== 'string') continue
          pins.push({
            file: path.relative(uiRoot, absolute),
            name,
            version,
          })
        }
      }
    }
  }
  /*
   * Every workspace member, not just `packages/`.
   *
   * `pnpm-workspace.yaml` also lists `benchmarks/*`, `apps/*` and `examples/*`.
   * Scanning only `packages/` let `examples/ai-workbench` — which still pinned
   * `@zeus-js/zeus@0.1.1-beta.20` while the other 46 packages moved to
   * `0.2.0-rc.0` — pass the static half as `passed`. The mismatch surfaced
   * later, as an unresolvable install against the registry, which is a much
   * worse place to find it: the tree looked complete and the failure named a
   * package rather than the file that was stale.
   */
  for (const group of ['packages', 'benchmarks', 'apps', 'examples']) {
    const directory = path.join(uiRoot, group)
    if (existsSync(directory)) visit(directory)
  }
  return pins
}

/**
 * `v<version>` on Core, resolved through the GitHub API.
 *
 * Annotated tags point at a tag object rather than a commit, so the object is
 * dereferenced when needed. `undefined` means the lookup failed — missing tag,
 * rate limit, no token — and the caller treats it as a failure.
 */
export function resolveCoreTagOnGitHub(
  tag: string,
  repository = 'baicie/zeus',
): string | undefined {
  const gh = (args: string[]): string =>
    execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    }) as string
  try {
    const ref = JSON.parse(
      gh(['api', `repos/${repository}/git/ref/tags/${tag}`]),
    ) as { object?: { type?: string; sha?: string } }
    const object = ref.object
    if (!object || typeof object.sha !== 'string') return undefined
    if (object.type === 'commit') return object.sha
    const tagObject = JSON.parse(
      gh(['api', `repos/${repository}/git/tags/${object.sha}`]),
    ) as { object?: { sha?: string } }
    return typeof tagObject.object?.sha === 'string'
      ? tagObject.object.sha
      : undefined
  } catch {
    return undefined
  }
}

/** A file at a commit on Core, or `undefined` when it is not there. */
export function readCoreFileAtCommit(
  commit: string,
  file: string,
  repository = 'baicie/zeus',
): string | undefined {
  try {
    return execFileSync(
      'gh',
      [
        'api',
        `repos/${repository}/contents/${file}?ref=${commit}`,
        '-H',
        'Accept: application/vnd.github.raw',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 },
    ) as string
  } catch {
    return undefined
  }
}

/**
 * A template for a Core pairing record, for the short window between a UI
 * candidate being pushed and Core recording it.
 *
 * It deliberately contains no UI commit: that value comes from Core, and a
 * tool that wrote one here would be recreating the self-reference.
 */
export function writeCorePairingTemplate(
  directory: string,
  version: string,
): string {
  mkdirSync(directory, { recursive: true })
  const file = path.join(directory, `v${version}.json`)
  if (existsSync(file)) return file
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        schema: CORE_PAIRING_SCHEMA,
        coreVersion: version,
        uiCommit: '<UI commit, filled in by the Core release PR>',
        uiVersion: version,
        verifiedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  )
  return file
}

function main(): void {
  const { values } = parseArgs({
    options: {
      'ui-root': { type: 'string', default: process.cwd() },
      version: { type: 'string' },
      'core-version': { type: 'string' },
      'release-sha': { type: 'string' },
      online: { type: 'boolean', default: false },
      out: { type: 'string' },
    },
  })
  if (!values.version) {
    console.error(
      'usage: check-release-pairing --version <v> [--ui-root <path>] [--online --release-sha <sha>]',
    )
    process.exitCode = 2
    return
  }
  const uiRoot = path.resolve(values['ui-root']!)
  const result = values.online
    ? evaluatePairing({
        uiRoot,
        uiVersion: values.version,
        ...(values['core-version']
          ? { coreVersion: values['core-version'] }
          : {}),
        uiCommit: values['release-sha'] ?? '',
      })
    : evaluateStatic({
        uiRoot,
        uiVersion: values.version,
        ...(values['core-version']
          ? { coreVersion: values['core-version'] }
          : {}),
      })

  for (const error of result.errors) console.error(pc.red(error))
  if (result.ok) {
    console.log(
      pc.green(
        `UI release pairing ${values.version} passed (${result.channel}${values.online ? ', online' : ', static'})`,
      ),
    )
  } else {
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
