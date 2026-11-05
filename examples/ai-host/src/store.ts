import type {
  AnyDomainEvent,
  Command,
  CommandAck,
  EventEntityRef,
  HostSnapshotPayload,
  SnapshotScope,
} from '@zeus-web/ai-core'
import { mkdirSync } from 'node:fs'

import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import {
  buildHostSnapshot,
  createEventFactory,
  createMockHost,
  validateCommand,
} from '@zeus-web/ai-core'

export interface PersistentHost {
  execute: (command: Command) => Promise<CommandAck>
  append: (
    type: AnyDomainEvent['type'],
    entity: EventEntityRef,
    payload: unknown,
  ) => AnyDomainEvent
  events: (streamId: string, afterSeq: number) => readonly AnyDomainEvent[]
  latestSeq: (streamId: string) => number
  findCommand: (idempotencyKey: string) => CommandAck | undefined
  subscribe: (
    streamId: string,
    afterSeq: number,
    signal?: AbortSignal,
  ) => AsyncIterable<AnyDomainEvent>
  getSnapshot: (scope: SnapshotScope) => Promise<HostSnapshotPayload>
  close: () => void
}

export interface HostDatabase {
  readonly file: string
  append: (event: AnyDomainEvent) => void
  events: (streamId: string) => AnyDomainEvent[]
  recordCommand: (command: Command, ack: CommandAck) => void
  findCommand: (
    idempotencyKey: string,
  ) => { command: Command; ack: CommandAck } | undefined
  latestSeq: (streamId: string) => number
  close: () => void
}

export function openHostDatabase(file: string): HostDatabase {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      stream_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      entity TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      PRIMARY KEY (stream_id, seq)
    );
    CREATE TABLE IF NOT EXISTS commands (
      idempotency_key TEXT PRIMARY KEY,
      command_id TEXT NOT NULL,
      command TEXT NOT NULL,
      ack TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
  return {
    file,
    append(event) {
      db.prepare(
        'INSERT OR REPLACE INTO events (stream_id, seq, event_id, entity, type, payload, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(
        event.streamId,
        event.seq,
        event.eventId,
        JSON.stringify(event.entity),
        event.type,
        JSON.stringify(event.payload),
        event.occurredAt,
      )
    },
    events(streamId) {
      return db
        .prepare(
          'SELECT stream_id, seq, event_id, entity, type, payload, occurred_at FROM events WHERE stream_id = ? ORDER BY seq',
        )
        .all(streamId)
        .map(
          row =>
            ({
              schemaVersion: 2,
              streamId: row.stream_id,
              seq: row.seq,
              eventId: row.event_id,
              entity: JSON.parse(row.entity as string),
              type: row.type,
              payload: JSON.parse(row.payload as string),
              occurredAt: row.occurred_at,
            }) as AnyDomainEvent,
        )
    },
    recordCommand(command, ack) {
      db.prepare(
        'INSERT OR REPLACE INTO commands (idempotency_key, command_id, command, ack, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(
        command.idempotencyKey,
        command.commandId,
        JSON.stringify(command),
        JSON.stringify(ack),
        new Date().toISOString(),
      )
    },
    findCommand(idempotencyKey) {
      const row = db
        .prepare('SELECT command, ack FROM commands WHERE idempotency_key = ?')
        .get(idempotencyKey) as { command: string; ack: string } | undefined
      return row
        ? { command: JSON.parse(row.command), ack: JSON.parse(row.ack) }
        : undefined
    },
    latestSeq(streamId) {
      const row = db
        .prepare('SELECT MAX(seq) AS seq FROM events WHERE stream_id = ?')
        .get(streamId) as { seq: number | null }
      return row.seq ?? 0
    },
    close: () => db.close(),
  }
}

export interface PersistentHostOptions {
  readonly database: HostDatabase
  readonly streamId?: string
  readonly onCommand?: (
    command: Command,
    emit: (event: AnyDomainEvent) => void,
  ) => Promise<CommandAck>
}

/**
 * Host whose event log and command ledger are durable. The in-memory mock is
 * reused only as the protocol/event factory; every accepted ack is committed
 * before it is returned, so a retry after restart replays the recorded result
 * instead of repeating the side effect.
 */
export function createPersistentHost(
  options: PersistentHostOptions,
): PersistentHost {
  const database = options.database
  const streamId = options.streamId ?? 'reference'
  const host = createMockHost({ streamId })
  const factory = createEventFactory(streamId, {
    startSeq: database.latestSeq(streamId) + 1,
  })
  let disposed = false
  const subscribers = new Set<() => void>()

  function append(
    type: AnyDomainEvent['type'],
    entity: EventEntityRef,
    payload: unknown,
  ): AnyDomainEvent {
    const event = factory.createForEntity(type, entity, payload)
    database.append(event)
    for (const wake of subscribers) wake()
    return event
  }

  return {
    async execute(command: Command): Promise<CommandAck> {
      if (disposed) {
        return {
          accepted: false,
          commandId: command.commandId,
          code: 'AI_HOST_CLOSED',
          message: 'host is closed',
        }
      }
      const validation = validateCommand(command)
      if (!validation.ok) {
        return {
          accepted: false,
          commandId: command.commandId,
          code: validation.code,
          message: validation.message,
        }
      }
      const recorded = database.findCommand(command.idempotencyKey)
      if (recorded) {
        if (
          JSON.stringify({ ...recorded.command, commandId: '' }) !==
          JSON.stringify({ ...command, commandId: '' })
        ) {
          return {
            accepted: false,
            commandId: command.commandId,
            code: 'AI_COMMAND_IDEMPOTENCY_CONFLICT',
            message: 'idempotencyKey was already used by a different command',
          }
        }
        return { ...recorded.ack, commandId: command.commandId }
      }
      const ack = options.onCommand
        ? await options.onCommand(command, event => {
            append(event.type, event.entity, event.payload)
          })
        : await host.execute(command)
      const stableAck = ack.accepted
        ? {
            ...ack,
            operationId: `operation-${database.latestSeq(streamId) + 1}`,
          }
        : ack
      database.recordCommand(command, stableAck)
      return stableAck
    },
    append,
    events(
      targetStreamId: string,
      afterSeq: number,
    ): readonly AnyDomainEvent[] {
      return database
        .events(targetStreamId)
        .filter(event => event.seq > afterSeq)
    },
    latestSeq(targetStreamId: string): number {
      return database.latestSeq(targetStreamId)
    },
    findCommand(idempotencyKey: string): CommandAck | undefined {
      return database.findCommand(idempotencyKey)?.ack
    },
    subscribe(
      targetStreamId: string,
      afterSeq: number,
      signal?: AbortSignal,
    ): AsyncIterable<AnyDomainEvent> {
      async function* iterate(): AsyncIterable<AnyDomainEvent> {
        let cursor = afterSeq
        for (;;) {
          if (disposed || signal?.aborted) break
          const events = database
            .events(targetStreamId)
            .filter(event => event.seq > cursor)
          if (events.length > 0) {
            for (const event of events) {
              cursor = event.seq
              yield event
            }
            continue
          }
          await new Promise<void>(resolve => {
            const wake = (): void => {
              subscribers.delete(wake)
              resolve()
            }
            subscribers.add(wake)
            signal?.addEventListener('abort', wake, { once: true })
          })
        }
      }
      return iterate()
    },
    getSnapshot(scope: SnapshotScope): Promise<HostSnapshotPayload> {
      void scope
      const events = database.events(streamId)
      return Promise.resolve(buildHostSnapshot(streamId, events))
    },
    close(): void {
      disposed = true
      host.close()
      for (const wake of subscribers) wake()
      subscribers.clear()
    },
  }
}
