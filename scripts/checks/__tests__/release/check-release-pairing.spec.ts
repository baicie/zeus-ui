import type { OnlinePairingInput } from '../../release/check-release-pairing'
/**
 * The Core-anchored pairing protocol, tested against real git commits.
 *
 * ## Why these use a real repository
 *
 * The previous protocol's tests all passed while the protocol was impossible to
 * satisfy. Every case supplied its own `uiCommit` and its own record, so the
 * self-reference — a commit writing its own SHA into itself — could not appear.
 * Mocking the inputs is exactly what hid the defect.
 *
 * So the constructibility test builds two throwaway git repositories, commits a
 * UI candidate, then commits Core's record naming that candidate's real SHA,
 * and asks the checker whether the pair verifies. If the protocol cannot be
 * constructed that way, the test fails.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'

import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import {
  buildPairingReport,
  compareExpectedCoreCommit,
  CORE_PAIRING_SCHEMA,
  evaluatePairing,
  evaluateStatic,
  listCorePins,
} from '../../release/check-release-pairing'

const VERSION = '0.2.0-rc.0'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function temporary(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  roots.push(directory)
  return directory
}

/** A UI tree with one package pinning Core at `version`. */
function uiTree(version = VERSION, pins: Record<string, string> = {}): string {
  const root = temporary('zeus-ui-pairing-')
  fs.mkdirSync(path.join(root, 'packages/primitives/button'), {
    recursive: true,
  })
  fs.writeFileSync(
    path.join(root, 'packages/primitives/button/package.json'),
    `${JSON.stringify(
      {
        name: '@zeus-web/button',
        version,
        dependencies: {
          '@zeus-js/runtime-dom': version,
          '@zeus-js/vite-plugin': '0.0.5',
          ...pins,
        },
        peerDependencies: { '@zeus-js/zeus': version },
      },
      null,
      2,
    )}\n`,
  )
  return root
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function initRepo(directory: string): void {
  git(directory, ['init', '-q'])
  git(directory, ['config', 'user.email', 'test@example.com'])
  git(directory, ['config', 'user.name', 'test'])
}

function coreRecord(overrides: Record<string, unknown> = {}): string {
  return `${JSON.stringify(
    {
      schema: CORE_PAIRING_SCHEMA,
      coreVersion: VERSION,
      uiCommit: 'a'.repeat(40),
      uiVersion: VERSION,
      verifiedAt: '2026-11-16T00:00:00.000Z',
      ...overrides,
    },
    null,
    2,
  )}\n`
}

/** A full online input with the network replaced by explicit answers. */
function onlineInput(
  overrides: Partial<OnlinePairingInput> = {},
): OnlinePairingInput {
  const uiCommit = 'c'.repeat(40)
  return {
    uiRoot: uiTree(),
    uiVersion: VERSION,
    /*
     * Required since Protocol v2: the Core version is its own input and is
     * never defaulted from the UI version. Here the two coincide, which v2
     * allows.
     */
    coreVersion: VERSION,
    uiCommit,
    resolveCoreTag: () => 'd'.repeat(40),
    /*
     * No amendment by default. Without this, the amendment lookup falls back to
     * the real GitHub resolver and the test blocks on a network call — which
     * timed out on Windows and only there, because the machine happened to have
     * a `gh` that waited.
     */
    resolvePairTag: () => undefined,
    readCoreFile: () => coreRecord({ uiCommit }),
    ...overrides,
  }
}

/*
 * The half that runs in a pull request. It must not need a Core tag, because
 * the tag does not exist until after the Core release, which is after this PR.
 */
describe('static checks need no network', () => {
  it('passes a tree whose pins match the version line', () => {
    const result = evaluateStatic({
      uiRoot: uiTree(),
      uiVersion: VERSION,
      coreVersion: VERSION,
    })
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.channel).toBe('rc')
  })

  it('fails a pinned package at the wrong version, without asking GitHub', () => {
    const result = evaluateStatic({
      uiRoot: uiTree(VERSION, { '@zeus-js/router': '0.1.1-beta.20' }),
      uiVersion: VERSION,
      coreVersion: VERSION,
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/@zeus-js\/router/)
  })

  /*
   * Protocol v2 reversed this assertion.
   *
   * v1 required `coreVersion === uiVersion` and this test pinned that as
   * correct. Core and UI are separate version lines — Core is 0.2.0-rc.5, UI
   * is 0.1.0-beta.35 — so the requirement rejected every real release. What
   * the check must do instead is hold the pins to the Core version the release
   * names.
   *
   * The fixture's pins are at VERSION, so naming a different Core version is
   * a pin mismatch. The message must say *that*, not "one version line".
   */
  it('holds the pins to the Core version the release names', () => {
    const result = evaluateStatic({
      uiRoot: uiTree(),
      uiVersion: VERSION,
      coreVersion: '0.2.0',
    })

    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/paired Core version 0\.2\.0/)
    expect(result.errors.join(' ')).not.toMatch(/one version line/)
  })

  it('accepts a Core version that differs from the UI version when pins match', () => {
    // The real pair: UI on its own line, pins on Core's.
    const result = evaluateStatic({
      uiRoot: uiTree(),
      uiVersion: '0.1.0-beta.35',
      coreVersion: VERSION,
    })

    expect(result.errors.join(' ')).not.toMatch(/one version line/)
    expect(result.errors.join(' ')).not.toMatch(/paired Core version/)
  })

  it('requires a Core version rather than assuming the UI one', () => {
    const result = evaluateStatic({
      uiRoot: uiTree(),
      uiVersion: VERSION,
    } as never)

    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/must name the Core version/)
  })

  it('ignores the independent vite-plugin pin', () => {
    const result = evaluateStatic({
      uiRoot: uiTree(),
      uiVersion: VERSION,
      coreVersion: VERSION,
    })
    expect(result.errors.join(' ')).not.toMatch(/vite-plugin/)
  })
})

/*
 * The half that runs at release time. Every failure mode is an error; none of
 * them degrades to a pass.
 */
describe('online pairing', () => {
  it('passes when Core names this release commit', () => {
    const result = evaluatePairing(onlineInput())
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('fails when Core names a different UI commit', () => {
    const result = evaluatePairing(
      onlineInput({
        readCoreFile: () => coreRecord({ uiCommit: 'e'.repeat(40) }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/names UI commit/)
  })

  it('fails when the Core tag cannot be resolved', () => {
    const result = evaluatePairing(
      onlineInput({ resolveCoreTag: () => undefined }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/cannot be resolved/)
  })

  it('fails when the tagged commit has no record', () => {
    const result = evaluatePairing(
      onlineInput({ readCoreFile: () => undefined }),
    )
    expect(result.ok).toBe(false)
    /*
     * Both directories, because Core moved the record to `meta/release/pairing`
     * and the tags created before the move carry the old path permanently.
     */
    expect(result.errors.join(' ')).toMatch(/has no meta\/release\/pairing/)
    expect(result.errors.join(' ')).toMatch(
      /release-pairing\/v0\.2\.0-rc\.0\.json/,
    )
  })

  it('fails when the record is not JSON', () => {
    const result = evaluatePairing(
      onlineInput({ readCoreFile: () => '{not json' }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/not valid JSON/)
  })

  it('fails when the record has the wrong schema', () => {
    const result = evaluatePairing(
      onlineInput({
        readCoreFile: () =>
          JSON.stringify({ schema: 'other', uiCommit: 'c'.repeat(40) }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/schema/)
  })

  it('fails when the record uiCommit is not a full SHA', () => {
    const result = evaluatePairing(
      onlineInput({ readCoreFile: () => coreRecord({ uiCommit: 'f3b7dce3' }) }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/40-character SHA/)
  })

  it('fails when the release SHA is not a full SHA', () => {
    const result = evaluatePairing(onlineInput({ uiCommit: 'f3b7dce3' }))
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/release SHA/)
  })

  it('fails when the record version line disagrees', () => {
    const result = evaluatePairing(
      onlineInput({
        readCoreFile: () =>
          coreRecord({ uiVersion: '0.2.0', coreVersion: '0.2.0' }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/uiVersion/)
  })

  /*
   * Beta skips the cross-repository pairing RECORD, not the Core release
   * identity. The Core must be an immutable tagged release before its packages
   * can be used by this publishing consumer.
   */
  it('requires an immutable Core tag but no pairing record for beta', () => {
    const coreCommit = 'd'.repeat(40)
    const result = evaluatePairing(
      onlineInput({
        uiVersion: '0.2.0-beta.1',
        uiRoot: uiTree('0.2.0-beta.1'),
        coreVersion: '0.2.0-beta.1',
        resolveCoreTag: tag => {
          expect(tag).toBe('v0.2.0-beta.1')
          return coreCommit
        },
        readCoreFile: () => {
          throw new Error(
            'beta does not require a cross-repository pair record',
          )
        },
      }),
    )
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.coreCommit).toBe(coreCommit)
  })

  it('fails closed if the beta Core tag is missing', () => {
    const result = evaluatePairing(
      onlineInput({
        uiVersion: '0.2.0-beta.1',
        uiRoot: uiTree('0.2.0-beta.1'),
        coreVersion: '0.2.0-beta.1',
        resolveCoreTag: () => undefined,
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/Core tag .* cannot be resolved/)
  })

  it('still checks the pins for a beta version', () => {
    const result = evaluatePairing(
      onlineInput({
        uiVersion: '0.2.0-beta.1',
        uiRoot: uiTree('0.2.0-beta.1', { '@zeus-js/router': '0.1.1-beta.20' }),
        resolveCoreTag: () => undefined,
      }),
    )
    expect(result.ok).toBe(false)
  })
})

describe('publishing dispatch Core commit', () => {
  const verified = {
    ok: true,
    channel: 'beta' as const,
    coreTag: 'v0.2.0-rc.5',
    coreCommit: 'd'.repeat(40),
    errors: [] as string[],
  }

  it('reports the verified Core tag without inventing a beta pair record', () => {
    const report = buildPairingReport({
      result: verified,
      mode: 'online',
      version: '0.1.0-beta.35',
      coreVersion: '0.2.0-rc.5',
      uiCommit: 'f'.repeat(40),
    })
    expect(report.coreTag).toBe('v0.2.0-rc.5')
    expect(report.coreTagCommit).toBe('d'.repeat(40))
    expect(report.coreCommit).toBe('d'.repeat(40))
    expect(report.pairTag).toBeNull()
  })

  it('accepts the commit actually resolved from the Core tag', () => {
    expect(compareExpectedCoreCommit(verified, 'd'.repeat(40)).ok).toBe(true)
  })

  it('refuses a valid-looking but mismatched dispatch SHA', () => {
    const result = compareExpectedCoreCommit(verified, 'a'.repeat(40))
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/does not match publish dispatch/)
  })

  it('refuses a malformed commit even when the pairing checker passed', () => {
    const result = compareExpectedCoreCommit(verified, 'abcd')
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/full 40-character SHA/)
  })
})

/*
 * The real thing, in real git repositories.
 *
 * This is the test the old protocol could not have passed. It commits a UI
 * candidate, reads its SHA from git, writes Core's record naming that SHA, and
 * verifies the pair — with no commit ever containing its own SHA.
 */
describe('the protocol is constructible', () => {
  /*
   * Two real git repositories, several commits each. The default 5s is a
   * budget for pure computation; this test shells out to git on every
   * assertion setup and takes 6-8s on a loaded machine, which made it the one
   * flaky test in this file rather than a wrong one.
   */
  it(
    'verifies a pair built from two real repositories',
    { timeout: 30_000 },
    () => {
      const uiRoot = temporary('zeus-ui-real-')
      initRepo(uiRoot)
      fs.mkdirSync(path.join(uiRoot, 'packages/primitives/button'), {
        recursive: true,
      })
      fs.writeFileSync(
        path.join(uiRoot, 'packages/primitives/button/package.json'),
        `${JSON.stringify(
          {
            name: '@zeus-web/button',
            version: VERSION,
            dependencies: { '@zeus-js/runtime-dom': VERSION },
          },
          null,
          2,
        )}\n`,
      )
      git(uiRoot, ['add', '-A'])
      git(uiRoot, ['commit', '-qm', 'ui candidate'])
      const uiCommit = git(uiRoot, ['rev-parse', 'HEAD'])

      /*
       * The UI tree contains no pairing record and no copy of its own SHA. That
       * is the property the old protocol violated.
       */
      const tracked = git(uiRoot, ['ls-files'])
      expect(tracked).not.toContain('release-pairing')
      expect(
        fs.readFileSync(path.join(uiRoot, tracked.split('\n')[0]!), 'utf8'),
      ).not.toContain(uiCommit)

      const coreRoot = temporary('zeus-core-real-')
      initRepo(coreRoot)
      fs.mkdirSync(path.join(coreRoot, 'release-pairing'), { recursive: true })
      const recordPath = `release-pairing/v${VERSION}.json`
      fs.writeFileSync(
        path.join(coreRoot, recordPath),
        coreRecord({ uiCommit, firstPublish: ['@zeus-js/i18n'] }),
      )
      git(coreRoot, ['add', '-A'])
      git(coreRoot, ['commit', '-qm', 'core pairing'])
      const coreCommit = git(coreRoot, ['rev-parse', 'HEAD'])

      const result = evaluatePairing({
        uiRoot,
        uiVersion: VERSION,
        coreVersion: VERSION,
        uiCommit,
        resolveCoreTag: tag => (tag === `v${VERSION}` ? coreCommit : undefined),
        /*
         * An amendment lookup is made for every rc release now, not only when
         * the commits differ — that ordering is what stops a superseded
         * candidate from keeping a live direct path. "No amendment" is the
         * answer here, and it has to be injected: the default resolver would
         * reach GitHub.
         */
        resolvePairTag: () => undefined,
        readCoreFile: (commit, file) => {
          if (commit !== coreCommit) return undefined
          const absolute = path.join(coreRoot, file)
          return fs.existsSync(absolute)
            ? fs.readFileSync(absolute, 'utf8')
            : undefined
        },
      })

      expect(result.errors).toEqual([])
      expect(result.ok).toBe(true)
      expect(result.record?.uiCommit).toBe(uiCommit)
    },
  )

  /*
   * And the property that made the old protocol impossible: committing the
   * record changes nothing about the UI commit, so Core can be written after
   * the UI candidate is final.
   */
  it('lets Core be recorded after the UI commit is final', () => {
    const uiRoot = temporary('zeus-ui-order-')
    initRepo(uiRoot)
    fs.mkdirSync(path.join(uiRoot, 'packages/a'), { recursive: true })
    fs.writeFileSync(
      path.join(uiRoot, 'packages/a/package.json'),
      JSON.stringify({
        name: '@zeus-web/a',
        version: VERSION,
        dependencies: { '@zeus-js/zeus': VERSION },
      }),
    )
    git(uiRoot, ['add', '-A'])
    git(uiRoot, ['commit', '-qm', 'ui'])
    const before = git(uiRoot, ['rev-parse', 'HEAD'])

    /*
     * Writing Core's record in a different repository does not touch the UI
     * tree at all, so the SHA read before is still the SHA released.
     */
    const coreRoot = temporary('zeus-core-order-')
    fs.mkdirSync(path.join(coreRoot, 'release-pairing'), { recursive: true })
    fs.writeFileSync(
      path.join(coreRoot, `release-pairing/v${VERSION}.json`),
      coreRecord({ uiCommit: before }),
    )

    const after = git(uiRoot, ['rev-parse', 'HEAD'])
    expect(after).toBe(before)

    const result = evaluatePairing({
      uiRoot,
      uiVersion: VERSION,
      coreVersion: VERSION,
      uiCommit: after,
      resolveCoreTag: () => 'b'.repeat(40),
      /* No amendment: this pair is direct, so none is ever consulted. */
      resolvePairTag: () => undefined,
      readCoreFile: () =>
        fs.readFileSync(
          path.join(coreRoot, `release-pairing/v${VERSION}.json`),
          'utf8',
        ),
    })
    expect(result.ok).toBe(true)
  })

  /*
   * The failure that motivated the remote-reachability check: a well-formed
   * record naming a commit that only ever existed locally.
   */
  it('rejects a record naming a commit this repository does not have', () => {
    const uiRoot = uiTree()
    const result = evaluatePairing({
      uiRoot,
      uiVersion: VERSION,
      coreVersion: VERSION,
      uiCommit: 'f'.repeat(40),
      resolveCoreTag: () => 'b'.repeat(40),
      /* No amendment: this pair is direct, so none is ever consulted. */
      resolvePairTag: () => undefined,
      readCoreFile: () => coreRecord({ uiCommit: 'e'.repeat(40) }),
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/names UI commit/)
  })
})

describe('pin discovery', () => {
  it('finds pins in every dependency field', () => {
    const pins = listCorePins(uiTree())
    const names = pins.map(pin => pin.name)
    expect(names).toContain('@zeus-js/runtime-dom')
    expect(names).toContain('@zeus-js/zeus')
    expect(names).toContain('@zeus-js/vite-plugin')
  })

  /*
   * `pnpm-workspace.yaml` lists `benchmarks/*`, `apps/*` and `examples/*` as
   * well as `packages/*`. Scanning only `packages/` let a real candidate —
   * `ca8cf2c8`, whose `examples/ai-workbench` still pinned
   * `@zeus-js/zeus@0.1.1-beta.20` while the rest of the tree moved to
   * `0.2.0-rc.0` — report `passed (rc, static)`.
   *
   * The stale pin then surfaced as an unresolvable install against the
   * registry, which names a package rather than the file that was stale.
   */
  it('finds pins outside packages/, in every workspace group', () => {
    const root = temporary('zeus-ui-groups-')
    for (const group of ['benchmarks', 'apps', 'examples']) {
      fs.mkdirSync(path.join(root, group, 'sample'), { recursive: true })
      fs.writeFileSync(
        path.join(root, group, 'sample/package.json'),
        `${JSON.stringify(
          {
            name: `@zeus-web/${group}-sample`,
            version: '0.2.0-rc.0',
            dependencies: { '@zeus-js/zeus': '0.1.1-beta.20' },
          },
          null,
          2,
        )}\n`,
      )
    }

    const pins = listCorePins(root)
    /*
     * `path.relative` returns the platform separator, so comparing against a
     * forward-slash literal passes on POSIX and fails on Windows. Normalise
     * before asserting — the production code reports whatever the platform
     * produces, and the test should not encode one of them.
     */
    const files = pins.map(pin => pin.file.replace(/\\/g, '/'))
    for (const group of ['benchmarks', 'apps', 'examples']) {
      expect(files).toContain(`${group}/sample/package.json`)
    }
  })

  it('fails a release whose stale pin is outside packages/', () => {
    const root = uiTree()
    fs.mkdirSync(path.join(root, 'examples/ai-workbench'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'examples/ai-workbench/package.json'),
      `${JSON.stringify(
        {
          name: '@zeus-web/example-ai-workbench',
          version: VERSION,
          dependencies: { '@zeus-js/zeus': '0.1.1-beta.20' },
        },
        null,
        2,
      )}\n`,
    )
    const result = evaluateStatic({
      uiRoot: root,
      uiVersion: VERSION,
      coreVersion: VERSION,
    })
    expect(result.ok).toBe(false)
    /* Accept either separator: the message carries the platform's path. */
    expect(result.errors.join(' ')).toMatch(/examples[\\/]ai-workbench/)
  })
})

/*
 * The pair for a bootstrap release.
 *
 * A bootstrap tag cannot name a UI commit and cannot move, so reading only the
 * tagged record would make every bootstrap release permanently unpairable.
 * The pair is recorded afterwards under `pair/v<version>`, and these cases are
 * the checks that make that record trustworthy rather than merely present.
 */
describe('bootstrap → pair', () => {
  const CORE_TAG_COMMIT = 'd'.repeat(40)
  const PAIR_COMMIT = 'e'.repeat(40)
  const UI = 'c'.repeat(40)

  function bootstrapRecord(): string {
    return `${JSON.stringify(
      {
        schema: CORE_PAIRING_SCHEMA,
        coreVersion: VERSION,
        uiCommit: null,
        uiVersion: VERSION,
        verifiedAt: '2026-11-17T00:00:00.000Z',
        bootstrap: true,
      },
      null,
      2,
    )}\n`
  }

  function attestation(overrides: Record<string, unknown> = {}): string {
    return `${JSON.stringify(
      {
        schema: 'zeus.pair-attestation/v1',
        releaseTag: `v${VERSION}`,
        coreCommit: CORE_TAG_COMMIT,
        coreVersion: VERSION,
        uiCommit: UI,
        uiVersion: VERSION,
        bootstrap: true,
        verifiedAt: '2026-11-17T00:00:00.000Z',
        ...overrides,
      },
      null,
      2,
    )}\n`
  }

  function bootstrapInput(
    overrides: Partial<OnlinePairingInput> = {},
  ): OnlinePairingInput {
    return {
      uiRoot: uiTree(),
      uiVersion: VERSION,
      coreVersion: VERSION,
      uiCommit: UI,
      resolveCoreTag: () => CORE_TAG_COMMIT,
      resolvePairTag: () => PAIR_COMMIT,
      readCoreFile: (_commit, file) => {
        /*
         * Both record directories, as the reader now tries them. The fixture
         * answers for either so the test is about the attestation, not the
         * path.
         */
        if (
          file.endsWith('meta/release/pairing/v0.2.0-rc.0.json') ||
          file.endsWith('release-pairing/v0.2.0-rc.0.json')
        ) {
          return bootstrapRecord()
        }
        if (file.includes('attestations')) return attestation()
        return undefined
      },
      ...overrides,
    }
  }

  it('passes when the attestation agrees with the release tag and the UI commit', () => {
    const result = evaluatePairing(bootstrapInput())
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.record?.uiCommit).toBe(UI)
  })

  it('fails when no pair attestation exists', () => {
    const result = evaluatePairing(
      bootstrapInput({ resolvePairTag: () => undefined }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(
      /no pair\/v0\.2\.0-rc\.0 attestation/,
    )
  })

  /*
   * The failure the whole design turns on: an attestation naming a Core commit
   * other than the one the release tag points at. Accepting it would pair the
   * UI with a tree this version never published.
   */
  it('fails when the attestation names a different Core commit', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          /*
           * Match the record path exactly. `includes('release-pairing/v')`
           * also matches `meta/release/pairing/v…`, so the attestation path
           * would answer with the record and this test would assert nothing.
           */
          file.endsWith('pairing/v0.2.0-rc.0.json') &&
          file.includes('/pairing/')
            ? bootstrapRecord()
            : attestation({ coreCommit: 'f'.repeat(40) }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/names Core commit/)
  })

  it('fails when the attestation names a different UI commit', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.endsWith('pairing/v0.2.0-rc.0.json') &&
          file.includes('/pairing/')
            ? bootstrapRecord()
            : attestation({ uiCommit: 'f'.repeat(40) }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/names UI commit/)
  })

  it('fails when the attestation version differs', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.endsWith('pairing/v0.2.0-rc.0.json') &&
          file.includes('/pairing/')
            ? bootstrapRecord()
            : attestation({ uiVersion: '0.2.0-rc.1' }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/uiVersion/)
  })

  it('fails when the attestation claims a paired release', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.endsWith('pairing/v0.2.0-rc.0.json') &&
          file.includes('/pairing/')
            ? bootstrapRecord()
            : attestation({ bootstrap: false }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/must record bootstrap: true/)
  })

  it('fails when the pair tag has no attestation file', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.includes('release-pairing/v') ? bootstrapRecord() : undefined,
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(
      /which has no release-pairing\/attestations/,
    )
  })

  it('fails when the attestation is not JSON', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.includes('release-pairing/v') ? bootstrapRecord() : '{not json',
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/not valid JSON/)
  })

  it('fails when the attestation schema is unknown', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.endsWith('pairing/v0.2.0-rc.0.json') &&
          file.includes('/pairing/')
            ? bootstrapRecord()
            : attestation({ schema: 'other/v1' }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/schema must be/)
  })

  /*
   * A record that is unpaired but does not declare it is ambiguous, and an
   * ambiguous record must not be read as either state.
   */
  it('refuses a null uiCommit that does not declare bootstrap', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.endsWith('pairing/v0.2.0-rc.0.json') &&
          file.includes('/pairing/')
            ? JSON.stringify({
                schema: CORE_PAIRING_SCHEMA,
                coreVersion: VERSION,
                uiCommit: null,
                uiVersion: VERSION,
                verifiedAt: '2026-11-17T00:00:00.000Z',
              })
            : attestation(),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/does not declare bootstrap/)
  })
})

/*
 * Pairing amendments: a published Core release whose tagged record names a UI
 * candidate that will never ship.
 *
 * Every case below supplies the amendment through `readCoreFile`, addressed by
 * the amendment tag, so the production path is what runs. The negative cases
 * are the point: an amendment is the weakest of the three pairing modes, and a
 * defect here would let any Core release be paired with any UI tree.
 */
/** The digest an amendment pins a record with: sha256 over the file's bytes. */
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/*
 * A guard against the failure this suite already had once: the amendment lookup
 * falls back to a real `gh api` call when no resolver is injected, so a test
 * that only exercises the direct path can block on the network. It timed out on
 * Windows and nowhere else, because that machine's `gh` waited instead of
 * failing fast.
 *
 * Every factory injects one. This asserts it, so a new case that builds its own
 * input is caught here rather than on a slow runner.
 */
describe('test inputs', () => {
  it('never reach the network for an amendment', () => {
    const result = evaluatePairing(
      onlineInput({ readCoreFile: () => taggedRecordForGuard() }),
    )
    /* The point is that this returned at all; a resolver reaching `gh` hangs. */
    expect(result.ok).toBe(false)
  })
})

function taggedRecordForGuard(): string {
  return coreRecord({ uiCommit: 'a'.repeat(40) })
}

describe('pairing amendment', () => {
  const CORE_COMMIT = 'd'.repeat(40)
  const ORIGINAL_UI = 'a'.repeat(40)
  const REPLACEMENT_UI = 'b'.repeat(40)
  const REPLACEMENT_TREE = 'f'.repeat(40)
  const HEX64 = (seed: string) => seed.repeat(64).slice(0, 64)
  const AMENDMENT_TAG = `pair-amendment/v${VERSION}`
  const AMENDMENT_FILE = `meta/release/pairing/amendments/v${VERSION}.json`

  /** The record the published tag carries, naming the abandoned candidate. */
  function taggedRecord(uiCommit = ORIGINAL_UI): string {
    return coreRecord({ uiCommit })
  }

  /*
   * The bundle the amendment is accepted on.
   *
   * Built from real report shapes rather than five hex strings, because that is
   * what the verifier now reads: each report's own numbers decide its verdict,
   * and the bundle's digest is recomputed from the bytes. A fixture with fake
   * digests would exercise the format check and nothing else — which is exactly
   * the acceptance the old version gave.
   */
  const APPROVAL_COMMIT = 'e'.repeat(40)
  const LOCKFILE_DIGEST = HEX64('1')

  function report(_id: string, content: Record<string, unknown>): string {
    return `${JSON.stringify(content, null, 2)}\n`
  }

  function coreRegistryReport(): string {
    return report('core-registry-report', {
      schema: 'zeus.core-registry-verification/v1',
      version: VERSION,
      checked: 32,
      exactVersion: 32,
      rcTag: 32,
      platformBinaries: 7,
      prereleaseLatestCount: 16,
      integrityRecorded: 32,
      verifiedAt: '2026-11-28T00:00:00.000Z',
    })
  }

  function uiCandidateReport(): string {
    return report('ui-candidate-report', {
      schema: 'zeus.create-zeus-candidate/v2',
      sourceCommit: 'c'.repeat(40),
      registry: 'https://registry.npmjs.org',
      coreVersion: VERSION,
      uiVersion: VERSION,
      candidatePackages: { core: 33, ui: 2 },
      templates: [
        { template: 'basic-ts', pinMatch: true, passed: true },
        { template: 'admin-ts', pinMatch: true, passed: true },
      ],
      passed: true,
    })
  }

  function templateAcceptance(): string {
    return report('template-acceptance', {
      schema: 'zeus.template-acceptance/v1',
      version: VERSION,
      uiCommit: REPLACEMENT_UI,
      templates: 6,
      passed: 6,
      coreSource: 'registry',
      verifiedAt: '2026-11-28T00:00:00.000Z',
    })
  }

  function browserAcceptance(): string {
    return report('browser-acceptance', {
      schema: 'zeus.browser-acceptance/v1',
      version: VERSION,
      uiCommit: REPLACEMENT_UI,
      probes: 5,
      passed: 5,
      verifiedAt: '2026-11-28T00:00:00.000Z',
    })
  }

  function uiRegistryPreflight(): string {
    /*
     * The shape `check-publish-preflight.ts` actually writes: per-package
     * states plus the three buckets and an `ok` derived from `failed`. Not a
     * hand-rolled summary — the verifier judges what the producer emits.
     */
    return report('ui-registry-preflight', {
      schema: 'zeus-ui.publish-preflight/v1',
      version: VERSION,
      tag: 'rc',
      registry: 'https://registry.npmjs.org/',
      packages: [{ name: '@zeus-web/button', state: 'ABSENT' }],
      published: [],
      absent: Array.from(
        { length: 46 },
        (_, index) => `@zeus-web/pkg-${index}`,
      ),
      failed: [],
      ok: true,
    })
  }

  /** The five reports, keyed by the id the bundle uses. */
  function reports(): Record<string, string> {
    return {
      'core-registry-report': coreRegistryReport(),
      'ui-candidate-report': uiCandidateReport(),
      'template-acceptance': templateAcceptance(),
      'browser-acceptance': browserAcceptance(),
      'ui-registry-preflight': uiRegistryPreflight(),
    }
  }

  function bundle(overrides: Record<string, unknown> = {}): string {
    const entries = reports()
    return `${JSON.stringify(
      {
        schema: 'zeus.release-evidence-bundle/v1',
        version: VERSION,
        core: { version: VERSION, tag: `v${VERSION}`, commit: CORE_COMMIT },
        ui: {
          version: VERSION,
          commit: REPLACEMENT_UI,
          tree: REPLACEMENT_TREE,
          lockfileSha256: LOCKFILE_DIGEST,
        },
        reports: Object.entries(entries).map(([id, content]) => ({
          id,
          schema: (
            {
              'core-registry-report': 'zeus.core-registry-verification/v1',
              'ui-candidate-report': 'zeus.create-zeus-candidate/v2',
              'template-acceptance': 'zeus.template-acceptance/v1',
              'browser-acceptance': 'zeus.browser-acceptance/v1',
              'ui-registry-preflight': 'zeus-ui.publish-preflight/v1',
            } as Record<string, string>
          )[id],
          sha256: sha256(content),
          producer: {
            kind: 'workflow',
            repository: 'baicie/zeus',
            workflow: 'release.yml',
            runId: 46005757777,
            headSha: CORE_COMMIT,
          },
          sourceCommit:
            id === 'core-registry-report' ? CORE_COMMIT : REPLACEMENT_UI,
          verdict: 'PASS',
          content,
        })),
        ...overrides,
      },
      null,
      2,
    )}\n`
  }

  const BUNDLE_PATH = `meta/release/evidence/v${VERSION}/bundle.json`

  function amendment(
    overrides: Record<string, unknown> = {},
    bundleRaw = bundle(),
  ): string {
    return JSON.stringify({
      schema: 'zeus.pairing-amendment/v2',
      releaseTag: `v${VERSION}`,
      coreVersion: VERSION,
      coreCommit: CORE_COMMIT,
      uiVersion: VERSION,
      originalPairing: {
        uiCommit: ORIGINAL_UI,
        recordSha256: sha256(taggedRecord()),
      },
      replacement: {
        uiCommit: REPLACEMENT_UI,
        uiTree: REPLACEMENT_TREE,
        lockfileSha256: LOCKFILE_DIGEST,
      },
      authorization: {
        releasedBy: 'baicie',
        releasedAt: '2026-11-28T00:00:00.000Z',
        changeReference: 'baicie/zeus#420',
      },
      evidence: {
        bundleSha256: sha256(bundleRaw),
        bundlePath: BUNDLE_PATH,
        reports: Object.fromEntries(
          Object.entries(reports()).map(([id, content]) => [
            id,
            sha256(content),
          ]),
        ),
      },
      reason:
        'the original candidate was never published and its tree lacks the release fixes',
      verifiedAt: '2026-11-28T00:00:00.000Z',
      ...overrides,
    })
  }

  /** An input whose Core record names the abandoned candidate. */
  function amendedInput(
    overrides: Partial<OnlinePairingInput> = {},
    amendmentOverrides: Record<string, unknown> = {},
    bundleRaw?: string,
  ): OnlinePairingInput {
    const files: Record<string, string> = {
      [`meta/release/pairing/v${VERSION}.json`]: taggedRecord(),
      [AMENDMENT_FILE]: amendment(amendmentOverrides, bundleRaw),
      [BUNDLE_PATH]: bundleRaw ?? bundle(),
    }
    return {
      ...onlineInput({
        uiCommit: REPLACEMENT_UI,
        resolveCoreTag: () => CORE_COMMIT,
        resolvePairTag: (tag: string) =>
          tag === AMENDMENT_TAG ? APPROVAL_COMMIT : undefined,
        /*
         * The amendment and the tagged record live in different commits, but
         * the file names already distinguish them, so the commit is only used
         * to prove the caller asked for the right one.
         */
        readCoreFile: (commit: string, file: string) =>
          commit === CORE_COMMIT || commit === APPROVAL_COMMIT
            ? files[file]
            : undefined,
        verifyUiCandidate: (_repository: string, commit: string) =>
          commit.toLowerCase() === REPLACEMENT_UI
            ? {
                state: 'FOUND' as const,
                tree: REPLACEMENT_TREE,
                lockfileSha256: LOCKFILE_DIGEST,
              }
            : { state: 'MISSING' as const, message: 'no such commit' },
        ...overrides,
      }),
    }
  }

  it('accepts a valid amendment and reports how the pair was established', () => {
    const result = evaluatePairing(amendedInput())
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.amended?.tag).toBe(AMENDMENT_TAG)
    expect(result.amended?.replacement).toBe(REPLACEMENT_UI)
  })

  it('still refuses a mismatch when no amendment exists', () => {
    /* The direct path must not become a fallback. */
    const result = evaluatePairing(
      onlineInput({
        uiCommit: REPLACEMENT_UI,
        readCoreFile: (_commit: string, file: string) =>
          file.includes('amendments') ? undefined : taggedRecord(),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/names UI commit/)
  })

  it('refuses an amendment whose coreCommit is another commit', () => {
    const result = evaluatePairing(
      amendedInput({}, { coreCommit: '9'.repeat(40) }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/is not the commit v/)
  })

  it('refuses an amendment whose original record digest does not match', () => {
    const result = evaluatePairing(
      amendedInput(
        {},
        {
          originalPairing: { uiCommit: ORIGINAL_UI, recordSha256: HEX64('9') },
        },
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/recordSha256/)
  })

  it('refuses an amendment whose original uiCommit contradicts the tag', () => {
    const result = evaluatePairing(
      amendedInput(
        {},
        {
          originalPairing: {
            uiCommit: '7'.repeat(40),
            recordSha256: sha256(taggedRecord()),
          },
        },
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/originalPairing\.uiCommit/)
  })

  it('refuses an amendment that names a different replacement than the release', () => {
    const result = evaluatePairing(
      amendedInput(
        {},
        {
          replacement: {
            uiCommit: '8'.repeat(40),
            uiTree: REPLACEMENT_TREE,
            lockfileSha256: HEX64('1'),
          },
        },
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/is not the commit being released/)
  })

  it('refuses an amendment whose uiTree does not match the commit', () => {
    const result = evaluatePairing(
      amendedInput(
        {},
        {
          replacement: {
            uiCommit: REPLACEMENT_UI,
            uiTree: 'a'.repeat(40),
            lockfileSha256: HEX64('1'),
          },
        },
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/records uiTree/)
  })

  it('refuses an amendment whose lockfile digest does not match', () => {
    const result = evaluatePairing(
      amendedInput(
        {},
        {
          replacement: {
            uiCommit: REPLACEMENT_UI,
            uiTree: REPLACEMENT_TREE,
            lockfileSha256: HEX64('c'),
          },
        },
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/lockfileSha256/)
  })

  it('refuses an amendment whose replacement cannot be read from the UI remote', () => {
    const result = evaluatePairing(
      amendedInput({
        verifyUiCandidate: () => ({
          state: 'MISSING' as const,
          message: 'no such commit',
        }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/is not on the UI repository/)
  })

  /*
   * The fail-open this suite exists to keep closed.
   *
   * v1's reader compared the lockfile digest only when both sides had one, so
   * a candidate whose lockfile could not be fetched passed on the tree alone.
   * These four cases pin the replacement behaviour: missing, unreadable,
   * mismatched, and matching.
   */
  it('refuses when the candidate lockfile cannot be fetched', () => {
    const result = evaluatePairing(
      amendedInput({
        verifyUiCandidate: () => ({
          state: 'ERROR' as const,
          message: 'reading blob abc failed: HTTP 502',
        }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(
      /could not be read from the UI repository: reading blob abc failed/,
    )
  })

  it('refuses when the candidate has no lockfile at all', () => {
    const result = evaluatePairing(
      amendedInput({
        verifyUiCandidate: () => ({
          state: 'MISSING' as const,
          message:
            'has no pnpm-lock.yaml; the amendment pins its digest, so there is nothing to compare',
        }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/has no pnpm-lock\.yaml/)
  })

  it('refuses an amendment that omits the lockfile digest', () => {
    /*
     * Absent is not "skip the comparison" — it is a malformed amendment. The
     * validator requires the field, so the refusal happens before any
     * comparison could be silently skipped.
     */
    const result = evaluatePairing(
      amendedInput(
        {},
        {
          replacement: {
            uiCommit: REPLACEMENT_UI,
            uiTree: REPLACEMENT_TREE,
          },
        },
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/replacement\.lockfileSha256/)
  })

  it('refuses an amendment with no reviewable authorization', () => {
    const result = evaluatePairing(
      amendedInput(
        {},
        {
          authorization: {
            releasedBy: '',
            releasedAt: 'not-a-timestamp',
            changeReference: '',
          },
        },
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/authorization\.releasedBy/)
  })

  it('refuses an amendment missing any evidence report digest', () => {
    const result = evaluatePairing(
      amendedInput(
        {},
        {
          evidence: {
            bundleSha256: sha256(bundle()),
            bundlePath: BUNDLE_PATH,
            reports: {
              'core-registry-report': sha256(coreRegistryReport()),
              'ui-candidate-report': sha256(uiCandidateReport()),
              'template-acceptance': sha256(templateAcceptance()),
              'browser-acceptance': '',
              'ui-registry-preflight': sha256(uiRegistryPreflight()),
            },
          },
        },
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/browser-acceptance/)
  })

  it('refuses a bundle whose digest the amendment does not pin', () => {
    const result = evaluatePairing(
      amendedInput(
        {},
        {
          evidence: {
            bundleSha256: HEX64('7'),
            bundlePath: BUNDLE_PATH,
            reports: Object.fromEntries(
              Object.entries(reports()).map(([id, content]) => [
                id,
                sha256(content),
              ]),
            ),
          },
        },
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/evidence\.bundleSha256/)
  })

  it('refuses when the evidence bundle is not committed with the amendment', () => {
    const result = evaluatePairing(
      amendedInput({
        readCoreFile: (_commit: string, file: string) =>
          file.includes('bundle.json')
            ? undefined
            : file.includes('amendments')
              ? amendment()
              : taggedRecord(),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(
      /the amendment's evidence must be committed with it/,
    )
  })

  /*
   * A report that fails must fail the bundle even when the bundle says PASS.
   * The verdict is recomputed from the report's own numbers, so relabelling it
   * changes nothing — which is the difference between evidence and a claim.
   */
  it('refuses a bundle carrying a failed report', () => {
    const failed = report('browser-acceptance', {
      schema: 'zeus.browser-acceptance/v1',
      version: VERSION,
      uiCommit: REPLACEMENT_UI,
      probes: 5,
      passed: 4,
      verifiedAt: '2026-11-28T00:00:00.000Z',
    })
    const raw = bundle()
    const parsed = JSON.parse(raw) as {
      reports: Array<{ id: string; content: string; sha256: string }>
    }
    const entry = parsed.reports.find(item => item.id === 'browser-acceptance')!
    entry.content = failed
    entry.sha256 = sha256(failed)
    const patched = `${JSON.stringify(parsed, null, 2)}\n`

    const result = evaluatePairing(amendedInput({}, {}, patched))
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/passed is 4, expected 5/)
  })

  it('refuses an amendment whose replacement equals the original candidate', () => {
    /*
     * That is a direct pair wearing an amendment's name, and must not be
     * laundered through the weaker path. The release commit stays the
     * replacement so the mismatch branch is still the one under test.
     */
    const result = evaluatePairing(
      amendedInput(
        {
          verifyUiCandidate: () => ({
            state: 'FOUND' as const,
            tree: REPLACEMENT_TREE,
            lockfileSha256: HEX64('1'),
          }),
        },
        {
          replacement: {
            uiCommit: ORIGINAL_UI,
            uiTree: REPLACEMENT_TREE,
            lockfileSha256: HEX64('1'),
          },
        },
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/direct pair, not an amendment/)
  })

  it('refuses an amendment tag whose tree has no amendment file', () => {
    const result = evaluatePairing(
      amendedInput({
        readCoreFile: (_commit: string, file: string) => {
          if (file.includes('amendments')) return undefined
          return taggedRecord()
        },
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(
      /has no meta\/release\/pairing\/amendments/,
    )
  })

  it('refuses an amendment file that is not JSON', () => {
    const result = evaluatePairing(
      amendedInput({
        readCoreFile: (_commit: string, file: string) =>
          file.includes('amendments') ? '{oops' : taggedRecord(),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/is not valid JSON/)
  })

  it('refuses an amendment with the wrong schema', () => {
    const result = evaluatePairing(
      amendedInput({}, { schema: 'zeus.pairing-amendment/v1' }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/schema must be/)
  })

  /*
   * The ordering that makes an amendment authoritative.
   *
   * v1 consulted the amendment only after noticing a commit mismatch, so the
   * original candidate kept a working direct path forever. These cases pin the
   * opposite: while an amendment is in force, the original is refused — even
   * when it is the commit the tagged record names, which is precisely the one
   * the old code would have accepted.
   */
  describe('an amendment supersedes the tagged candidate', () => {
    it('refuses the original candidate while an amendment is in force', () => {
      const result = evaluatePairing(amendedInput({ uiCommit: ORIGINAL_UI }))
      expect(result.ok).toBe(false)
      expect(result.errors.join(' ')).toMatch(
        /is amended: the candidate that ships is b{40}, so a{40} cannot be released/,
      )
    })

    it('accepts only the amendment replacement', () => {
      const good = evaluatePairing(amendedInput())
      expect(good.ok).toBe(true)

      const wrong = evaluatePairing(amendedInput({ uiCommit: '7'.repeat(40) }))
      expect(wrong.ok).toBe(false)
      expect(wrong.errors.join(' ')).toMatch(
        /is amended: the candidate that ships/,
      )
    })

    it('does not fall back to the original when the amendment is invalid', () => {
      /*
       * A corrupt amendment must not restore the pair it was written to
       * replace. Falling through here would make "delete a byte from the
       * amendment" a way to release the superseded candidate.
       */
      const result = evaluatePairing(
        amendedInput({ uiCommit: ORIGINAL_UI }, { coreCommit: '9'.repeat(40) }),
      )
      expect(result.ok).toBe(false)
      expect(result.errors.join(' ')).toMatch(/is not the commit v/)
    })

    it('does not fall back to the original when the lookup fails', () => {
      const result = evaluatePairing(
        amendedInput({
          uiCommit: ORIGINAL_UI,
          resolvePairTagLookup: () => ({
            state: 'ERROR' as const,
            message: 'HTTP 502 from api.github.com',
          }),
        }),
      )
      expect(result.ok).toBe(false)
      expect(result.errors.join(' ')).toMatch(
        /could not determine whether pair-amendment/,
      )
      /* And specifically not the direct-path answer, which would be a pass. */
      expect(result.errors.join(' ')).not.toMatch(/names UI commit/)
    })

    it('treats a lookup failure as a refusal even when the commits agree', () => {
      /*
       * The strongest form: the release is the tagged candidate, the pins
       * agree, everything offline passes — and the only unknown is whether an
       * amendment supersedes it. Unknown is not a pass.
       */
      const result = evaluatePairing(
        onlineInput({
          uiCommit: 'c'.repeat(40),
          resolvePairTagLookup: () => ({
            state: 'ERROR' as const,
            message: 'rate limited',
          }),
          readCoreFile: () => coreRecord({ uiCommit: 'c'.repeat(40) }),
        }),
      )
      expect(result.ok).toBe(false)
    })

    it('is absent, not failed, when the remote has no such tag', () => {
      /*
       * The other side of the same distinction: a 404 really does mean "no
       * amendment", and a direct pair must still work. Without this a release
       * could never be paired directly again.
       */
      const result = evaluatePairing(
        onlineInput({
          uiCommit: 'c'.repeat(40),
          resolvePairTagLookup: () => ({ state: 'ABSENT' as const }),
          readCoreFile: () => coreRecord({ uiCommit: 'c'.repeat(40) }),
        }),
      )
      expect(result.ok).toBe(true)
    })
  })
})
