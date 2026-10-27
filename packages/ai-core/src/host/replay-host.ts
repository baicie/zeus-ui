/**
 * Replay host (AI2-110).
 *
 * Replays a recorded authoritative event stream so the exact same canonical
 * state can be rebuilt in CI without a network or a live model. A replay host
 * cannot accept commands: pretending it could would fabricate approvals.
 */

import type { AssetRef } from '../domain/types'

import type { Command, CommandAck } from '../protocol/commands'
import type { AnyDomainEvent } from '../protocol/events'
import type {
  AiHostAdapter,
  AssetContent,
  HostSnapshotPayload,
  SnapshotScope,
} from './adapter'
import { createRejectedAck } from './adapter'

export interface ReplayHostOptions {
  streamId?: string
}

export interface ReplayHost extends AiHostAdapter {
  events: () => readonly AnyDomainEvent[]
}

export function createReplayHost(
  recorded: readonly AnyDomainEvent[],
  options: ReplayHostOptions = {},
): ReplayHost {
  const streamId = options.streamId ?? recorded[0]?.streamId ?? 'replay-stream'
  const events = recorded
    .filter(event => event.streamId === streamId)
    .slice()
    .sort((left, right) => left.seq - right.seq)

  const lastSeq = events.length > 0 ? events[events.length - 1].seq : 0

  return {
    events(): readonly AnyDomainEvent[] {
      return events
    },
    async execute(command: Command): Promise<CommandAck> {
      return createRejectedAck(
        command,
        'AI_HOST_READONLY',
        'replay host cannot execute commands',
      )
    },
    subscribe(
      targetStreamId: string,
      afterSeq: number,
      signal?: AbortSignal,
    ): AsyncIterable<AnyDomainEvent> {
      async function* iterate(): AsyncIterable<AnyDomainEvent> {
        for (const event of events) {
          if (signal?.aborted) return
          if (targetStreamId !== streamId) continue
          if (event.seq <= afterSeq) continue
          yield event
        }
      }

      return iterate()
    },
    async getSnapshot(scope: SnapshotScope): Promise<HostSnapshotPayload> {
      void scope

      return { cursors: { [streamId]: lastSeq }, state: {} }
    },
    async loadAsset(
      asset: AssetRef,
      signal?: AbortSignal,
    ): Promise<AssetContent> {
      if (signal?.aborted) throw new Error('AI_ASSET_ABORTED')
      void asset
      throw new Error('AI_ASSET_UNAVAILABLE_IN_REPLAY')
    },
  }
}
