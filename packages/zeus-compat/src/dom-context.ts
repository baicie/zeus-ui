import type { Context } from '@zeus-js/zeus'

import { onCleanup } from '@zeus-js/zeus'

/**
 * DOM event used by Zeus custom elements to look up context values across
 * custom element boundaries. Zeus `defineElement({ consumes })` and
 * `Context.Bridge` use the same event name and detail shape, so values
 * provided here are visible to them and the other way round.
 */
const DOM_CONTEXT_REQUEST_EVENT = 'zeus:context-request'

export type DOMContext<T = unknown> = Context<T>

export interface DOMContextResolution<T> {
  found: boolean
  value: T | undefined
}

interface DOMContextRequestDetail {
  id: symbol
  resolved: boolean
  value: unknown
  resolve: (value: unknown) => void
}

/**
 * Answers context requests that bubble through `target`.
 *
 * Call it synchronously inside a custom element setup function. The listener
 * is removed when the element's owner scope is disposed.
 */
export function provideDOMContext<T>(
  target: EventTarget,
  context: DOMContext<T>,
  value: T,
): void {
  const handler = (event: Event): void => {
    const detail = (event as CustomEvent<DOMContextRequestDetail | undefined>)
      .detail

    if (!detail || detail.id !== context.id) return

    event.stopPropagation()
    detail.resolve(value)
  }

  target.addEventListener(DOM_CONTEXT_REQUEST_EVENT, handler)
  onCleanup(() => {
    target.removeEventListener(DOM_CONTEXT_REQUEST_EVENT, handler)
  })
}

/**
 * Dispatches a context request from `host` and returns the nearest provided
 * value. `found` distinguishes a missing provider from a provided `undefined`.
 */
export function resolveDOMContext<T>(
  host: HTMLElement,
  context: DOMContext<T>,
): DOMContextResolution<T> {
  const result: DOMContextResolution<T> = {
    found: false,
    value: undefined,
  }
  const detail: DOMContextRequestDetail = {
    id: context.id,
    resolved: false,
    value: undefined,
    resolve(next: unknown): void {
      result.found = true
      result.value = next as T
      detail.resolved = true
      detail.value = next
    },
  }

  host.dispatchEvent(
    new CustomEvent(DOM_CONTEXT_REQUEST_EVENT, {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail,
    }),
  )

  return result
}
