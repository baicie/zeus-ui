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
  finishToolCallInAgentConsoleState,
  getLatestAgentConsoleEvent,
  resetAgentConsoleState,
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
  toolCalls?: AgentConsoleToolCall[]
  artifacts?: AgentConsoleArtifact[]
  diagnostics?: AgentConsoleDiagnostic[]
  selectedArtifactId?: string
  maxEvents?: number
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

const objectIds = new WeakMap<object, string>()
let objectIdCounter = 0

function getObjectSignature(value: unknown): string {
  if (
    (typeof value !== 'object' && typeof value !== 'function') ||
    value === null
  ) {
    return String(value)
  }

  const objectValue = value as object
  const existing = objectIds.get(objectValue)

  if (existing) return existing

  objectIdCounter += 1
  const id = `ref:${objectIdCounter.toString(36)}`
  objectIds.set(objectValue, id)

  return id
}

function readArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function resolveInitialState(props: AgentConsoleProps): AgentConsoleState {
  return {
    status: props.status ?? 'idle',
    messages: readArray(props.messages),
    toolCalls: readArray(props.toolCalls),
    artifacts: readArray(props.artifacts),
    diagnostics: readArray(props.diagnostics),
    events: [],
    selectedArtifactId: props.selectedArtifactId,
  }
}

function setup(
  props: AgentConsoleProps,
  ctx: DefineElementContext<AgentConsoleElement, AgentConsoleEmits>,
) {
  let state = resolveInitialState(props)
  let pendingExternalSync = false
  let lastExternalSignature = ''

  const readExternalState = (): AgentConsoleState => ({
    status: ctx.host.status ?? props.status ?? 'idle',
    messages: readArray(ctx.host.messages ?? props.messages),
    toolCalls: readArray(ctx.host.toolCalls ?? props.toolCalls),
    artifacts: readArray(ctx.host.artifacts ?? props.artifacts),
    diagnostics: readArray(ctx.host.diagnostics ?? props.diagnostics),
    events: state.events,
    selectedArtifactId: ctx.host.selectedArtifactId ?? props.selectedArtifactId,
  })

  const getExternalSignature = (): string => {
    const external = readExternalState()

    return [
      external.status,
      external.selectedArtifactId,
      ctx.host.maxEvents ?? props.maxEvents,
      external.messages,
      external.toolCalls,
      external.artifacts,
      external.diagnostics,
    ]
      .map(getObjectSignature)
      .join('|')
  }

  const maxEvents = (): number | undefined =>
    ctx.host.maxEvents ?? props.maxEvents

  const syncHostProps = (): void => {
    ctx.host.status = state.status
    ctx.host.messages = state.messages
    ctx.host.toolCalls = state.toolCalls
    ctx.host.artifacts = state.artifacts
    ctx.host.diagnostics = state.diagnostics
    ctx.host.selectedArtifactId = state.selectedArtifactId
    ctx.host.maxEvents = maxEvents()
    lastExternalSignature = getExternalSignature()
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

  const syncExternalState = (): void => {
    const nextSignature = getExternalSignature()

    if (nextSignature === lastExternalSignature) return

    state = readExternalState()
    syncHostProps()
  }

  const scheduleExternalSync = (): void => {
    if (pendingExternalSync) return

    pendingExternalSync = true

    queueMicrotask(() => {
      pendingExternalSync = false
      syncExternalState()
    })
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
      const previousArtifact = getSelectedArtifact()

      commit(addArtifactToAgentConsoleState(state, input, maxEvents()))

      const artifact = getSelectedArtifact()

      if (previousArtifact?.id !== artifact?.id) {
        ctx.emit.artifactSelect({
          artifact,
          artifactId: state.selectedArtifactId,
          state: cloneAgentConsoleState(state),
        })
      }

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
      syncExternalState()
      return cloneAgentConsoleState(state, options)
    },

    getEvents(): AgentConsoleEvent[] {
      syncExternalState()
      return cloneAgentConsoleState(state).events
    },

    reset(): void {
      state = resetAgentConsoleState(props.status ?? 'idle', maxEvents())
      syncHostProps()
      emitLatestEvent()

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
      data-external-signature={() => {
        scheduleExternalSync()
        return getExternalSignature()
      }}
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
