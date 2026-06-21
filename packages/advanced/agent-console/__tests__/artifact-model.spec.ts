import { describe, expect, it } from 'vitest'

import {
  addAgentConsoleArtifact,
  createAgentConsoleArtifact,
  getAgentConsoleArtifactById,
  removeAgentConsoleArtifactById,
} from '../src/core'

describe('artifact model', () => {
  it('creates an artifact', () => {
    expect(
      createAgentConsoleArtifact({
        id: 'a1',
        kind: 'json',
        title: 'Result',
        content: {
          ok: true,
        },
        createdAt: 1,
      }),
    ).toEqual({
      id: 'a1',
      kind: 'json',
      title: 'Result',
      content: {
        ok: true,
      },
      url: undefined,
      mimeType: undefined,
      createdAt: 1,
      updatedAt: 1,
      metadata: undefined,
    })
  })

  it('adds artifacts', () => {
    expect(
      addAgentConsoleArtifact([], {
        id: 'a1',
        kind: 'text',
        title: 'Note',
      }),
    ).toHaveLength(1)
  })

  it('gets artifact by id', () => {
    const artifacts = addAgentConsoleArtifact([], {
      id: 'a1',
      kind: 'text',
      title: 'Note',
    })

    expect(getAgentConsoleArtifactById(artifacts, 'a1')?.title).toBe('Note')
    expect(getAgentConsoleArtifactById(artifacts, 'missing')).toBeUndefined()
  })

  it('removes artifact by id', () => {
    const artifacts = addAgentConsoleArtifact([], {
      id: 'a1',
      kind: 'text',
      title: 'Note',
    })

    expect(removeAgentConsoleArtifactById(artifacts, 'a1')).toEqual([])
  })
})
