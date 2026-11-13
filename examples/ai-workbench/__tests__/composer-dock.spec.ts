/* eslint-disable no-restricted-globals */
/**
 * Unit contract for the composer dock (PR-A).
 *
 * The gate in `scripts/checks/ai/check-ai-workbench-p0.ts` proves the whole
 * page in three browsers. This file pins the rule underneath it without a
 * browser, so a regression names the exact invariant that broke:
 *
 * - one owner at a time;
 * - the previous owner is detached, so it can neither be focused nor submit;
 * - a late `release` from a mode that no longer owns the dock is a no-op.
 */
import { describe, expect, it } from 'vitest'

import { createComposerDock } from '../src/composer-dock'

/** A zone that is really in the document, so `isConnected` means something. */
function mountedZone(): HTMLElement {
  const zone = document.createElement('div')
  document.body.append(zone)
  return zone
}

describe('composer dock', () => {
  it('keeps exactly one owner and detaches the previous one', () => {
    const zone = mountedZone()
    const dock = createComposerDock(zone)
    const host = document.createElement('div')
    host.id = 'host-composer'
    const byok = document.createElement('div')
    byok.id = 'byok-composer'

    dock.claim({ id: 'host', element: host })
    expect(dock.activeId()).toBe('host')
    expect(host.isConnected).toBe(true)

    dock.claim({ id: 'byok', element: byok })
    expect(dock.activeId()).toBe('byok')
    expect(byok.isConnected).toBe(true)
    // Detached, not hidden: a detached node cannot take focus or a submit.
    expect(host.isConnected).toBe(false)
    expect(zone.querySelectorAll('#host-composer')).toHaveLength(0)
    expect(zone.querySelectorAll('#byok-composer')).toHaveLength(1)
  })

  it('ignores a release from a mode that no longer owns the dock', () => {
    const zone = mountedZone()
    const dock = createComposerDock(zone)
    const host = document.createElement('div')
    host.id = 'host-composer'
    const byok = document.createElement('div')
    byok.id = 'byok-composer'

    dock.claim({ id: 'host', element: host })
    dock.claim({ id: 'byok', element: byok })
    // The Host view tearing down late must not empty the BYOK composer.
    dock.release('host')
    expect(dock.activeId()).toBe('byok')
    expect(byok.isConnected).toBe(true)

    dock.release('byok')
    expect(dock.activeId()).toBeUndefined()
    expect(byok.isConnected).toBe(false)
  })

  it('moves the zone, never the composer, between hosts', () => {
    const zone = document.createElement('div')
    const welcome = document.createElement('div')
    const surface = document.createElement('div')
    const dock = createComposerDock(zone)
    const owner = document.createElement('div')
    owner.id = 'composer'

    dock.claim({ id: 'host', element: owner })
    dock.mount(welcome)
    expect(zone.parentElement).toBe(welcome)
    const node = owner

    dock.mount(surface)
    expect(zone.parentElement).toBe(surface)
    // The same element instance: a draft and its caret survive the move.
    expect(dock.activeElement()).toBe(node)
  })

  it('focuses the newly claimed composer only when asked', () => {
    const zone = mountedZone()
    const dock = createComposerDock(zone)
    const first = document.createElement('button')
    const second = document.createElement('button')

    let focusedFirst = 0
    let focusedSecond = 0
    dock.claim({ id: 'host', element: first, focus: () => (focusedFirst += 1) })
    expect(focusedFirst).toBe(0)
    dock.claim(
      { id: 'byok', element: second, focus: () => (focusedSecond += 1) },
      { focus: true },
    )
    expect(focusedSecond).toBe(1)
  })
})
