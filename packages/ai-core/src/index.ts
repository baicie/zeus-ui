/**
 * `@zeus-web/ai-core` — Zeus AI Headless V2 domain, protocol and store.
 *
 * Pure TypeScript: no DOM, React, Vue or network SDK is imported here, so the
 * same code runs in Node, the browser, a worker and SSR. UI packages build on
 * top of this layer; they never own authoritative state.
 */

export * from './domain/approval'
export * from './domain/changeset'
export * from './domain/execution'
export * from './domain/types'

export * from './host/adapter'
export * from './host/event-factory'
export * from './host/fixtures'
export * from './host/host-snapshot'

export * from './host/mock-host'
export * from './host/replay-host'
export * from './protocol/commands'
export * from './protocol/compat'
export * from './protocol/events'
export * from './protocol/validation'

export * from './store/reducers'
export * from './store/selectors'
export * from './store/snapshot'
export * from './store/state'
export * from './store/store'
