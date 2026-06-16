import type {
  AgentConsoleAddArtifactInput,
  AgentConsoleAddDiagnosticInput,
  AgentConsoleAppendMessageInput,
  AgentConsoleArtifact,
  AgentConsoleDiagnostic,
  AgentConsoleEvent,
  AgentConsoleFinishToolCallInput,
  AgentConsoleMessage,
  AgentConsoleSnapshotOptions,
  AgentConsoleStartToolCallInput,
  AgentConsoleState,
  AgentConsoleStatus,
  AgentConsoleToolCall,
  AgentConsoleUpdateMessageInput,
} from '../types'

import {
  addAgentConsoleArtifact,
  getAgentConsoleArtifactById,
} from './artifact-model'
import { addAgentConsoleDiagnostic } from './diagnostic-model'
import { appendAgentConsoleEvent } from './event-log-model'
import {
  appendAgentConsoleMessage,
  updateAgentConsoleMessage,
} from './message-model'
import {
  finishAgentConsoleToolCall,
  startAgentConsoleToolCall,
} from './tool-call-model'

export function createEmptyAgentConsoleState(
  status: AgentConsoleStatus = 'idle',
): AgentConsoleState {
  return {
    status,
    messages: [],
    toolCalls: [],
    artifacts: [],
    diagnostics: [],
    events: [],
  }
}

export function cloneAgentConsoleState(
  state: AgentConsoleState,
  options: AgentConsoleSnapshotOptions = {},
): AgentConsoleState {
  const events =
    options.maxEvents && options.maxEvents > 0
      ? state.events.slice(Math.max(0, state.events.length - options.maxEvents))
      : state.events

  return {
    status: state.status,
    selectedArtifactId: state.selectedArtifactId,
    messages: state.messages.map(message => ({ ...message })),
    toolCalls: state.toolCalls.map(toolCall => ({ ...toolCall })),
    artifacts: state.artifacts.map(artifact => ({ ...artifact })),
    diagnostics: state.diagnostics.map(diagnostic => ({ ...diagnostic })),
    events: events.map(event => ({ ...event })),
  }
}

export function setAgentConsoleStatus(
  state: AgentConsoleState,
  status: AgentConsoleStatus,
  maxEvents?: number,
): AgentConsoleState {
  return {
    ...state,
    status,
    events: appendAgentConsoleEvent(
      state.events,
      {
        type: 'status',
        status,
      },
      maxEvents,
    ),
  }
}

export function appendMessageToAgentConsoleState(
  state: AgentConsoleState,
  input: AgentConsoleAppendMessageInput,
  maxEvents?: number,
): AgentConsoleState {
  const messages = appendAgentConsoleMessage(state.messages, input)
  const message = messages[messages.length - 1]

  return {
    ...state,
    messages,
    events: appendAgentConsoleEvent(
      state.events,
      {
        type: 'message',
        message,
      },
      maxEvents,
    ),
  }
}

export function updateMessageInAgentConsoleState(
  state: AgentConsoleState,
  input: AgentConsoleUpdateMessageInput,
  maxEvents?: number,
): AgentConsoleState {
  const messages = updateAgentConsoleMessage(state.messages, input)
  const message = messages.find(item => item.id === input.id)

  if (!message) return state

  return {
    ...state,
    messages,
    events: appendAgentConsoleEvent(
      state.events,
      {
        type: 'message',
        message,
      },
      maxEvents,
    ),
  }
}

export function startToolCallInAgentConsoleState(
  state: AgentConsoleState,
  input: AgentConsoleStartToolCallInput,
  maxEvents?: number,
): AgentConsoleState {
  const toolCalls = startAgentConsoleToolCall(state.toolCalls, input)
  const toolCall = toolCalls[toolCalls.length - 1]

  return {
    ...state,
    toolCalls,
    events: appendAgentConsoleEvent(
      state.events,
      {
        type: 'tool-call',
        toolCall,
      },
      maxEvents,
    ),
  }
}

export function finishToolCallInAgentConsoleState(
  state: AgentConsoleState,
  input: AgentConsoleFinishToolCallInput,
  maxEvents?: number,
): AgentConsoleState {
  const toolCalls = finishAgentConsoleToolCall(state.toolCalls, input)
  const toolCall = toolCalls.find(item => item.id === input.id)

  if (!toolCall) return state

  return {
    ...state,
    toolCalls,
    events: appendAgentConsoleEvent(
      state.events,
      {
        type: 'tool-result',
        toolCall,
      },
      maxEvents,
    ),
  }
}

export function addArtifactToAgentConsoleState(
  state: AgentConsoleState,
  input: AgentConsoleAddArtifactInput,
  maxEvents?: number,
): AgentConsoleState {
  const artifacts = addAgentConsoleArtifact(state.artifacts, input)
  const artifact = artifacts[artifacts.length - 1]

  return {
    ...state,
    artifacts,
    selectedArtifactId: state.selectedArtifactId ?? artifact.id,
    events: appendAgentConsoleEvent(
      state.events,
      {
        type: 'artifact',
        artifact,
      },
      maxEvents,
    ),
  }
}

export function selectAgentConsoleArtifact(
  state: AgentConsoleState,
  artifactId: string | undefined,
): AgentConsoleState {
  if (!artifactId) {
    return {
      ...state,
      selectedArtifactId: undefined,
    }
  }

  const artifact = getAgentConsoleArtifactById(state.artifacts, artifactId)

  return {
    ...state,
    selectedArtifactId: artifact ? artifact.id : state.selectedArtifactId,
  }
}

export function addDiagnosticToAgentConsoleState(
  state: AgentConsoleState,
  input: AgentConsoleAddDiagnosticInput,
  maxEvents?: number,
): AgentConsoleState {
  const diagnostics = addAgentConsoleDiagnostic(state.diagnostics, input)
  const diagnostic = diagnostics[diagnostics.length - 1]

  return {
    ...state,
    diagnostics,
    events: appendAgentConsoleEvent(
      state.events,
      {
        type: 'diagnostic',
        diagnostic,
      },
      maxEvents,
    ),
  }
}

export function getLatestAgentConsoleMessage(
  state: AgentConsoleState,
): AgentConsoleMessage | undefined {
  return state.messages[state.messages.length - 1]
}

export function getLatestAgentConsoleToolCall(
  state: AgentConsoleState,
): AgentConsoleToolCall | undefined {
  return state.toolCalls[state.toolCalls.length - 1]
}

export function getLatestAgentConsoleArtifact(
  state: AgentConsoleState,
): AgentConsoleArtifact | undefined {
  return state.artifacts[state.artifacts.length - 1]
}

export function getLatestAgentConsoleDiagnostic(
  state: AgentConsoleState,
): AgentConsoleDiagnostic | undefined {
  return state.diagnostics[state.diagnostics.length - 1]
}

export function getLatestAgentConsoleEvent(
  state: AgentConsoleState,
): AgentConsoleEvent | undefined {
  return state.events[state.events.length - 1]
}
