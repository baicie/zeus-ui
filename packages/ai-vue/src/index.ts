/**
 * `@zeus-web/ai-vue` — Vue adapter for Zeus AI Headless V2 (AI2-502).
 *
 * Composables bridge controllers and the store into `shallowRef`s;
 * components render the shared primitive views with Vue render functions,
 * and scoped slots accept any VNode. No Web Component runtime; importing it
 * touches no DOM global (SSR-safe).
 */

export * from './agent'
export * from './chat'
export * from './coding'
export * from './composables'
export * from './render'
