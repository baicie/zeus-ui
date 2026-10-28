/**
 * `@zeus-web/ai-react` — React adapter for Zeus AI Headless V2 (AI2-501).
 *
 * Hooks bridge controllers and the canonical store through
 * `useSyncExternalStore`; components render the shared primitive views with
 * React itself, and slots / render props accept any ReactNode. No Web
 * Component runtime, and importing it touches no DOM global (SSR-safe).
 */

export * from './agent'
export * from './chat'
export * from './coding'
export * from './hooks'
export * from './render'
