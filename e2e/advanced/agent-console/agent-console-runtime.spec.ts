import type {
  AgentConsoleArtifactSelectDetail,
  AgentConsoleEventDetail,
  AgentConsoleResetDetail,
  AgentConsoleStatusChangeDetail,
} from './agent-console-runtime-harness'

import { afterEach, describe, expect, it } from 'vitest'

import {
  cleanupAgentConsoleFixtures,
  collectEvents,
  mountAgentConsole,
  nextFrame,
} from './agent-console-runtime-harness'

describe('zw-agent-console runtime', () => {
  afterEach(() => {
    cleanupAgentConsoleFixtures()
  })

  it('mounts and exposes runtime methods', async () => {
    const consoleElement = await mountAgentConsole()

    expect(consoleElement.tagName.toLowerCase()).toBe('zw-agent-console')
    expect(typeof consoleElement.appendMessage).toBe('function')
    expect(typeof consoleElement.startToolCall).toBe('function')
    expect(typeof consoleElement.addArtifact).toBe('function')
    expect(typeof consoleElement.getState).toBe('function')

    expect(consoleElement.getState().messages).toHaveLength(1)
    expect(consoleElement.getState().artifacts).toHaveLength(1)
  })

  it('appendMessage emits agent-event and updates state', async () => {
    const consoleElement = await mountAgentConsole()
    const collector = collectEvents<AgentConsoleEventDetail>(
      consoleElement,
      'agent-event',
    )

    const message = consoleElement.appendMessage({
      id: 'm2',
      role: 'assistant',
      content: 'Hello',
    })

    await nextFrame()

    expect(message.id).toBe('m2')
    expect(consoleElement.getState().messages).toHaveLength(2)
    expect(collector.events).toHaveLength(1)
    expect(collector.events[0].detail.event.type).toBe('message')
    expect(collector.events[0].detail.event.message?.content).toBe('Hello')

    collector.dispose()
  })

  it('updates messages', async () => {
    const consoleElement = await mountAgentConsole()

    consoleElement.appendMessage({
      id: 'm2',
      role: 'assistant',
      content: 'Draft',
      status: 'streaming',
    })

    consoleElement.updateMessage({
      id: 'm2',
      content: 'Final',
      status: 'complete',
    })

    await nextFrame()

    expect(
      consoleElement.getState().messages.find(message => message.id === 'm2'),
    ).toMatchObject({
      content: 'Final',
      status: 'complete',
    })
  })

  it('tracks tool calls', async () => {
    const consoleElement = await mountAgentConsole()
    const collector = collectEvents<AgentConsoleEventDetail>(
      consoleElement,
      'agent-event',
    )

    const toolId = consoleElement.startToolCall({
      id: 't1',
      name: 'search',
      input: { q: 'zeus' },
    })

    consoleElement.finishToolCall({
      id: toolId,
      output: { ok: true },
    })

    await nextFrame()

    expect(consoleElement.getState().toolCalls[0]).toMatchObject({
      id: 't1',
      status: 'complete',
      output: { ok: true },
    })

    expect(collector.events.map(event => event.detail.event.type)).toEqual([
      'tool-call',
      'tool-result',
    ])

    collector.dispose()
  })

  it('adds artifacts and selects them', async () => {
    const consoleElement = await mountAgentConsole()
    const collector = collectEvents<AgentConsoleArtifactSelectDetail>(
      consoleElement,
      'artifact-select',
    )

    const artifact = consoleElement.addArtifact({
      id: 'a2',
      kind: 'code',
      title: 'Generated code',
      content: 'console.log(1)',
    })

    expect(artifact.id).toBe('a2')

    const selected = consoleElement.selectArtifact('a2')

    await nextFrame()

    expect(selected?.id).toBe('a2')
    expect(consoleElement.selectedArtifactId).toBe('a2')
    expect(collector.events[0].detail.artifactId).toBe('a2')

    collector.dispose()
  })

  it('adds diagnostics', async () => {
    const consoleElement = await mountAgentConsole()

    consoleElement.addDiagnostic({
      id: 'd1',
      level: 'warning',
      message: 'Slow tool call',
      source: 'tool',
    })

    await nextFrame()

    expect(consoleElement.getState().diagnostics).toEqual([
      expect.objectContaining({
        id: 'd1',
        level: 'warning',
        message: 'Slow tool call',
      }),
    ])
  })

  it('emits status-change', async () => {
    const consoleElement = await mountAgentConsole()
    const collector = collectEvents<AgentConsoleStatusChangeDetail>(
      consoleElement,
      'status-change',
    )

    consoleElement.setStatus('running')

    await nextFrame()

    expect(consoleElement.status).toBe('running')
    expect(collector.events).toHaveLength(1)
    expect(collector.events[0].detail).toMatchObject({
      previousStatus: 'idle',
      status: 'running',
    })

    collector.dispose()
  })

  it('caps events by maxEvents', async () => {
    const consoleElement = await mountAgentConsole({
      maxEvents: 2,
    })

    consoleElement.appendMessage({
      id: 'm2',
      role: 'user',
      content: 'A',
    })
    consoleElement.appendMessage({
      id: 'm3',
      role: 'assistant',
      content: 'B',
    })
    consoleElement.appendMessage({
      id: 'm4',
      role: 'assistant',
      content: 'C',
    })

    await nextFrame()

    expect(consoleElement.getEvents().map(event => event.message?.id)).toEqual([
      'm3',
      'm4',
    ])
  })

  it('resets state and emits reset', async () => {
    const consoleElement = await mountAgentConsole()
    const collector = collectEvents<AgentConsoleResetDetail>(
      consoleElement,
      'reset',
    )

    consoleElement.appendMessage({
      id: 'm2',
      role: 'assistant',
      content: 'Hello',
    })

    consoleElement.reset()

    await nextFrame()

    expect(consoleElement.getState().messages).toHaveLength(0)
    expect(consoleElement.getState().events).toHaveLength(1)
    expect(consoleElement.getState().events[0].type).toBe('reset')
    expect(collector.events).toHaveLength(1)

    collector.dispose()
  })

  it('syncs direct external property updates into state', async () => {
    const consoleElement = await mountAgentConsole()

    consoleElement.messages = [
      {
        id: 'external-message',
        role: 'assistant',
        content: 'External message',
        status: 'complete',
        createdAt: 10,
        updatedAt: 10,
      },
    ]

    consoleElement.toolCalls = [
      {
        id: 'external-tool',
        name: 'search',
        status: 'complete',
        input: {
          q: 'zeus',
        },
        output: {
          ok: true,
        },
        createdAt: 11,
        updatedAt: 12,
      },
    ]

    consoleElement.artifacts = [
      {
        id: 'external-artifact',
        kind: 'json',
        title: 'External artifact',
        content: {
          ok: true,
        },
        createdAt: 13,
        updatedAt: 13,
      },
    ]

    consoleElement.diagnostics = [
      {
        id: 'external-diagnostic',
        level: 'info',
        message: 'External diagnostic',
        createdAt: 14,
      },
    ]

    consoleElement.status = 'waiting'
    consoleElement.selectedArtifactId = 'external-artifact'

    await nextFrame()
    await nextFrame()

    expect(consoleElement.getState()).toMatchObject({
      status: 'waiting',
      selectedArtifactId: 'external-artifact',
      messages: [
        expect.objectContaining({
          id: 'external-message',
          content: 'External message',
        }),
      ],
      toolCalls: [
        expect.objectContaining({
          id: 'external-tool',
          status: 'complete',
        }),
      ],
      artifacts: [
        expect.objectContaining({
          id: 'external-artifact',
          title: 'External artifact',
        }),
      ],
      diagnostics: [
        expect.objectContaining({
          id: 'external-diagnostic',
          message: 'External diagnostic',
        }),
      ],
    })
  })
})
