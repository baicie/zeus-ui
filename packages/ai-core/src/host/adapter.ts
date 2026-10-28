/**
 * Host adapter boundary (AI2-105 / AI2-110).
 *
 * The UI never executes side effects. It sends commands to a trusted host and
 * receives authoritative events, snapshots and assets back. Only this
 * interface is shared; SSE, WebSocket, Codex app-server and vendor backends map
 * onto it through separate adapters.
 */

import type { AssetRef } from '../domain/types'
import type { Command, CommandAck } from '../protocol/commands'
import type { AnyDomainEvent } from '../protocol/events'
import type { AiState } from '../store/state'

export interface SnapshotScope {
  kind: string
  id: string
}

export interface HostSnapshotPayload {
  cursors: Record<string, number>
  state: Partial<AiState>
  checksum?: string
}

export type AssetContent = Uint8Array | ReadableStream<Uint8Array>

export interface AiHostAdapter {
  execute: (command: Command, signal?: AbortSignal) => Promise<CommandAck>
  subscribe: (
    streamId: string,
    afterSeq: number,
    signal?: AbortSignal,
  ) => AsyncIterable<AnyDomainEvent>
  getSnapshot: (
    scope: SnapshotScope,
    signal?: AbortSignal,
  ) => Promise<HostSnapshotPayload>
  loadAsset: (asset: AssetRef, signal?: AbortSignal) => Promise<AssetContent>
}

export function createAcceptedAck(
  command: Command,
  operationId: string,
): CommandAck {
  return { accepted: true, commandId: command.commandId, operationId }
}

export function createRejectedAck(
  command: Command,
  code: string,
  message: string,
): CommandAck {
  return { accepted: false, commandId: command.commandId, code, message }
}
