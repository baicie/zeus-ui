/**
 * `@zeus-web/ai-adapters` — transport adapters for Zeus AI Headless V2
 * (AI2-111). Each one implements `AiHostAdapter` from `@zeus-web/ai-core`
 * and adds no DOM, UI or vendor SDK dependency: `fetch` and `WebSocket` are
 * looked up at call time or injected, so importing is safe under SSR.
 */

export * from './errors'
export * from './shared'
export * from './sse'
export * from './websocket'
