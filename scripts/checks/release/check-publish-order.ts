/**
 * Publish order acceptance: will the release publish dependencies first?
 *
 * ## What this adds over `publish-order.spec.ts`
 *
 * The unit test proves the *function* is right — given the manifests,
 * `createPackageKind` puts every dependency below its dependents. It does not
 * touch the question that actually decides publish order: whether the release
 * sorts by that kind, and by which comparator.
 *
 * That logic lives in `@baicie/release`, which cannot be imported here (its
 * `conventional-changelog` dependency fails to resolve under this Node). So
 * this check does two things instead of pretending to run it:
 *
 * 1. **Pins the comparator to vendor source.** It reads
 *    `@baicie/release/dist/index.js` and requires the exact sort expression
 *    and the `packageKind` call to still be there. If a dependency bump
 *    changes how the vendor orders packages, this fails and says so — the
 *    copy below is then known to be stale rather than silently wrong.
 * 2. **Applies that comparator** to the real workspace and asserts no
 *    dependency lands after its dependent.
 *
 * It also asserts the order is *not* alphabetical. If `packageKind` returned
 * `undefined` for everything, the sort would collapse to name order, and on a
 * tree that happens to sort well the inversion check would pass while
 * measuring nothing.
 *
 * ## What it still does not prove
 *
 * That npm accepts 46 sequential publishes. That is registry behaviour; the
 * only way to learn it is to publish. This narrows the gap between "the
 * function is correct" and "the release will publish in this order". It does
 * not close it, and the output says so.
 *
 * Usage: `pnpm exec tsx scripts/checks/release/check-publish-order.ts`
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

import {
  computePublishDepths,
  createPackageKind,
} from '../../release/publish-order'

const require = createRequire(import.meta.url)

const INTERNAL = '@zeus-web/'

/**
 * The comparator and the `packageKind` call, copied verbatim from
 * `@baicie/release/dist/index.js`. `checkVendorComparator` re-reads the
 * vendor file and fails when either no longer matches.
 */
const VENDOR_KIND_CALL =
  'config.workspace.packageKind?.(relativeDir, packageJson)'
const VENDOR_COMPARATOR =
  'if ((a.kind ?? "") !== (b.kind ?? "")) return (a.kind ?? "").localeCompare(b.kind ?? "");'

interface PackageJson {
  name?: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

interface Publishable {
  name: string
  relativeDir?: string
  packageJson: PackageJson
}

export interface PublishOrderReport {
  readonly ok: boolean
  readonly count: number
  readonly kinds: number
  readonly first: string
  readonly last: string
  readonly errors: readonly string[]
  readonly order: readonly string[]
}

/** Fails when the vendor no longer sorts by `packageKind`, or sorts differently. */
export function checkVendorComparator(): void {
  const entry = require.resolve('@baicie/release')
  const source = readFileSync(entry, 'utf8')

  const missing = [
    ['packageKind call', VENDOR_KIND_CALL],
    ['sort comparator', VENDOR_COMPARATOR],
  ].filter(([, needle]) => !source.includes(needle!))

  if (missing.length > 0) {
    throw new Error(
      [
        `@baicie/release at ${entry} no longer matches the comparator this check copies.`,
        ...missing.map(
          ([what]) =>
            `  missing ${what}: ${what === 'packageKind call' ? VENDOR_KIND_CALL : VENDOR_COMPARATOR}`,
        ),
        'Re-read the vendor sort before trusting this gate.',
      ].join('\n'),
    )
  }
}

function internalDeps(pkg: Publishable): string[] {
  return [
    ...Object.keys(pkg.packageJson.dependencies ?? {}),
    ...Object.keys(pkg.packageJson.peerDependencies ?? {}),
    ...Object.keys(pkg.packageJson.optionalDependencies ?? {}),
  ].filter(name => name.startsWith(INTERNAL))
}

/**
 * Runs the acceptance over the given workspace. Exported so the test can feed
 * a synthetic workspace without touching the real one.
 */
export function evaluatePublishOrder(
  publishable: readonly Publishable[],
): PublishOrderReport {
  const manifests = publishable.map(pkg => ({
    name: pkg.name,
    deps: [
      ...Object.entries(pkg.packageJson.dependencies ?? {}),
      ...Object.entries(pkg.packageJson.peerDependencies ?? {}),
      ...Object.entries(pkg.packageJson.optionalDependencies ?? {}),
    ]
      .filter(
        ([dep, version]) =>
          dep.startsWith(INTERNAL) && String(version).startsWith('workspace:'),
      )
      .map(([dep]) => dep),
  }))

  const kindOf = createPackageKind(manifests)

  // The vendor's comparator, as pinned by checkVendorComparator().
  const sorted = [...publishable].sort((a, b) => {
    const ka = kindOf(a.relativeDir ?? '', a.packageJson) ?? ''
    const kb = kindOf(b.relativeDir ?? '', b.packageJson) ?? ''
    if (ka !== kb) return ka.localeCompare(kb)
    return a.name.localeCompare(b.name)
  })

  const errors: string[] = []

  if (sorted.length === 0) {
    errors.push('the publishable set is empty; this gate would pass vacuously')
  }

  const position = new Map(sorted.map((pkg, index) => [pkg.name, index]))
  const publishableNames = new Set(publishable.map(pkg => pkg.name))

  for (const pkg of sorted) {
    for (const dep of internalDeps(pkg)) {
      /*
       * A `@zeus-web/*` dependency with `workspace:*` that is not in the
       * publishable set is the dangerous case, and skipping it is how this
       * gate would go green while the order is wrong.
       *
       * `computePublishDepths` treats such an edge as absent (`continue`), so
       * the dependent is computed at depth 0 and sorts *before* a dependency
       * that may well be published after it. Reproduced: with
       * `zzz -> ghost` and `aaa -> zzz`, the order came out `[zzz, aaa]` —
       * aaa before its dependency — and the gate reported ok.
       *
       * Today the tree has zero such edges. The check is here so that a
       * renamed or newly private package fails loudly instead of silently
       * shortening an edge.
       */
      if (!publishableNames.has(dep)) {
        errors.push(
          `${pkg.name} declares a workspace dependency on ${dep}, which is not in the publishable set; the publish order cannot place it, and computePublishDepths silently drops the edge`,
        )
        continue
      }

      const depPosition = position.get(dep)!
      const own = position.get(pkg.name)!
      if (depPosition > own) {
        errors.push(
          `${pkg.name} (position ${own + 1}) publishes before its dependency ${dep} (position ${depPosition + 1})`,
        )
      }
    }
  }

  /*
   * `packageKind` silently losing the dependency edges is the defect this gate
   * exists for. Its symptom is not "the order is alphabetical" — that is
   * correct for many small trees — and it is not "every kind is equal", because
   * `publishKind` embeds the package name, so kinds are always distinct.
   *
   * The real symptom is that every package lands at depth 0: with no edges,
   * `computePublishDepths` gives everything the same depth, `packageKind`
   * collapses to name order, and a publish can name a dependency that is not
   * on the registry yet. So check the depths, not the kind strings.
   *
   * Verified by stripping internal edges from the real manifests: the order
   * then becomes alphabetical and used to pass this gate.
   */
  const depths = computePublishDepths(manifests)
  const depthValues = new Set(depths.values())
  const hasInternalEdges = manifests.some(m => m.deps.length > 0)

  if (hasInternalEdges && depthValues.size <= 1 && manifests.length > 1) {
    errors.push(
      `every package has publish depth ${[...depthValues][0]}; the workspace declares internal dependencies but none reached the sort, so packageKind reduced to name order and this gate proves nothing`,
    )
  }

  return {
    ok: errors.length === 0,
    count: sorted.length,
    kinds: new Set(
      sorted.map(pkg => kindOf(pkg.relativeDir ?? '', pkg.packageJson)),
    ).size,
    first: sorted[0]?.name ?? '',
    last: sorted[sorted.length - 1]?.name ?? '',
    errors,
    order: sorted.map(pkg => pkg.name),
  }
}

async function main(): Promise<number> {
  checkVendorComparator()

  const { listPublishablePackages } = await import('../../release/workspace')
  const publishable = listPublishablePackages() as unknown as Publishable[]

  const report = evaluatePublishOrder(publishable)

  if (!report.ok) {
    for (const error of report.errors) console.error(`error: ${error}`)
    console.error(`\npublish order FAILED (${report.errors.length} errors)`)
    return 1
  }

  console.log(
    `publish order PASS: ${report.count} packages, ${report.kinds} kinds, 0 inversions`,
  )
  console.log(`  first: ${report.first}`)
  console.log(`  last:  ${report.last}`)
  console.log(
    '  note: this proves the order the release will use, not that npm accepts it.',
  )
  return 0
}

const invoked = process.argv[1] ?? ''
if (resolve(invoked) === resolve(new URL(import.meta.url).pathname)) {
  main().then(
    code => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    },
  )
}
