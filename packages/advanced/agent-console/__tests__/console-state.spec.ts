import { describe, expect, it } from 'vitest'

import {
  addArtifactToAgentConsoleState,
  addDiagnosticToAgentConsoleState,
  appendMessageToAgentConsoleState,
  cloneAgentConsoleState,
  createEmptyAgentConsoleState,
  finishToolCallInAgentConsoleState,
  getLatestAgentConsoleArtifact,
  getLatestAgentConsoleEvent,
  getLatestAgentConsoleMessage,
  getLatestAgentConsoleToolCall,
  resetAgentConsoleState,
  selectAgentConsoleArtifact,
  setAgentConsoleStatus,
  startToolCallInAgentConsoleState,
  updateMessageInAgentConsoleState,
} from '../src/core'

describe('console state', () => {
  it('creates empty state', () => {
    expect(createEmptyAgentConsoleState()).toEqual({
      status: 'idle',
      messages: [],
      toolCalls: [],
      artifacts: [],
      diagnostics: [],
      events: [],
    })
  })

  it('sets status and appends status event', () => {
    const state = setAgentConsoleStatus(
      createEmptyAgentConsoleState(),
      'running',
    )

    expect(state.status).toBe('running')
    expect(getLatestAgentConsoleEvent(state)).toMatchObject({
      type: 'status',
      status: 'running',
    })
  })

  it('appends and updates messages', () => {
    const state = appendMessageToAgentConsoleState(
      createEmptyAgentConsoleState(),
      {
        id: 'm1',
        role: 'assistant',
        content: 'Hello',
        createdAt: 1,
      },
    )

    expect(getLatestAgentConsoleMessage(state)?.content).toBe('Hello')
    expect(getLatestAgentConsoleEvent(state)?.type).toBe('message')

    const updated = updateMessageInAgentConsoleState(state, {
      id: 'm1',
      content: 'Hello world',
      updatedAt: 2,
    })

    expect(updated.messages[0].content).toBe('Hello world')
  })

  it('starts and finishes tool calls', () => {
    const started = startToolCallInAgentConsoleState(
      createEmptyAgentConsoleState(),
      {
        id: 't1',
        name: 'search',
        createdAt: 1,
      },
    )

    expect(getLatestAgentConsoleToolCall(started)?.status).toBe('running')
    expect(getLatestAgentConsoleEvent(started)?.type).toBe('tool-call')

    const finished = finishToolCallInAgentConsoleState(started, {
      id: 't1',
      output: {
        ok: true,
      },
      updatedAt: 2,
    })

    expect(finished.toolCalls[0].status).toBe('complete')
    expect(getLatestAgentConsoleEvent(finished)?.type).toBe('tool-result')
  })

  it('adds and selects artifacts', () => {
    const state = addArtifactToAgentConsoleState(
      createEmptyAgentConsoleState(),
      {
        id: 'a1',
        kind: 'json',
        title: 'Result',
      },
    )

    expect(getLatestAgentConsoleArtifact(state)?.id).toBe('a1')
    expect(state.selectedArtifactId).toBe('a1')

    const cleared = selectAgentConsoleArtifact(state, undefined)
    expect(cleared.selectedArtifactId).toBeUndefined()

    const selected = selectAgentConsoleArtifact(cleared, 'a1')
    expect(selected.selectedArtifactId).toBe('a1')
  })

  it('adds diagnostics', () => {
    const state = addDiagnosticToAgentConsoleState(
      createEmptyAgentConsoleState(),
      {
        id: 'd1',
        level: 'error',
        message: 'Failed',
      },
    )

    expect(state.diagnostics[0].message).toBe('Failed')
    expect(getLatestAgentConsoleEvent(state)?.type).toBe('diagnostic')
  })

  it('clones state and caps events', () => {
    const state = appendMessageToAgentConsoleState(
      appendMessageToAgentConsoleState(createEmptyAgentConsoleState(), {
        id: 'm1',
        role: 'user',
        content: 'A',
      }),
      {
        id: 'm2',
        role: 'assistant',
        content: 'B',
      },
    )

    const snapshot = cloneAgentConsoleState(state, {
      maxEvents: 1,
    })

    expect(snapshot.events).toHaveLength(1)
    expect(snapshot.events[0].message?.id).toBe('m2')
    expect(snapshot).not.toBe(state)
    expect(snapshot.messages).not.toBe(state.messages)
  })

  it('resets state and records reset event', () => {
    const state = resetAgentConsoleState('idle')

    expect(state.status).toBe('idle')
    expect(state.messages).toEqual([])
    expect(state.toolCalls).toEqual([])
    expect(state.artifacts).toEqual([])
    expect(state.diagnostics).toEqual([])
    expect(state.events).toEqual([
      expect.objectContaining({
        type: 'reset',
      }),
    ])
  })
})
