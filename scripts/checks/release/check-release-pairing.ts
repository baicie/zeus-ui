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
import { planPairing } from '../../release/release-protocol'

/**
 * The shape of **Core's** record, which is the authority.
 *
 * Deliberately not the same schema as anything in the UI repository: the UI no
 * longer keeps a record, and a shared schema would invite one back.
 */
export const CORE_PAIRING_SCHEMA = 'zeus.release-pairing/v1'
/**
 * Where a Core tag keeps its pairing record, in the order to try.
 *
 * Core moved the directory to `meta/release/pairing` and the tags created
 * before that move still carry `release-pairing`, and a tag cannot be edited.
 * Core's own reader (`TAGGED_RECORD_PATHS` in `pair-attestation.ts`) lists
 * both for this reason. This checker only knew the old path, so every record
 * written after the move read as missing.
 */
export const CORE_PAIRING_DIRECTORIES = [
  'meta/release/pairing',
  'release-pairing',
] as const

/** Kept for the callers that name a single directory. */
export const CORE_PAIRING_DIRECTORY = CORE_PAIRING_DIRECTORIES[0]
/**
 * The schema of the attestation that supplies a pair for a bootstrap release.
 *
 * Defined in Core at `scripts/release/pair-attestation.ts`; duplicated here
 * because the UI must refuse a payload it does not recognise, and reading the
 * constant from Core would make a Core-side typo silently accept anything.
 */
export const PAIR_ATTESTATION_SCHEMA = 'zeus.pair-attestation/v1'

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
  /**
   * The paired UI commit, or `null` when the release published unpaired.
   *
   * `null` is not a missing value: it states that the tag was created before
   * any UI commit could exist, which is what a new version line's first RC
   * does. Such a record is only complete together with a pair attestation.
   */
  readonly uiCommit: string | null
  readonly uiVersion: string
  readonly verifiedAt: string
  readonly firstPublish?: readonly string[]
  /** The record declared it published unpaired. */
  readonly bootstrap?: boolean
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
  /**
   * Resolves `pair/v<coreVersion>` on Core to a commit, or `undefined`.
   *
   * Separate from `resolveCoreTag` because the two are different tags in
   * different namespaces, and a bootstrap release needs both: the release tag
   * to prove what was published, the pair tag to prove who it was paired with.
   */
  readonly resolvePairTag?: (tag: string) => string | undefined
  /** Reads a file from a Core commit. */
  readonly readCoreFile?: (commit: string, file: string) => string | undefined
}

export interface PairingResult {
  readonly ok: boolean
  readonly channel?: ReleaseChannel
  readonly record?: CorePairingRecord
  /**
   * The Core tag this release must resolve, `v<coreVersion>`.
   *
   * Carried on the result because the report needs it: v1 built the report
   * from the version alone, so every consumer re-derived the tag and one of
   * them derived it from the *UI* version.
   */
  readonly coreTag?: string
  /**
   * The Core commit the pair was verified against.
   *
   * Only an online run can know this. It is on the result rather than passed
   * separately to the report builder because v1 lost it in exactly that gap:
   * the runner resolved the tag, the report was built without it, and the
   * workflow then refused a report that "carries no coreCommit".
   */
  readonly coreCommit?: string
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

  /*
   * The two repositories release on separate version lines, so the pairing
   * contract is "the UI names the Core it was verified against", not "the two
   * strings are equal". `planPairing` owns that rule; see
   * `scripts/release/release-protocol.ts` for why v1's equality requirement
   * rejected every real release.
   *
   * `coreVersion` is required here. It used to default to `uiVersion`, which
   * made a caller that forgot it silently assert the lines were the same.
   */
  const plan = planPairing({
    uiVersion: input.uiVersion,
    coreVersion: input.coreVersion ?? '',
    uiCommit: null,
    coreCommit: null,
  })
  errors.push(...plan.errors.filter(e => !errors.includes(e)))
  const coreVersion = input.coreVersion

  if (!EXACT_VERSION.test(input.uiVersion)) {
    const message = `UI version ${input.uiVersion} is not an exact version`
    if (!errors.includes(message)) errors.push(message)
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

    /*
     * No Core version means `planPairing` already refused the release; a
     * comparison against `undefined` would add one identical error per pin and
     * bury that one.
     */
    if (coreVersion === undefined) {
      continue
    }

    if (pin.version !== coreVersion) {
      errors.push(
        `${pin.file}: ${pin.name} ${pin.version} != paired Core version ${coreVersion}`,
      )
    }
  }

  return {
    ok: errors.length === 0,
    channel,
    ...(plan.coreTag ? { coreTag: plan.coreTag } : {}),
    errors,
  }
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

  /*
   * No `?? input.uiVersion` fallback: the Core version is its own input, and
   * defaulting it to the UI version is what sent v1's dispatch looking for a
   * Core tag named after the UI release.
   */
  const coreVersion = input.coreVersion

  if (coreVersion === undefined) {
    return { ok: false, channel, errors }
  }

  const requirePairing = input.requirePairing ?? channel !== 'beta'
  const coreTag = `v${coreVersion}`

  if (!FULL_SHA.test(input.uiCommit)) {
    errors.push('release SHA must be a full 40-character UI commit SHA')
  }

  if (!requirePairing) {
    /*
     * Beta does not need a cross-repository pairing record, but publishing a
     * consumer requires the Core release itself to be immutable and real.
     * Resolve the Core tag independently of the UI version and carry its SHA
     * into the report. The workflow's later verification must not be able to
     * mistake a pin-only static check for an immutable release binding.
     */
    const resolveCoreTag = input.resolveCoreTag ?? resolveCoreTagOnGitHub
    const coreCommit = resolveCoreTag(coreTag)
    if (coreCommit === undefined || !FULL_SHA.test(coreCommit)) {
      errors.push(
        `Core tag ${coreTag} cannot be resolved to a 40-character commit; a beta release must consume an immutable published Core release`,
      )
      return { ok: false, channel, coreTag, errors }
    }
    return {
      ok: errors.length === 0,
      channel,
      coreTag,
      coreCommit,
      errors,
    }
  }

  const resolveCoreTag = input.resolveCoreTag ?? resolveCoreTagOnGitHub
  const tagCommit = resolveCoreTag(coreTag)
  if (tagCommit === undefined) {
    errors.push(
      `Core tag v${coreVersion} cannot be resolved; the paired Core release does not exist or GitHub could not be reached`,
    )
    return { ok: false, channel, errors }
  }
  if (!FULL_SHA.test(tagCommit)) {
    errors.push(`Core tag v${coreVersion} did not resolve to a commit`)
    return { ok: false, channel, coreTag, errors }
  }

  /*
   * The record is read **from the tagged commit**, not from the UI checkout and
   * not from a branch. A record that only exists on `main` after the tag says
   * nothing about what was released.
   */
  const readCoreFile = input.readCoreFile ?? readCoreFileAtCommit
  let raw: string | undefined
  let recordPath = ''

  /*
   * Both directories, newest first. The tags created before the move carry
   * the old one permanently, so a single-path read makes one half of the
   * published history unreadable.
   */
  for (const directory of CORE_PAIRING_DIRECTORIES) {
    const candidate = `${directory}/v${coreVersion}.json`
    const contents = readCoreFile(tagCommit, candidate)

    if (contents !== undefined) {
      raw = contents
      recordPath = candidate
      break
    }
  }

  if (raw === undefined) {
    errors.push(
      `Core tag v${coreVersion} points at ${tagCommit}, which has no ${CORE_PAIRING_DIRECTORIES.map(d => `${d}/v${coreVersion}.json`).join(' or ')}`,
    )
    return { ok: false, channel, coreTag, errors }
  }

  const parsed = parseCorePairingRecord(raw, errors)
  if (!parsed) return { ok: false, channel, coreTag, errors }

  /*
   * A bootstrap release published before any UI commit existed, so the record
   * inside its tag names `uiCommit: null` — and that tag cannot move. Reading
   * only this file would make every bootstrap release permanently unpairable.
   *
   * The pair is therefore established afterwards, by a protected `pair/v…`
   * tag pointing at a commit that attests the same Core commit plus the UI
   * candidate. The attestation is read here, and it is *required* to agree
   * with the tagged record on everything both of them state.
   */
  if (parsed.uiCommit === null) {
    return evaluateBootstrapPairing({
      input,
      coreVersion,
      tagCommit,
      channel,
      errors,
      record: parsed,
    })
  }

  if (parsed.coreVersion !== coreVersion) {
    errors.push(
      `Core record ${recordPath} coreVersion ${parsed.coreVersion} != expected ${coreVersion}`,
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
    coreTag,
    coreCommit: tagCommit,
    record: parsed,
    errors,
  }
}

/**
 * The pair for a release whose Core tag published unpaired.
 *
 * ## Why this is a separate path rather than a fallback
 *
 * A bootstrap release cannot name a UI commit: the UI lockfile resolves only
 * after those packages are on the registry, and the record has to be inside
 * the tagged commit. So the tag is permanent and says `uiCommit: null`, and
 * the pair is recorded afterwards under a protected `pair/v<version>` tag that
 * names the same Core commit plus a UI candidate.
 *
 * ## What is checked
 *
 * The attestation is not trusted for anything the caller can establish:
 *
 * - its `coreCommit` must equal the commit `v<version>` resolves to, so a pair
 *   cannot describe a Core tree that was never published under this version;
 * - its `uiCommit` must equal the release's commit, so the pair cannot name a
 *   candidate other than the one being released;
 * - its version fields must agree with the release;
 * - it must be read from the commit the `pair/v<version>` tag points at, not
 *   from a branch, so a later edit to `main` changes nothing about it.
 *
 * Every one of those failing is a refusal. There is no partial credit: a pair
 * that half-matches describes two different things.
 */
function evaluateBootstrapPairing(args: {
  input: OnlinePairingInput
  coreVersion: string
  tagCommit: string
  channel: ReleaseChannel
  errors: string[]
  record: CorePairingRecord
}): PairingResult {
  const { input, coreVersion, tagCommit, channel, errors, record } = args

  const resolvePairTag =
    input.resolvePairTag ?? (tag => resolveCoreTagOnGitHub(tag))
  const pairTag = `pair/v${coreVersion}`
  const pairCommit = resolvePairTag(pairTag)
  if (pairCommit === undefined) {
    errors.push(
      `Core tag v${coreVersion} published unpaired, and no ${pairTag} attestation exists; the pair was never recorded, so this release cannot claim it`,
    )
    return {
      ok: false,
      channel,
      coreTag: `v${coreVersion}`,
      coreCommit: tagCommit,
      record,
      errors,
    }
  }
  if (!FULL_SHA.test(pairCommit)) {
    errors.push(`${pairTag} did not resolve to a commit`)
    return {
      ok: false,
      channel,
      coreTag: `v${coreVersion}`,
      coreCommit: tagCommit,
      record,
      errors,
    }
  }

  const readCoreFile = input.readCoreFile ?? readCoreFileAtCommit
  const attestationPath = `release-pairing/attestations/v${coreVersion}.json`
  const raw = readCoreFile(pairCommit, attestationPath)
  if (raw === undefined) {
    errors.push(
      `${pairTag} points at ${pairCommit}, which has no ${attestationPath}`,
    )
    return {
      ok: false,
      channel,
      coreTag: `v${coreVersion}`,
      coreCommit: tagCommit,
      record,
      errors,
    }
  }

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (error) {
    errors.push(
      `pair attestation is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
    return {
      ok: false,
      channel,
      coreTag: `v${coreVersion}`,
      coreCommit: tagCommit,
      record,
      errors,
    }
  }
  if (!isPlainObject(value)) {
    errors.push('pair attestation must be a JSON object')
    return {
      ok: false,
      channel,
      coreTag: `v${coreVersion}`,
      coreCommit: tagCommit,
      record,
      errors,
    }
  }

  if (value.schema !== PAIR_ATTESTATION_SCHEMA) {
    errors.push(`pair attestation schema must be ${PAIR_ATTESTATION_SCHEMA}`)
  }
  if (value.releaseTag !== `v${coreVersion}`) {
    errors.push(
      `pair attestation releaseTag ${String(value.releaseTag)} != v${coreVersion}`,
    )
  }

  /*
   * The comparison that makes this a pair. Core published at `tagCommit`; the
   * attestation must name that exact commit. Anything else pairs the UI with a
   * Core tree that this version never published.
   */
  const attestedCore =
    typeof value.coreCommit === 'string' ? value.coreCommit : ''
  if (attestedCore.toLowerCase() !== tagCommit.toLowerCase()) {
    errors.push(
      `pair attestation names Core commit ${attestedCore || '(missing)'}, but v${coreVersion} points at ${tagCommit}`,
    )
  }

  const attestedUi = typeof value.uiCommit === 'string' ? value.uiCommit : ''
  if (!FULL_SHA.test(attestedUi)) {
    errors.push('pair attestation uiCommit is not a full 40-character SHA')
  } else if (attestedUi.toLowerCase() !== input.uiCommit.toLowerCase()) {
    errors.push(
      `pair attestation names UI commit ${attestedUi}, but this release is ${input.uiCommit}`,
    )
  }

  if (value.coreVersion !== coreVersion) {
    errors.push(
      `pair attestation coreVersion ${String(value.coreVersion)} != ${coreVersion}`,
    )
  }
  if (value.uiVersion !== input.uiVersion) {
    errors.push(
      `pair attestation uiVersion ${String(value.uiVersion)} != release version ${input.uiVersion}`,
    )
  }
  /*
   * The tagged record and the attestation both describe this release, so they
   * must agree on the one fact they share beyond the version: that it was
   * published unpaired. An attestation claiming `bootstrap: false` describes a
   * release whose tag carries a pair — which this tag does not.
   */
  if (value.bootstrap !== true) {
    errors.push(
      'pair attestation must record bootstrap: true, because the release tag it pairs with published unpaired',
    )
  }

  return {
    ok: errors.length === 0,
    channel,
    coreTag: `v${coreVersion}`,
    coreCommit: tagCommit,
    record: {
      ...record,
      uiCommit: attestedUi,
    },
    errors,
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  /*
   * `uiCommit` is either a full SHA or `null`.
   *
   * `null` means the tag published unpaired, which is legal only for a new
   * version line's first RC and only when the record says `bootstrap: true`.
   * Accepting `null` here without that flag would turn "the field is missing"
   * into "the release is paired" — the ambiguity the flag exists to remove.
   */
  const bootstrapDeclared = record.bootstrap === true
  if (record.uiCommit === null) {
    if (!bootstrapDeclared) {
      typeErrors.push(
        'Core pairing record uiCommit is null but the record does not declare bootstrap',
      )
    }
  } else if (
    typeof record.uiCommit !== 'string' ||
    !FULL_SHA.test(record.uiCommit)
  ) {
    typeErrors.push(
      'Core pairing record uiCommit must be a full 40-character SHA, or null on a bootstrap record',
    )
  }
  if (bootstrapDeclared && typeof record.uiCommit === 'string') {
    typeErrors.push(
      'Core pairing record declares bootstrap but also names a UI commit; a release is paired or unpaired, never both',
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

/**
 * The report a release uploads as evidence.
 *
 * ## Why it is a separate artifact from the exit code
 *
 * The workflows upload `release-pairing.json` with `if-no-files-found: error`,
 * so the file is a hard requirement — but before this existed, nothing wrote
 * it. The `--out` flag was accepted and ignored, which meant the upload step
 * failed after every check had passed, or (worse, if the flag had been
 * dropped) an artifact from an earlier run could be what got preserved.
 *
 * ## What makes it evidence rather than a log
 *
 * It records the mode it ran in and refuses to be read as the other one. A
 * static pass and an online pass answer different questions — "the pins agree"
 * versus "the pair was proven against an immutable tag" — and a reader who
 * cannot tell which they are holding has no way to know whether the pair was
 * ever checked.
 *
 * It is written on failure too. A refusal that leaves no record is a refusal
 * nobody can diagnose, and the recovery path for a half-published release
 * depends on knowing exactly which clause failed.
 */
export const PAIRING_REPORT_SCHEMA = 'zeus.ui-pairing-report/v1'

export interface PairingReport {
  readonly schema: typeof PAIRING_REPORT_SCHEMA
  /** `static` answers offline questions only; `online` adds the pair. */
  readonly mode: 'static' | 'online'
  readonly version: string
  readonly channel: ReleaseChannel | null
  readonly ok: boolean
  readonly errors: readonly string[]
  readonly verifiedAt: string
  /** Everything below is `null` in static mode, by construction. */
  readonly coreTag: string | null
  readonly coreTagCommit: string | null
  readonly pairTag: string | null
  readonly pairTagCommit: string | null
  readonly coreCommit: string | null
  readonly uiCommit: string | null
}

export interface WritePairingReportInput {
  readonly result: PairingResult
  readonly mode: 'static' | 'online'
  /** The UI version being released. */
  readonly version: string
  /** The Core version this UI release was verified against. */
  readonly coreVersion?: string
  /** Explicit Core tag override; defaults to the result's `coreTag`. */
  readonly coreTag?: string
  readonly uiCommit?: string
  readonly coreTagCommit?: string
  readonly pairTagCommit?: string
  readonly coreCommit?: string
}

export function buildPairingReport(
  input: WritePairingReportInput,
): PairingReport {
  const online = input.mode === 'online'
  return {
    schema: PAIRING_REPORT_SCHEMA,
    mode: input.mode,
    version: input.version,
    channel: input.result.channel ?? null,
    ok: input.result.ok,
    errors: [...input.result.errors],
    verifiedAt: new Date().toISOString(),
    /*
     * `coreTag` is named in both modes because it is the tag whose immutability
     * the pair depends on. The rest are online-only: a static run has not read
     * any of them, and emitting a placeholder would let a reader mistake "not
     * looked up" for "looked up and empty".
     */
    /*
     * The report states the Core tag from the *result*, not from the release
     * version. v1 wrote `v${input.version}`, where `version` is the UI
     * version, so the report named a Core tag that cannot exist whenever the
     * two version lines differ.
     */
    coreTag: input.result.coreTag ?? input.coreTag ?? null,
    coreTagCommit: online
      ? (input.coreTagCommit ?? input.result.coreCommit ?? null)
      : null,
    pairTag:
      input.result.channel === 'beta'
        ? null
        : input.result.coreTag
          ? `pair/${input.result.coreTag}`
          : online && input.coreVersion
            ? `pair/v${input.coreVersion}`
            : null,
    pairTagCommit: online ? (input.pairTagCommit ?? null) : null,
    /*
     * Carried on the result by the runner that resolved it. This is the field
     * the release workflow refuses to proceed without, and v1 dropped it here
     * because the report was built from the version string alone.
     */
    coreCommit: online
      ? (input.coreCommit ??
        input.result.coreCommit ??
        input.coreTagCommit ??
        null)
      : null,
    uiCommit: online ? (input.uiCommit ?? null) : null,
  }
}

/**
 * Writes the report, returning the path.
 *
 * Failure to write is not swallowed: the workflow's next step requires the
 * file, and a run that silently skipped writing it would surface as a missing
 * artifact far from the cause.
 */
export function writePairingReport(
  file: string,
  report: PairingReport,
): string {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`)
  return file
}

/**
 * The publish dispatch carries a Core SHA. Compare it with the commit just
 * resolved from the immutable Core tag, never trust the dispatch value as the
 * source of truth. A syntactically valid but unrelated SHA must fail before
 * any package is published.
 */
export function compareExpectedCoreCommit(
  result: PairingResult,
  expectedCommit: string,
): PairingResult {
  const errors = [...result.errors]
  if (!FULL_SHA.test(expectedCommit)) {
    errors.push('expected Core commit must be a full 40-character SHA')
  } else if (
    !result.coreCommit ||
    result.coreCommit.toLowerCase() !== expectedCommit.toLowerCase()
  ) {
    errors.push(
      `verified Core commit ${result.coreCommit ?? '(missing)'} does not match publish dispatch ${expectedCommit}`,
    )
  }
  return {
    ...result,
    ok: result.ok && errors.length === 0,
    errors,
  }
}

function main(): void {
  const { values } = parseArgs({
    options: {
      'ui-root': { type: 'string', default: process.cwd() },
      version: { type: 'string' },
      'core-version': { type: 'string' },
      'expected-core-commit': { type: 'string' },
      'release-sha': { type: 'string' },
      online: { type: 'boolean', default: false },
      out: { type: 'string' },
    },
  })
  if (!values.version) {
    console.error(
      'usage: check-release-pairing --version <v> [--ui-root <path>] [--online --release-sha <sha>] [--out <file>]',
    )
    process.exitCode = 2
    return
  }
  if (values.online && !values['release-sha']) {
    /*
     * An online run without the release SHA cannot compare anything: every
     * commit-comparison would be against the empty string, and a record that
     * disagrees with `''` produces a confusing message. Refusing here names the
     * omission instead.
     */
    console.error('usage: --online requires --release-sha <40-character SHA>')
    process.exitCode = 2
    return
  }

  if (values['expected-core-commit'] !== undefined && !values.online) {
    console.error('--expected-core-commit requires --online')
    process.exitCode = 2
    return
  }

  const uiRoot = path.resolve(values['ui-root']!)
  const evaluated = values.online
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

  const result =
    values['expected-core-commit'] === undefined
      ? evaluated
      : compareExpectedCoreCommit(evaluated, values['expected-core-commit'])

  for (const error of result.errors) console.error(pc.red(error))

  if (values.out) {
    /*
     * Written before the exit code is decided, so a failing run still leaves
     * the evidence its recovery depends on.
     */
    const report = buildPairingReport({
      result,
      mode: values.online ? 'online' : 'static',
      version: values.version,
      /*
       * The Core version travels with the report. v1 omitted it, so the report
       * builder fell back to the *UI* version for the Core tag and the
       * workflow then rejected the report for carrying no coreCommit.
       *
       * `coreCommit` is not passed here: `evaluatePairing` resolved it and put
       * it on the result, which is the single place it can come from without
       * the caller re-deriving it.
       */
      ...(values['core-version']
        ? { coreVersion: values['core-version'] }
        : {}),
      ...(values.online && values['release-sha']
        ? { uiCommit: values['release-sha'] }
        : {}),
    })
    writePairingReport(values.out, report)
    console.log(pc.dim(`wrote ${values.out} (${report.mode}, ok=${report.ok})`))
  }

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
