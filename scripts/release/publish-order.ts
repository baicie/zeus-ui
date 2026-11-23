/**
 * The publish order for `@zeus-web/*`.
 *
 * `@baicie/release` sorts by `packageKind` and, within a kind, by package
 * name. Without a `packageKind`, every package sorts as one group and the
 * order is alphabetical — which inverts real dependencies in 59 places:
 *
 *     @zeus-web/cli      depends on @zeus-web/registry, which sorts after it
 *     @zeus-web/headless depends on @zeus-web/label,    which sorts after it
 *
 * npm accepts each `publish` independently, so that order produces a window
 * where a published version names a dependency that is not on the registry
 * yet. Anyone installing during it gets `ERR_PNPM_NO_MATCHING_VERSION` for a
 * package that is about to exist.
 *
 * ## Why a depth, not a hand-written list
 *
 * The depth is the longest dependency chain below a package, computed from the
 * workspace manifests. A hand-written list would be correct exactly once: the
 * next package to gain an internal dependency would invalidate it, and nothing
 * would say so. This recomputes from the same manifests the release reads, so
 * a new edge moves the package automatically.
 *
 * ## The kind is a two-digit string on purpose
 *
 * `@baicie/release` compares kinds with `localeCompare`, so a plain number
 * would sort `"10"` before `"2"`. Zero-padding keeps the string order equal to
 * the numeric order.
 */

/** Packages that must exist before anything depends on them. */
export function publishKind(name: string, depth: number): string {
  return `d${String(depth).padStart(2, '0')}:${name}`
}

interface Manifest {
  name?: string
  private?: boolean
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

/**
 * Dependency depth of every publishable package.
 *
 * A package with no `@zeus-web` dependency is depth 0; a package that depends
 * on one is `1 + max(depth of its dependencies)`. A cycle cannot be ordered at
 * all, so it throws rather than silently picking one.
 */
export function computePublishDepths(
  manifests: ReadonlyArray<{ name: string; deps: ReadonlyArray<string> }>,
): Map<string, number> {
  const depsByName = new Map<string, ReadonlyArray<string>>()

  for (const manifest of manifests) {
    depsByName.set(manifest.name, manifest.deps)
  }

  const depths = new Map<string, number>()
  const visiting = new Set<string>()

  const depthOf = (name: string): number => {
    const known = depths.get(name)

    if (known !== undefined) {
      return known
    }

    if (visiting.has(name)) {
      throw new Error(
        `${name} is part of a dependency cycle within the publish group; the packages cannot be ordered`,
      )
    }

    visiting.add(name)

    let depth = 0

    for (const dependency of depsByName.get(name) ?? []) {
      if (!depsByName.has(dependency)) {
        continue
      }

      depth = Math.max(depth, depthOf(dependency) + 1)
    }

    visiting.delete(name)
    depths.set(name, depth)

    return depth
  }

  for (const manifest of manifests) {
    depthOf(manifest.name)
  }

  return depths
}

/**
 * The `packageKind` hook `@baicie/release` calls.
 *
 * `relativeDir` and `packageJson` are what the release passes; only the name
 * is needed, so the depth is looked up in a table built once per process.
 */
export function createPackageKind(
  manifests: ReadonlyArray<{ name: string; deps: ReadonlyArray<string> }>,
): (relativeDir: string, packageJson: Manifest) => string | undefined {
  const depths = computePublishDepths(manifests)

  return (_relativeDir, packageJson) => {
    const name = packageJson.name

    if (!name) {
      return undefined
    }

    const depth = depths.get(name)

    return depth === undefined ? undefined : publishKind(name, depth)
  }
}
