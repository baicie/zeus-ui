/* eslint-disable no-restricted-globals */
/**
 * Chrome copy bound to the active language.
 *
 * Each binding rewrites a text node or attribute in place, so switching the
 * language never creates, removes or re-parents DOM. Focus, caret, draft text,
 * streamed output, scroll position and any open popover all survive a switch.
 *
 * Rules:
 * - Only chrome copy is registered here. Message text, code, diffs, file
 *   contents, tool output, model names, provider ids, gateway URLs and error
 *   codes are data and are written verbatim.
 * - A binding is dropped on refresh once its anchor has left the document, so
 *   panels that re-render often do not accumulate stale bindings.
 */

import type { WorkbenchMessageKey } from './locales/en'
import { subscribeLanguage, t } from './locale'

export type CopyValues = Readonly<Record<string, string | number>>

interface Binding {
  readonly update: () => void
  /**
   * Node whose connectivity says whether this binding is still live. Omitted
   * for bindings that update an element which is always in the document.
   */
  readonly anchor?: () => Node | undefined
  /** An anchor that was detached when bound may not be mounted yet. */
  seenConnected: boolean
}

export interface CopyScope {
  /** A text node whose content follows the active language. */
  text: (
    key: WorkbenchMessageKey,
    values?: () => CopyValues | undefined,
  ) => Text
  /** An element attribute (`aria-label`, `title`, `placeholder`…). */
  attr: (
    element: Element,
    name: string,
    key: WorkbenchMessageKey,
    values?: () => CopyValues | undefined,
  ) => void
  /** Sets an element's text content from copy, reusing one text node. */
  node: (
    element: Node,
    key: WorkbenchMessageKey,
    values?: () => CopyValues | undefined,
  ) => void
  /**
   * An arbitrary label update (derived from current state, not just a key).
   * Pass `anchor` when the target can leave the document.
   */
  custom: (update: () => void, anchor?: () => Node | undefined) => void
  /** Re-runs every live binding. */
  refresh: () => void
  /** Drops bindings whose target has left the document. */
  prune: () => void
  /** Drops every binding; call when the owner unmounts. */
  dispose: () => void
}

/**
 * A copy scope. `isAlive` lets a scope stop refreshing once its panel is torn
 * down even if some nodes are still reachable through user code.
 */
export function createCopy(isAlive?: () => boolean): CopyScope {
  let bindings: Binding[] = []

  const register = (
    update: () => void,
    anchor?: () => Node | undefined,
  ): void => {
    const binding: Binding = {
      update,
      anchor,
      seenConnected: anchor?.()?.isConnected === true,
    }
    bindings.push(binding)
    update()
  }

  const scope: CopyScope = {
    text(key, values) {
      const node = document.createTextNode('')
      register(
        () => {
          node.data = t(key, values?.())
        },
        () => node,
      )
      return node
    },
    attr(element, name, key, values) {
      register(
        () => {
          element.setAttribute(name, t(key, values?.()))
        },
        () => element,
      )
    },
    node(element, key, values) {
      const existing = element.firstChild
      const node =
        existing && existing.nodeType === 3 && !existing.nextSibling
          ? (existing as Text)
          : document.createTextNode('')
      if (node.parentNode !== element) {
        element.textContent = ''
        element.appendChild(node)
      }
      register(
        () => {
          node.data = t(key, values?.())
        },
        () => node,
      )
    },
    custom(update, anchor) {
      register(update, anchor)
    },
    refresh() {
      if (isAlive && !isAlive()) return
      scope.prune()
      for (const binding of bindings) binding.update()
    },
    prune() {
      bindings = bindings.filter(binding => {
        if (!binding.anchor) return true
        const node = binding.anchor()
        if (!node) return false
        if (node.isConnected) {
          binding.seenConnected = true
          return true
        }
        // Keep a binding whose node is not mounted yet, but drop one that has
        // been in the document and was removed.
        return !binding.seenConnected
      })
    },
    dispose() {
      bindings = []
    },
  }

  return scope
}

/**
 * Re-runs `scope` whenever the language changes. Returns the unsubscribe, to
 * be called by the owner's teardown.
 */
export function refreshOnLanguageChange(scope: CopyScope): () => void {
  return subscribeLanguage(() => scope.refresh())
}
