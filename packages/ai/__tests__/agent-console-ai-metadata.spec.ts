import { describe, expect, it } from 'vitest'

import { aiMetadata } from '../src/metadata'

describe('agent-console ai metadata', () => {
  const agentConsole = aiMetadata.advancedComponents.find(
    component => component.name === 'agent-console',
  )

  it('registers agent-console as advanced metadata', () => {
    expect(agentConsole).toBeTruthy()
    expect(agentConsole).toMatchObject({
      name: 'agent-console',
      packageName: '@zeus-web/agent-console',
      category: 'advanced',
    })
  })

  it('documents events and methods', () => {
    expect(agentConsole?.events['zw-agent-console']).toEqual(
      expect.arrayContaining([
        'agent-event',
        'status-change',
        'artifact-select',
        'reset',
      ]),
    )

    expect(agentConsole?.methods['zw-agent-console']).toEqual(
      expect.arrayContaining([
        'appendMessage',
        'startToolCall',
        'finishToolCall',
        'addArtifact',
        'setStatus',
        'getState',
      ]),
    )
  })

  it('keeps provider and network logic out of hints', () => {
    const text = JSON.stringify(agentConsole)

    expect(text).toContain('Do not add fetch')
    expect(text).not.toContain('OPENAI_API_KEY')
    expect(text).not.toContain('ANTHROPIC_API_KEY')
    expect(text).not.toContain('DEEPSEEK_API_KEY')
  })
})
