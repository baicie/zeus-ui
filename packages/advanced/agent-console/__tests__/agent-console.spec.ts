import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const sourcePath = resolve(
  workspaceRoot,
  'packages/advanced/agent-console/src/components/agent-console.tsx',
)
const source = readFileSync(sourcePath, 'utf-8')

describe('agent-console component protocol', () => {
  it('infers props, events, methods, slots and parts', () => {
    const result = analyzeFile({
      file: 'packages/advanced/agent-console/src/components/agent-console.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-agent-console',
      props: {
        status: {
          type: 'string',
          values: ['idle', 'running', 'waiting', 'complete', 'error'],
          default: 'idle',
          reflect: true,
        },
        selectedArtifactId: {
          type: 'string',
        },
        maxEvents: {
          type: 'number',
        },
        ariaLabel: {
          type: 'string',
        },
      },
      events: {
        agentEvent: {
          name: 'agent-event',
          reactName: 'onAgentEvent',
        },
        statusChange: {
          name: 'status-change',
          reactName: 'onStatusChange',
        },
        artifactSelect: {
          name: 'artifact-select',
          reactName: 'onArtifactSelect',
        },
        reset: {
          name: 'reset',
          reactName: 'onReset',
        },
      },
      methods: {
        appendMessage: {
          name: 'appendMessage',
          returns: 'AgentConsoleMessage',
        },
        updateMessage: {
          name: 'updateMessage',
          returns: 'AgentConsoleMessage | unknown',
        },
        startToolCall: {
          name: 'startToolCall',
          returns: 'string',
        },
        finishToolCall: {
          name: 'finishToolCall',
          returns: 'void',
        },
        addArtifact: {
          name: 'addArtifact',
          returns: 'AgentConsoleArtifact',
        },
        selectArtifact: {
          name: 'selectArtifact',
          returns: 'AgentConsoleArtifact | unknown',
        },
        addDiagnostic: {
          name: 'addDiagnostic',
          returns: 'void',
        },
        setStatus: {
          name: 'setStatus',
          returns: 'void',
        },
        getState: {
          name: 'getState',
          returns: 'AgentConsoleState',
        },
        getEvents: {
          name: 'getEvents',
          returns: 'AgentConsoleEvent[]',
        },
        reset: {
          name: 'reset',
          returns: 'void',
        },
      },
      slots: {
        timeline: {
          name: 'timeline',
        },
        tools: {
          name: 'tools',
        },
        artifacts: {
          name: 'artifacts',
        },
        diagnostics: {
          name: 'diagnostics',
        },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining([
        'root',
        'layout',
        'timeline',
        'tools',
        'artifacts',
        'diagnostics',
      ]),
    )
  })

  it('does not include provider or network logic', () => {
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('EventSource')
    expect(source).not.toContain('WebSocket')
    expect(source).not.toContain('OPENAI_API_KEY')
    expect(source).not.toContain('ANTHROPIC_API_KEY')
    expect(source).not.toContain('DEEPSEEK_API_KEY')
    expect(source).not.toContain('Authorization')
    expect(source).not.toContain('Bearer')
  })

  it('exports component from package root', () => {
    const indexSource = readFileSync(
      resolve(workspaceRoot, 'packages/advanced/agent-console/src/index.ts'),
      'utf-8',
    )

    expect(indexSource).toContain('AgentConsole')
    expect(indexSource).toContain('AgentConsoleElement')
    expect(indexSource).toContain('./components/agent-console')
  })
})
