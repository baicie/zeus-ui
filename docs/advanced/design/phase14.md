下面给出 **Phase 14：Agent Console Foundation** 的详细设计与完整代码，包含完整单元测试。

Phase 14 回到最初高级组件路线的最终方向：**Agent Console**。这一阶段只做本地 headless runtime，不接 OpenAI / Anthropic / DeepSeek 等真实 provider，不写 fetch、不写 API key、不写传输层。目标是把 `chat + tool calls + artifacts + diagnostics + status` 的基础控制台模型打稳，后续 Phase 15 再做 product layer，Phase 16 再做真实运行时 e2e / provider adapter。

---

# 1. Phase 14 目标

```txt
Phase 14: Agent Console Foundation

目标:
  1. 新增 @zeus-web/agent-console advanced 包
  2. 提供 Agent Console 本地状态模型
  3. 支持 messages
  4. 支持 tool calls / tool results
  5. 支持 artifacts
  6. 支持 diagnostics
  7. 支持 status
  8. 支持 selected artifact
  9. 提供 zw-agent-console Web Component
  10. 暴露 appendMessage / startToolCall / finishToolCall / addArtifact / addDiagnostic / setStatus / reset 等方法
  11. 提供 agent-event / status-change / artifact-select / reset 事件
  12. 提供完整 core 单测与 component analyzer 测试
```

---

# 2. 非目标

```txt
1. 不接真实 LLM provider
2. 不发网络请求
3. 不读取 API key
4. 不实现 SSE/WebSocket transport
5. 不实现 markdown renderer
6. 不实现代码高亮
7. 不实现 tool executor
8. 不实现 artifact preview runtime
9. 不接 registry product layer
10. 不做 React/Vue styled template
```

Phase 14 只是 foundation。真实产品层与模板应放 Phase 15。

---

# 3. 包结构

```txt
packages/advanced/agent-console/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    core/
      index.ts
      id.ts
      message-model.ts
      tool-call-model.ts
      artifact-model.ts
      diagnostic-model.ts
      event-log-model.ts
      console-state.ts
    components/
      agent-console.tsx
  __tests__/
    id.spec.ts
    message-model.spec.ts
    tool-call-model.spec.ts
    artifact-model.spec.ts
    diagnostic-model.spec.ts
    event-log-model.spec.ts
    console-state.spec.ts
    agent-console.spec.ts

docs/advanced/design/phase14.md
```

---

# 4. 新增 `packages/advanced/agent-console/package.json`

```json
{
  "name": "@zeus-web/agent-console",
  "type": "module",
  "version": "0.0.0",
  "description": "Headless agent console advanced component for Zeus Web.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/baicie/zeus-ui.git",
    "directory": "packages/advanced/agent-console"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "sideEffects": ["./dist/wc/index.js", "./dist/wc/*.js", "./dist/**/*.css"],
  "exports": {
    ".": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc/auto": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/auto.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js"
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue/index.js"
    },
    "./vue/global": {
      "types": "./dist/vue/global.d.ts"
    },
    "./custom-elements.json": {
      "default": "./dist/custom-elements.json"
    },
    "./zeus.components.json": {
      "default": "./dist/zeus.components.json"
    }
  },
  "files": ["dist"],
  "scripts": {
    "dev": "rolldown -c ../../../rolldown.config.ts --watch",
    "build": "rimraf dist && rolldown -c ../../../rolldown.config.ts",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../../.. --project unit packages/advanced/agent-console/__tests__/id.spec.ts packages/advanced/agent-console/__tests__/message-model.spec.ts packages/advanced/agent-console/__tests__/tool-call-model.spec.ts packages/advanced/agent-console/__tests__/artifact-model.spec.ts packages/advanced/agent-console/__tests__/diagnostic-model.spec.ts packages/advanced/agent-console/__tests__/event-log-model.spec.ts packages/advanced/agent-console/__tests__/console-state.spec.ts packages/advanced/agent-console/__tests__/agent-console.spec.ts"
  },
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.5 <0.2.0"
  },
  "dependencies": {
    "@zeus-js/runtime-dom": "0.1.0-beta.5",
    "@zeus-js/web-c-runtime": "0.2.0",
    "@zeus-web/chat": "workspace:*",
    "@zeus-web/virtual": "workspace:*",
    "@zeus-web/data-grid": "workspace:*",
    "@zeus-web/zeus-compat": "workspace:*"
  }
}
```

---

# 5. 新增 `packages/advanced/agent-console/tsconfig.json`

```json
{
  "extends": "../../../scripts/config/tsconfig.zeus-jsx.json",
  "compilerOptions": {
    "rootDir": "../../",
    "baseUrl": "../../../"
  },
  "include": ["src"]
}
```

---

# 6. 新增 `packages/advanced/agent-console/src/types.ts`

```ts
export type AgentConsoleRole = 'system' | 'user' | 'assistant' | 'tool'

export type AgentConsoleStatus =
  | 'idle'
  | 'running'
  | 'waiting'
  | 'complete'
  | 'error'

export type AgentConsoleMessageStatus =
  | 'pending'
  | 'streaming'
  | 'complete'
  | 'error'

export type AgentConsoleToolCallStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'error'
  | 'cancelled'

export type AgentConsoleArtifactKind =
  | 'text'
  | 'json'
  | 'code'
  | 'table'
  | 'file'
  | 'image'
  | 'link'

export type AgentConsoleDiagnosticLevel = 'info' | 'warning' | 'error'

export type AgentConsoleEventType =
  | 'message'
  | 'tool-call'
  | 'tool-result'
  | 'artifact'
  | 'diagnostic'
  | 'status'
  | 'reset'

export type AgentConsoleMetadata = Record<string, unknown>

export interface AgentConsoleMessage {
  id: string
  role: AgentConsoleRole
  content: string
  status: AgentConsoleMessageStatus
  createdAt: number
  updatedAt: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleToolCall {
  id: string
  name: string
  status: AgentConsoleToolCallStatus
  input?: unknown
  output?: unknown
  error?: string
  createdAt: number
  updatedAt: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleArtifact {
  id: string
  kind: AgentConsoleArtifactKind
  title: string
  content?: unknown
  url?: string
  mimeType?: string
  createdAt: number
  updatedAt: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleDiagnostic {
  id: string
  level: AgentConsoleDiagnosticLevel
  message: string
  source?: string
  createdAt: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleEvent {
  id: string
  type: AgentConsoleEventType
  createdAt: number
  message?: AgentConsoleMessage
  toolCall?: AgentConsoleToolCall
  artifact?: AgentConsoleArtifact
  diagnostic?: AgentConsoleDiagnostic
  status?: AgentConsoleStatus
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleState {
  status: AgentConsoleStatus
  messages: AgentConsoleMessage[]
  toolCalls: AgentConsoleToolCall[]
  artifacts: AgentConsoleArtifact[]
  diagnostics: AgentConsoleDiagnostic[]
  events: AgentConsoleEvent[]
  selectedArtifactId?: string
}

export interface AgentConsoleAppendMessageInput {
  id?: string
  role: AgentConsoleRole
  content: string
  status?: AgentConsoleMessageStatus
  createdAt?: number
  updatedAt?: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleUpdateMessageInput {
  id: string
  content?: string
  status?: AgentConsoleMessageStatus
  updatedAt?: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleStartToolCallInput {
  id?: string
  name: string
  input?: unknown
  status?: AgentConsoleToolCallStatus
  createdAt?: number
  updatedAt?: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleFinishToolCallInput {
  id: string
  output?: unknown
  error?: string
  status?: AgentConsoleToolCallStatus
  updatedAt?: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleAddArtifactInput {
  id?: string
  kind: AgentConsoleArtifactKind
  title: string
  content?: unknown
  url?: string
  mimeType?: string
  createdAt?: number
  updatedAt?: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleAddDiagnosticInput {
  id?: string
  level: AgentConsoleDiagnosticLevel
  message: string
  source?: string
  createdAt?: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleSnapshotOptions {
  maxEvents?: number
}

export interface AgentConsoleEventDetail {
  event: AgentConsoleEvent
  state: AgentConsoleState
}

export interface AgentConsoleStatusChangeDetail {
  status: AgentConsoleStatus
  previousStatus: AgentConsoleStatus
  state: AgentConsoleState
}

export interface AgentConsoleArtifactSelectDetail {
  artifact: AgentConsoleArtifact | undefined
  artifactId: string | undefined
  state: AgentConsoleState
}

export interface AgentConsoleResetDetail {
  state: AgentConsoleState
}

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

export type { AgentConsoleElement } from './components/agent-console'
```

---

# 7. 新增 core

## 7.1 `packages/advanced/agent-console/src/core/id.ts`

```ts
let counter = 0

export function createAgentConsoleId(prefix = 'agc'): string {
  counter += 1
  return `${prefix}-${counter.toString(36)}`
}

export function resetAgentConsoleIdCounter(): void {
  counter = 0
}

export function normalizeAgentConsoleId(
  value: string | undefined,
  prefix?: string,
): string {
  return value && value.trim() ? value : createAgentConsoleId(prefix)
}
```

---

## 7.2 `packages/advanced/agent-console/src/core/message-model.ts`

```ts
import type {
  AgentConsoleAppendMessageInput,
  AgentConsoleMessage,
  AgentConsoleUpdateMessageInput,
} from '../types'

import { normalizeAgentConsoleId } from './id'

function now(): number {
  return Date.now()
}

export function createAgentConsoleMessage(
  input: AgentConsoleAppendMessageInput,
): AgentConsoleMessage {
  const createdAt = input.createdAt ?? now()

  return {
    id: normalizeAgentConsoleId(input.id, 'msg'),
    role: input.role,
    content: input.content,
    status: input.status ?? 'complete',
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    metadata: input.metadata,
  }
}

export function appendAgentConsoleMessage(
  messages: AgentConsoleMessage[],
  input: AgentConsoleAppendMessageInput,
): AgentConsoleMessage[] {
  return [...messages, createAgentConsoleMessage(input)]
}

export function updateAgentConsoleMessage(
  messages: AgentConsoleMessage[],
  input: AgentConsoleUpdateMessageInput,
): AgentConsoleMessage[] {
  return messages.map(message => {
    if (message.id !== input.id) return message

    return {
      ...message,
      content: input.content ?? message.content,
      status: input.status ?? message.status,
      updatedAt: input.updatedAt ?? Date.now(),
      metadata: input.metadata
        ? {
            ...(message.metadata ?? {}),
            ...input.metadata,
          }
        : message.metadata,
    }
  })
}

export function getAgentConsoleMessageById(
  messages: AgentConsoleMessage[],
  id: string,
): AgentConsoleMessage | undefined {
  return messages.find(message => message.id === id)
}
```

---

## 7.3 `packages/advanced/agent-console/src/core/tool-call-model.ts`

```ts
import type {
  AgentConsoleFinishToolCallInput,
  AgentConsoleStartToolCallInput,
  AgentConsoleToolCall,
} from '../types'

import { normalizeAgentConsoleId } from './id'

function now(): number {
  return Date.now()
}

export function createAgentConsoleToolCall(
  input: AgentConsoleStartToolCallInput,
): AgentConsoleToolCall {
  const createdAt = input.createdAt ?? now()

  return {
    id: normalizeAgentConsoleId(input.id, 'tool'),
    name: input.name,
    status: input.status ?? 'running',
    input: input.input,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    metadata: input.metadata,
  }
}

export function startAgentConsoleToolCall(
  toolCalls: AgentConsoleToolCall[],
  input: AgentConsoleStartToolCallInput,
): AgentConsoleToolCall[] {
  return [...toolCalls, createAgentConsoleToolCall(input)]
}

export function finishAgentConsoleToolCall(
  toolCalls: AgentConsoleToolCall[],
  input: AgentConsoleFinishToolCallInput,
): AgentConsoleToolCall[] {
  return toolCalls.map(toolCall => {
    if (toolCall.id !== input.id) return toolCall

    const status = input.status ?? (input.error ? 'error' : 'complete')

    return {
      ...toolCall,
      status,
      output: input.output,
      error: input.error,
      updatedAt: input.updatedAt ?? Date.now(),
      metadata: input.metadata
        ? {
            ...(toolCall.metadata ?? {}),
            ...input.metadata,
          }
        : toolCall.metadata,
    }
  })
}

export function getAgentConsoleToolCallById(
  toolCalls: AgentConsoleToolCall[],
  id: string,
): AgentConsoleToolCall | undefined {
  return toolCalls.find(toolCall => toolCall.id === id)
}
```

---

## 7.4 `packages/advanced/agent-console/src/core/artifact-model.ts`

```ts
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
```

---

## 7.5 `packages/advanced/agent-console/src/core/diagnostic-model.ts`

```ts
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
```

---

## 7.6 `packages/advanced/agent-console/src/core/event-log-model.ts`

```ts
import type {
  AgentConsoleArtifact,
  AgentConsoleDiagnostic,
  AgentConsoleEvent,
  AgentConsoleEventType,
  AgentConsoleMessage,
  AgentConsoleMetadata,
  AgentConsoleStatus,
  AgentConsoleToolCall,
} from '../types'

import { normalizeAgentConsoleId } from './id'

function now(): number {
  return Date.now()
}

export interface CreateAgentConsoleEventInput {
  id?: string
  type: AgentConsoleEventType
  createdAt?: number
  message?: AgentConsoleMessage
  toolCall?: AgentConsoleToolCall
  artifact?: AgentConsoleArtifact
  diagnostic?: AgentConsoleDiagnostic
  status?: AgentConsoleStatus
  metadata?: AgentConsoleMetadata
}

export function createAgentConsoleEvent(
  input: CreateAgentConsoleEventInput,
): AgentConsoleEvent {
  return {
    id: normalizeAgentConsoleId(input.id, 'event'),
    type: input.type,
    createdAt: input.createdAt ?? now(),
    message: input.message,
    toolCall: input.toolCall,
    artifact: input.artifact,
    diagnostic: input.diagnostic,
    status: input.status,
    metadata: input.metadata,
  }
}

export function appendAgentConsoleEvent(
  events: AgentConsoleEvent[],
  input: CreateAgentConsoleEventInput,
  maxEvents?: number,
): AgentConsoleEvent[] {
  const next = [...events, createAgentConsoleEvent(input)]

  if (!maxEvents || maxEvents <= 0 || next.length <= maxEvents) return next

  return next.slice(next.length - maxEvents)
}

export function filterAgentConsoleEventsByType(
  events: AgentConsoleEvent[],
  type: AgentConsoleEventType,
): AgentConsoleEvent[] {
  return events.filter(event => event.type === type)
}
```

---

## 7.7 `packages/advanced/agent-console/src/core/console-state.ts`

```ts
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
  return state.messages.at(-1)
}

export function getLatestAgentConsoleToolCall(
  state: AgentConsoleState,
): AgentConsoleToolCall | undefined {
  return state.toolCalls.at(-1)
}

export function getLatestAgentConsoleArtifact(
  state: AgentConsoleState,
): AgentConsoleArtifact | undefined {
  return state.artifacts.at(-1)
}

export function getLatestAgentConsoleDiagnostic(
  state: AgentConsoleState,
): AgentConsoleDiagnostic | undefined {
  return state.diagnostics.at(-1)
}

export function getLatestAgentConsoleEvent(
  state: AgentConsoleState,
): AgentConsoleEvent | undefined {
  return state.events.at(-1)
}
```

---

## 7.8 `packages/advanced/agent-console/src/core/index.ts`

```ts
export * from './artifact-model'
export * from './console-state'
export * from './diagnostic-model'
export * from './event-log-model'
export * from './id'
export * from './message-model'
export * from './tool-call-model'
```

---

# 8. 新增组件 `packages/advanced/agent-console/src/components/agent-console.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'

import type {
  AgentConsoleAddArtifactInput,
  AgentConsoleAddDiagnosticInput,
  AgentConsoleAppendMessageInput,
  AgentConsoleArtifact,
  AgentConsoleArtifactSelectDetail,
  AgentConsoleEvent,
  AgentConsoleEventDetail,
  AgentConsoleFinishToolCallInput,
  AgentConsoleMessage,
  AgentConsoleProps,
  AgentConsoleResetDetail,
  AgentConsoleSnapshotOptions,
  AgentConsoleStartToolCallInput,
  AgentConsoleState,
  AgentConsoleStatus,
  AgentConsoleStatusChangeDetail,
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
```

---

# 9. 新增 `packages/advanced/agent-console/src/index.ts`

```ts
export {
  AgentConsole,
  type AgentConsoleElement,
} from './components/agent-console'

export * from './core'
export * from './types'
```

---

# 10. 单元测试

## 10.1 `__tests__/id.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import {
  createAgentConsoleId,
  normalizeAgentConsoleId,
  resetAgentConsoleIdCounter,
} from '../src/core'

describe('agent console id', () => {
  it('creates deterministic incrementing ids', () => {
    resetAgentConsoleIdCounter()

    expect(createAgentConsoleId('x')).toBe('x-1')
    expect(createAgentConsoleId('x')).toBe('x-2')
    expect(createAgentConsoleId('msg')).toBe('msg-3')
  })

  it('normalizes provided ids', () => {
    resetAgentConsoleIdCounter()

    expect(normalizeAgentConsoleId('custom', 'x')).toBe('custom')
    expect(normalizeAgentConsoleId('', 'x')).toBe('x-1')
    expect(normalizeAgentConsoleId(undefined, 'x')).toBe('x-2')
  })
})
```

---

## 10.2 `__tests__/message-model.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import {
  appendAgentConsoleMessage,
  createAgentConsoleMessage,
  getAgentConsoleMessageById,
  updateAgentConsoleMessage,
} from '../src/core'

describe('message model', () => {
  it('creates a message', () => {
    expect(
      createAgentConsoleMessage({
        id: 'm1',
        role: 'assistant',
        content: 'Hello',
        createdAt: 1,
      }),
    ).toEqual({
      id: 'm1',
      role: 'assistant',
      content: 'Hello',
      status: 'complete',
      createdAt: 1,
      updatedAt: 1,
      metadata: undefined,
    })
  })

  it('appends messages', () => {
    expect(
      appendAgentConsoleMessage([], {
        id: 'm1',
        role: 'user',
        content: 'Hi',
        createdAt: 1,
      }),
    ).toHaveLength(1)
  })

  it('updates message content and metadata', () => {
    const messages = [
      createAgentConsoleMessage({
        id: 'm1',
        role: 'assistant',
        content: 'A',
        createdAt: 1,
        metadata: {
          a: 1,
        },
      }),
    ]

    expect(
      updateAgentConsoleMessage(messages, {
        id: 'm1',
        content: 'B',
        status: 'streaming',
        updatedAt: 2,
        metadata: {
          b: 2,
        },
      })[0],
    ).toMatchObject({
      id: 'm1',
      content: 'B',
      status: 'streaming',
      updatedAt: 2,
      metadata: {
        a: 1,
        b: 2,
      },
    })
  })

  it('gets message by id', () => {
    const messages = [
      createAgentConsoleMessage({
        id: 'm1',
        role: 'user',
        content: 'Hi',
      }),
    ]

    expect(getAgentConsoleMessageById(messages, 'm1')?.content).toBe('Hi')
    expect(getAgentConsoleMessageById(messages, 'missing')).toBeUndefined()
  })
})
```

---

## 10.3 `__tests__/tool-call-model.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import {
  createAgentConsoleToolCall,
  finishAgentConsoleToolCall,
  getAgentConsoleToolCallById,
  startAgentConsoleToolCall,
} from '../src/core'

describe('tool call model', () => {
  it('creates a tool call', () => {
    expect(
      createAgentConsoleToolCall({
        id: 't1',
        name: 'search',
        input: {
          q: 'zeus',
        },
        createdAt: 1,
      }),
    ).toEqual({
      id: 't1',
      name: 'search',
      status: 'running',
      input: {
        q: 'zeus',
      },
      createdAt: 1,
      updatedAt: 1,
      metadata: undefined,
    })
  })

  it('starts and finishes a tool call', () => {
    const started = startAgentConsoleToolCall([], {
      id: 't1',
      name: 'search',
      createdAt: 1,
    })

    const finished = finishAgentConsoleToolCall(started, {
      id: 't1',
      output: {
        ok: true,
      },
      updatedAt: 2,
    })

    expect(finished[0]).toMatchObject({
      id: 't1',
      status: 'complete',
      output: {
        ok: true,
      },
      updatedAt: 2,
    })
  })

  it('marks tool call as error when error is provided', () => {
    const started = startAgentConsoleToolCall([], {
      id: 't1',
      name: 'search',
      createdAt: 1,
    })

    expect(
      finishAgentConsoleToolCall(started, {
        id: 't1',
        error: 'failed',
        updatedAt: 2,
      })[0],
    ).toMatchObject({
      id: 't1',
      status: 'error',
      error: 'failed',
    })
  })

  it('gets tool call by id', () => {
    const calls = startAgentConsoleToolCall([], {
      id: 't1',
      name: 'search',
    })

    expect(getAgentConsoleToolCallById(calls, 't1')?.name).toBe('search')
    expect(getAgentConsoleToolCallById(calls, 'missing')).toBeUndefined()
  })
})
```

---

## 10.4 `__tests__/artifact-model.spec.ts`

```ts
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
```

---

## 10.5 `__tests__/diagnostic-model.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import {
  addAgentConsoleDiagnostic,
  createAgentConsoleDiagnostic,
  getAgentConsoleDiagnosticById,
  getAgentConsoleDiagnosticsByLevel,
} from '../src/core'

describe('diagnostic model', () => {
  it('creates diagnostic', () => {
    expect(
      createAgentConsoleDiagnostic({
        id: 'd1',
        level: 'warning',
        message: 'Slow tool',
        source: 'tool',
        createdAt: 1,
      }),
    ).toEqual({
      id: 'd1',
      level: 'warning',
      message: 'Slow tool',
      source: 'tool',
      createdAt: 1,
      metadata: undefined,
    })
  })

  it('adds and filters diagnostics', () => {
    const diagnostics = [
      ...addAgentConsoleDiagnostic([], {
        id: 'd1',
        level: 'info',
        message: 'Start',
      }),
      ...addAgentConsoleDiagnostic([], {
        id: 'd2',
        level: 'error',
        message: 'Failed',
      }),
    ]

    expect(getAgentConsoleDiagnosticById(diagnostics, 'd2')?.message).toBe(
      'Failed',
    )
    expect(
      getAgentConsoleDiagnosticsByLevel(diagnostics, 'error'),
    ).toHaveLength(1)
  })
})
```

---

## 10.6 `__tests__/event-log-model.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import {
  appendAgentConsoleEvent,
  createAgentConsoleEvent,
  filterAgentConsoleEventsByType,
} from '../src/core'

describe('event log model', () => {
  it('creates event', () => {
    expect(
      createAgentConsoleEvent({
        id: 'e1',
        type: 'status',
        status: 'running',
        createdAt: 1,
      }),
    ).toEqual({
      id: 'e1',
      type: 'status',
      status: 'running',
      createdAt: 1,
      message: undefined,
      toolCall: undefined,
      artifact: undefined,
      diagnostic: undefined,
      metadata: undefined,
    })
  })

  it('appends and caps events', () => {
    const events = appendAgentConsoleEvent(
      appendAgentConsoleEvent(
        appendAgentConsoleEvent([], {
          id: 'e1',
          type: 'status',
        }),
        {
          id: 'e2',
          type: 'message',
        },
      ),
      {
        id: 'e3',
        type: 'artifact',
      },
      2,
    )

    expect(events.map(event => event.id)).toEqual(['e2', 'e3'])
  })

  it('filters by type', () => {
    const events = [
      createAgentConsoleEvent({
        id: 'e1',
        type: 'message',
      }),
      createAgentConsoleEvent({
        id: 'e2',
        type: 'artifact',
      }),
    ]

    expect(filterAgentConsoleEventsByType(events, 'artifact')).toEqual([
      expect.objectContaining({
        id: 'e2',
      }),
    ])
  })
})
```

---

## 10.7 `__tests__/console-state.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import {
  addArtifactToAgentConsoleState,
  addDiagnosticToAgentConsoleState,
  appendMessageToAgentConsoleState,
  cloneAgentConsoleState,
  createEmptyAgentConsoleState,
  finishToolCallInAgentConsoleState,
  getLatestAgentConsoleArtifact,
  getLatestAgentConsoleEvent,
  getLatestAgentConsoleMessage,
  getLatestAgentConsoleToolCall,
  selectAgentConsoleArtifact,
  setAgentConsoleStatus,
  startToolCallInAgentConsoleState,
  updateMessageInAgentConsoleState,
} from '../src/core'

describe('console state', () => {
  it('creates empty state', () => {
    expect(createEmptyAgentConsoleState()).toEqual({
      status: 'idle',
      messages: [],
      toolCalls: [],
      artifacts: [],
      diagnostics: [],
      events: [],
    })
  })

  it('sets status and appends status event', () => {
    const state = setAgentConsoleStatus(
      createEmptyAgentConsoleState(),
      'running',
    )

    expect(state.status).toBe('running')
    expect(getLatestAgentConsoleEvent(state)).toMatchObject({
      type: 'status',
      status: 'running',
    })
  })

  it('appends and updates messages', () => {
    const state = appendMessageToAgentConsoleState(
      createEmptyAgentConsoleState(),
      {
        id: 'm1',
        role: 'assistant',
        content: 'Hello',
        createdAt: 1,
      },
    )

    expect(getLatestAgentConsoleMessage(state)?.content).toBe('Hello')
    expect(getLatestAgentConsoleEvent(state)?.type).toBe('message')

    const updated = updateMessageInAgentConsoleState(state, {
      id: 'm1',
      content: 'Hello world',
      updatedAt: 2,
    })

    expect(updated.messages[0].content).toBe('Hello world')
  })

  it('starts and finishes tool calls', () => {
    const started = startToolCallInAgentConsoleState(
      createEmptyAgentConsoleState(),
      {
        id: 't1',
        name: 'search',
        createdAt: 1,
      },
    )

    expect(getLatestAgentConsoleToolCall(started)?.status).toBe('running')
    expect(getLatestAgentConsoleEvent(started)?.type).toBe('tool-call')

    const finished = finishToolCallInAgentConsoleState(started, {
      id: 't1',
      output: {
        ok: true,
      },
      updatedAt: 2,
    })

    expect(finished.toolCalls[0].status).toBe('complete')
    expect(getLatestAgentConsoleEvent(finished)?.type).toBe('tool-result')
  })

  it('adds and selects artifacts', () => {
    const state = addArtifactToAgentConsoleState(
      createEmptyAgentConsoleState(),
      {
        id: 'a1',
        kind: 'json',
        title: 'Result',
      },
    )

    expect(getLatestAgentConsoleArtifact(state)?.id).toBe('a1')
    expect(state.selectedArtifactId).toBe('a1')

    const cleared = selectAgentConsoleArtifact(state, undefined)
    expect(cleared.selectedArtifactId).toBeUndefined()

    const selected = selectAgentConsoleArtifact(cleared, 'a1')
    expect(selected.selectedArtifactId).toBe('a1')
  })

  it('adds diagnostics', () => {
    const state = addDiagnosticToAgentConsoleState(
      createEmptyAgentConsoleState(),
      {
        id: 'd1',
        level: 'error',
        message: 'Failed',
      },
    )

    expect(state.diagnostics[0].message).toBe('Failed')
    expect(getLatestAgentConsoleEvent(state)?.type).toBe('diagnostic')
  })

  it('clones state and caps events', () => {
    const state = appendMessageToAgentConsoleState(
      appendMessageToAgentConsoleState(createEmptyAgentConsoleState(), {
        id: 'm1',
        role: 'user',
        content: 'A',
      }),
      {
        id: 'm2',
        role: 'assistant',
        content: 'B',
      },
    )

    const snapshot = cloneAgentConsoleState(state, {
      maxEvents: 1,
    })

    expect(snapshot.events).toHaveLength(1)
    expect(snapshot.events[0].message?.id).toBe('m2')
    expect(snapshot).not.toBe(state)
    expect(snapshot.messages).not.toBe(state.messages)
  })
})
```

---

## 10.8 `__tests__/agent-console.spec.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const sourcePath = resolve(
  workspaceRoot,
  'packages/advanced/agent-console/src/components/agent-console.tsx',
)
const source = readFileSync(sourcePath, 'utf-8')

describe('agent-console component protocol', () => {
  it('infers props, events, methods, slots and parts', () => {
    const result = analyzeFile({
      file: 'packages/advanced/agent-console/src/components/agent-console.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-agent-console',
      props: {
        status: {
          type: 'string',
          values: ['idle', 'running', 'waiting', 'complete', 'error'],
          default: 'idle',
          reflect: true,
        },
        selectedArtifactId: {
          type: 'string',
        },
        maxEvents: {
          type: 'number',
        },
        ariaLabel: {
          type: 'string',
        },
      },
      events: {
        agentEvent: {
          name: 'agent-event',
          reactName: 'onAgentEvent',
        },
        statusChange: {
          name: 'status-change',
          reactName: 'onStatusChange',
        },
        artifactSelect: {
          name: 'artifact-select',
          reactName: 'onArtifactSelect',
        },
        reset: {
          name: 'reset',
          reactName: 'onReset',
        },
      },
      methods: {
        appendMessage: {
          name: 'appendMessage',
          returns: 'AgentConsoleMessage',
        },
        updateMessage: {
          name: 'updateMessage',
          returns: 'AgentConsoleMessage | undefined',
        },
        startToolCall: {
          name: 'startToolCall',
          returns: 'string',
        },
        finishToolCall: {
          name: 'finishToolCall',
          returns: 'void',
        },
        addArtifact: {
          name: 'addArtifact',
          returns: 'AgentConsoleArtifact',
        },
        selectArtifact: {
          name: 'selectArtifact',
          returns: 'AgentConsoleArtifact | undefined',
        },
        addDiagnostic: {
          name: 'addDiagnostic',
          returns: 'void',
        },
        setStatus: {
          name: 'setStatus',
          returns: 'void',
        },
        getState: {
          name: 'getState',
          returns: 'AgentConsoleState',
        },
        getEvents: {
          name: 'getEvents',
          returns: 'AgentConsoleEvent[]',
        },
        reset: {
          name: 'reset',
          returns: 'void',
        },
      },
      slots: {
        timeline: {
          name: 'timeline',
        },
        tools: {
          name: 'tools',
        },
        artifacts: {
          name: 'artifacts',
        },
        diagnostics: {
          name: 'diagnostics',
        },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining([
        'root',
        'layout',
        'timeline',
        'tools',
        'artifacts',
        'diagnostics',
      ]),
    )
  })

  it('does not include provider or network logic', () => {
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('EventSource')
    expect(source).not.toContain('WebSocket')
    expect(source).not.toContain('OPENAI_API_KEY')
    expect(source).not.toContain('ANTHROPIC_API_KEY')
    expect(source).not.toContain('DEEPSEEK_API_KEY')
    expect(source).not.toContain('Authorization')
    expect(source).not.toContain('Bearer')
  })

  it('exports component from package root', () => {
    const indexSource = readFileSync(
      resolve(workspaceRoot, 'packages/advanced/agent-console/src/index.ts'),
      'utf-8',
    )

    expect(indexSource).toContain('AgentConsole')
    expect(indexSource).toContain('AgentConsoleElement')
    expect(indexSource).toContain('./components/agent-console')
  })
})
```

---

# 11. 新增 `docs/advanced/design/phase14.md`

````md
# Phase 14：Agent Console Foundation

## 目标

Phase 14 新增 `@zeus-web/agent-console` advanced 包，作为 Agent Console 的本地 headless foundation。

它只负责：

1. messages
2. tool calls
3. artifacts
4. diagnostics
5. status
6. event log
7. Web Component 协议

它不负责真实 LLM provider、网络请求、API key、SSE/WebSocket、tool executor。

## 非目标

1. 不接 OpenAI / Anthropic / DeepSeek。
2. 不读取 API key。
3. 不写 fetch。
4. 不写 SSE。
5. 不写 WebSocket。
6. 不执行真实 tool。
7. 不实现 markdown renderer。
8. 不实现 artifact preview。
9. 不接 registry product layer。

## 包结构

```txt
packages/advanced/agent-console/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    core/
      index.ts
      id.ts
      message-model.ts
      tool-call-model.ts
      artifact-model.ts
      diagnostic-model.ts
      event-log-model.ts
      console-state.ts
    components/
      agent-console.tsx
  __tests__/
    id.spec.ts
    message-model.spec.ts
    tool-call-model.spec.ts
    artifact-model.spec.ts
    diagnostic-model.spec.ts
    event-log-model.spec.ts
    console-state.spec.ts
    agent-console.spec.ts
```
````

## Web Component

标签：

```txt
zw-agent-console
```

### Props

```txt
status
messages
toolCalls
artifacts
diagnostics
selectedArtifactId
maxEvents
ariaLabel
```

### Events

```txt
agent-event
status-change
artifact-select
reset
```

### Methods

```txt
appendMessage(input)
updateMessage(input)
startToolCall(input)
finishToolCall(input)
addArtifact(input)
selectArtifact(artifactId)
addDiagnostic(input)
setStatus(status)
getState(options)
getEvents()
reset()
```

### Slots

```txt
timeline
tools
artifacts
diagnostics
```

### Parts

```txt
root
layout
timeline
tools
artifacts
diagnostics
```

## 状态模型

`AgentConsoleState` 包含：

```txt
status
messages
toolCalls
artifacts
diagnostics
events
selectedArtifactId
```

所有写操作都会更新 state，并在必要时追加 event log。

## 安全边界

Phase 14 明确禁止：

```txt
fetch
EventSource
WebSocket
Authorization
Bearer
OPENAI_API_KEY
ANTHROPIC_API_KEY
DEEPSEEK_API_KEY
```

Provider adapter 应在后续阶段单独设计。

## 验收

```bash
pnpm --filter @zeus-web/agent-console check
pnpm --filter @zeus-web/agent-console test
pnpm --filter @zeus-web/agent-console build

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm release:plan
```

````

---

# 12. 验收命令

```bash
pnpm --filter @zeus-web/agent-console check
pnpm --filter @zeus-web/agent-console test
pnpm --filter @zeus-web/agent-console build

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm check:product-contract
pnpm release:plan
````

---

# 13. Phase 14 完成标准

```txt
必须满足:
  1. 新增 @zeus-web/agent-console advanced 包
  2. 包结构符合 advanced contract
  3. package exports 符合 advanced contract
  4. AgentConsole core 单测通过
  5. AgentConsole component analyzer 测试通过
  6. zw-agent-console 暴露完整 props/events/methods/slots/parts
  7. 不包含 fetch / EventSource / WebSocket / API key / Authorization / Bearer
  8. 不接真实 provider
  9. build output/exports 检查通过
```

---

# 14. 下一阶段建议

Phase 15 建议做：

```txt
Phase 15: Agent Console Product Layer

目标:
  1. registry 注册 agent-console
  2. native/react/vue templates
  3. AI metadata
  4. product contract
  5. 仍然不接真实 provider
```

Phase 16 再做：

```txt
Phase 16: Agent Console Runtime Harness

目标:
  1. jsdom runtime e2e
  2. appendMessage / toolCall / artifact / diagnostic / status 事件验证
  3. slots/parts/runtime 属性验证
```

Phase 17 才适合考虑 provider adapter。
