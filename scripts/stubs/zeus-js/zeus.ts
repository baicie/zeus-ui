// Stub type declarations for @zeus-js/zeus.
// This file allows the workspace to typecheck without a real @zeus-js/zeus installation.
// During local development, use `pnpm link:zeus-js` to symlink the real Zeus monorepo.
// During CI/canary runs, @zeus-js/*@canary is installed via pnpm add, which provides the real types.

// Re-exported runtime APIs
declare const For: unknown
declare const Host: (props: Record<string, unknown>) => Record<string, unknown>
declare const Show: unknown
declare const Slot: unknown
declare const batch: unknown
declare const computed: unknown
declare const createContext: unknown
declare const defineElement: (
  name: string,
  opts: Record<string, unknown>,
  setup: (props: Record<string, unknown>, ctx: unknown) => unknown,
) => unknown
declare const effect: unknown
declare const inject: unknown
declare const nextTick: unknown
declare const onCleanup: unknown
declare const provide: unknown
declare const render: unknown
declare const scope: unknown
declare const state: unknown
declare const untrack: unknown
declare const useContext: unknown
declare const watch: unknown

// Re-exported type definitions
declare type Component = unknown
declare type Context = unknown
declare type ContextBridgeProps = unknown
declare type ContextProviderProps = unknown
declare type DefineElementContext = unknown
declare type DefineElementMeta = unknown
declare type DefineElementOptions = unknown
declare type DefineElementSetup = (
  props: Record<string, unknown>,
  ctx: unknown,
) => unknown
declare type ForProps<_T = unknown> = unknown
declare type HostProps = unknown
declare type JSXValue = unknown
declare type ShowProps<_T = unknown> = unknown
declare type SlotProps = unknown

// Capabilities sub-path export (used by zeus-compat/capabilities.ts at runtime via dynamic import)
declare const ZEUS_CAPABILITIES: unknown

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
  ZEUS_CAPABILITIES,
}
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
}
