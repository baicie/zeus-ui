/**
 * Legacy → V2 import (AI2-511).
 *
 * Converts data from the V1 `@zeus-web/chat` thread and the
 * `@zeus-web/agent-console` provider event log into a V2 snapshot that a
 * store can load. Explicit, one-way and conservative (01-ARCHITECTURE §19):
 *
 * - no `seq` is invented: the result is a snapshot of a dedicated
 *   `legacy:*` stream with **no cursor**, so it never claims a position in
 *   any real host stream and cannot be replayed;
 * - no approval is ever created, and nothing is marked approved;
 * - tool results that V2 could only hold behind an authorized asset are not
 *   copied, and unverified URLs never become asset URIs;
 * - every lossy or ambiguous mapping is reported as a diagnostic instead of
 *   being guessed silently.
 *
 * The input types are structural copies of the V1 shapes, so this module
 * does not depend on the legacy packages.
 */

import type {
  ContentPart,
  Conversation,
  EntityId,
  Execution,
  ExecutionStatus,
  ExecutionStep,
  Message,
  MessageStatus,
  ToolInvocation,
  ToolInvocationStatus,
} from '../domain/types'
import type { AiSnapshot } from '../store/snapshot'
import type { AiState } from '../store/state'

import { EntityMap } from '../store/entity-map'
import { createSnapshot, validateSnapshot } from '../store/snapshot'
import { createInitialState } from '../store/state'

// ---------------------------------------------------------------------------
// V1 shapes (structural)
// ---------------------------------------------------------------------------

export interface LegacyChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  status?: 'idle' | 'streaming' | 'complete' | 'error' | 'aborted'
  content?: string
  parts?: (
    | { type: 'text'; text: string }
    | { type: 'code'; code: string; language?: string; filename?: string }
    | {
        type: 'tool-call'
        id: string
        name: string
        status: string
        input?: unknown
        output?: unknown
      }
    | {
        type: 'artifact'
        id: string
        kind: string
        title?: string
        data?: unknown
      }
  )[]
  createdAt?: number
}

export interface LegacyAgentEvent {
  type:
    | 'message'
    | 'message-delta'
    | 'tool-call'
    | 'tool-result'
    | 'artifact'
    | 'diagnostic'
    | 'status'
    | 'done'
    | 'error'
  message?: {
    id: string
    role: LegacyChatMessage['role']
    content: string
    status?: string
    createdAt?: number
  }
  delta?: string
  toolCall?: {
    id: string
    name: string
    status: string
    input?: unknown
    output?: unknown
    error?: string
  }
  artifact?: {
    id: string
    kind: string
    title: string
    content?: unknown
    url?: string
    mimeType?: string
  }
  status?: 'idle' | 'running' | 'waiting' | 'complete' | 'error'
  error?: string
}

// ---------------------------------------------------------------------------

export type LegacyDiagnosticCode =
  | 'stream-interrupted'
  | 'tool-call-part-dropped'
  | 'tool-output-dropped'
  | 'artifact-inlined'
  | 'artifact-url-dropped'
  | 'waiting-status-mapped'
  | 'diagnostic-events-dropped'
  | 'error-recorded'
  | 'orphan-delta'

export interface LegacyDiagnostic {
  code: LegacyDiagnosticCode
  message: string
  entityId?: string
}

export interface LegacyImportResult {
  /** Load with `createAiStore({ streamId: snapshot.streamId }).loadSnapshot()`. */
  snapshot: AiSnapshot
  diagnostics: readonly LegacyDiagnostic[]
}

export interface LegacyImportOptions {
  conversationId: EntityId
  title?: string
  /** Used for timestamps the V1 data did not carry. */
  importedAt?: string
}

const IMPORT_SCHEMA = 'zeus.legacy-artifact/v1'

function iso(value: number | undefined, fallback: string): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value).toISOString()
    : fallback
}

function finish(
  streamId: string,
  state: AiState,
  importedAt: string,
  diagnostics: LegacyDiagnostic[],
): LegacyImportResult {
  const result = validateSnapshot(
    createSnapshot(streamId, state, importedAt),
    streamId,
  )
  if (!result.ok) {
    throw new Error(`[AI_LEGACY_IMPORT_INVALID] ${result.message}`)
  }
  return { snapshot: result.snapshot, diagnostics }
}

function chatStatus(
  status: LegacyChatMessage['status'],
  id: string,
  diagnostics: LegacyDiagnostic[],
): MessageStatus {
  switch (status) {
    case 'error':
      return 'failed'
    case 'aborted':
      return 'cancelled'
    case 'streaming':
      diagnostics.push({
        code: 'stream-interrupted',
        message: `message ${id} was still streaming in V1; imported as cancelled`,
        entityId: id,
      })
      return 'cancelled'
    default:
      return 'complete'
  }
}

/** Convert a V1 chat thread (linear) into a V2 conversation snapshot. */
export function importLegacyChat(
  messages: readonly LegacyChatMessage[],
  options: LegacyImportOptions,
): LegacyImportResult {
  const importedAt = options.importedAt ?? new Date(0).toISOString()
  const diagnostics: LegacyDiagnostic[] = []
  const conversation: Conversation = {
    id: options.conversationId,
    title: options.title ?? 'Imported conversation',
    revision: 1,
  }
  const records: Record<EntityId, Message> = {}
  const order: EntityId[] = []
  let parent: EntityId | undefined

  for (const legacy of messages) {
    const parts: ContentPart[] = []
    const source =
      legacy.parts ??
      (legacy.content !== undefined
        ? [{ type: 'text' as const, text: legacy.content }]
        : [])

    source.forEach((part, index) => {
      const id = `p${index}`
      switch (part.type) {
        case 'text':
          parts.push({
            id,
            kind: 'text',
            revision: 0,
            text: part.text,
            format: 'markdown',
          })
          break
        case 'code':
          parts.push({
            id,
            kind: 'text',
            revision: 0,
            text: `\`\`\`${part.language ?? ''}\n${part.code}\n\`\`\``,
            format: 'markdown',
          })
          break
        case 'tool-call':
          // V2 keeps tools on executions, never inside message content.
          diagnostics.push({
            code: 'tool-call-part-dropped',
            message: `tool call ${part.name} in message ${legacy.id} is not imported as content`,
            entityId: legacy.id,
          })
          break
        case 'artifact':
          diagnostics.push({
            code: 'artifact-inlined',
            message: `artifact ${part.id} kept as structured content of message ${legacy.id}`,
            entityId: legacy.id,
          })
          parts.push({
            id,
            kind: 'structured',
            schema: IMPORT_SCHEMA,
            value: {
              id: part.id,
              kind: part.kind,
              title: part.title,
              data: part.data,
            },
          })
          break
      }
    })

    records[legacy.id] = {
      id: legacy.id,
      conversationId: conversation.id,
      parentMessageId: parent,
      author: legacy.role,
      parts,
      status: chatStatus(legacy.status, legacy.id, diagnostics),
      revision: 1,
      createdAt: iso(legacy.createdAt, importedAt),
    }
    order.push(legacy.id)
    parent = legacy.id
  }

  const state: AiState = {
    ...createInitialState(),
    conversations: EntityMap.fromRecord({ [conversation.id]: conversation }),
    messages: EntityMap.fromRecord(records),
    conversationMessageIds:
      order.length > 0 ? { [conversation.id]: order } : {},
  }

  return finish(`legacy:${conversation.id}`, state, importedAt, diagnostics)
}

const TOOL_STATUS: Readonly<Record<string, ToolInvocationStatus>> = {
  pending: 'requested',
  running: 'running',
  success: 'succeeded',
  error: 'failed',
}

/** Fold a V1 agent-console provider event log into one V2 execution. */
export function importLegacyAgentRun(
  events: readonly LegacyAgentEvent[],
  options: LegacyImportOptions & { executionId: EntityId },
): LegacyImportResult {
  const importedAt = options.importedAt ?? new Date(0).toISOString()
  const diagnostics: LegacyDiagnostic[] = []
  const conversation: Conversation = {
    id: options.conversationId,
    title: options.title ?? 'Imported agent run',
    revision: 1,
  }
  const messages: Record<EntityId, Message> = {}
  const order: EntityId[] = []
  const steps: Record<EntityId, ExecutionStep> = {}
  const tools: Record<EntityId, ToolInvocation> = {}
  let status: ExecutionStatus = 'running'
  let lastAssistant: EntityId | undefined
  let droppedDiagnostics = 0

  const pushMessage = (message: Message): void => {
    messages[message.id] = {
      ...message,
      parentMessageId: order[order.length - 1],
    }
    order.push(message.id)
  }

  for (const event of events) {
    switch (event.type) {
      case 'message':
        if (!event.message) break
        pushMessage({
          id: event.message.id,
          conversationId: conversation.id,
          author: event.message.role,
          parts: [
            {
              id: 'p0',
              kind: 'text',
              revision: 0,
              text: event.message.content,
              format: 'markdown',
            },
          ],
          status: 'complete',
          executionId: options.executionId,
          revision: 1,
          createdAt: iso(event.message.createdAt, importedAt),
        })
        if (event.message.role === 'assistant') lastAssistant = event.message.id
        break
      case 'message-delta': {
        const target = lastAssistant ? messages[lastAssistant] : undefined
        const part = target?.parts[0]
        if (!target || !part || part.kind !== 'text') {
          diagnostics.push({
            code: 'orphan-delta',
            message: 'delta without an assistant message was dropped',
          })
          break
        }
        messages[target.id] = {
          ...target,
          parts: [{ ...part, text: part.text + (event.delta ?? '') }],
        }
        break
      }
      case 'tool-call':
      case 'tool-result': {
        const call = event.toolCall
        if (!call) break
        const stepId = `step-${call.id}`
        const toolStatus = TOOL_STATUS[call.status] ?? 'requested'
        if (call.output !== undefined && !tools[call.id]?.resultAssetId) {
          diagnostics.push({
            code: 'tool-output-dropped',
            message: `output of tool ${call.name} has no authorized asset in V2 and was not imported`,
            entityId: call.id,
          })
        }
        steps[stepId] = {
          id: stepId,
          executionId: options.executionId,
          kind: 'tool',
          status:
            toolStatus === 'succeeded'
              ? 'completed'
              : toolStatus === 'requested'
                ? 'pending'
                : toolStatus,
          label: call.name,
          toolInvocationId: call.id,
        }
        tools[call.id] = {
          id: call.id,
          executionId: options.executionId,
          stepId,
          toolName: call.name,
          summary: call.error ? `${call.name}: ${call.error}` : call.name,
          inputPreview: call.input,
          status: toolStatus,
        }
        break
      }
      case 'artifact': {
        const artifact = event.artifact
        if (!artifact) break
        if (artifact.url) {
          diagnostics.push({
            code: 'artifact-url-dropped',
            message: `artifact ${artifact.id} URL is unverified and was not imported as an asset`,
            entityId: artifact.id,
          })
        }
        diagnostics.push({
          code: 'artifact-inlined',
          message: `artifact ${artifact.id} kept as structured content`,
          entityId: artifact.id,
        })
        pushMessage({
          id: `artifact-${artifact.id}`,
          conversationId: conversation.id,
          author: 'tool',
          parts: [
            {
              id: 'p0',
              kind: 'structured',
              schema: IMPORT_SCHEMA,
              value: {
                id: artifact.id,
                kind: artifact.kind,
                title: artifact.title,
                content: artifact.content,
              },
            },
          ],
          status: 'complete',
          executionId: options.executionId,
          revision: 1,
          createdAt: importedAt,
        })
        break
      }
      case 'diagnostic':
        droppedDiagnostics += 1
        break
      case 'status':
        if (event.status === 'waiting') {
          // V1 had no approval record behind "waiting"; never invent one.
          diagnostics.push({
            code: 'waiting-status-mapped',
            message: 'V1 "waiting" has no approval record; imported as paused',
          })
          status = 'paused'
        } else if (event.status === 'complete') {
          status = 'completed'
        } else if (event.status === 'error') {
          status = 'failed'
        } else if (event.status === 'running') {
          status = 'running'
        }
        break
      case 'done':
        if (status !== 'failed') status = 'completed'
        break
      case 'error':
        status = 'failed'
        diagnostics.push({
          code: 'error-recorded',
          message: event.error ?? 'V1 run reported an error',
        })
        break
    }
  }

  if (droppedDiagnostics > 0) {
    diagnostics.push({
      code: 'diagnostic-events-dropped',
      message: `${droppedDiagnostics} V1 diagnostic events are not part of the V2 domain`,
    })
  }

  // A run that never finished cannot be resumed from an import.
  if (status === 'running') {
    diagnostics.push({
      code: 'stream-interrupted',
      message: `run ${options.executionId} had not finished in V1; imported as cancelled`,
      entityId: options.executionId,
    })
    status = 'cancelled'
  }

  const execution: Execution = {
    id: options.executionId,
    kind: 'agent',
    conversationId: conversation.id,
    status,
    createdAt: importedAt,
    revision: 1,
    activeStepIds: [],
  }

  const state: AiState = {
    ...createInitialState(),
    conversations: EntityMap.fromRecord({ [conversation.id]: conversation }),
    messages: EntityMap.fromRecord(messages),
    conversationMessageIds:
      order.length > 0 ? { [conversation.id]: order } : {},
    executions: EntityMap.fromRecord({ [execution.id]: execution }),
    steps: EntityMap.fromRecord(steps),
    executionStepIds:
      Object.keys(steps).length > 0
        ? { [execution.id]: Object.keys(steps) }
        : {},
    toolInvocations: EntityMap.fromRecord(tools),
  }

  return finish(`legacy:${options.executionId}`, state, importedAt, diagnostics)
}
