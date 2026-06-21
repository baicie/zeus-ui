import type {
  AgentConsoleAddDiagnosticInput,
  AgentConsoleDiagnostic,
} from '../types'

import { normalizeAgentConsoleId } from './id'

function now(): number {
  return Date.now()
}

export function createAgentConsoleDiagnostic(
  input: AgentConsoleAddDiagnosticInput,
): AgentConsoleDiagnostic {
  return {
    id: normalizeAgentConsoleId(input.id, 'diag'),
    level: input.level,
    message: input.message,
    source: input.source,
    createdAt: input.createdAt ?? now(),
    metadata: input.metadata,
  }
}

export function addAgentConsoleDiagnostic(
  diagnostics: AgentConsoleDiagnostic[],
  input: AgentConsoleAddDiagnosticInput,
): AgentConsoleDiagnostic[] {
  return [...diagnostics, createAgentConsoleDiagnostic(input)]
}

export function getAgentConsoleDiagnosticById(
  diagnostics: AgentConsoleDiagnostic[],
  id: string,
): AgentConsoleDiagnostic | undefined {
  return diagnostics.find(diagnostic => diagnostic.id === id)
}

export function getAgentConsoleDiagnosticsByLevel(
  diagnostics: AgentConsoleDiagnostic[],
  level: AgentConsoleDiagnostic['level'],
): AgentConsoleDiagnostic[] {
  return diagnostics.filter(diagnostic => diagnostic.level === level)
}
