import type { ReleaseChannel } from '../../release/channel'
/**
 * Immutable Core/UI pairing for a Zeus UI release.
 *
 * A UI version string is not evidence that the release was built against the
 * approved Zeus Core candidate: anyone can type `0.2.0-rc.0` into a dispatch
 * form. A release is only publishable when a pairing record committed for that
 * exact version names the exact Core commit, and that commit is what the Core
 * release tag resolves to.
 *
 * The record lives at `release-pairing/<version>.json` and is read from the git
 * object database at the release SHA, so a file written after checkout cannot
 * satisfy the gate. Everything else is re-derived:
 *
 *   - the UI commit is the release SHA the workflow dispatched on;
 *   - the Core commit is the record, and `v<coreVersion>` must resolve to it;
 *   - every `@zeus-js/*` pin in the checkout must equal `coreVersion`.
 *
 * Beta is the pre-contract development channel and has no record; `rc` and
 * `latest` require one.
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

export const RELEASE_PAIRING_SCHEMA = 'zeus-ui.release-pairing/v1'
export const RELEASE_PAIRING_DIRECTORY = 'release-pairing'

const FULL_SHA = /^[0-9a-f]{40}$/i
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9a-z]+(?:[.-][0-9a-z]+)*)?$/i
const CHANNELS: readonly ReleaseChannel[] = ['latest', 'rc', 'beta', 'canary']

/**
 * Core packages that are deliberately versioned outside the fixed release
 * group, mirroring `INDEPENDENT_PACKAGE_VERSIONS` in the UI baseline check.
 * Every other `@zeus-js/*` pin must equal the paired Core version exactly.
 */
export const INDEPENDENT_CORE_PINS: Readonly<Record<string, string>> = {
  '@zeus-js/vite-plugin': '0.0.5',
}

export interface ReleasePairingRecord {
  readonly schema: typeof RELEASE_PAIRING_SCHEMA
  readonly uiVersion: string
  readonly uiCommit: string
  readonly coreVersion: string
  readonly coreCommit: string
  readonly channel: ReleaseChannel
}

export interface ReleasePairingInput {
  readonly uiRoot: string
  readonly uiVersion: string
  readonly uiCommit: string
  /** Defaults to `uiVersion`: Core and UI release on one version line. */
  readonly coreVersion?: string
  /** When given it must equal the pairing record, never replace it. */
  readonly coreCommit?: string
  /** Resolves the commit a Core release tag points at. */
  readonly resolveCoreTag?: (coreVersion: string) => string | undefined
  /** Reads the pairing record. Defaults to git at `uiCommit`. */
  readonly readPairing?: (uiVersion: string) => string | undefined
  /** Lists every `@zeus-js/*` pin in the UI workspace. */
  readonly listCorePins?: (root: string) => Array<{
    file: string
    name: string
    version: string
  }>
  /** Overrides the channel rule; beta releases may skip the record. */
  readonly requirePairing?: boolean
}

export interface ReleasePairingResult {
  readonly ok: boolean
  readonly channel?: ReleaseChannel
  readonly record?: ReleasePairingRecord
  readonly errors: readonly string[]
}

export function pairingPath(uiVersion: string): string {
  return `${RELEASE_PAIRING_DIRECTORY}/${uiVersion}.json`
}

export function evaluateReleasePairing(
  input: ReleasePairingInput,
): ReleasePairingResult {
  const errors: string[] = []
  const channelResult = resolveChannel(input.uiVersion)

  if (channelResult.errors.length > 0) {
    return { ok: false, errors: [...channelResult.errors] }
  }

  const channel = channelResult.channel!
  const coreVersion = input.coreVersion ?? input.uiVersion
  const requirePairing = input.requirePairing ?? channel !== 'beta'

  if (!FULL_SHA.test(input.uiCommit)) {
    errors.push('release SHA must be a full 40-character UI commit SHA')
  }
  if (coreVersion !== input.uiVersion) {
    errors.push(
      `Core version ${coreVersion} must equal the UI version ${input.uiVersion}; Zeus Core and Zeus UI release on one version line`,
    )
  }

  const rawPairing = input.readPairing
    ? input.readPairing(input.uiVersion)
    : readPairingFromGit(input.uiRoot, input.uiCommit, input.uiVersion)

  if (rawPairing === undefined) {
    if (requirePairing) {
      errors.push(
        `Missing ${pairingPath(input.uiVersion)} at ${input.uiCommit.slice(0, 12)}; commit the Core/UI pairing record before publishing ${input.uiVersion}`,
      )
    }
    return { ok: errors.length === 0, channel, errors }
  }

  const record = parsePairingRecord(rawPairing, errors)
  if (!record) return { ok: false, channel, errors }

  if (record.uiVersion !== input.uiVersion) {
    errors.push(
      `Pairing record uiVersion ${record.uiVersion} != release version ${input.uiVersion}`,
    )
  }
  if (record.uiCommit.toLowerCase() !== input.uiCommit.toLowerCase()) {
    errors.push(
      `Pairing record uiCommit ${record.uiCommit} != release commit ${input.uiCommit}`,
    )
  }
  if (record.coreVersion !== coreVersion) {
    errors.push(
      `Pairing record coreVersion ${record.coreVersion} != expected Core version ${coreVersion}`,
    )
  }
  if (
    input.coreCommit !== undefined &&
    record.coreCommit.toLowerCase() !== input.coreCommit.toLowerCase()
  ) {
    errors.push(
      `Pairing record coreCommit ${record.coreCommit} != requested Core commit ${input.coreCommit}`,
    )
  }
  if (record.channel !== channel) {
    errors.push(
      `Pairing record channel ${record.channel} != channel ${channel} derived from ${input.uiVersion}`,
    )
  }

  const resolveCoreTag =
    input.resolveCoreTag ?? (tag => readCoreTagFromGitHub(tag))

  const tagCommit = resolveCoreTag(record.coreVersion)
  if (tagCommit === undefined) {
    errors.push(
      `Core tag v${record.coreVersion} cannot be resolved; the paired Core release does not exist`,
    )
  } else if (!FULL_SHA.test(tagCommit)) {
    errors.push(`Core tag v${record.coreVersion} returned an invalid commit`)
  } else if (tagCommit.toLowerCase() !== record.coreCommit.toLowerCase()) {
    errors.push(
      `Core tag v${record.coreVersion} points at ${tagCommit}, not the paired commit ${record.coreCommit}`,
    )
  }

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
    if (pin.version !== record.coreVersion) {
      errors.push(
        `${pin.file}: ${pin.name} ${pin.version} != paired Core version ${record.coreVersion}`,
      )
    }
  }

  return {
    ok: errors.length === 0,
    channel,
    record,
    errors,
  }
}

function parsePairingRecord(
  raw: string,
  errors: string[],
): ReleasePairingRecord | undefined {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (error) {
    errors.push(
      `Pairing record is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
    return undefined
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('Pairing record must be a JSON object')
    return undefined
  }

  const record = value as Partial<ReleasePairingRecord>
  const typeErrors: string[] = []
  if (record.schema !== RELEASE_PAIRING_SCHEMA) {
    typeErrors.push(`Pairing record schema must be ${RELEASE_PAIRING_SCHEMA}`)
  }
  if (
    typeof record.uiVersion !== 'string' ||
    !EXACT_VERSION.test(record.uiVersion)
  ) {
    typeErrors.push('Pairing record uiVersion must be an exact version')
  }
  if (typeof record.uiCommit !== 'string' || !FULL_SHA.test(record.uiCommit)) {
    typeErrors.push('Pairing record uiCommit must be a full 40-character SHA')
  }
  if (
    typeof record.coreVersion !== 'string' ||
    !EXACT_VERSION.test(record.coreVersion)
  ) {
    typeErrors.push('Pairing record coreVersion must be an exact version')
  }
  if (
    typeof record.coreCommit !== 'string' ||
    !FULL_SHA.test(record.coreCommit)
  ) {
    typeErrors.push('Pairing record coreCommit must be a full 40-character SHA')
  }
  if (
    typeof record.channel !== 'string' ||
    !CHANNELS.includes(record.channel as ReleaseChannel)
  ) {
    typeErrors.push('Pairing record channel must be a known release channel')
  }

  errors.push(...typeErrors)
  // A record that failed the shape check must not be compared field by field:
  // every comparison below assumes the typed fields exist.
  return typeErrors.length === 0 ? (record as ReleasePairingRecord) : undefined
}

/**
 * Reads the record from git at the release commit. `git cat-file` fails for a
 * path outside the tree, which is exactly the case the gate must reject.
 */
function readPairingFromGit(
  uiRoot: string,
  commit: string,
  uiVersion: string,
): string | undefined {
  if (!FULL_SHA.test(commit)) return undefined
  try {
    return execFileSync(
      'git',
      ['-C', uiRoot, 'cat-file', 'blob', `${commit}:${pairingPath(uiVersion)}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
  } catch {
    return undefined
  }
}

/**
 * Resolves a tag to its commit through the commits endpoint, which peels
 * annotated tags and rejects a branch, short SHA or missing tag.
 */
function readCoreTagFromGitHub(coreVersion: string): string | undefined {
  try {
    const output = execFileSync(
      'gh',
      ['api', `repos/baicie/zeus/commits/v${coreVersion}`, '--jq', '.sha'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim()
    return FULL_SHA.test(output) ? output : undefined
  } catch {
    return undefined
  }
}

export function listCorePins(
  root: string,
): Array<{ file: string; name: string; version: string }> {
  const pins: Array<{ file: string; name: string; version: string }> = []
  const manifests = [
    path.join(root, 'package.json'),
    ...packageJsonFiles(path.join(root, 'packages')),
    ...packageJsonFiles(path.join(root, 'examples')),
  ]

  for (const file of manifests) {
    if (!existsSync(file)) continue
    let manifest: Record<string, unknown>
    try {
      manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<
        string,
        unknown
      >
    } catch {
      continue
    }
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ] as const) {
      const dependencies = manifest[field]
      if (!dependencies || typeof dependencies !== 'object') continue
      for (const [name, version] of Object.entries(
        dependencies as Record<string, unknown>,
      )) {
        if (!name.startsWith('@zeus-js/')) continue
        pins.push({
          file: path.relative(root, file).split(path.sep).join('/'),
          name,
          version: String(version),
        })
      }
    }
  }

  return pins.sort((a, b) =>
    `${a.file}:${a.name}`.localeCompare(`${b.file}:${b.name}`),
  )
}

function packageJsonFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...packageJsonFiles(absolute))
    else if (entry.isFile() && entry.name === 'package.json')
      files.push(absolute)
  }
  return files
}

function main(): void {
  const { values } = parseArgs({
    options: {
      'ui-root': { type: 'string', default: process.cwd() },
      version: { type: 'string' },
      'core-version': { type: 'string' },
      'core-commit': { type: 'string' },
      'release-sha': { type: 'string' },
      'allow-missing-pairing': { type: 'boolean', default: false },
      out: { type: 'string' },
    },
  })

  for (const key of ['version', 'release-sha'] as const) {
    if (!values[key]) throw new Error(`--${key} is required`)
  }

  const result = evaluateReleasePairing({
    uiRoot: path.resolve(values['ui-root']!),
    uiVersion: values.version!,
    uiCommit: values['release-sha']!,
    ...(values['core-version'] ? { coreVersion: values['core-version'] } : {}),
    ...(values['core-commit'] ? { coreCommit: values['core-commit'] } : {}),
    ...(values['allow-missing-pairing'] ? { requirePairing: false } : {}),
  })

  if (values.out) {
    const output = path.resolve(values.out)
    mkdirSync(path.dirname(output), { recursive: true })
    writeFileSync(
      output,
      `${JSON.stringify(
        {
          schema: 'zeus-ui.release-pairing-check/v1',
          uiVersion: values.version,
          uiCommit: values['release-sha'],
          coreVersion: result.record?.coreVersion ?? values['core-version'],
          coreCommit: result.record?.coreCommit ?? values['core-commit'],
          ...result,
        },
        null,
        2,
      )}\n`,
    )
  }

  for (const error of result.errors) console.error(pc.red(`BLOCKER ${error}`))
  console.log(
    `${result.ok ? 'PASS' : 'FAIL'} release pairing: UI ${values.version}@${values['release-sha']!.slice(0, 12)} <-> Core ${result.record?.coreVersion ?? values['core-version'] ?? 'unresolved'}@${(result.record?.coreCommit ?? values['core-commit'] ?? 'unresolved').slice(0, 12)}`,
  )
  if (!result.ok) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
