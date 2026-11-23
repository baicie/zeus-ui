/**
 * The publish order must never place a package before something it depends on.
 *
 * This is checked against the real workspace, not a fixture: the defect it
 * prevents is a property of the 46 packages as they exist today, and a
 * fixture would keep passing after the workspace changed.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  computePublishDepths,
  createPackageKind,
  publishKind,
} from '../../../release/publish-order'

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
