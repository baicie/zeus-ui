/**
 * AI2-511 · legacy import: explicit, one-way, never forges seq, approvals or
 * tool results.
 */

import { describe, expect, it } from 'vitest'
import { importLegacyAgentRun, importLegacyChat } from '../src/legacy/import'
import { createAiStore } from '../src/store/store'

describe('legacy chat import', () => {
  const { snapshot, diagnostics } = importLegacyChat(
    [
      { id: 'u1', role: 'user', content: 'Hi', createdAt: 1_700_000_000_000 },
      {
        id: 'a1',
        role: 'assistant',
        status: 'complete',
        parts: [
          { type: 'text', text: 'Here:' },
          { type: 'code', code: 'x()', language: 'js' },
          {
            type: 'tool-call',
            id: 't1',
            name: 'search',
            status: 'success',
            output: 'secret',
          },
          {
            type: 'artifact',
            id: 'art',
            kind: 'table',
            title: 'T',
            data: [[1]],
          },
        ],
      },
      { id: 'a2', role: 'assistant', status: 'streaming', content: 'half' },
    ],
    { conversationId: 'conv-legacy', importedAt: '2026-10-27T00:00:00.000Z' },
  )

  it('produces a loadable snapshot without a cursor', () => {
    const store = createAiStore({ streamId: snapshot.streamId })
    expect(
      store.loadSnapshot(JSON.parse(JSON.stringify(snapshot))),
    ).toMatchObject({ ok: true })
    expect(snapshot.streamId).toBe('legacy:conv-legacy')
    expect(snapshot.cursors).toEqual({})
    expect(store.getCursor()).toBe(0)
  })

  it('links messages linearly and maps content conservatively', () => {
    const messages = snapshot.state.messages
    expect(messages.get('a1')!.parentMessageId).toBe('u1')
    expect(messages.get('a1')!.parts.map(part => part.kind)).toEqual([
      'text',
      'text',
      'structured',
    ])
    expect(JSON.stringify(messages.get('a1'))).not.toContain('secret')
    expect(messages.get('a2')!.status).toBe('cancelled')
    expect(messages.get('u1')!.createdAt).toBe('2023-11-14T22:13:20.000Z')
    expect(diagnostics.map(entry => entry.code).sort()).toEqual([
      'artifact-inlined',
      'stream-interrupted',
      'tool-call-part-dropped',
    ])
  })

  it('creates no approvals, executions or tools', () => {
    expect(snapshot.state.approvals.size).toBe(0)
    expect(snapshot.state.executions.size).toBe(0)
    expect(snapshot.state.toolInvocations.size).toBe(0)
  })
})

describe('legacy agent run import', () => {
  it('folds the event log without inventing approvals or outputs', () => {
    const { snapshot, diagnostics } = importLegacyAgentRun(
      [
        {
          type: 'message',
          message: { id: 'u1', role: 'user', content: 'deploy' },
        },
        { type: 'status', status: 'running' },
        {
          type: 'message',
          message: { id: 'a1', role: 'assistant', content: 'On ' },
        },
        { type: 'message-delta', delta: 'it.' },
        {
          type: 'tool-call',
          toolCall: {
            id: 't1',
            name: 'shell',
            status: 'running',
            input: { cmd: 'deploy' },
          },
        },
        {
          type: 'tool-result',
          toolCall: {
            id: 't1',
            name: 'shell',
            status: 'success',
            output: 'ok',
          },
        },
        {
          type: 'artifact',
          artifact: {
            id: 'r',
            kind: 'markdown',
            title: 'Report',
            content: '# ok',
            url: 'javascript:alert(1)',
          },
        },
        { type: 'diagnostic' },
        { type: 'status', status: 'waiting' },
      ],
      {
        conversationId: 'conv',
        executionId: 'run-1',
        importedAt: '2026-10-27T00:00:00.000Z',
      },
    )

    const state = snapshot.state
    expect(state.approvals.size).toBe(0)
    expect(state.executions.get('run-1')!.status).toBe('paused')
    expect(state.messages.get('a1')!.parts[0]).toMatchObject({ text: 'On it.' })
    expect(state.toolInvocations.get('t1')!.status).toBe('succeeded')
    expect(state.toolInvocations.get('t1')!.resultAssetId).toBeUndefined()
    expect(state.steps.get('step-t1')!.status).toBe('completed')
    expect(JSON.stringify(snapshot)).not.toContain('javascript:')
    expect(diagnostics.map(entry => entry.code)).toEqual(
      expect.arrayContaining([
        'tool-output-dropped',
        'artifact-url-dropped',
        'waiting-status-mapped',
        'diagnostic-events-dropped',
      ]),
    )
  })

  it('marks an unfinished run cancelled instead of running', () => {
    const { snapshot } = importLegacyAgentRun(
      [{ type: 'status', status: 'running' }],
      {
        conversationId: 'c',
        executionId: 'r',
      },
    )
    expect(snapshot.state.executions.get('r')!.status).toBe('cancelled')
  })
})
