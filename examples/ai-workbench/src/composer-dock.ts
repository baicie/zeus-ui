/* eslint-disable no-restricted-globals */
/**
 * Composer ownership.
 *
 * Two chat modes share one shell, and each owns its own composer. This module
 * is the single place that decides which one is mounted. It exists because the
 * previous shell appended the BYOK composer into the same container the Host
 * composer already occupied and only hid the Host one in some paths: the user
 * saw two inputs, could focus the wrong one, and a conversation switch rebuilt
 * the container underneath the active mode.
 *
 * Rules:
 * - the dock owns the zone element; it never has more than one owner element;
 * - `claim()` detaches the previous owner from the document (not `hidden`), so
 *   a detached composer cannot receive focus, clicks or submits;
 * - `release(id)` only acts when that id currently owns the dock, so a late
 *   teardown cannot remove the other mode's composer;
 * - the dock moves the *zone* between the welcome block and the chat column;
 *   it never re-parents anything inside an owner's element.
 */

export interface ComposerOwner {
  readonly id: string
  readonly element: HTMLElement
  /** Focus target, used after a user-driven mode or chat switch. */
  readonly focus?: () => void
}

export interface ComposerDock {
  /** Makes `owner` the only composer in the zone. */
  claim: (owner: ComposerOwner, options?: { focus?: boolean }) => void
  /** Detaches the owner's element if (and only if) it owns the dock. */
  release: (id: string) => void
  activeId: () => string | undefined
  activeElement: () => HTMLElement | undefined
  /** Places the whole zone in `host`; claimed nodes move with it. */
  mount: (host: HTMLElement) => void
  /** The welcome suggestion chip, owned by the dock but shown per surface. */
  setAccessory: (element: HTMLElement | null) => void
  setAccessoryVisible: (visible: boolean) => void
}

export function createComposerDock(zone: HTMLElement): ComposerDock {
  const slot = document.createElement('div')
  slot.className = 'wb-dock-slot'
  const accessory = document.createElement('div')
  accessory.className = 'wb-dock-accessory'
  accessory.hidden = true
  zone.replaceChildren(slot, accessory)

  let active: ComposerOwner | undefined
  let accessoryElement: HTMLElement | null = null

  return {
    claim(owner, options) {
      if (active?.id === owner.id && active.element === owner.element) {
        if (options?.focus) owner.focus?.()
        return
      }
      // Detach first: a composer that is not in the document cannot be
      // focused, typed into or submitted, which is what "inactive" must mean.
      active?.element.remove()
      active = owner
      slot.replaceChildren(owner.element)
      if (options?.focus) owner.focus?.()
    },
    release(id) {
      if (active?.id !== id) return
      active.element.remove()
      active = undefined
    },
    activeId: () => active?.id,
    activeElement: () => active?.element,
    mount(host) {
      if (zone.parentElement !== host) host.append(zone)
    },
    setAccessory(element) {
      accessoryElement = element
      accessory.replaceChildren(...(element ? [element] : []))
    },
    setAccessoryVisible(visible) {
      accessory.hidden = !visible || !accessoryElement
    },
  }
}
