/**
 * React bindings for controllers and the canonical store.
 *
 * Subscriptions go through `useSyncExternalStore` with selectors, so a
 * component re-renders only when its slice changed (AI2-109 carried into
 * React). Owned controllers are created once per mount and disposed on
 * unmount; `StrictMode`'s double effect run recreates a disposed instance
 * instead of rendering a dead one.
 */

import type { AiSession, AiState, AiStore, Controller } from '@zeus-web/ai-core'
import type { ReactElement, ReactNode } from 'react'

import { createViewStore } from '@zeus-web/ai-core'
import { idScopeFrom } from '@zeus-web/ai-primitives'
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

function identity<T>(value: T): T {
  return value
}

/** Subscribe to a controller view, or to a selected slice of it. */
export function useController<TView, TSelected = TView>(
  controller: Controller<TView>,
  selector: (view: Readonly<TView>) => TSelected = identity as (
    view: Readonly<TView>,
  ) => TSelected,
  equal: (previous: TSelected, next: TSelected) => boolean = Object.is,
): TSelected {
  const selectorRef = useRef(selector)
  selectorRef.current = selector

  return useSyncExternalStore(
    notify =>
      controller.subscribe(
        view => selectorRef.current(view),
        () => notify(),
        equal,
      ),
    () => selectorRef.current(controller.getSnapshot()),
    () => selectorRef.current(controller.getSnapshot()),
  )
}

const ABSENT = createViewStore<Record<string, never>>({})

/**
 * `useController` for an optional controller: returns undefined while it is
 * absent, without breaking the rules of hooks.
 */
export function useOptionalController<TView, TSelected>(
  controller: Controller<TView> | undefined,
  selector: (view: Readonly<TView>) => TSelected,
): TSelected | undefined {
  return useController((controller ?? ABSENT) as Controller<unknown>, view =>
    controller ? selector(view as Readonly<TView>) : undefined,
  )
}

/** Subscribe to a slice of canonical state. */
export function useAiState<T>(
  store: AiStore,
  selector: (state: Readonly<AiState>) => T,
  equal: (previous: T, next: T) => boolean = Object.is,
): T {
  const selectorRef = useRef(selector)
  selectorRef.current = selector

  return useSyncExternalStore(
    notify =>
      store.subscribe(
        state => selectorRef.current(state),
        () => notify(),
        equal,
      ),
    () => selectorRef.current(store.getState()),
    () => selectorRef.current(store.getState()),
  )
}

/**
 * Create a controller for this component and dispose it on unmount or when
 * `deps` change. Disposing never cancels host work.
 */
export function useOwnedController<
  TController extends { dispose: () => void; readonly disposed: boolean },
>(factory: () => TController, deps: readonly unknown[]): TController {
  const [controller, setController] = useState(factory)
  const depsRef = useRef(deps)
  const factoryRef = useRef(factory)
  factoryRef.current = factory

  useEffect(() => {
    let current = controller
    const changed =
      depsRef.current.length !== deps.length ||
      depsRef.current.some((dep, index) => !Object.is(dep, deps[index]))

    // StrictMode disposes once on purpose; deps changes need a fresh one.
    if (current.disposed || changed) {
      current = factoryRef.current()
      depsRef.current = deps
      setController(current)
    }

    return () => current.dispose()
  }, deps)

  return controller
}

/** Deterministic DOM ids per component (SSR-stable via `useId`). */
export function useIds(): ReturnType<typeof idScopeFrom> {
  const id = useId()
  return useMemo(() => idScopeFrom(`zw-ai${id}`), [id])
}

const SessionContext = createContext<AiSession | null>(null)

export interface AiSessionProviderProps {
  session: AiSession
  children?: ReactNode
}

/** Composition convenience; nothing requires a provider. */
export function AiSessionProvider(props: AiSessionProviderProps): ReactElement {
  return createElement(
    SessionContext.Provider,
    { value: props.session },
    props.children,
  )
}

export function useAiSession(explicit?: AiSession): AiSession {
  const context = useContext(SessionContext)
  const session = explicit ?? context
  if (!session) {
    throw new Error(
      '[AI_REACT_NO_SESSION] pass `session` or render inside <AiSessionProvider>',
    )
  }
  return session
}

/** Focus an element by id, when a document exists (SSR-safe). */
export function focusById(id: string): void {
  const doc = (globalThis as { document?: Document }).document
  doc?.getElementById(id)?.focus()
}

/** Clipboard writer used by copy actions; no-op where unavailable. */
export function defaultCopy(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    void navigator.clipboard.writeText(text).catch(() => {})
  }
}
