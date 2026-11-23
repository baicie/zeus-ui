/**
 * The single source for what "aligned with Zeus" means.
 *
 * Two commands act on this contract and they used to each carry their own
 * copy of it:
 *
 * - `check-zeus-beta-alignment` decides whether a tree is correct.
 * - `align-zeus-beta` rewrites a tree to be correct.
 *
 * When the two disagree, the writer produces a tree the checker rejects, or
 * the checker rejects a tree the writer considers done. Both happened:
 * the versions allowlist lived in only one of them, so aligning to 0.2.0-rc.5
 * rewrote `@zeus-js/vite-plugin` from its real `0.0.5` to a version that does
 * not exist, and the two also computed peer ranges differently for invalid
 * versions (`*` versus `>=<version>`).
 *
 * Everything both sides need to agree on lives here.
 */
import { readFileSync } from 'node:fs'

import { createZeusPeerRequirement } from './zeus-peer-requirement'

export const ZEUS_SCOPE = '@zeus-js/'

export const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const

interface WorkspaceManifest {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

/**
 * Packages that carry their own version line and must not follow the
 * `@zeus-js/zeus` release.
 *
 * `@zeus-js/vite-plugin` is published independently at `0.0.5`; rewriting it
 * to the coordinated version invents a dependency that was never published.
 */
export const INDEPENDENT_PACKAGE_VERSIONS: Readonly<Record<string, string>> = {
  '@zeus-js/vite-plugin': '0.0.5',
}

/**
 * Used only when a workspace pins no `@zeus-js` dependency at all — an empty
 * tree, or one whose manifests could not be read. Keeping a value means such a
 * tree is still checked rather than silently passing.
 *
 * This must never be the answer for a tree that does pin a version: that is
 * what `resolveWorkspaceZeusVersion` is for. A literal here is a version the
 * repository stopped agreeing with the moment Zeus published, and both
 * commands then either report the correct tree as wrong or rewrite it back to
 * the previous release.
 */
export const FALLBACK_EXPECTED_ZEUS_VERSION = '0.2.0-rc.5'

/**
 * The peer range a workspace should declare for `@zeus-js/zeus`.
 *
 * Three shapes, one rule per shape:
 *
 * - **prerelease** (`0.2.0-rc.5`) — pinned exactly. Zeus's prerelease line
 *   makes no compatibility promise across RCs, so a range would claim more
 *   than the release does.
 * - **stable** (`0.2.0`) — the range `createZeusPeerRequirement` computes,
 *   `>=0.2.0 <0.3.0`.
 * - **dist-tag** (`canary`, `latest`) — `*`. A dist-tag names a moving
 *   pointer, not a version, so there is no lower bound to state. This is also
 *   the only shape `createZeusPeerRequirement` cannot express: it throws on
 *   non-semver input, and both commands have to agree on what happens instead
 *   of one producing `*` while the other refuses the tree.
 */
export function createExpectedPeerRange(version: string): string {
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    return '*'
  }

  return createZeusPeerRequirement(version)
}

/**
 * The version a workspace pins itself to.
 *
 * Reads every `@zeus-js` dependency that follows the coordinated line and
 * returns the one that appears most often. Independent packages are skipped:
 * their versions are not evidence of what the workspace aligned to.
 *
 * Returns `null` when the workspace pins nothing, so the caller can fall back
 * to `FALLBACK_EXPECTED_ZEUS_VERSION` and say so.
 */
export function resolveWorkspaceZeusVersion(files: string[]): string | null {
  const counts = new Map<string, number>()

  for (const file of files) {
    let pkg: WorkspaceManifest

    try {
      pkg = JSON.parse(readFileSync(file, 'utf8')) as WorkspaceManifest
    } catch {
      continue
    }

    for (const field of DEP_FIELDS) {
      const deps = pkg[field]

      if (!deps) {
        continue
      }

      for (const [name, version] of Object.entries(deps)) {
        if (!name.startsWith(ZEUS_SCOPE)) {
          continue
        }

        if (name in INDEPENDENT_PACKAGE_VERSIONS) {
          continue
        }

        if (typeof version !== 'string' || !/^\d+\.\d+\.\d+/.test(version)) {
          continue
        }

        counts.set(version, (counts.get(version) ?? 0) + 1)
      }
    }
  }

  let winner: string | null = null
  let best = 0

  for (const [version, count] of counts) {
    if (count > best) {
      best = count
      winner = version
    }
  }

  return winner
}
