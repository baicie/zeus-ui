<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

type AgentStatus = 'idle' | 'running' | 'waiting' | 'complete' | 'error'
type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error'
type ToolStatus = 'pending' | 'running' | 'complete' | 'error' | 'cancelled'
type ArtifactKind =
  | 'text'
  | 'json'
  | 'code'
  | 'table'
  | 'file'
  | 'image'
  | 'link'

interface AgentMessage {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  status: MessageStatus
  createdAt: number
  updatedAt: number
}

interface AgentToolCall {
  id: string
  name: string
  status: ToolStatus
  input?: unknown
  output?: unknown
  createdAt: number
  updatedAt: number
}

interface AgentArtifact {
  id: string
  kind: ArtifactKind
  title: string
  content?: unknown
  createdAt: number
  updatedAt: number
}

interface AgentDiagnostic {
  id: string
  level: 'info' | 'warning' | 'error'
  message: string
  source?: string
  createdAt: number
}

interface AgentSnapshot {
  status: AgentStatus
  messages: AgentMessage[]
  toolCalls: AgentToolCall[]
  artifacts: AgentArtifact[]
  diagnostics: AgentDiagnostic[]
  selectedArtifactId?: string
}

interface AppendMessageInput {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  status?: MessageStatus
}

interface StartToolCallInput {
  name: string
  input?: unknown
}

interface FinishToolCallInput {
  id: string
  output?: unknown
  error?: string
}

interface AddArtifactInput {
  kind: ArtifactKind
  title: string
  content?: unknown
}

interface AddDiagnosticInput {
  level: 'info' | 'warning' | 'error'
  message: string
  source?: string
}

interface AgentConsoleElement extends HTMLElement {
  componentOnReady?: () => Promise<HTMLElement>
  status?: AgentStatus
  messages?: AgentMessage[]
  toolCalls?: AgentToolCall[]
  artifacts?: AgentArtifact[]
  diagnostics?: AgentDiagnostic[]
  selectedArtifactId?: string
  appendMessage?: (
    input: AppendMessageInput,
  ) => AgentMessage | Promise<AgentMessage>
  startToolCall?: (input: StartToolCallInput) => string | Promise<string>
  finishToolCall?: (input: FinishToolCallInput) => void | Promise<void>
  addArtifact?: (
    input: AddArtifactInput,
  ) => AgentArtifact | Promise<AgentArtifact>
  selectArtifact?: (
    artifactId: string | undefined,
  ) => AgentArtifact | undefined | Promise<AgentArtifact | undefined>
  addDiagnostic?: (input: AddDiagnosticInput) => void | Promise<void>
  setStatus?: (status: AgentStatus) => void | Promise<void>
  getState?: () => AgentSnapshot | Promise<AgentSnapshot>
  reset?: () => void | Promise<void>
}

interface AgentEventDetail {
  event?: {
    type?: unknown
  }
  state?: unknown
}

interface StatusChangeDetail {
  status?: unknown
  state?: unknown
}

interface ArtifactSelectDetail {
  artifact?: unknown
  state?: unknown
}

const ui = useLocalizedMessages({
  en: {
    initialized: 'Local agent console initialized.',
    instructions: 'Use the controls to exercise state transitions.',
    summary: 'Workspace summary',
    localDiagnostic: 'No provider configured; running local UI behavior only.',
    waiting: 'Waiting for the Agent Console custom element.',
    readFailed: 'The console state could not be read.',
    consoleLabel: 'Local agent console',
    ready: 'Agent Console ready. All actions stay local.',
    actionFailed: 'The requested console action failed.',
    appendedContent: 'A local message was appended through the exposed method.',
    appended: 'Message appended.',
    toolComplete: 'Tool call completed.',
    toolFailed: 'Tool call failed.',
    runNote: (index: number) => `Run note ${index}`,
    artifactContent: 'Created from the standalone Agent Console playground.',
    artifactAdded: 'Artifact added and selected.',
    syntheticDiagnostic: 'Synthetic playground diagnostic.',
    diagnosticAdded: 'Diagnostic added.',
    statusChanged: (status: string) => `Status changed to ${status}.`,
    artifactSelected: (id: string) => `Selected artifact “${id}”.`,
    reset: 'Console state reset.',
    agentEvent: (type: string) => `Agent event: ${type}`,
    statusEvent: (status: string) => `Status event: ${status}`,
    artifactEvent: (title: string) => `Artifact event: ${title}`,
    resetEvent: 'Reset event received.',
    message: 'Message',
    runTool: 'Run tool',
    artifact: 'Artifact',
    diagnostic: 'Diagnostic',
    status: 'Status',
    resetButton: 'Reset',
    noMessages: 'No messages after reset.',
    toolCalls: 'Tool calls',
    noToolCalls: 'No tool calls.',
    artifacts: 'Artifacts',
    noArtifacts: 'No artifacts.',
    diagnostics: 'Diagnostics',
    noDiagnostics: 'No diagnostics.',
    noArtifactSelected: 'No artifact selected.',
    system: 'System',
    user: 'User',
    assistant: 'Assistant',
    tool: 'Tool',
    idle: 'Idle',
    running: 'Running',
    waitingStatus: 'Waiting',
    complete: 'Complete',
    error: 'Error',
    pending: 'Pending',
    streaming: 'Streaming',
    cancelled: 'Cancelled',
  },
  zh: {
    initialized: '本地智能体控制台已初始化。',
    instructions: '使用上方控件体验状态变化。',
    summary: '工作区摘要',
    localDiagnostic: '未配置服务；当前只运行本地 UI 行为。',
    waiting: '正在等待 Agent Console 自定义元素。',
    readFailed: '无法读取控制台状态。',
    consoleLabel: '本地智能体控制台',
    ready: 'Agent Console 已就绪，所有操作均在本地完成。',
    actionFailed: '请求的控制台操作失败。',
    appendedContent: '已通过公开方法追加一条本地消息。',
    appended: '消息已追加。',
    toolComplete: '工具调用已完成。',
    toolFailed: '工具调用失败。',
    runNote: (index: number) => `运行记录 ${index}`,
    artifactContent: '由独立 Agent Console 交互演示创建。',
    artifactAdded: '产物已添加并选中。',
    syntheticDiagnostic: '模拟的交互演示诊断。',
    diagnosticAdded: '诊断已添加。',
    statusChanged: (status: string) => `状态已切换为 ${status}。`,
    artifactSelected: (id: string) => `已选择产物“${id}”。`,
    reset: '控制台状态已重置。',
    agentEvent: (type: string) => `智能体事件：${type}`,
    statusEvent: (status: string) => `状态事件：${status}`,
    artifactEvent: (title: string) => `产物事件：${title}`,
    resetEvent: '已收到重置事件。',
    message: '消息',
    runTool: '运行工具',
    artifact: '产物',
    diagnostic: '诊断',
    status: '状态',
    resetButton: '重置',
    noMessages: '重置后暂无消息。',
    toolCalls: '工具调用',
    noToolCalls: '暂无工具调用。',
    artifacts: '产物',
    noArtifacts: '暂无产物。',
    diagnostics: '诊断',
    noDiagnostics: '暂无诊断。',
    noArtifactSelected: '尚未选择产物。',
    system: '系统',
    user: '用户',
    assistant: '助手',
    tool: '工具',
    idle: '空闲',
    running: '运行中',
    waitingStatus: '等待中',
    complete: '已完成',
    error: '错误',
    pending: '待处理',
    streaming: '输出中',
    cancelled: '已取消',
  },
})

const INITIAL_TIME = 1750000000000

const initialMessages: AgentMessage[] = [
  {
    id: 'system',
    role: 'system',
    content: ui.value.initialized,
    status: 'complete',
    createdAt: INITIAL_TIME,
    updatedAt: INITIAL_TIME,
  },
  {
    id: 'assistant',
    role: 'assistant',
    content: ui.value.instructions,
    status: 'complete',
    createdAt: INITIAL_TIME + 1,
    updatedAt: INITIAL_TIME + 1,
  },
]

const initialToolCalls: AgentToolCall[] = [
  {
    id: 'inspect',
    name: 'workspace.inspect',
    status: 'complete',
    input: { scope: 'playground' },
    output: { components: 25 },
    createdAt: INITIAL_TIME + 2,
    updatedAt: INITIAL_TIME + 2,
  },
]

const initialArtifacts: AgentArtifact[] = [
  {
    id: 'summary',
    kind: 'json',
    title: ui.value.summary,
    content: {
      packages: 25,
      frameworks: ['web-component', 'react', 'vue'],
    },
    createdAt: INITIAL_TIME + 3,
    updatedAt: INITIAL_TIME + 3,
  },
]

const initialDiagnostics: AgentDiagnostic[] = [
  {
    id: 'local-mode',
    level: 'info',
    message: ui.value.localDiagnostic,
    source: 'playground',
    createdAt: INITIAL_TIME + 4,
  },
]

const consoleElement = ref<AgentConsoleElement | null>(null)
const snapshot = ref<AgentSnapshot>(createInitialSnapshot())
const note = ref(ui.value.waiting)
const isReady = ref(false)

let activeElement: AgentConsoleElement | null = null
let syncFrame: number | undefined

const selectedArtifact = computed(() => {
  const selectedId = snapshot.value.selectedArtifactId

  if (!selectedId) return undefined

  return snapshot.value.artifacts.find(artifact => artifact.id === selectedId)
})

function localizedState(value: string): string {
  if (value === 'system') return ui.value.system
  if (value === 'user') return ui.value.user
  if (value === 'assistant') return ui.value.assistant
  if (value === 'tool') return ui.value.tool
  if (value === 'idle') return ui.value.idle
  if (value === 'running') return ui.value.running
  if (value === 'waiting') return ui.value.waitingStatus
  if (value === 'complete') return ui.value.complete
  if (value === 'error') return ui.value.error
  if (value === 'pending') return ui.value.pending
  if (value === 'streaming') return ui.value.streaming
  if (value === 'cancelled') return ui.value.cancelled
  return value
}

function createInitialSnapshot(): AgentSnapshot {
  return {
    status: 'idle',
    messages: initialMessages.slice(),
    toolCalls: initialToolCalls.slice(),
    artifacts: initialArtifacts.slice(),
    diagnostics: initialDiagnostics.slice(),
    selectedArtifactId: 'summary',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isAgentStatus(value: unknown): value is AgentStatus {
  return (
    value === 'idle' ||
    value === 'running' ||
    value === 'waiting' ||
    value === 'complete' ||
    value === 'error'
  )
}

function isMessage(value: unknown): value is AgentMessage {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.role === 'string' &&
    typeof value.content === 'string' &&
    typeof value.status === 'string'
  )
}

function isToolCall(value: unknown): value is AgentToolCall {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.status === 'string'
  )
}

function isArtifact(value: unknown): value is AgentArtifact {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    typeof value.title === 'string'
  )
}

function isDiagnostic(value: unknown): value is AgentDiagnostic {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.level === 'string' &&
    typeof value.message === 'string'
  )
}

function normalizeSnapshot(value: unknown): AgentSnapshot | undefined {
  if (!isRecord(value)) return undefined

  const status = isAgentStatus(value.status) ? value.status : 'idle'
  const selectedArtifactId =
    typeof value.selectedArtifactId === 'string'
      ? value.selectedArtifactId
      : undefined

  return {
    status,
    messages: Array.isArray(value.messages)
      ? value.messages.filter(isMessage)
      : [],
    toolCalls: Array.isArray(value.toolCalls)
      ? value.toolCalls.filter(isToolCall)
      : [],
    artifacts: Array.isArray(value.artifacts)
      ? value.artifacts.filter(isArtifact)
      : [],
    diagnostics: Array.isArray(value.diagnostics)
      ? value.diagnostics.filter(isDiagnostic)
      : [],
    selectedArtifactId,
  }
}

function commitSnapshot(value: unknown): void {
  const nextSnapshot = normalizeSnapshot(value)

  if (nextSnapshot) snapshot.value = nextSnapshot
}

function syncFromElement(): void {
  const element = activeElement

  if (!element || typeof element.getState !== 'function') return

  Promise.resolve(element.getState()).then(
    value => {
      if (activeElement === element) commitSnapshot(value)
    },
    () => {
      note.value = ui.value.readFailed
    },
  )
}

function scheduleSync(): void {
  if (syncFrame !== undefined) cancelAnimationFrame(syncFrame)

  syncFrame = requestAnimationFrame(() => {
    syncFrame = undefined
    syncFromElement()
  })
}

function configureConsole(element: AgentConsoleElement): void {
  const initial = createInitialSnapshot()

  element.messages = initial.messages.slice()
  element.toolCalls = initial.toolCalls.slice()
  element.artifacts = initial.artifacts.slice()
  element.diagnostics = initial.diagnostics.slice()
  element.status = initial.status
  element.selectedArtifactId = initial.selectedArtifactId
  element.setAttribute('aria-label', ui.value.consoleLabel)

  isReady.value = true
  note.value = ui.value.ready
  scheduleSync()
}

function finishAction(
  result: unknown | PromiseLike<unknown>,
  successNote: string,
): void {
  Promise.resolve(result).then(
    () => {
      note.value = successNote
      syncFromElement()
    },
    () => {
      note.value = ui.value.actionFailed
      syncFromElement()
    },
  )
}

function appendMessage(): void {
  const element = activeElement

  if (!element || typeof element.appendMessage !== 'function') return

  finishAction(
    element.appendMessage({
      role: 'assistant',
      content: ui.value.appendedContent,
      status: 'complete',
    }),
    ui.value.appended,
  )
}

function runTool(): void {
  const element = activeElement

  if (
    !element ||
    typeof element.startToolCall !== 'function' ||
    typeof element.finishToolCall !== 'function'
  ) {
    return
  }

  const finishToolCall = element.finishToolCall

  Promise.resolve(
    element.startToolCall({
      name: 'playground.inspect',
      input: { route: '/playground/agent-console/' },
    }),
  )
    .then(toolId =>
      finishToolCall.call(element, {
        id: toolId,
        output: { ok: true, elements: 4 },
      }),
    )
    .then(
      () => {
        note.value = ui.value.toolComplete
        syncFromElement()
      },
      () => {
        note.value = ui.value.toolFailed
        syncFromElement()
      },
    )
}

function addArtifact(): void {
  const element = activeElement

  if (!element || typeof element.addArtifact !== 'function') return

  finishAction(
    element.addArtifact({
      kind: 'text',
      title: ui.value.runNote(snapshot.value.artifacts.length + 1),
      content: ui.value.artifactContent,
    }),
    ui.value.artifactAdded,
  )
}

function addDiagnostic(): void {
  const element = activeElement

  if (!element || typeof element.addDiagnostic !== 'function') return

  finishAction(
    element.addDiagnostic({
      level: 'warning',
      message: ui.value.syntheticDiagnostic,
      source: 'playground',
    }),
    ui.value.diagnosticAdded,
  )
}

function cycleStatus(): void {
  const element = activeElement

  if (!element || typeof element.setStatus !== 'function') return

  const statuses: AgentStatus[] = ['idle', 'running', 'waiting', 'complete']
  const currentIndex = statuses.indexOf(snapshot.value.status)
  const nextStatus = statuses[(currentIndex + 1) % statuses.length]

  finishAction(
    element.setStatus(nextStatus),
    ui.value.statusChanged(localizedState(nextStatus)),
  )
}

function selectArtifact(artifactId: string): void {
  const element = activeElement

  if (!element || typeof element.selectArtifact !== 'function') return

  finishAction(
    element.selectArtifact(artifactId),
    ui.value.artifactSelected(artifactId),
  )
}

function resetConsole(): void {
  const element = activeElement

  if (!element || typeof element.reset !== 'function') return

  finishAction(element.reset(), ui.value.reset)
}

function handleAgentEvent(event: Event): void {
  const customEvent = event as CustomEvent<AgentEventDetail>
  const detail = customEvent.detail

  if (detail && detail.state) commitSnapshot(detail.state)

  const eventType =
    detail && detail.event && typeof detail.event.type === 'string'
      ? detail.event.type
      : 'state-change'

  note.value = ui.value.agentEvent(eventType)
}

function handleStatusChange(event: Event): void {
  const customEvent = event as CustomEvent<StatusChangeDetail>
  const detail = customEvent.detail

  if (detail && detail.state) commitSnapshot(detail.state)

  if (detail && typeof detail.status === 'string') {
    note.value = ui.value.statusEvent(localizedState(detail.status))
  }
}

function handleArtifactSelect(event: Event): void {
  const customEvent = event as CustomEvent<ArtifactSelectDetail>
  const detail = customEvent.detail

  if (detail && detail.state) commitSnapshot(detail.state)

  if (detail && isArtifact(detail.artifact)) {
    note.value = ui.value.artifactEvent(detail.artifact.title)
  }
}

function handleReset(): void {
  note.value = ui.value.resetEvent
  syncFromElement()
}

function artifactContent(artifact: AgentArtifact): string {
  if (artifact.kind === 'json') {
    return JSON.stringify(artifact.content, null, 2)
  }

  return artifact.content === undefined ? '' : String(artifact.content)
}

onMounted(() => {
  const element = consoleElement.value

  if (!element) return

  activeElement = element
  element.addEventListener('agent-event', handleAgentEvent)
  element.addEventListener('status-change', handleStatusChange)
  element.addEventListener('artifact-select', handleArtifactSelect)
  element.addEventListener('reset', handleReset)

  if (typeof element.componentOnReady === 'function') {
    element.componentOnReady().then(
      () => configureConsole(element),
      () => configureConsole(element),
    )
  } else {
    configureConsole(element)
  }
})

onUnmounted(() => {
  if (syncFrame !== undefined) {
    cancelAnimationFrame(syncFrame)
    syncFrame = undefined
  }

  if (activeElement) {
    activeElement.removeEventListener('agent-event', handleAgentEvent)
    activeElement.removeEventListener('status-change', handleStatusChange)
    activeElement.removeEventListener('artifact-select', handleArtifactSelect)
    activeElement.removeEventListener('reset', handleReset)
  }

  activeElement = null
})
</script>

<template>
  <div class="advanced-demo" data-playground-demo="agent-console">
    <div class="demo-toolbar">
      <button type="button" :disabled="!isReady" @click="appendMessage">
        {{ ui.message }}
      </button>
      <button type="button" :disabled="!isReady" @click="runTool">
        {{ ui.runTool }}
      </button>
      <button type="button" :disabled="!isReady" @click="addArtifact">
        {{ ui.artifact }}
      </button>
      <button type="button" :disabled="!isReady" @click="addDiagnostic">
        {{ ui.diagnostic }}
      </button>
      <button type="button" :disabled="!isReady" @click="cycleStatus">
        {{ ui.status }}
      </button>
      <button type="button" :disabled="!isReady" @click="resetConsole">
        {{ ui.resetButton }}
      </button>
      <span aria-live="polite">{{ note }}</span>
    </div>

    <zw-agent-console ref="consoleElement">
      <div v-bind="{ slot: 'timeline' }" class="agent-timeline">
        <article
          v-for="message in snapshot.messages"
          :key="message.id"
          class="agent-message"
          :data-role="message.role"
        >
          <strong>{{ localizedState(message.role) }}</strong>
          <span>{{ message.content }}</span>
        </article>
        <p v-if="snapshot.messages.length === 0" class="empty-state">
          {{ ui.noMessages }}
        </p>
      </div>

      <section v-bind="{ slot: 'tools' }" class="agent-panel">
        <h3>{{ ui.toolCalls }}</h3>
        <div
          v-for="tool in snapshot.toolCalls"
          :key="tool.id"
          class="agent-tool"
        >
          <code>{{ tool.name }}</code>
          <span>{{ localizedState(tool.status) }}</span>
        </div>
        <p v-if="snapshot.toolCalls.length === 0" class="empty-state">
          {{ ui.noToolCalls }}
        </p>
      </section>

      <section v-bind="{ slot: 'artifacts' }" class="agent-panel">
        <h3>{{ ui.artifacts }}</h3>
        <button
          v-for="artifact in snapshot.artifacts"
          :key="artifact.id"
          type="button"
          class="artifact-button"
          :class="{ active: artifact.id === snapshot.selectedArtifactId }"
          @click="selectArtifact(artifact.id)"
        >
          {{ artifact.title }}
        </button>
        <p v-if="snapshot.artifacts.length === 0" class="empty-state">
          {{ ui.noArtifacts }}
        </p>
      </section>

      <section v-bind="{ slot: 'diagnostics' }" class="agent-panel">
        <h3>{{ ui.diagnostics }}</h3>
        <p
          v-for="diagnostic in snapshot.diagnostics"
          :key="diagnostic.id"
          class="diagnostic"
          :data-level="diagnostic.level"
        >
          <span aria-hidden="true" />
          {{ diagnostic.message }}
        </p>
        <p v-if="snapshot.diagnostics.length === 0" class="empty-state">
          {{ ui.noDiagnostics }}
        </p>
      </section>
    </zw-agent-console>

    <section class="artifact-preview" aria-live="polite">
      <template v-if="selectedArtifact">
        <strong>{{ selectedArtifact.title }}</strong>
        <pre><code>{{ artifactContent(selectedArtifact) }}</code></pre>
      </template>
      <p v-else>{{ ui.noArtifactSelected }}</p>
    </section>
  </div>
</template>

<style scoped>
.advanced-demo {
  display: grid;
  gap: 0.875rem;
}

.demo-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.demo-toolbar > span {
  flex: 1;
  min-width: 14rem;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
  text-align: right;
}

button {
  padding: 0.4rem 0.7rem;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.45rem;
  cursor: pointer;
}

button:disabled {
  cursor: wait;
  opacity: 0.5;
}

zw-agent-console {
  display: block;
}

:deep(zw-agent-console [data-slot='agent-console-layout']) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(12rem, 0.45fr);
  gap: 0.65rem;
  padding: 0.75rem;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.75rem;
}

:deep(zw-agent-console [data-slot='agent-console-timeline']) {
  grid-row: span 3;
  min-height: 19rem;
  max-height: 24rem;
  padding: 0.65rem;
  overflow-y: auto;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.55rem;
}

:deep(zw-agent-console [data-slot='agent-console-tools']),
:deep(zw-agent-console [data-slot='agent-console-artifacts']),
:deep(zw-agent-console [data-slot='agent-console-diagnostics']) {
  min-width: 0;
  padding: 0.65rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.55rem;
}

.agent-timeline {
  display: grid;
  gap: 0.6rem;
}

.agent-message {
  display: grid;
  gap: 0.2rem;
  padding: 0.6rem 0.7rem;
  background: var(--vp-c-bg);
  border-radius: 0.5rem;
  font-size: 0.85rem;
}

.agent-message strong {
  color: var(--vp-c-text-2);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.agent-message[data-role='assistant'] {
  border-left: 3px solid var(--vp-c-brand-1);
}

.agent-message[data-role='system'] {
  border-left: 3px solid var(--vp-c-warning-1);
}

.agent-panel {
  min-width: 0;
}

.agent-panel h3 {
  margin: 0 0 0.5rem;
  color: var(--vp-c-text-2);
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.agent-tool {
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  padding: 0.35rem 0;
  font-size: 0.75rem;
}

.agent-tool code {
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-tool span {
  color: var(--vp-c-text-2);
}

.artifact-button {
  display: block;
  width: 100%;
  margin-top: 0.35rem;
  overflow: hidden;
  font-size: 0.75rem;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artifact-button.active {
  color: white;
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.diagnostic {
  display: grid;
  grid-template-columns: 0.5rem minmax(0, 1fr);
  gap: 0.4rem;
  align-items: start;
  margin: 0.4rem 0 0;
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
}

.diagnostic span {
  width: 0.45rem;
  height: 0.45rem;
  margin-top: 0.28rem;
  background: var(--vp-c-brand-1);
  border-radius: 50%;
}

.diagnostic[data-level='warning'] span {
  background: var(--vp-c-warning-1);
}

.diagnostic[data-level='error'] span {
  background: var(--vp-c-danger-1);
}

.empty-state {
  margin: 0;
  color: var(--vp-c-text-3);
  font-size: 0.75rem;
}

.artifact-preview {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.65rem;
}

.artifact-preview p,
.artifact-preview pre {
  margin: 0;
}

.artifact-preview pre {
  padding: 0.65rem;
  overflow-x: auto;
  background: var(--vp-code-block-bg);
  border-radius: 0.45rem;
  font-size: 0.78rem;
}

@media (max-width: 760px) {
  .demo-toolbar > span {
    flex-basis: 100%;
    text-align: left;
  }

  :deep(zw-agent-console [data-slot='agent-console-layout']) {
    grid-template-columns: 1fr;
  }

  :deep(zw-agent-console [data-slot='agent-console-timeline']) {
    grid-row: auto;
  }
}
</style>
