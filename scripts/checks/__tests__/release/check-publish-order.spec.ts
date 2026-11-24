import { describe, expect, it } from 'vitest'

import { listPublishablePackages } from '../../../release/workspace'
import {
  checkVendorComparator,
  evaluatePublishOrder,
} from '../../release/check-publish-order'

function pkg(
  name: string,
  dependencies: Record<string, string> = {},
): {
  name: string
  relativeDir: string
  packageJson: { name: string; dependencies: Record<string, string> }
} {
  return {
    name,
    relativeDir: `packages/${name.replace('@zeus-web/', '')}`,
    packageJson: { name, dependencies },
  }
}

function workspace(dep: string): Record<string, string> {
  return {
    [dep]: 'workspace:*',
  }
}

describe('publish order acceptance', () => {
  it('keeps the vendor comparator from drifting', () => {
    // Throws when @baicie/release no longer sorts by packageKind, or sorts by
    // a different expression. The copy in check-publish-order.ts is only
    // trustworthy while this passes.
    expect(() => checkVendorComparator()).not.toThrow()
  })

  it('accepts a tree whose dependencies precede their dependents', () => {
    const report = evaluatePublishOrder([
      pkg('@zeus-web/base'),
      pkg('@zeus-web/mid', workspace('@zeus-web/base')),
      pkg('@zeus-web/top', workspace('@zeus-web/mid')),
    ])

    expect(report.errors).toEqual([])
    expect(report.order).toEqual([
      '@zeus-web/base',
      '@zeus-web/mid',
      '@zeus-web/top',
    ])
  })

  it('rejects a dangling workspace dependency instead of dropping the edge', () => {
    /*
     * `computePublishDepths` skips edges to names it does not know, which puts
     * the dependent at depth 0 — ahead of a dependency that may publish later.
     * Skipping it here is how this gate would go green on a wrong order.
     */
    const report = evaluatePublishOrder([
      pkg('@zeus-web/zzz', workspace('@zeus-web/ghost')),
      pkg('@zeus-web/aaa', workspace('@zeus-web/zzz')),
    ])

    expect(report.ok).toBe(false)
    expect(report.errors.join('\n')).toContain('@zeus-web/ghost')
    expect(report.errors.join('\n')).toContain('not in the publishable set')
  })

  it('rejects an empty set rather than passing vacuously', () => {
    const report = evaluatePublishOrder([])

    expect(report.ok).toBe(false)
    expect(report.errors.join('\n')).toContain('empty')
  })

  it('accepts two unrelated packages even though the order is alphabetical', () => {
    // Alphabetical order is correct here. An earlier version of this gate
    // failed whenever the result matched alphabetical order, which is a false
    // positive on any tree that happens to sort well.
    const report = evaluatePublishOrder([
      pkg('@zeus-web/aaa'),
      pkg('@zeus-web/bbb'),
    ])

    expect(report.ok).toBe(true)
  })

  it('orders the real workspace with no inversions', () => {
    const report = evaluatePublishOrder(listPublishablePackages() as never[])

    expect(report.errors).toEqual([])
    expect(report.count).toBeGreaterThan(40)
    // The defect this replaces inverted 59 edges; that number is asserted in
    // publish-order.spec.ts against the raw alphabetical sort.
    expect(report.kinds).toBeGreaterThan(1)
  })
})
