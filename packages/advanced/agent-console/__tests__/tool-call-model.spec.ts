import { describe, expect, it } from 'vitest'

import {
  createAgentConsoleToolCall,
  finishAgentConsoleToolCall,
  getAgentConsoleToolCallById,
  startAgentConsoleToolCall,
} from '../src/core'

describe('tool call model', () => {
  it('creates a tool call', () => {
    expect(
      createAgentConsoleToolCall({
        id: 't1',
        name: 'search',
        input: {
          q: 'zeus',
        },
        createdAt: 1,
      }),
    ).toEqual({
      id: 't1',
      name: 'search',
      status: 'running',
      input: {
        q: 'zeus',
      },
      createdAt: 1,
      updatedAt: 1,
      metadata: undefined,
    })
  })

  it('starts and finishes a tool call', () => {
    const started = startAgentConsoleToolCall([], {
      id: 't1',
      name: 'search',
      createdAt: 1,
    })

    const finished = finishAgentConsoleToolCall(started, {
      id: 't1',
      output: {
        ok: true,
      },
      updatedAt: 2,
    })

    expect(finished[0]).toMatchObject({
      id: 't1',
      status: 'complete',
      output: {
        ok: true,
      },
      updatedAt: 2,
    })
  })

  it('marks tool call as error when error is provided', () => {
    const started = startAgentConsoleToolCall([], {
      id: 't1',
      name: 'search',
      createdAt: 1,
    })

    expect(
      finishAgentConsoleToolCall(started, {
        id: 't1',
        error: 'failed',
        updatedAt: 2,
      })[0],
    ).toMatchObject({
      id: 't1',
      status: 'error',
      error: 'failed',
    })
  })

  it('gets tool call by id', () => {
    const calls = startAgentConsoleToolCall([], {
      id: 't1',
      name: 'search',
    })

    expect(getAgentConsoleToolCallById(calls, 't1')?.name).toBe('search')
    expect(getAgentConsoleToolCallById(calls, 'missing')).toBeUndefined()
  })
})
