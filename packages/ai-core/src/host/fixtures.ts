/**
 * Recorded S1 / S2 / S3 scenarios (AI2-110, G0 gate).
 *
 * Each fixture is a pure authoritative event stream. Replaying it in Node must
 * produce the same canonical state, which is what the contract tests assert.
 */

import type {
  ApprovalRequest,
  ApprovalStatus,
  ChangeSet,
  Execution,
  ExecutionStatus,
  Message,
  MessageStatus,
} from '../domain/types'

import type { AnyDomainEvent } from '../protocol/events'
import type { EventFactory } from './event-factory'
import { createEventFactory } from './event-factory'

export interface ScenarioExpectations {
  messageStatus?: MessageStatus
  executionStatus?: ExecutionStatus
  approvalStatus?: ApprovalStatus
}

export interface ScenarioFixture {
  name: string
  streamId: string
  events: readonly AnyDomainEvent[]
  expectations: ScenarioExpectations
}

const CREATED_AT = '2026-01-01T00:00:00.000Z'

function createConversation(id: string, title: string) {
  return { id, title, revision: 1 }
}

function createMessage(
  id: string,
  conversationId: string,
  author: Message['author'],
  text: string,
  options: { status?: MessageStatus; executionId?: string } = {},
): Message {
  const message: Message = {
    id,
    conversationId,
    author,
    parts: [
      { id: `${id}-text`, kind: 'text', revision: 1, text, format: 'markdown' },
    ],
    status: options.status ?? 'complete',
    revision: 1,
    createdAt: CREATED_AT,
  }

  if (options.executionId) message.executionId = options.executionId

  return message
}

function createExecution(
  id: string,
  kind: Execution['kind'],
  status: ExecutionStatus,
  options: { conversationId?: string; workspaceId?: string } = {},
): Execution {
  const execution: Execution = {
    id,
    kind,
    status,
    createdAt: CREATED_AT,
    revision: 1,
    activeStepIds: [],
  }

  if (options.conversationId) execution.conversationId = options.conversationId
  if (options.workspaceId) execution.workspaceId = options.workspaceId

  return execution
}

/** S1 — ChatGPT-style conversation with streamed assistant text. */
export function createS1ChatScenario(): ScenarioFixture {
  const streamId = 'stream-s1'
  const factory: EventFactory = createEventFactory(streamId)
  const conversationId = 'conv-s1'
  const userMessageId = 'msg-s1-user'
  const assistantMessageId = 'msg-s1-assistant'
  const executionId = 'exec-s1'
  const events: AnyDomainEvent[] = []

  events.push(
    factory.create('conversation.upserted', conversationId, {
      conversation: createConversation(conversationId, '总结这段代码'),
    }),
  )
  events.push(
    factory.create('message.created', userMessageId, {
      message: createMessage(
        userMessageId,
        conversationId,
        'user',
        '帮我总结这段代码',
      ),
    }),
  )
  events.push(
    factory.create('execution.started', executionId, {
      execution: createExecution(executionId, 'generation', 'running', {
        conversationId,
      }),
    }),
  )
  events.push(
    factory.create('message.created', assistantMessageId, {
      message: createMessage(
        assistantMessageId,
        conversationId,
        'assistant',
        '',
        {
          status: 'streaming',
          executionId,
        },
      ),
    }),
  )

  const deltas = ['这段', '代码', '做的是', '增量渲染。']
  let revision = 1

  for (const append of deltas) {
    events.push(
      factory.create('message.part.delta', assistantMessageId, {
        messageId: assistantMessageId,
        partId: `${assistantMessageId}-text`,
        baseRevision: revision,
        nextRevision: revision + 1,
        append,
      }),
    )
    revision += 1
  }

  events.push(
    factory.create('message.completed', assistantMessageId, {
      messageId: assistantMessageId,
      revision: revision + 1,
      status: 'complete',
    }),
  )
  events.push(
    factory.create('execution.status.changed', executionId, {
      id: executionId,
      from: 'running',
      to: 'completed',
      revision: 2,
    }),
  )

  return {
    name: 'S1 会话流式回答',
    streamId,
    events,
    expectations: { messageStatus: 'complete', executionStatus: 'completed' },
  }
}

/** S2 — Codex-style agent run gated by a host approval. */
export function createS2AgentApprovalScenario(): ScenarioFixture {
  const streamId = 'stream-s2'
  const factory: EventFactory = createEventFactory(streamId)
  const conversationId = 'conv-s2'
  const executionId = 'exec-s2'
  const approvalId = 'approval-s2'
  const stepId = 'step-s2-plan'
  const toolId = 'tool-s2-shell'
  const events: AnyDomainEvent[] = []

  events.push(
    factory.create('conversation.upserted', conversationId, {
      conversation: createConversation(conversationId, '清理构建产物'),
    }),
  )
  events.push(
    factory.create('message.created', 'msg-s2-user', {
      message: createMessage(
        'msg-s2-user',
        conversationId,
        'user',
        '清理 dist 目录后重新构建',
      ),
    }),
  )
  events.push(
    factory.create('execution.started', executionId, {
      execution: createExecution(executionId, 'agent', 'queued', {
        conversationId,
      }),
    }),
  )
  events.push(
    factory.create('execution.status.changed', executionId, {
      id: executionId,
      from: 'queued',
      to: 'running',
      revision: 2,
    }),
  )
  events.push(
    factory.create('step.upserted', stepId, {
      step: {
        id: stepId,
        executionId,
        kind: 'plan',
        status: 'running',
        label: '清理并重建',
        startedAt: CREATED_AT,
      },
    }),
  )
  events.push(
    factory.create('tool.upserted', toolId, {
      tool: {
        id: toolId,
        executionId,
        stepId,
        toolName: 'shell',
        summary: 'rm -rf dist && pnpm build',
        status: 'requested',
      },
    }),
  )

  const approval: ApprovalRequest = {
    id: approvalId,
    executionId,
    toolInvocationId: toolId,
    title: '删除构建目录',
    summary: '删除工作区 dist 后重新构建',
    operation: { kind: 'shell', target: 'workspace:ws-main/dist' },
    scope: 'once',
    risk: 'high',
    expiresAt: '2026-01-01T00:10:00.000Z',
    status: 'pending',
    revision: 1,
  }

  events.push(factory.create('approval.requested', approvalId, { approval }))
  events.push(
    factory.create('execution.status.changed', executionId, {
      id: executionId,
      from: 'running',
      to: 'awaiting-approval',
      revision: 3,
    }),
  )
  events.push(
    factory.create('approval.resolved', approvalId, {
      approvalId,
      decision: 'approved',
      revision: 2,
    }),
  )
  events.push(
    factory.create('execution.status.changed', executionId, {
      id: executionId,
      from: 'awaiting-approval',
      to: 'running',
      revision: 4,
    }),
  )
  events.push(
    factory.create('tool.upserted', toolId, {
      tool: {
        id: toolId,
        executionId,
        stepId,
        toolName: 'shell',
        summary: 'rm -rf dist && pnpm build',
        status: 'succeeded',
      },
    }),
  )
  events.push(
    factory.create('step.upserted', stepId, {
      step: {
        id: stepId,
        executionId,
        kind: 'plan',
        status: 'completed',
        label: '清理并重建',
        startedAt: CREATED_AT,
        completedAt: '2026-01-01T00:00:05.000Z',
      },
    }),
  )
  events.push(
    factory.create('execution.status.changed', executionId, {
      id: executionId,
      from: 'running',
      to: 'completed',
      revision: 5,
    }),
  )

  return {
    name: 'S2 Agent 审批后执行',
    streamId,
    events,
    expectations: { approvalStatus: 'approved', executionStatus: 'completed' },
  }
}

/** S3 — Coding review: change set reviewed and applied by the host only. */
export function createS3CodingReviewScenario(): ScenarioFixture {
  const streamId = 'stream-s3'
  const factory: EventFactory = createEventFactory(streamId)
  const executionId = 'exec-s3'
  const changeSetId = 'changeset-s3'
  const approvalId = 'approval-s3'
  const workspaceId = 'ws-main'
  const events: AnyDomainEvent[] = []

  events.push(
    factory.create('execution.started', executionId, {
      execution: createExecution(executionId, 'agent', 'running', {
        workspaceId,
      }),
    }),
  )

  const changeSet: ChangeSet = {
    id: changeSetId,
    executionId,
    workspaceId,
    baseRevision: 'abc123',
    files: [
      {
        path: 'packages/ai-core/src/index.ts',
        status: 'added',
        stats: { additions: 12, deletions: 0 },
      },
      {
        path: 'packages/ai-core/package.json',
        status: 'added',
        stats: { additions: 24, deletions: 0 },
      },
    ],
    status: 'ready',
    revision: 1,
  }

  events.push(
    factory.create('changeset.updated', changeSetId, { changeset: changeSet }),
  )

  const approval: ApprovalRequest = {
    id: approvalId,
    executionId,
    title: '应用代码变更',
    summary: '把 2 个文件写入工作区 ws-main',
    operation: { kind: 'changeset.apply', target: `workspace:${workspaceId}` },
    scope: 'workspace',
    risk: 'high',
    status: 'pending',
    revision: 1,
  }

  events.push(factory.create('approval.requested', approvalId, { approval }))
  events.push(
    factory.create('approval.resolved', approvalId, {
      approvalId,
      decision: 'approved',
      revision: 2,
    }),
  )
  events.push(
    factory.create('changeset.updated', changeSetId, {
      changeset: { ...changeSet, status: 'applying', revision: 2 },
    }),
  )
  events.push(
    factory.create('changeset.updated', changeSetId, {
      changeset: { ...changeSet, status: 'applied', revision: 3 },
    }),
  )
  events.push(
    factory.create('execution.status.changed', executionId, {
      id: executionId,
      from: 'running',
      to: 'completed',
      revision: 2,
    }),
  )

  return {
    name: 'S3 代码变更审阅与写入',
    streamId,
    events,
    expectations: { approvalStatus: 'approved', executionStatus: 'completed' },
  }
}

export const SCENARIO_FIXTURES: readonly ScenarioFixture[] = [
  createS1ChatScenario(),
  createS2AgentApprovalScenario(),
  createS3CodingReviewScenario(),
]
