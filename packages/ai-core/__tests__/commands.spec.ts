import { describe, expect, it } from 'vitest'

import {
  COMMAND_SCHEMA_VERSION,
  createCommand,
  createIdempotencyTracker,
  retryCommand,
  validateCommand,
} from '../src/protocol/commands'

const baseInput = {
  commandId: 'cmd-1',
  idempotencyKey: 'idem-1',
  type: 'message.send',
  target: { kind: 'conversation', id: 'conv-1' },
  payload: { text: 'hello' },
}

describe('command envelope (AI2-105)', () => {
  it('stamps the schema version and copies the target', () => {
    const command = createCommand(baseInput)

    expect(command.schemaVersion).toBe(COMMAND_SCHEMA_VERSION)
    expect(command.commandId).toBe('cmd-1')
    expect(command.idempotencyKey).toBe('idem-1')
    expect(command.target).toEqual({ kind: 'conversation', id: 'conv-1' })
    expect(command.target).not.toBe(baseInput.target)
  })

  it('rejects empty identity fields', () => {
    expect(() => createCommand({ ...baseInput, idempotencyKey: '' })).toThrow(
      'AI_COMMAND_INVALID',
    )
    expect(() =>
      createCommand({ ...baseInput, target: { kind: '', id: 'conv-1' } }),
    ).toThrow('AI_COMMAND_INVALID')
  })

  it('keeps the idempotency key on retries and only refreshes the tracing id', () => {
    const command = createCommand(baseInput)
    const retried = retryCommand(command, 'cmd-2')

    expect(retried.commandId).toBe('cmd-2')
    expect(retried.idempotencyKey).toBe(command.idempotencyKey)
  })

  it('validates unknown commands defensively', () => {
    expect(validateCommand(null)).toMatchObject({
      ok: false,
      code: 'AI_COMMAND_INVALID',
    })
    expect(
      validateCommand({ ...createCommand(baseInput), schemaVersion: 1 }),
    ).toMatchObject({ ok: false, code: 'AI_COMMAND_UNSUPPORTED_SCHEMA' })
    expect(
      validateCommand({ schemaVersion: COMMAND_SCHEMA_VERSION }),
    ).toMatchObject({
      ok: false,
      code: 'AI_COMMAND_INVALID',
    })
    expect(validateCommand(createCommand(baseInput))).toMatchObject({
      ok: true,
    })
  })
})

describe('idempotency tracker', () => {
  it('executes once, reports in-flight and replays the stored ack', () => {
    const tracker = createIdempotencyTracker()
    const command = createCommand(baseInput)

    expect(tracker.begin(command)).toEqual({ kind: 'execute' })
    expect(tracker.begin(retryCommand(command, 'cmd-2'))).toEqual({
      kind: 'in-flight',
    })

    const ack = {
      accepted: true as const,
      commandId: command.commandId,
      operationId: 'op-1',
    }

    tracker.acknowledge(command, ack)

    // Same operation, answered under the retry's tracing id.
    expect(tracker.begin(retryCommand(command, 'cmd-3'))).toEqual({
      kind: 'replay',
      ack: { ...ack, commandId: 'cmd-3' },
    })
  })

  it('treats a rejection as settled but keeps the failure code', () => {
    const tracker = createIdempotencyTracker()
    const command = createCommand(baseInput)
    const ack = {
      accepted: false as const,
      commandId: command.commandId,
      code: 'AI_POLICY_DENIED',
      message: 'denied by host policy',
    }

    tracker.begin(command)
    tracker.acknowledge(command, ack)

    const decision = tracker.begin(command)
    expect(decision.kind).toBe('replay')
    if (decision.kind === 'replay') {
      expect(decision.ack.accepted).toBe(false)
      expect(decision.ack).toMatchObject({ code: 'AI_POLICY_DENIED' })
    }
  })

  it('evicts settled entries beyond the configured limit', () => {
    const tracker = createIdempotencyTracker({ limit: 2 })

    for (let index = 0; index < 3; index += 1) {
      const command = createCommand({
        ...baseInput,
        idempotencyKey: `idem-${index}`,
      })
      tracker.begin(command)
      tracker.acknowledge(command, {
        accepted: true,
        commandId: command.commandId,
        operationId: `op-${index}`,
      })
    }

    expect(tracker.size()).toBe(2)
  })
})
