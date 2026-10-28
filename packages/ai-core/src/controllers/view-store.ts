/**
 * Controller base (AI2-201).
 *
 * Every controller exposes the same small surface:
 *
 * - `getSnapshot()` returns a frozen view model whose identity only changes
 *   when its content changes;
 * - `subscribe(selector, listener, equal?)` notifies only when the selected
 *   slice changed;
 * - `dispose()` releases the controller's own subscriptions and timers. It
 *   never cancels work the host already accepted.
 *
 * Nothing here touches the DOM; renderers adapt the view model.
 */

import type { Unsubscribe } from '../store/store'

export interface Controller<TView> {
  getSnapshot: () => Readonly<TView>
  subscribe: <T>(
    selector: (view: Readonly<TView>) => T,
    listener: (value: T) => void,
    equal?: (previous: T, next: T) => boolean,
  ) => Unsubscribe
  dispose: () => void
  readonly disposed: boolean
}

export interface ViewStore<TView> extends Controller<TView> {
  /** Shallow-merge a patch; no-op when every patched field is unchanged. */
  update: (
    patch: Partial<TView> | ((view: Readonly<TView>) => Partial<TView>),
  ) => void
  /** Register teardown work that runs once on `dispose()`. */
  onDispose: (cleanup: () => void) => void
  /** Live subscription count, for leak tests. */
  listenerCount: () => number
}

interface Listener {
  selector: (view: unknown) => unknown
  listener: (value: unknown) => void
  equal: (previous: unknown, next: unknown) => boolean
  last: unknown
}

export interface ViewStoreOptions {
  onListenerError?: (error: unknown) => void
}

export function createViewStore<TView extends object>(
  initial: TView,
  options: ViewStoreOptions = {},
): ViewStore<TView> {
  let view: Readonly<TView> = Object.freeze({ ...initial })
  let disposed = false
  const listeners = new Set<Listener>()
  const cleanups: (() => void)[] = []

  function notify(): void {
    for (const entry of [...listeners]) {
      if (!listeners.has(entry)) continue

      try {
        const value = entry.selector(view)
        if (entry.equal(entry.last, value)) continue
        entry.last = value
        entry.listener(value)
      } catch (error) {
        options.onListenerError?.(error)
      }
    }
  }

  return {
    getSnapshot(): Readonly<TView> {
      return view
    },
    subscribe<T>(
      selector: (value: Readonly<TView>) => T,
      listener: (value: T) => void,
      equal: (previous: T, next: T) => boolean = Object.is,
    ): Unsubscribe {
      if (disposed) return () => {}

      const entry: Listener = {
        selector: selector as (value: unknown) => unknown,
        listener: listener as (value: unknown) => void,
        equal: equal as (previous: unknown, next: unknown) => boolean,
        last: selector(view),
      }
      listeners.add(entry)

      return () => {
        listeners.delete(entry)
      }
    },
    update(patch): void {
      if (disposed) return

      const next = typeof patch === 'function' ? patch(view) : patch
      const keys = Object.keys(next) as (keyof TView)[]

      if (keys.every(key => Object.is(view[key], next[key]))) return

      view = Object.freeze({ ...view, ...next })
      notify()
    },
    onDispose(cleanup: () => void): void {
      if (disposed) cleanup()
      else cleanups.push(cleanup)
    },
    listenerCount(): number {
      return listeners.size
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      listeners.clear()
      for (const cleanup of cleanups.splice(0)) cleanup()
    },
    get disposed(): boolean {
      return disposed
    },
  }
}

/** Element-wise equality for arrays of ids or entities. */
export function sameItems<T>(
  previous: readonly T[] | undefined,
  next: readonly T[],
): boolean {
  if (previous === next) return true
  if (!previous || previous.length !== next.length) return false
  return previous.every((entry, index) => Object.is(entry, next[index]))
}

/** Unique ids for commands and idempotency keys. */
export type IdGenerator = (prefix: string) => string

let fallbackCounter = 0

export const defaultIdGenerator: IdGenerator = prefix => {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${(fallbackCounter += 1).toString(36)}-${Math.random().toString(36).slice(2)}`

  return `${prefix}-${random}`
}
