/**
 * Demo host for the published Workbench.
 *
 * The Pages build has no server, so there is no Host to connect to. Instead of
 * faking replies, it replays a real recording: `scripts/release/ai-demo-recording.mjs`
 * drives the actual `reference` Host over HTTP, captures the domain events it
 * emitted, and ships them as a static file. This module feeds those events to
 * `createReplayHost`, which is the same adapter the repo's CI uses — it rebuilds
 * the exact canonical state and refuses commands instead of fabricating
 * approvals.
 *
 * Nothing here invents a model response. What a visitor sees is what the Host
 * actually produced.
 */
import type {
  AiHostAdapter,
  AnyDomainEvent,
  AssetContent,
  AssetRef,
  Command,
  CommandAck,
  HostSnapshotPayload,
  SnapshotScope,
} from '@zeus-web/ai-core'
import { createReplayHost } from '@zeus-web/ai-core'

export interface AiDemoRecording {
  readonly schema: 'zeus.ai-demo/v1'
  readonly generatedAt: string
  readonly uiCommit: string
  readonly streamId: string
  readonly events: readonly AnyDomainEvent[]
  /**
   * Diff text captured from the Host alongside the events, keyed by asset id.
   * A diff is served as its own asset, not embedded in the stream, so a replay
   * needs these to show a change set instead of "asset unavailable".
   */
  readonly assets?: Readonly<Record<string, string>>
}

export function isAiDemoRecording(value: unknown): value is AiDemoRecording {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AiDemoRecording>
  return (
    candidate.schema === 'zeus.ai-demo/v1' && Array.isArray(candidate.events)
  )
}

// Injected by `vite.config.ts` (see the `define` block). Declared here rather
// than in `main.ts` so this module compiles on its own.
declare const __ZEUS_AI_DEMO__: boolean
declare const __ZEUS_AI_DEMO_BASE__: string

/** True in the read-only Pages build; the shell uses it to explain itself. */
export const isDemoBuild: boolean = __ZEUS_AI_DEMO__ === true

/** Vite's base for this build, e.g. `/zeus-demos/ai/`. */
export const DEMO_BASE: string = __ZEUS_AI_DEMO_BASE__ || '/'

let cached: AiHostAdapter | undefined

/**
 * Loads the recording once and returns a replay host.
 */
export async function loadDemoHost(): Promise<AiHostAdapter> {
  if (cached) return cached
  const url = `${DEMO_BASE}ai-demo-recording.json`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`无法加载演示录制（${response.status}）：${url}`)
  }
  const recording: unknown = await response.json()
  if (!isAiDemoRecording(recording)) {
    throw new Error('演示录制格式不正确（期望 zeus.ai-demo/v1）。')
  }
  const replay = createReplayHost(recording.events, {
    streamId: recording.streamId,
  })
  const assets = recording.assets ?? {}
  // The replay host has no server to ask for assets. Serve the recorded ones
  // by id, and keep the host's own failure for anything not recorded.
  cached = {
    ...replay,
    async loadAsset(
      asset: AssetRef,
      signal?: AbortSignal,
    ): Promise<AssetContent> {
      if (signal?.aborted) throw new Error('AI_ASSET_ABORTED')
      const text = assets[asset.id]
      if (text === undefined) return replay.loadAsset(asset, signal)
      return new TextEncoder().encode(text)
    },
  }
  return cached
}

/**
 * A host available synchronously that resolves to the recording on first use.
 *
 * `main.ts` builds the session at module scope, so awaiting there would push
 * the whole shell behind a top-level await. Every call that touches the network
 * — snapshot, subscribe, execute — waits for the one local file fetch instead.
 */
export function createDeferredDemoHost(): AiHostAdapter {
  return {
    async execute(command: Command, signal?: AbortSignal): Promise<CommandAck> {
      const host = await loadDemoHost()
      return host.execute(command, signal)
    },
    subscribe(
      streamId: string,
      afterSeq: number,
      signal?: AbortSignal,
    ): AsyncIterable<AnyDomainEvent> {
      // `subscribe` must return synchronously, so the generator awaits the
      // recording before delegating to the replay host's own iteration.
      const source = async function* (): AsyncGenerator<AnyDomainEvent> {
        const host = await loadDemoHost()
        yield* host.subscribe(streamId, afterSeq, signal)
      }
      return source()
    },
    async getSnapshot(
      scope: SnapshotScope,
      signal?: AbortSignal,
    ): Promise<HostSnapshotPayload> {
      const host = await loadDemoHost()
      return host.getSnapshot(scope, signal)
    },
    async loadAsset(
      asset: AssetRef,
      signal?: AbortSignal,
    ): Promise<AssetContent> {
      const host = await loadDemoHost()
      return host.loadAsset(asset, signal)
    },
  }
}
