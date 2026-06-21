import type {
  AgentConsoleAddArtifactInput,
  AgentConsoleArtifact,
} from '../types'

import { normalizeAgentConsoleId } from './id'

function now(): number {
  return Date.now()
}

export function createAgentConsoleArtifact(
  input: AgentConsoleAddArtifactInput,
): AgentConsoleArtifact {
  const createdAt = input.createdAt ?? now()

  return {
    id: normalizeAgentConsoleId(input.id, 'artifact'),
    kind: input.kind,
    title: input.title,
    content: input.content,
    url: input.url,
    mimeType: input.mimeType,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    metadata: input.metadata,
  }
}

export function addAgentConsoleArtifact(
  artifacts: AgentConsoleArtifact[],
  input: AgentConsoleAddArtifactInput,
): AgentConsoleArtifact[] {
  return [...artifacts, createAgentConsoleArtifact(input)]
}

export function getAgentConsoleArtifactById(
  artifacts: AgentConsoleArtifact[],
  id: string,
): AgentConsoleArtifact | undefined {
  return artifacts.find(artifact => artifact.id === id)
}

export function removeAgentConsoleArtifactById(
  artifacts: AgentConsoleArtifact[],
  id: string,
): AgentConsoleArtifact[] {
  return artifacts.filter(artifact => artifact.id !== id)
}
