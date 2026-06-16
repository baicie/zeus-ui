import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'

import type {
  AgentConsoleAddArtifactInput,
  AgentConsoleAddDiagnosticInput,
  AgentConsoleAppendMessageInput,
  AgentConsoleArtifact,
  AgentConsoleArtifactSelectDetail,
  AgentConsoleDiagnostic,
  AgentConsoleEvent,
  AgentConsoleEventDetail,
  AgentConsoleFinishToolCallInput,
  AgentConsoleMessage,
  AgentConsoleResetDetail,
  AgentConsoleSnapshotOptions,
  AgentConsoleStartToolCallInput,
  AgentConsoleState,
  AgentConsoleStatus,
  AgentConsoleStatusChangeDetail,
  AgentConsoleToolCall,
  AgentConsoleUpdateMessageInput,
} from '../types'

import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

import {
  addArtifactToAgentConsoleState,
  addDiagnosticToAgentConsoleState,
  appendMessageToAgentConsoleState,
  cloneAgentConsoleState,
  createEmptyAgentConsoleState,
  finishToolCallInAgentConsoleState,
  getLatestAgentConsoleEvent,
  selectAgentConsoleArtifact,
  setAgentConsoleStatus,
  startToolCallInAgentConsoleState,
  updateMessageInAgentConsoleState,
} from '../core'

export interface AgentConsoleProps {
  status?: AgentConsoleStatus
  messages?: AgentConsoleMessage[]
  toolCalls?: AgentConsoleToolCall[]
  artifacts?: AgentConsoleArtifact[]
  diagnostics?: AgentConsoleDiagnostic[]
  selectedArtifactId?: string
  maxEvents?: number
  ariaLabel?: string
}

export interface AgentConsoleElement extends HTMLElement {
  status?: AgentConsoleStatus
  messages?: AgentConsoleMessage[]
  artifacts?: AgentConsoleArtifact[]
  selectedArtifactId?: string
  appendMessage: (input: AgentConsoleAppendMessageInput) => AgentConsoleMessage
  updateMessage: (
    input: AgentConsoleUpdateMessageInput,
  ) => AgentConsoleMessage | undefined
  startToolCall: (input: AgentConsoleStartToolCallInput) => string
  finishToolCall: (input: AgentConsoleFinishToolCallInput) => void
  addArtifact: (input: AgentConsoleAddArtifactInput) => AgentConsoleArtifact
  selectArtifact: (
    artifactId: string | undefined,
  ) => AgentConsoleArtifact | undefined
  addDiagnostic: (input: AgentConsoleAddDiagnosticInput) => void
  setStatus: (status: AgentConsoleStatus) => void
  getState: (options?: AgentConsoleSnapshotOptions) => AgentConsoleState
  getEvents: () => AgentConsoleEvent[]
  reset: () => void
}

interface AgentConsoleEmits extends Record<string, EventDefinition<unknown>> {
  agentEvent: EventDefinition<AgentConsoleEventDetail>
  statusChange: EventDefinition<AgentConsoleStatusChangeDetail>
  artifactSelect: EventDefinition<AgentConsoleArtifactSelectDetail>
  reset: EventDefinition<AgentConsoleResetDetail>
}

function resolveInitialState(props: AgentConsoleProps): AgentConsoleState {
  return {
    status: props.status ?? 'idle',
    messages: props.messages ?? [],
    toolCalls: props.toolCalls ?? [],
    artifacts: props.artifacts ?? [],
    diagnostics: props.diagnostics ?? [],
    events: [],
    selectedArtifactId: props.selectedArtifactId,
  }
}

function setup(
  props: AgentConsoleProps,
  ctx: DefineElementContext<AgentConsoleElement, AgentConsoleEmits>,
) {
  let state = resolveInitialState(props)

  const maxEvents = (): number | undefined => props.maxEvents

  const syncHostProps = (): void => {
    ctx.host.status = state.status
    ctx.host.messages = state.messages
    ctx.host.artifacts = state.artifacts
    ctx.host.selectedArtifactId = state.selectedArtifactId
  }

  const emitLatestEvent = (): void => {
    const latest = getLatestAgentConsoleEvent(state)
    if (!latest) return

    ctx.emit.agentEvent({
      event: latest,
      state: cloneAgentConsoleState(state),
    })
  }

  const commit = (nextState: AgentConsoleState): void => {
    state = nextState
    syncHostProps()
    emitLatestEvent()
  }

  const getSelectedArtifact = (): AgentConsoleArtifact | undefined => {
    if (!state.selectedArtifactId) return undefined

    return state.artifacts.find(
      artifact => artifact.id === state.selectedArtifactId,
    )
  }

  ctx.expose({
    appendMessage(input: AgentConsoleAppendMessageInput): AgentConsoleMessage {
      commit(appendMessageToAgentConsoleState(state, input, maxEvents()))
      return state.messages[state.messages.length - 1]
    },

    updateMessage(
      input: AgentConsoleUpdateMessageInput,
    ): AgentConsoleMessage | undefined {
      commit(updateMessageInAgentConsoleState(state, input, maxEvents()))
      return state.messages.find(message => message.id === input.id)
    },

    startToolCall(input: AgentConsoleStartToolCallInput): string {
      commit(startToolCallInAgentConsoleState(state, input, maxEvents()))
      return state.toolCalls[state.toolCalls.length - 1].id
    },

    finishToolCall(input: AgentConsoleFinishToolCallInput): void {
      commit(finishToolCallInAgentConsoleState(state, input, maxEvents()))
    },

    addArtifact(input: AgentConsoleAddArtifactInput): AgentConsoleArtifact {
      commit(addArtifactToAgentConsoleState(state, input, maxEvents()))
      return state.artifacts[state.artifacts.length - 1]
    },

    selectArtifact(
      artifactId: string | undefined,
    ): AgentConsoleArtifact | undefined {
      const previousArtifact = getSelectedArtifact()
      state = selectAgentConsoleArtifact(state, artifactId)
      syncHostProps()

      const artifact = getSelectedArtifact()

      if (previousArtifact?.id !== artifact?.id) {
        ctx.emit.artifactSelect({
          artifact,
          artifactId: state.selectedArtifactId,
          state: cloneAgentConsoleState(state),
        })
      }

      return artifact
    },

    addDiagnostic(input: AgentConsoleAddDiagnosticInput): void {
      commit(addDiagnosticToAgentConsoleState(state, input, maxEvents()))
    },

    setStatus(status: AgentConsoleStatus): void {
      const previousStatus = state.status

      if (previousStatus === status) return

      state = setAgentConsoleStatus(state, status, maxEvents())
      syncHostProps()
      emitLatestEvent()

      ctx.emit.statusChange({
        status,
        previousStatus,
        state: cloneAgentConsoleState(state),
      })
    },

    getState(options?: AgentConsoleSnapshotOptions): AgentConsoleState {
      return cloneAgentConsoleState(state, options)
    },

    getEvents(): AgentConsoleEvent[] {
      return cloneAgentConsoleState(state).events
    },

    reset(): void {
      state = createEmptyAgentConsoleState(props.status ?? 'idle')
      syncHostProps()

      ctx.emit.reset({
        state: cloneAgentConsoleState(state),
      })
    },
  })

  syncHostProps()

  return (
    <Host
      part="root"
      data-slot="agent-console-root"
      data-status={() => state.status}
      data-message-count={() => String(state.messages.length)}
      data-tool-call-count={() => String(state.toolCalls.length)}
      data-artifact-count={() => String(state.artifacts.length)}
      data-diagnostic-count={() => String(state.diagnostics.length)}
    >
      <section
        part="layout"
        data-slot="agent-console-layout"
        role="region"
        aria-label={() => props.ariaLabel ?? 'Agent console'}
      >
        <div
          part="timeline"
          data-slot="agent-console-timeline"
          role="log"
          aria-live={() => (state.status === 'running' ? 'polite' : 'off')}
        >
          <Slot name="timeline" />
        </div>

        <aside
          part="tools"
          data-slot="agent-console-tools"
          aria-label="Tool calls"
        >
          <Slot name="tools" />
        </aside>

        <aside
          part="artifacts"
          data-slot="agent-console-artifacts"
          aria-label="Artifacts"
          data-selected-artifact-id={() => state.selectedArtifactId}
        >
          <Slot name="artifacts" />
        </aside>

        <aside
          part="diagnostics"
          data-slot="agent-console-diagnostics"
          aria-label="Diagnostics"
        >
          <Slot name="diagnostics" />
        </aside>
      </section>
    </Host>
  )
}

export const AgentConsole = defineElement<
  AgentConsoleProps,
  AgentConsoleElement,
  AgentConsoleEmits
>(
  'zw-agent-console',
  {
    shadow: false,
    props: {
      status: prop(['idle', 'running', 'waiting', 'complete', 'error'], {
        default: 'idle',
        reflect: true,
      }),
      messages: Array,
      toolCalls: Array,
      artifacts: Array,
      diagnostics: Array,
      selectedArtifactId: prop(String, {
        attr: 'selected-artifact-id',
      }),
      maxEvents: prop(Number, {
        attr: 'max-events',
      }),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
    },
    emits: {
      agentEvent: event<AgentConsoleEventDetail>(),
      statusChange: event<AgentConsoleStatusChangeDetail>(),
      artifactSelect: event<AgentConsoleArtifactSelectDetail>(),
      reset: event<AgentConsoleResetDetail>(),
    },
    meta: {
      description:
        'Headless agent console foundation for messages, tool calls, artifacts and diagnostics.',
    },
  },
  setup,
)
