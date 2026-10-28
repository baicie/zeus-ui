/**
 * Zeus AI Headless V2 domain entities (AI2-102 / AI2-103).
 *
 * These types are intentionally independent from `@zeus-web/chat` and
 * `@zeus-web/agent-console`: V2 keeps Conversation, Execution, Approval,
 * Artifact and ChangeSet as sibling aggregates instead of folding everything
 * into one message/event array.
 *
 * The module is pure TypeScript with no DOM, React or Vue references so it can
 * be imported from Node, the browser, or a worker.
 */

/** Stable identifier owned by the authoritative host. */
export type EntityId = string

/** ISO-8601 timestamp issued by the authoritative source. */
export type Timestamp = string

/** Monotonic per-entity revision. Timestamps are for display only. */
export type Revision = number

export interface Project {
  id: EntityId
  title: string
  workspaceIds: EntityId[]
}

export type WorkspaceKind = 'none' | 'local' | 'worktree' | 'remote'

export interface WorkspaceRepo {
  id: string
  ref?: string
  revision?: string
}

export interface Workspace {
  id: EntityId
  projectId?: EntityId
  kind: WorkspaceKind
  displayName: string
  repo?: WorkspaceRepo
  /** Capabilities the host granted for this workspace, never inferred from paths. */
  capabilities: string[]
}

export interface Conversation {
  id: EntityId
  projectId?: EntityId
  title: string
  selectedLeafMessageId?: EntityId
  revision: Revision
}

export type MessageAuthor = 'user' | 'assistant' | 'system' | 'tool'

export type MessageStatus =
  | 'pending'
  | 'streaming'
  | 'complete'
  | 'failed'
  | 'cancelled'

export type ContentPart =
  | {
      id: string
      kind: 'text'
      revision: Revision
      text: string
      format: 'plain' | 'markdown'
    }
  | { id: string; kind: 'image'; asset: AssetRef; alt?: string }
  | { id: string; kind: 'file'; asset: AssetRef; name: string }
  | { id: string; kind: 'reference'; sourceId: string; label?: string }
  | { id: string; kind: 'artifact-ref'; artifactId: EntityId }
  | { id: string; kind: 'structured'; schema: string; value: unknown }

export type ContentPartKind = ContentPart['kind']

export interface Message {
  id: EntityId
  conversationId: EntityId
  /** Editing or retrying a message produces a sibling branch instead of mutating this one. */
  parentMessageId?: EntityId
  author: MessageAuthor
  parts: ContentPart[]
  executionId?: EntityId
  status: MessageStatus
  revision: Revision
  createdAt: Timestamp
}

export type ExecutionKind = 'generation' | 'agent'

export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'awaiting-approval'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ExecutionOutcome {
  summary?: string
  artifactIds?: EntityId[]
}

export interface Execution {
  id: EntityId
  kind: ExecutionKind
  conversationId?: EntityId
  workspaceId?: EntityId
  status: ExecutionStatus
  createdAt: Timestamp
  revision: Revision
  activeStepIds: EntityId[]
  outcome?: ExecutionOutcome
}

export type StepKind =
  | 'plan'
  | 'tool'
  | 'reasoning-summary'
  | 'test'
  | 'output'
  | 'custom'

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ExecutionStep {
  id: EntityId
  executionId: EntityId
  parentStepId?: EntityId
  kind: StepKind
  status: StepStatus
  label: string
  startedAt?: Timestamp
  completedAt?: Timestamp
  toolInvocationId?: EntityId
}

export type ToolInvocationStatus =
  | 'requested'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface ToolInvocation {
  id: EntityId
  executionId: EntityId
  stepId?: EntityId
  toolName: string
  summary: string
  /** Redacted and size-limited preview. Never raw secrets or unbounded output. */
  inputPreview?: unknown
  resultAssetId?: EntityId
  status: ToolInvocationStatus
}

export interface AssetRef {
  id: EntityId
  mimeType: string
  size?: number
  /** Validated/authorized URI. Treated as opaque data, never as a render target. */
  uri?: string
  checksum?: string
}

export type ArtifactKind =
  | 'document'
  | 'code'
  | 'table'
  | 'chart'
  | 'image'
  | 'file'
  | 'custom'

export interface Artifact {
  id: EntityId
  executionId?: EntityId
  kind: ArtifactKind
  title: string
  asset: AssetRef
  rendererHint?: string
  revision: Revision
}

/**
 * Approval status (AI2-104).
 *
 * `approved` only means the trusted host recorded the authorization. It never
 * means the side effect ran; execution success is a separate domain fact.
 */
export type ApprovalStatus =
  | 'pending'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'revoked'

export type ApprovalScope = 'once' | 'session' | 'workspace'

export type ApprovalRisk = 'low' | 'medium' | 'high'

export interface ApprovalOperation {
  kind: string
  target: string
  preview?: unknown
}

export interface ApprovalRequest {
  id: EntityId
  executionId: EntityId
  toolInvocationId?: EntityId
  title: string
  summary: string
  operation: ApprovalOperation
  scope: ApprovalScope
  risk: ApprovalRisk
  expiresAt?: Timestamp
  status: ApprovalStatus
  revision: Revision
}

export type ChangeSetStatus =
  | 'draft'
  | 'ready'
  | 'applying'
  | 'applied'
  | 'rejected'
  | 'conflicted'

export type ChangedFileStatus = 'added' | 'modified' | 'deleted' | 'renamed'

export interface ChangedFileStats {
  additions: number
  deletions: number
}

export interface ChangedFile {
  /** Display path only. Writing files is always a host-side authorized operation. */
  path: string
  status: ChangedFileStatus
  oldPath?: string
  diffAsset?: AssetRef
  binary?: boolean
  stats?: ChangedFileStats
}

export interface ChangeSet {
  id: EntityId
  executionId: EntityId
  workspaceId: EntityId
  baseRevision: string
  files: ChangedFile[]
  status: ChangeSetStatus
  revision: Revision
}
