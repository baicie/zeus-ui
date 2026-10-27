/**
 * Vue composables for controllers and the canonical store (AI2-502).
 *
 * Each subscription is a `shallowRef` fed by the controller's selector
 * subscription and released with `onScopeDispose`, so a component updates
 * only when its slice changed. Owned controllers are disposed with the
 * component scope; disposing never cancels host work.
 */

import type { AiSession, AiState, AiStore, Controller } from '@zeus-web/ai-core'
import type { InjectionKey, ShallowRef } from 'vue'

import { idScopeFrom } from '@zeus-web/ai-primitives'
import {
  getCurrentScope,
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  useId,
} from 'vue'

function identity<T>(value: T): T {
  return value
}

export function useController<TView, TSelected = TView>(
  controller: Controller<TView>,
  selector: (view: Readonly<TView>) => TSelected = identity as (
    view: Readonly<TView>,
  ) => TSelected,
  equal?: (previous: TSelected, next: TSelected) => boolean,
): Readonly<ShallowRef<TSelected>> {
  const value = shallowRef(selector(controller.getSnapshot()))
  const stop = controller.subscribe(
    selector,
    next => {
      value.value = next
    },
    equal,
  )
  if (getCurrentScope()) onScopeDispose(stop)
  return value
}

export function useAiState<T>(
  store: AiStore,
  selector: (state: Readonly<AiState>) => T,
  equal?: (previous: T, next: T) => boolean,
): Readonly<ShallowRef<T>> {
  const value = shallowRef(selector(store.getState()))
  const stop = store.subscribe(
    selector,
    next => {
      value.value = next
    },
    equal,
  )
  if (getCurrentScope()) onScopeDispose(stop)
  return value
}

/** Create a controller for this component scope and dispose it with the scope. */
export function useOwnedController<TController extends { dispose: () => void }>(
  factory: () => TController,
): TController {
  const controller = factory()
  if (getCurrentScope()) onScopeDispose(() => controller.dispose())
  return controller
}

export function useIds(): ReturnType<typeof idScopeFrom> {
  return idScopeFrom(`zw-ai-${useId() ?? 'x'}`)
}

const SESSION: InjectionKey<AiSession> = Symbol('zw-ai-session')

/** Composition convenience; nothing requires it. */
export function provideAiSession(session: AiSession): void {
  provide(SESSION, session)
}

export function useAiSession(explicit?: AiSession): AiSession {
  const session = explicit ?? inject(SESSION, null)
  if (!session) {
    throw new Error(
      '[AI_VUE_NO_SESSION] pass `session` or call provideAiSession()',
    )
  }
  return session
}

export function focusById(id: string): void {
  const doc = (globalThis as { document?: Document }).document
  doc?.getElementById(id)?.focus()
}

export function defaultCopy(text: string): void {
  const clipboard = (globalThis as { navigator?: Navigator }).navigator
    ?.clipboard
  if (clipboard) void clipboard.writeText(text).catch(() => {})
}
