/**
 * The publish order must never place a package before something it depends on.
 *
 * This is checked against the real workspace, not a fixture: the defect it
 * prevents is a property of the 46 packages as they exist today, and a
 * fixture would keep passing after the workspace changed.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  computePublishDepths,
  createPackageKind,
  publishKind,
} from '../../../release/publish-order'

const require = createRequire(import.meta.url)
const TSX = require.resolve('tsx/cli')
const CLI = resolve(__dirname, '../../release/check-release-pairing.ts')
const ROOT = resolve(__dirname, '../../../..')

interface Manifest {
  name?: string
  private?: boolean
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

function readPublishableManifests(): Array<{
  name: string
  deps: string[]
  json: Manifest
}> {
  const results: Array<{ name: string; deps: string[]; json: Manifest }> = []
  const roots = ['packages']

  for (const root of roots) {
    const dir = join(ROOT, root)
    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const candidates = [
        join(dir, entry.name, 'package.json'),
        ...(() => {
          const nested = join(dir, entry.name)
          try {
            return readdirSync(nested, { withFileTypes: true })
              .filter(e => e.isDirectory())
              .map(e => join(nested, e.name, 'package.json'))
          } catch {
            return []
          }
        })(),
      ]

      for (const candidate of candidates) {
        let json: Manifest
        try {
          json = JSON.parse(readFileSync(candidate, 'utf8')) as Manifest
        } catch {
          continue
        }

        const name = json.name
        if (!name || !name.startsWith('@zeus-web/') || json.private) continue

        const deps = new Set<string>()
        for (const field of [
          'dependencies',
          'peerDependencies',
          'optionalDependencies',
        ] as const) {
          for (const [dep, version] of Object.entries(json[field] ?? {})) {
            if (
              dep.startsWith('@zeus-web/') &&
              String(version).startsWith('workspace:')
            ) {
              deps.add(dep)
            }
          }
        }

        results.push({ name, deps: [...deps], json })
      }
    }
  }

  return results
}

describe('publish order', () => {
  it('places every package after the workspace packages it depends on', () => {
    const manifests = readPublishableManifests()
    const kind = createPackageKind(manifests)
    const depths = computePublishDepths(manifests)

    expect(manifests.length).toBeGreaterThan(0)

    const ordered = [...manifests].sort((a, b) => {
      const ka = kind('', a.json) ?? ''
      const kb = kind('', b.json) ?? ''
      return ka.localeCompare(kb)
    })

    const position = new Map(ordered.map((m, index) => [m.name, index]))
    const inversions: string[] = []

    for (const manifest of manifests) {
      for (const dep of manifest.deps) {
        const depPosition = position.get(dep)

        if (depPosition === undefined) continue

        if (depPosition > position.get(manifest.name)!) {
          inversions.push(`${manifest.name} depends on ${dep}`)
        }
      }
    }

    expect(inversions).toEqual([])
    // Guards the defect this replaces: alphabetical order inverted 59 edges.
    expect(depths.size).toBe(manifests.length)
  })

  it('gives a dependency a strictly lower kind than its dependents', () => {
    const manifests = readPublishableManifests()
    const depths = computePublishDepths(manifests)

    for (const manifest of manifests) {
      for (const dep of manifest.deps) {
        const own = depths.get(manifest.name)
        const dependency = depths.get(dep)

        if (own === undefined || dependency === undefined) continue

        expect(
          publishKind(dep, dependency) < publishKind(manifest.name, own),
        ).toBe(true)
      }
    }
  })

  it('keeps string order equal to numeric order past ten depths', () => {
    // localeCompare would put '10' before '2' without padding.
    expect(publishKind('a', 2) < publishKind('a', 10)).toBe(true)
  })

  it('throws on a dependency cycle instead of picking an order', () => {
    expect(() =>
      computePublishDepths([
        { name: 'a', deps: ['b'] },
        { name: 'b', deps: ['a'] },
      ]),
    ).toThrow(/cycle/)
  })
})

/**
 * The precheck runs `check:release-pairing` with no arguments, so the CLI must
 * derive both versions from the workspace.
 *
 * Before this, the command exited 2 with a usage line, which made the
 * precheck entry impossible to pass — a gate that can only be removed.
 */
describe('check-release-pairing CLI defaults', () => {
  /*
   * The workspace this runs in is not always a release workspace.
   *
   * The canary compatibility job rewrites every `@zeus-js/*` pin before running
   * `test-unit`, and it rewrites them to the dist-tag `canary` — a moving
   * pointer, not a version. The UI has three release channels (beta, rc,
   * latest) and canary is not one of them, so a canonical version cannot be
   * derived from those pins and the CLI should say so rather than invent one.
   *
   * The first version of this branch keyed on the root `version` containing
   * `-canary.`. It never did: `align-zeus-beta.ts` edits dependency fields and
   * leaves `version` alone, so the branch was dead code in exactly the
   * environment it was written for and the job stayed red. Detecting the pins
   * is detecting the thing that actually changes.
   *
   * Asserting success unconditionally made the canary job red on every run
   * since the alignment step was added. The refusal is the right behaviour; the
   * test was asking for the wrong one.
   */
  const canaryPins = ((): number => {
    let found = 0
    const manifests = [
      join(ROOT, 'package.json'),
      ...readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .flatMap(entry => {
          const directory = join(ROOT, 'packages', entry.name)
          return readdirSync(directory, { withFileTypes: true })
            .filter(nested => nested.isDirectory())
            .map(nested => join(directory, nested.name, 'package.json'))
        }),
    ]
    for (const file of manifests) {
      let manifest: {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
        peerDependencies?: Record<string, string>
      }
      try {
        manifest = JSON.parse(readFileSync(file, 'utf8'))
      } catch {
        continue
      }
      for (const field of [
        'dependencies',
        'devDependencies',
        'peerDependencies',
      ] as const) {
        for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
          if (name.startsWith('@zeus-js/') && spec === 'canary') found += 1
        }
      }
    }
    return found
  })()

  const isCanaryWorkspace = canaryPins > 0

  it('runs without arguments and reads the versions from the workspace', () => {
    const result = spawnSync(process.execPath, [TSX, CLI], {
      cwd: ROOT,
      encoding: 'utf8',
    })

    expect(result.error).toBeUndefined()

    if (isCanaryWorkspace) {
      /*
       * A dist-tag names no release to pair against, so the only correct
       * outcome is a refusal that says so.
       *
       * This assertion started as `status !== 0` plus a regex for the channel
       * error, and that was wrong in a way worth keeping visible: the CLI used
       * to exit **zero** here and print `UI release pairing 0.1.0-beta.35
       * passed (beta, static)`, because `resolveWorkspaceZeusVersion` skips
       * non-semver pins, the caller fell back to
       * `FALLBACK_EXPECTED_ZEUS_VERSION`, and a constant then stood in for a
       * version the workspace never named. The canary compatibility job ran on
       * exactly this shape and was green for a run that verified nothing.
       *
       * The refusal is now explicit (`process.exitCode = 2`) and names both the
       * tag and the remedy, so the message is asserted rather than merely the
       * non-zero exit — "failed for some reason" was how the defect survived.
       */
      expect(result.status).toBe(2)
      expect(`${result.stdout}${result.stderr}`).toMatch(
        /pins \d+ @zeus-js package\(s\) to a dist-tag \(canary\)/,
      )
      expect(`${result.stdout}${result.stderr}`).toMatch(/--core-version/)
      return
    }

    expect(result.status).toBe(0)
    expect(`${result.stdout}${result.stderr}`).toMatch(
      /UI release pairing \d+\.\d+\.\d+/,
    )
  })
})
