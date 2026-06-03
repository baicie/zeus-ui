// NOTE: @zeus-js/zeus/capabilities does not exist yet in the Zeus monorepo.
// When Zeus exports it, this file should be updated to:
//   export { ZEUS_CAPABILITIES } from '@zeus-js/zeus/capabilities'
// Until then, capabilities are maintained in ./capabilities.ts.
export {
  ZEUS_CAPABILITIES,
  assertZeusCompatRequirements,
  getMissingZeusCompatRequirements,
} from './capabilities'
export type { ZeusCapabilities, ZeusCompatRequirement } from './capabilities'

// All public APIs are re-exported from the unified @zeus-js/zeus public API.
// This is the only allowed import path — downstream packages MUST NOT import
// @zeus-js/runtime-dom or @zeus-js/signal directly.
export {
  For,
  Host,
  Show,
  Slot,
  batch,
  computed,
  createContext,
  defineElement,
  effect,
  inject,
  nextTick,
  onCleanup,
  provide,
  render,
  scope,
  state,
  untrack,
  useContext,
  watch,
} from '@zeus-js/zeus'

export type {
  Component,
  Context,
  ContextBridgeProps,
  ContextProviderProps,
  DefineElementContext,
  DefineElementMeta,
  DefineElementOptions,
  DefineElementSetup,
  ForProps,
  HostProps,
  JSXValue,
  ShowProps,
  SlotProps,
} from '@zeus-js/zeus'
