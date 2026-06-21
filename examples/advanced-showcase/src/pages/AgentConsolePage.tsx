import type { AgentConsoleElement } from '../types'

import { useEffect, useRef, useState } from 'react'
import { DemoCard } from '../components/DemoCard'
import { StatusNote } from '../components/StatusNote'
import {
  agentArtifacts,
  agentDiagnostics,
  agentMessages,
  agentToolCalls,
} from '../data/advanced-data'

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  running: 'Running',
  waiting: 'Waiting',
  complete: 'Complete',
  error: 'Error',
}

const LEVEL_COLORS: Record<string, string> = {
  info: '#245f49',
  warning: '#c07000',
  error: '#c03030',
}

export function AgentConsolePage() {
  const consoleRef = useRef<AgentConsoleElement | null>(null)
  const [note, setNote] = useState(
    'Interact with the buttons to see agent events.',
  )
  const [selectedArtifact, setSelectedArtifact] = useState(
    agentArtifacts[0] ?? null,
  )

  useEffect(() => {
    const el = consoleRef.current
    if (!el) return

    el.messages = agentMessages
    el.toolCalls = agentToolCalls
    el.artifacts = agentArtifacts
    el.diagnostics = agentDiagnostics
    el.status = 'idle'
    el.selectedArtifactId = agentArtifacts[0]?.id
    el.setAttribute('aria-label', 'Agent console showcase')

    const handleAgentEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        event: { type: string }
      }>
      setNote(`Agent event: ${customEvent.detail.event.type}`)
    }

    const handleStatusChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        status: string
      }>
      setNote(
        `Status: ${STATUS_LABELS[customEvent.detail.status] ?? customEvent.detail.status}`,
      )
    }

    const handleArtifactSelect = (event: Event) => {
      const customEvent = event as CustomEvent<{
        artifact: { title: string }
      }>
      if (customEvent.detail.artifact) {
        setSelectedArtifact(
          customEvent.detail.artifact as typeof selectedArtifact,
        )
        setNote(`Selected artifact: ${customEvent.detail.artifact.title}`)
      }
    }

    el.addEventListener('agent-event', handleAgentEvent)
    el.addEventListener('status-change', handleStatusChange)
    el.addEventListener('artifact-select', handleArtifactSelect)

    return () => {
      el.removeEventListener('agent-event', handleAgentEvent)
      el.removeEventListener('status-change', handleStatusChange)
      el.removeEventListener('artifact-select', handleArtifactSelect)
    }
  }, [])

  const appendMessage = () => {
    consoleRef.current?.appendMessage({
      role: 'assistant',
      content: 'Manual showcase message from the UI.',
      status: 'complete',
    })
  }

  const runTool = () => {
    const el = consoleRef.current
    if (!el) return

    const toolId = el.startToolCall({
      name: 'local.inspect',
      input: { page: 'agent-console' },
    })

    el.finishToolCall({
      id: toolId,
      output: { ok: true, elements: 4 },
    })
  }

  const addArtifact = () => {
    const artifact = consoleRef.current?.addArtifact({
      kind: 'text',
      title: 'Manual artifact',
      content: 'Added from showcase UI.',
    })

    if (artifact) {
      setSelectedArtifact(artifact)
    }
  }

  const addDiagnostic = () => {
    consoleRef.current?.addDiagnostic({
      level: 'info',
      message: 'Manual diagnostic from showcase.',
      source: 'advanced-showcase',
    })
  }

  const cycleStatus = () => {
    const el = consoleRef.current
    if (!el) return

    const order = ['idle', 'running', 'waiting', 'complete'] as const
    const current = (el.status ?? 'idle') as (typeof order)[number]
    const idx = order.indexOf(current)
    el.setStatus(order[(idx + 1) % order.length])
  }

  const reset = () => {
    consoleRef.current?.reset()
    setNote('Console reset.')
    setSelectedArtifact(agentArtifacts[0] ?? null)
  }

  const renderArtifactContent = () => {
    if (!selectedArtifact)
      return <p className="agent-empty">No artifact selected.</p>

    if (selectedArtifact.kind === 'json') {
      return (
        <pre className="agent-json-content">
          {JSON.stringify(selectedArtifact.content, null, 2)}
        </pre>
      )
    }

    return (
      <p className="agent-text-content">
        {String(selectedArtifact.content ?? '')}
      </p>
    )
  }

  return (
    <DemoCard
      title="Agent console"
      description="Foundation for AI agent UIs: messages, tool calls, artifacts and diagnostics."
      aside={
        <div className="button-row">
          <button type="button" onClick={appendMessage}>
            Message
          </button>
          <button type="button" onClick={runTool}>
            Tool
          </button>
          <button type="button" onClick={addArtifact}>
            Artifact
          </button>
          <button type="button" onClick={addDiagnostic}>
            Diagnostic
          </button>
          <button type="button" onClick={cycleStatus}>
            Status
          </button>
          <button type="button" onClick={reset}>
            Reset
          </button>
        </div>
      }
    >
      <zw-agent-console ref={consoleRef}>
        <div slot="timeline" className="agent-timeline">
          {agentMessages.map(msg => (
            <div key={msg.id} className={`agent-msg agent-msg-${msg.role}`}>
              <strong>{msg.role}</strong>
              <span>{msg.content}</span>
            </div>
          ))}
        </div>

        <div slot="tools" className="agent-panel">
          <h3 className="agent-panel-title">Tool Calls</h3>
          {agentToolCalls.map(tool => (
            <div
              key={tool.id}
              className={`agent-tool agent-tool-${tool.status}`}
            >
              <span className="agent-tool-name">{tool.name}</span>
              <span className="agent-tool-status">{tool.status}</span>
            </div>
          ))}
        </div>

        <div slot="artifacts" className="agent-panel">
          <h3 className="agent-panel-title">Artifacts</h3>
          {agentArtifacts.map(artifact => (
            <button
              key={artifact.id}
              type="button"
              className={`agent-artifact-btn${artifact.id === selectedArtifact?.id ? ' active' : ''}`}
              onClick={() => {
                setSelectedArtifact(artifact)
                consoleRef.current?.selectArtifact(artifact.id)
              }}
            >
              {artifact.title}
            </button>
          ))}
        </div>

        <div slot="diagnostics" className="agent-panel">
          <h3 className="agent-panel-title">Diagnostics</h3>
          {agentDiagnostics.map(d => (
            <div key={d.id} className="agent-diag">
              <span
                className="agent-diag-dot"
                style={{ background: LEVEL_COLORS[d.level] ?? '#888' }}
              />
              <span>{d.message}</span>
            </div>
          ))}
        </div>
      </zw-agent-console>

      {selectedArtifact && (
        <div className="agent-artifact-preview">
          <h3 className="agent-artifact-preview-title">
            {selectedArtifact.title}
          </h3>
          {renderArtifactContent()}
        </div>
      )}

      <StatusNote>{note}</StatusNote>
    </DemoCard>
  )
}
