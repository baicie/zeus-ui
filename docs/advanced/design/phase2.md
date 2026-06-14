下面给出 **Phase 2：`@zeus-web/chat` Headless Chat 组件族** 的详细设计与完整代码，包含完整单元测试。

Phase 2 的定位是：**只做 headless 能力层，不做 registry styled source，不做 `@zeus-web/ui/chat` 样式入口，不接任何模型服务**。这样可以先把高级组件最关键的跨框架协议、事件、方法、slots、core 状态模型打稳。

当前仓库已经有 `@zeus-web/virtual` 的 advanced 包结构，`package.json` 已采用 `./wc`、`./wc/auto`、`./react`、`./vue`、`./vue/global`、`custom-elements.json`、`zeus.components.json` 这套输出模型。 现有组件写法使用 `defineElement / Host / prop / Slot / event / ctx.expose`。 单测风格也主要通过 `@zeus-js/component-analyzer` 分析源码协议。

---

# Phase 2 目标

```txt
packages/advanced/chat
  @zeus-web/chat
```

本阶段实现：

```txt
1. Chat 消息模型
2. Chat store
3. Composer 状态
4. Stream buffer
5. Chat 组件族
6. send / abort / regenerate / message-action / artifact-open 等事件
7. focus / clear / appendMessage / updateMessage / appendMessagePart / scrollToBottom 等方法
8. 完整 core 单元测试
9. 完整组件协议测试
```

本阶段不做：

```txt
1. 不接 OpenAI / DeepSeek / Anthropic 等 provider
2. 不做 registry react/vue styled source
3. 不做 @zeus-web/ui/chat
4. 不做 markdown 渲染器
5. 不做代码高亮
6. 不做附件上传 transport
7. 不做 virtual thread 集成
```

---

# 目录结构

```txt
packages/advanced/chat/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    core/
      index.ts
      message-model.ts
      chat-store.ts
      composer-state.ts
      stream-buffer.ts
    components/
      chat.tsx
      chat-thread.tsx
      chat-message.tsx
      chat-composer.tsx
      chat-code-block.tsx
      chat-tool-call.tsx
      chat-artifact.tsx
      chat-typing.tsx
  __tests__/
    message-model.spec.ts
    chat-store.spec.ts
    composer-state.spec.ts
    stream-buffer.spec.ts
    chat-components.spec.ts
```

---

# 1. `packages/advanced/chat/package.json`

```json
{
  "name": "@zeus-web/chat",
  "type": "module",
  "version": "0.0.0",
  "description": "Headless ChatGPT-style chat advanced components for Zeus Web.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/baicie/zeus-ui.git",
    "directory": "packages/advanced/chat"
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
    "test": "vitest --root ../../.. --project unit packages/advanced/chat/__tests__/message-model.spec.ts packages/advanced/chat/__tests__/chat-store.spec.ts packages/advanced/chat/__tests__/composer-state.spec.ts packages/advanced/chat/__tests__/stream-buffer.spec.ts packages/advanced/chat/__tests__/chat-components.spec.ts"
  },
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.5 <0.2.0",
    "react": ">=18 || >=19",
    "vue": ">=3"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    },
    "vue": {
      "optional": true
    }
  },
  "dependencies": {
    "@zeus-js/runtime-dom": "0.1.0-beta.5",
    "@zeus-js/web-c-runtime": "0.2.0",
    "@zeus-web/zeus-compat": "workspace:*"
  }
}
```

---

# 2. `packages/advanced/chat/tsconfig.json`

```json
{
  "extends": "../../../scripts/config/tsconfig.zeus-jsx.json",
  "compilerOptions": {
    "composite": false,
    "rootDir": "../../",
    "outDir": "dist",
    "isolatedDeclarations": false
  },
  "include": ["src"]
}
```

---

# 3. `packages/advanced/chat/src/types.ts`

```ts
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export type ChatMessageStatus =
  | 'idle'
  | 'streaming'
  | 'complete'
  | 'error'
  | 'aborted'

export type ChatToolCallStatus = 'pending' | 'running' | 'success' | 'error'

export type ChatArtifactKind = 'text' | 'code' | 'table' | 'chart' | 'custom'

export interface ChatMessagePartText {
  type: 'text'
  text: string
}

export interface ChatMessagePartCode {
  type: 'code'
  code: string
  language?: string
  filename?: string
}

export interface ChatMessagePartToolCall {
  type: 'tool-call'
  id: string
  name: string
  status: ChatToolCallStatus
  input?: unknown
  output?: unknown
  error?: string
}

export interface ChatMessagePartArtifact {
  type: 'artifact'
  id: string
  kind: ChatArtifactKind
  title?: string
  data?: unknown
}

export type ChatMessagePart =
  | ChatMessagePartText
  | ChatMessagePartCode
  | ChatMessagePartToolCall
  | ChatMessagePartArtifact

export interface ChatMessageData {
  id: string
  role: ChatRole
  status?: ChatMessageStatus
  content?: string
  parts?: ChatMessagePart[]
  createdAt?: number
  metadata?: Record<string, unknown>
}

export interface NormalizedChatMessageData {
  id: string
  role: ChatRole
  status: ChatMessageStatus
  parts: ChatMessagePart[]
  createdAt: number
  metadata?: Record<string, unknown>
}

export interface ChatAttachmentData {
  id: string
  name: string
  type?: string
  size?: number
  url?: string
  metadata?: Record<string, unknown>
}

export interface ChatSendDetail {
  value: string
  attachments: ChatAttachmentData[]
  nativeEvent: Event | KeyboardEvent
}

export interface ChatAbortDetail {
  messageId?: string
  reason?: string
}

export interface ChatRegenerateDetail {
  messageId: string
}

export type ChatMessageAction = 'copy' | 'like' | 'dislike' | 'retry' | 'delete'

export interface ChatMessageActionDetail {
  messageId: string
  action: ChatMessageAction
  nativeEvent?: Event
}

export interface ChatArtifactOpenDetail {
  artifactId: string
  messageId?: string
  nativeEvent?: Event
}

export interface ChatValueChangeDetail {
  value: string
  nativeEvent: Event
}

export interface ChatAttachmentChangeDetail {
  attachments: ChatAttachmentData[]
  nativeEvent?: Event
}

export interface ChatProps {
  messages?: ChatMessageData[]
  loading?: boolean
  disabled?: boolean
  autoScroll?: boolean
  virtual?: boolean
  emptyText?: string
}

export interface ChatElement extends HTMLElement {
  messages?: ChatMessageData[]
  appendMessage: (message: ChatMessageData) => void
  updateMessage: (id: string, patch: Partial<ChatMessageData>) => void
  appendMessagePart: (id: string, part: ChatMessagePart) => void
  clear: () => void
  getMessages: () => NormalizedChatMessageData[]
  scrollToBottom: (options?: ScrollIntoViewOptions) => void
}

export interface ChatThreadProps {
  count?: number
  loading?: boolean
  empty?: boolean
  virtual?: boolean
  ariaLabel?: string
}

export interface ChatThreadElement extends HTMLElement {
  scrollToBottom: (options?: ScrollIntoViewOptions) => void
}

export interface ChatMessageProps {
  messageId?: string
  role?: ChatRole
  status?: ChatMessageStatus
  selected?: boolean
  interactive?: boolean
}

export interface ChatMessageElement extends HTMLElement {}

export interface ChatComposerProps {
  value?: string
  defaultValue?: string
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  submitOnEnter?: boolean
  rows?: number
  maxLength?: number
  ariaLabel?: string
}

export interface ChatComposerElement extends HTMLElement {
  value?: string
  focus: () => void
  clear: () => void
  submit: () => void
}

export interface ChatCodeBlockProps {
  language?: string
  filename?: string
  copied?: boolean
}

export interface ChatCodeBlockElement extends HTMLElement {}

export interface ChatToolCallProps {
  toolId?: string
  name?: string
  status?: ChatToolCallStatus
  open?: boolean
}

export interface ChatToolCallElement extends HTMLElement {}

export interface ChatArtifactProps {
  artifactId?: string
  kind?: ChatArtifactKind
  title?: string
  open?: boolean
}

export interface ChatArtifactElement extends HTMLElement {}

export interface ChatTypingProps {
  text?: string
  active?: boolean
}

export interface ChatTypingElement extends HTMLElement {}
```

---

# 4. `packages/advanced/chat/src/core/message-model.ts`

```ts
import type {
  ChatMessageData,
  ChatMessagePart,
  ChatMessagePartText,
  ChatMessageStatus,
  NormalizedChatMessageData,
} from '../types'

function createTextPart(text: string): ChatMessagePartText {
  return {
    type: 'text',
    text,
  }
}

function normalizeParts(message: ChatMessageData): ChatMessagePart[] {
  if (message.parts && message.parts.length > 0) {
    return message.parts.map(part => ({ ...part }))
  }

  if (message.content !== undefined) {
    return [createTextPart(message.content)]
  }

  return []
}

function normalizeStatus(
  status: ChatMessageStatus | undefined,
): ChatMessageStatus {
  return status ?? 'idle'
}

export function normalizeChatMessage(
  message: ChatMessageData,
): NormalizedChatMessageData {
  return {
    id: message.id,
    role: message.role,
    status: normalizeStatus(message.status),
    parts: normalizeParts(message),
    createdAt: message.createdAt ?? Date.now(),
    metadata: message.metadata ? { ...message.metadata } : undefined,
  }
}

export function normalizeChatMessages(
  messages: ChatMessageData[] | undefined,
): NormalizedChatMessageData[] {
  return (messages ?? []).map(message => normalizeChatMessage(message))
}

export function getMessageText(message: NormalizedChatMessageData): string {
  return message.parts
    .filter((part): part is ChatMessagePartText => part.type === 'text')
    .map(part => part.text)
    .join('')
}

export function appendMessagePart(
  message: NormalizedChatMessageData,
  part: ChatMessagePart,
): NormalizedChatMessageData {
  return {
    ...message,
    parts: [...message.parts, { ...part }],
  }
}

export function patchMessage(
  message: NormalizedChatMessageData,
  patch: Partial<ChatMessageData>,
): NormalizedChatMessageData {
  const next: ChatMessageData = {
    ...message,
    ...patch,
    parts: patch.parts ?? message.parts,
  }

  if (patch.content !== undefined && patch.parts === undefined) {
    next.parts = [{ type: 'text', text: patch.content }]
  }

  return normalizeChatMessage(next)
}

export function hasMessageId(
  messages: NormalizedChatMessageData[],
  id: string,
): boolean {
  return messages.some(message => message.id === id)
}
```

---

# 5. `packages/advanced/chat/src/core/chat-store.ts`

```ts
import type {
  ChatMessageData,
  ChatMessagePart,
  NormalizedChatMessageData,
} from '../types'

import {
  appendMessagePart as appendPartToMessage,
  hasMessageId,
  normalizeChatMessage,
  normalizeChatMessages,
  patchMessage,
} from './message-model'

export interface ChatStoreSnapshot {
  messages: NormalizedChatMessageData[]
}

export interface ChatStore {
  getSnapshot: () => ChatStoreSnapshot
  getMessages: () => NormalizedChatMessageData[]
  setMessages: (messages: ChatMessageData[]) => NormalizedChatMessageData[]
  appendMessage: (message: ChatMessageData) => NormalizedChatMessageData[]
  updateMessage: (
    id: string,
    patch: Partial<ChatMessageData>,
  ) => NormalizedChatMessageData[]
  appendMessagePart: (
    id: string,
    part: ChatMessagePart,
  ) => NormalizedChatMessageData[]
  clear: () => void
}

export function createChatStore(
  initialMessages: ChatMessageData[] = [],
): ChatStore {
  let messages = normalizeChatMessages(initialMessages)

  const cloneMessages = () =>
    messages.map(message => ({
      ...message,
      parts: message.parts.map(part => ({ ...part })),
      metadata: message.metadata ? { ...message.metadata } : undefined,
    }))

  return {
    getSnapshot(): ChatStoreSnapshot {
      return {
        messages: cloneMessages(),
      }
    },

    getMessages(): NormalizedChatMessageData[] {
      return cloneMessages()
    },

    setMessages(nextMessages: ChatMessageData[]): NormalizedChatMessageData[] {
      messages = normalizeChatMessages(nextMessages)
      return cloneMessages()
    },

    appendMessage(message: ChatMessageData): NormalizedChatMessageData[] {
      if (hasMessageId(messages, message.id)) {
        messages = messages.map(item =>
          item.id === message.id ? normalizeChatMessage(message) : item,
        )
      } else {
        messages = [...messages, normalizeChatMessage(message)]
      }

      return cloneMessages()
    },

    updateMessage(
      id: string,
      patch: Partial<ChatMessageData>,
    ): NormalizedChatMessageData[] {
      messages = messages.map(message =>
        message.id === id ? patchMessage(message, patch) : message,
      )

      return cloneMessages()
    },

    appendMessagePart(
      id: string,
      part: ChatMessagePart,
    ): NormalizedChatMessageData[] {
      messages = messages.map(message =>
        message.id === id ? appendPartToMessage(message, part) : message,
      )

      return cloneMessages()
    },

    clear(): void {
      messages = []
    },
  }
}
```

---

# 6. `packages/advanced/chat/src/core/composer-state.ts`

```ts
import type { ChatAttachmentData } from '../types'

export interface ComposerStateSnapshot {
  value: string
  attachments: ChatAttachmentData[]
}

export interface ComposerState {
  getValue: () => string
  setValue: (value: string) => string
  clearValue: () => void
  getAttachments: () => ChatAttachmentData[]
  setAttachments: (attachments: ChatAttachmentData[]) => ChatAttachmentData[]
  addAttachment: (attachment: ChatAttachmentData) => ChatAttachmentData[]
  removeAttachment: (id: string) => ChatAttachmentData[]
  clearAttachments: () => void
  getSnapshot: () => ComposerStateSnapshot
}

function normalizeValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function cloneAttachment(attachment: ChatAttachmentData): ChatAttachmentData {
  return {
    ...attachment,
    metadata: attachment.metadata ? { ...attachment.metadata } : undefined,
  }
}

function cloneAttachments(
  attachments: ChatAttachmentData[],
): ChatAttachmentData[] {
  return attachments.map(attachment => cloneAttachment(attachment))
}

export function createComposerState(
  initialValue = '',
  initialAttachments: ChatAttachmentData[] = [],
): ComposerState {
  let value = normalizeValue(initialValue)
  let attachments = cloneAttachments(initialAttachments)

  return {
    getValue(): string {
      return value
    },

    setValue(nextValue: string): string {
      value = normalizeValue(nextValue)
      return value
    },

    clearValue(): void {
      value = ''
    },

    getAttachments(): ChatAttachmentData[] {
      return cloneAttachments(attachments)
    },

    setAttachments(
      nextAttachments: ChatAttachmentData[],
    ): ChatAttachmentData[] {
      attachments = cloneAttachments(nextAttachments)
      return cloneAttachments(attachments)
    },

    addAttachment(attachment: ChatAttachmentData): ChatAttachmentData[] {
      attachments = [
        ...attachments.filter(item => item.id !== attachment.id),
        cloneAttachment(attachment),
      ]

      return cloneAttachments(attachments)
    },

    removeAttachment(id: string): ChatAttachmentData[] {
      attachments = attachments.filter(attachment => attachment.id !== id)
      return cloneAttachments(attachments)
    },

    clearAttachments(): void {
      attachments = []
    },

    getSnapshot(): ComposerStateSnapshot {
      return {
        value,
        attachments: cloneAttachments(attachments),
      }
    },
  }
}

export function shouldSubmitFromKeyboardEvent(
  event: KeyboardEvent,
  submitOnEnter: boolean,
): boolean {
  if (!submitOnEnter) return false
  if (event.defaultPrevented) return false
  if (event.key !== 'Enter') return false
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
    return false
  if (event.isComposing || event.keyCode === 229) return false

  return true
}
```

---

# 7. `packages/advanced/chat/src/core/stream-buffer.ts`

```ts
export interface StreamBufferOptions {
  onFlush: (value: string) => void
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (handle: number) => void
}

export interface StreamBuffer {
  push: (chunk: string) => void
  flush: () => void
  cancel: () => void
  getPendingValue: () => string
  isScheduled: () => boolean
}

function defaultRequestFrame(callback: FrameRequestCallback): number {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback)
  }

  return setTimeout(() => callback(Date.now()), 16) as unknown as number
}

function defaultCancelFrame(handle: number): void {
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(handle)
    return
  }

  clearTimeout(handle)
}

export function createStreamBuffer(options: StreamBufferOptions): StreamBuffer {
  const requestFrame = options.requestFrame ?? defaultRequestFrame
  const cancelFrame = options.cancelFrame ?? defaultCancelFrame

  let buffer = ''
  let frameHandle: number | undefined

  const run = () => {
    frameHandle = undefined

    if (!buffer) return

    const value = buffer
    buffer = ''

    options.onFlush(value)
  }

  return {
    push(chunk: string): void {
      if (!chunk) return

      buffer += chunk

      if (frameHandle !== undefined) return

      frameHandle = requestFrame(run)
    },

    flush(): void {
      if (frameHandle !== undefined) {
        cancelFrame(frameHandle)
        frameHandle = undefined
      }

      run()
    },

    cancel(): void {
      if (frameHandle !== undefined) {
        cancelFrame(frameHandle)
      }

      frameHandle = undefined
      buffer = ''
    },

    getPendingValue(): string {
      return buffer
    },

    isScheduled(): boolean {
      return frameHandle !== undefined
    },
  }
}
```

---

# 8. `packages/advanced/chat/src/core/index.ts`

```ts
export * from './chat-store'
export * from './composer-state'
export * from './message-model'
export * from './stream-buffer'
```

---

# 9. `packages/advanced/chat/src/components/chat.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

import type {
  ChatAbortDetail,
  ChatArtifactOpenDetail,
  ChatElement,
  ChatMessageActionDetail,
  ChatMessageData,
  ChatMessagePart,
  ChatProps,
  ChatRegenerateDetail,
  ChatSendDetail,
  NormalizedChatMessageData,
} from '../types'
import { createChatStore } from '../core'

interface ChatEmits extends Record<string, EventDefinition<unknown>> {
  send: EventDefinition<ChatSendDetail>
  abort: EventDefinition<ChatAbortDetail>
  regenerate: EventDefinition<ChatRegenerateDetail>
  messageAction: EventDefinition<ChatMessageActionDetail>
  artifactOpen: EventDefinition<ChatArtifactOpenDetail>
}

function setup(
  props: ChatProps,
  ctx: DefineElementContext<ChatElement, ChatEmits>,
) {
  let root: HTMLElement | undefined
  const store = createChatStore(props.messages ?? [])

  const scrollToBottom = (options?: ScrollIntoViewOptions) => {
    root?.scrollTo({
      top: root.scrollHeight,
      behavior: options?.behavior,
    })
  }

  const syncHostMessages = (messages: NormalizedChatMessageData[]) => {
    ctx.host.messages = messages
  }

  ctx.expose({
    appendMessage(message: ChatMessageData): void {
      const messages = store.appendMessage(message)
      syncHostMessages(messages)

      if (props.autoScroll !== false) {
        queueMicrotask(() => scrollToBottom({ behavior: 'smooth' }))
      }
    },

    updateMessage(id: string, patch: Partial<ChatMessageData>): void {
      const messages = store.updateMessage(id, patch)
      syncHostMessages(messages)

      if (props.autoScroll !== false) {
        queueMicrotask(() => scrollToBottom({ behavior: 'smooth' }))
      }
    },

    appendMessagePart(id: string, part: ChatMessagePart): void {
      const messages = store.appendMessagePart(id, part)
      syncHostMessages(messages)

      if (props.autoScroll !== false) {
        queueMicrotask(() => scrollToBottom({ behavior: 'smooth' }))
      }
    },

    clear(): void {
      store.clear()
      ctx.host.messages = []
    },

    getMessages(): NormalizedChatMessageData[] {
      return store.getMessages()
    },

    scrollToBottom,
  })

  return (
    <Host
      part="root"
      data-slot="chat-root"
      data-loading={() => (props.loading ? '' : undefined)}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-virtual={() => (props.virtual ? '' : undefined)}
      data-empty={() => (store.getMessages().length === 0 ? '' : undefined)}
    >
      <section
        ref={(element: HTMLElement | null) => {
          if (element) root = element
        }}
        part="container"
        data-slot="chat"
      >
        <header part="header" data-slot="chat-header">
          <Slot name="header" />
        </header>

        <aside part="sidebar" data-slot="chat-sidebar">
          <Slot name="sidebar" />
        </aside>

        <main part="thread" data-slot="chat-thread">
          <Slot name="thread" />

          <div part="empty" data-slot="chat-empty">
            <Slot name="empty">{props.emptyText ?? ''}</Slot>
          </div>

          <div part="loading" data-slot="chat-loading">
            <Slot name="loading" />
          </div>
        </main>

        <section part="artifact" data-slot="chat-artifact">
          <Slot name="artifact" />
        </section>

        <footer part="composer" data-slot="chat-composer">
          <Slot name="composer" />
        </footer>
      </section>
    </Host>
  )
}

export const Chat = defineElement<ChatProps, ChatElement, ChatEmits>(
  'zw-chat',
  {
    shadow: false,
    props: {
      messages: Array,
      loading: prop(Boolean, {
        reflect: true,
      }),
      disabled: prop(Boolean, {
        reflect: true,
      }),
      autoScroll: prop(Boolean, {
        attr: 'auto-scroll',
        default: true,
      }),
      virtual: prop(Boolean, {
        reflect: true,
      }),
      emptyText: prop(String, {
        attr: 'empty-text',
      }),
    },
    emits: {
      send: event<ChatSendDetail>(),
      abort: event<ChatAbortDetail>(),
      regenerate: event<ChatRegenerateDetail>(),
      messageAction: event<ChatMessageActionDetail>(),
      artifactOpen: event<ChatArtifactOpenDetail>(),
    },
    meta: {
      description: 'Headless ChatGPT-style chat root advanced component.',
    },
  },
  setup,
)
```

---

# 10. `packages/advanced/chat/src/components/chat-thread.tsx`

```tsx
import type { DefineElementContext } from '@zeus-js/zeus'
import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

import type { ChatThreadElement, ChatThreadProps } from '../types'

function setup(
  props: ChatThreadProps,
  ctx: DefineElementContext<ChatThreadElement>,
) {
  let viewport: HTMLElement | undefined

  ctx.expose({
    scrollToBottom(options?: ScrollIntoViewOptions): void {
      viewport?.scrollTo({
        top: viewport.scrollHeight,
        behavior: options?.behavior,
      })
    },
  })

  return (
    <Host
      part="root"
      data-slot="chat-thread-root"
      data-loading={() => (props.loading ? '' : undefined)}
      data-empty={() => (props.empty ? '' : undefined)}
      data-virtual={() => (props.virtual ? '' : undefined)}
      data-count={() => String(props.count ?? 0)}
    >
      <div
        ref={(element: HTMLElement | null) => {
          if (element) viewport = element
        }}
        part="viewport"
        data-slot="chat-thread"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={() => (props.loading ? 'true' : undefined)}
        aria-label={() => props.ariaLabel}
      >
        <Slot />
      </div>
    </Host>
  )
}

export const ChatThread = defineElement<ChatThreadProps, ChatThreadElement>(
  'zw-chat-thread',
  {
    shadow: false,
    props: {
      count: prop(Number, {
        default: 0,
      }),
      loading: prop(Boolean, {
        reflect: true,
      }),
      empty: prop(Boolean, {
        reflect: true,
      }),
      virtual: prop(Boolean, {
        reflect: true,
      }),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
    },
    meta: {
      description: 'Headless chat message thread advanced component.',
    },
  },
  setup,
)
```

---

# 11. `packages/advanced/chat/src/components/chat-message.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

import type {
  ChatMessageActionDetail,
  ChatMessageElement,
  ChatMessageProps,
} from '../types'

interface ChatMessageEmits extends Record<string, EventDefinition<unknown>> {
  messageAction: EventDefinition<ChatMessageActionDetail>
}

function setup(
  props: ChatMessageProps,
  _ctx: DefineElementContext<ChatMessageElement, ChatMessageEmits>,
) {
  return (
    <Host
      part="root"
      data-slot="chat-message-root"
      data-message-id={() => props.messageId}
      data-role={() => props.role}
      data-status={() => props.status}
      data-selected={() => (props.selected ? '' : undefined)}
      data-interactive={() => (props.interactive ? '' : undefined)}
    >
      <article part="message" data-slot="chat-message">
        <div part="avatar" data-slot="chat-message-avatar">
          <Slot name="avatar" />
        </div>

        <div part="body" data-slot="chat-message-body">
          <header part="header" data-slot="chat-message-header">
            <Slot name="header" />
          </header>

          <div part="content" data-slot="chat-message-content">
            <Slot />
          </div>

          <footer part="footer" data-slot="chat-message-footer">
            <Slot name="footer" />
          </footer>

          <div part="actions" data-slot="chat-message-actions">
            <Slot name="actions" />
          </div>
        </div>
      </article>
    </Host>
  )
}

export const ChatMessage = defineElement<
  ChatMessageProps,
  ChatMessageElement,
  ChatMessageEmits
>(
  'zw-chat-message',
  {
    shadow: false,
    props: {
      messageId: prop(String, {
        attr: 'message-id',
      }),
      role: prop(['system', 'user', 'assistant', 'tool'], {
        default: 'assistant',
        reflect: true,
      }),
      status: prop(['idle', 'streaming', 'complete', 'error', 'aborted'], {
        default: 'idle',
        reflect: true,
      }),
      selected: prop(Boolean, {
        reflect: true,
      }),
      interactive: prop(Boolean, {
        reflect: true,
      }),
    },
    emits: {
      messageAction: event<ChatMessageActionDetail>(),
    },
    meta: {
      description: 'Headless chat message advanced component.',
    },
  },
  setup,
)
```

---

# 12. `packages/advanced/chat/src/components/chat-composer.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

import type {
  ChatAttachmentChangeDetail,
  ChatComposerElement,
  ChatComposerProps,
  ChatSendDetail,
  ChatValueChangeDetail,
} from '../types'
import { createComposerState, shouldSubmitFromKeyboardEvent } from '../core'

interface ChatComposerEmits extends Record<string, EventDefinition<unknown>> {
  send: EventDefinition<ChatSendDetail>
  valueChange: EventDefinition<ChatValueChangeDetail>
  attachmentChange: EventDefinition<ChatAttachmentChangeDetail>
}

function resolveInitialValue(props: ChatComposerProps): string {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return ''
}

function normalizeRows(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) return 3
  return Math.max(1, Math.floor(value))
}

function setup(
  props: ChatComposerProps,
  ctx: DefineElementContext<ChatComposerElement, ChatComposerEmits>,
) {
  let control: HTMLTextAreaElement | undefined
  const composer = createComposerState(resolveInitialValue(props))

  const setControlValue = (value: string) => {
    if (control) control.value = value
    ctx.host.value = value
    composer.setValue(value)
  }

  const emitValueChange = (nativeEvent: Event) => {
    const value = control?.value ?? ''
    composer.setValue(value)
    ctx.host.value = value
    ctx.emit.valueChange({ value, nativeEvent })
  }

  const submit = (nativeEvent: Event | KeyboardEvent) => {
    const value = (control?.value ?? composer.getValue()).trim()

    if (!value || props.disabled || props.loading) return

    ctx.emit.send({
      value,
      attachments: composer.getAttachments(),
      nativeEvent,
    })

    setControlValue('')
    composer.clearAttachments()

    ctx.emit.attachmentChange({
      attachments: [],
      nativeEvent,
    })
  }

  ctx.expose({
    focus(): void {
      control?.focus()
    },

    clear(): void {
      setControlValue('')
      composer.clearAttachments()
      ctx.emit.attachmentChange({
        attachments: [],
      })
    },

    submit(): void {
      const event = new Event('submit')
      submit(event)
    },
  })

  return (
    <Host
      part="root"
      data-slot="chat-composer-root"
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-loading={() => (props.loading ? '' : undefined)}
    >
      <form
        part="form"
        data-slot="chat-composer"
        onSubmit={(nativeEvent: Event) => {
          nativeEvent.preventDefault()
          submit(nativeEvent)
        }}
      >
        <div part="prefix" data-slot="chat-composer-prefix">
          <Slot name="prefix" />
        </div>

        <div part="attachments" data-slot="chat-composer-attachments">
          <Slot name="attachments" />
        </div>

        <textarea
          ref={(element: HTMLTextAreaElement | null) => {
            if (element) {
              control = element
              control.value = resolveInitialValue(props)
            }
          }}
          part="control"
          data-slot="chat-composer-control"
          prop:value={() => props.value ?? composer.getValue()}
          placeholder={() => props.placeholder}
          disabled={() => Boolean(props.disabled)}
          rows={() => normalizeRows(props.rows)}
          maxLength={() => props.maxLength}
          aria-label={() => props.ariaLabel}
          onInput={emitValueChange}
          onKeyDown={(nativeEvent: KeyboardEvent) => {
            if (
              shouldSubmitFromKeyboardEvent(
                nativeEvent,
                props.submitOnEnter !== false,
              )
            ) {
              nativeEvent.preventDefault()
              submit(nativeEvent)
            }
          }}
        />

        <button
          part="submit"
          data-slot="chat-composer-submit"
          type="submit"
          disabled={() => Boolean(props.disabled || props.loading)}
        >
          <Slot name="submit">Send</Slot>
        </button>

        <div part="suffix" data-slot="chat-composer-suffix">
          <Slot name="suffix" />
        </div>
      </form>
    </Host>
  )
}

export const ChatComposer = defineElement<
  ChatComposerProps,
  ChatComposerElement,
  ChatComposerEmits
>(
  'zw-chat-composer',
  {
    shadow: false,
    props: {
      value: {
        type: String,
        reflect: true,
      },
      defaultValue: {
        type: String,
        attr: 'default-value',
      },
      placeholder: String,
      disabled: prop(Boolean, {
        reflect: true,
      }),
      loading: prop(Boolean, {
        reflect: true,
      }),
      submitOnEnter: prop(Boolean, {
        attr: 'submit-on-enter',
        default: true,
      }),
      rows: prop(Number, {
        default: 3,
      }),
      maxLength: prop(Number, {
        attr: 'max-length',
      }),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
    },
    emits: {
      send: event<ChatSendDetail>(),
      valueChange: event<ChatValueChangeDetail>(),
      attachmentChange: event<ChatAttachmentChangeDetail>(),
    },
    meta: {
      description: 'Headless chat composer advanced component.',
    },
  },
  setup,
)
```

---

# 13. `packages/advanced/chat/src/components/chat-code-block.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

import type {
  ChatCodeBlockElement,
  ChatCodeBlockProps,
  ChatMessageActionDetail,
} from '../types'

interface ChatCodeBlockEmits extends Record<string, EventDefinition<unknown>> {
  codeAction: EventDefinition<ChatMessageActionDetail>
}

function setup(
  props: ChatCodeBlockProps,
  _ctx: DefineElementContext<ChatCodeBlockElement, ChatCodeBlockEmits>,
) {
  return (
    <Host
      part="root"
      data-slot="chat-code-block-root"
      data-language={() => props.language}
      data-filename={() => props.filename}
      data-copied={() => (props.copied ? '' : undefined)}
    >
      <figure part="figure" data-slot="chat-code-block">
        <figcaption part="header" data-slot="chat-code-block-header">
          <span part="filename" data-slot="chat-code-block-filename">
            <Slot name="filename">{props.filename ?? ''}</Slot>
          </span>

          <span part="language" data-slot="chat-code-block-language">
            <Slot name="language">{props.language ?? ''}</Slot>
          </span>

          <div part="actions" data-slot="chat-code-block-actions">
            <Slot name="actions" />
          </div>
        </figcaption>

        <pre part="pre" data-slot="chat-code-block-pre">
          <code part="code" data-slot="chat-code-block-code">
            <Slot />
          </code>
        </pre>
      </figure>
    </Host>
  )
}

export const ChatCodeBlock = defineElement<
  ChatCodeBlockProps,
  ChatCodeBlockElement,
  ChatCodeBlockEmits
>(
  'zw-chat-code-block',
  {
    shadow: false,
    props: {
      language: prop(String, {
        reflect: true,
      }),
      filename: String,
      copied: prop(Boolean, {
        reflect: true,
      }),
    },
    emits: {
      codeAction: event<ChatMessageActionDetail>(),
    },
    meta: {
      description: 'Headless chat code block advanced component.',
    },
  },
  setup,
)
```

---

# 14. `packages/advanced/chat/src/components/chat-tool-call.tsx`

```tsx
import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

import type { ChatToolCallElement, ChatToolCallProps } from '../types'

function setup(props: ChatToolCallProps) {
  return (
    <Host
      part="root"
      data-slot="chat-tool-call-root"
      data-tool-id={() => props.toolId}
      data-name={() => props.name}
      data-status={() => props.status}
      data-open={() => (props.open ? '' : undefined)}
    >
      <details
        part="details"
        data-slot="chat-tool-call"
        open={() => Boolean(props.open)}
      >
        <summary part="summary" data-slot="chat-tool-call-summary">
          <Slot name="summary">{props.name ?? ''}</Slot>
        </summary>

        <div part="input" data-slot="chat-tool-call-input">
          <Slot name="input" />
        </div>

        <div part="output" data-slot="chat-tool-call-output">
          <Slot name="output" />
        </div>

        <div part="error" data-slot="chat-tool-call-error">
          <Slot name="error" />
        </div>

        <div part="actions" data-slot="chat-tool-call-actions">
          <Slot name="actions" />
        </div>
      </details>
    </Host>
  )
}

export const ChatToolCall = defineElement<
  ChatToolCallProps,
  ChatToolCallElement
>(
  'zw-chat-tool-call',
  {
    shadow: false,
    props: {
      toolId: prop(String, {
        attr: 'tool-id',
      }),
      name: String,
      status: prop(['pending', 'running', 'success', 'error'], {
        default: 'pending',
        reflect: true,
      }),
      open: prop(Boolean, {
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless chat tool call advanced component.',
    },
  },
  setup,
)
```

---

# 15. `packages/advanced/chat/src/components/chat-artifact.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

import type {
  ChatArtifactElement,
  ChatArtifactOpenDetail,
  ChatArtifactProps,
} from '../types'

interface ChatArtifactEmits extends Record<string, EventDefinition<unknown>> {
  artifactOpen: EventDefinition<ChatArtifactOpenDetail>
}

function setup(
  props: ChatArtifactProps,
  _ctx: DefineElementContext<ChatArtifactElement, ChatArtifactEmits>,
) {
  return (
    <Host
      part="root"
      data-slot="chat-artifact-root"
      data-artifact-id={() => props.artifactId}
      data-kind={() => props.kind}
      data-open={() => (props.open ? '' : undefined)}
    >
      <section part="artifact" data-slot="chat-artifact">
        <header part="header" data-slot="chat-artifact-header">
          <Slot name="header">{props.title ?? ''}</Slot>
        </header>

        <div part="content" data-slot="chat-artifact-content">
          <Slot />
        </div>

        <footer part="footer" data-slot="chat-artifact-footer">
          <Slot name="footer" />
        </footer>

        <div part="actions" data-slot="chat-artifact-actions">
          <Slot name="actions" />
        </div>
      </section>
    </Host>
  )
}

export const ChatArtifact = defineElement<
  ChatArtifactProps,
  ChatArtifactElement,
  ChatArtifactEmits
>(
  'zw-chat-artifact',
  {
    shadow: false,
    props: {
      artifactId: prop(String, {
        attr: 'artifact-id',
      }),
      kind: prop(['text', 'code', 'table', 'chart', 'custom'], {
        default: 'custom',
        reflect: true,
      }),
      title: String,
      open: prop(Boolean, {
        reflect: true,
      }),
    },
    emits: {
      artifactOpen: event<ChatArtifactOpenDetail>(),
    },
    meta: {
      description: 'Headless chat artifact advanced component.',
    },
  },
  setup,
)
```

---

# 16. `packages/advanced/chat/src/components/chat-typing.tsx`

```tsx
import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

import type { ChatTypingElement, ChatTypingProps } from '../types'

function setup(props: ChatTypingProps) {
  return (
    <Host
      part="root"
      data-slot="chat-typing-root"
      data-active={() => (props.active ? '' : undefined)}
      aria-hidden={() => (props.active ? undefined : 'true')}
    >
      <div part="indicator" data-slot="chat-typing">
        <Slot>{props.text ?? 'Typing...'}</Slot>
      </div>
    </Host>
  )
}

export const ChatTyping = defineElement<ChatTypingProps, ChatTypingElement>(
  'zw-chat-typing',
  {
    shadow: false,
    props: {
      text: String,
      active: prop(Boolean, {
        default: true,
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless chat typing indicator advanced component.',
    },
  },
  setup,
)
```

---

# 17. `packages/advanced/chat/src/index.ts`

```ts
export * from './types'
export * from './core'

export { Chat, type ChatElement, type ChatProps } from './components/chat'

export {
  ChatThread,
  type ChatThreadElement,
  type ChatThreadProps,
} from './components/chat-thread'

export {
  ChatMessage,
  type ChatMessageElement,
  type ChatMessageProps,
} from './components/chat-message'

export {
  ChatComposer,
  type ChatComposerElement,
  type ChatComposerProps,
} from './components/chat-composer'

export {
  ChatCodeBlock,
  type ChatCodeBlockElement,
  type ChatCodeBlockProps,
} from './components/chat-code-block'

export {
  ChatToolCall,
  type ChatToolCallElement,
  type ChatToolCallProps,
} from './components/chat-tool-call'

export {
  ChatArtifact,
  type ChatArtifactElement,
  type ChatArtifactProps,
} from './components/chat-artifact'

export {
  ChatTyping,
  type ChatTypingElement,
  type ChatTypingProps,
} from './components/chat-typing'
```

---

# 18. `packages/advanced/chat/__tests__/message-model.spec.ts`

```ts
import { describe, expect, it, vi } from 'vitest'

import {
  appendMessagePart,
  getMessageText,
  normalizeChatMessage,
  normalizeChatMessages,
  patchMessage,
} from '../src/core'

describe('message model', () => {
  it('normalizes content into text parts', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)

    const message = normalizeChatMessage({
      id: 'm1',
      role: 'assistant',
      content: 'hello',
    })

    expect(message).toEqual({
      id: 'm1',
      role: 'assistant',
      status: 'idle',
      parts: [{ type: 'text', text: 'hello' }],
      createdAt: 1000,
      metadata: undefined,
    })

    vi.restoreAllMocks()
  })

  it('keeps explicit parts', () => {
    const message = normalizeChatMessage({
      id: 'm1',
      role: 'assistant',
      status: 'streaming',
      parts: [
        { type: 'text', text: 'hello' },
        { type: 'code', language: 'ts', code: 'const a = 1' },
      ],
      createdAt: 1,
    })

    expect(message.parts).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'code', language: 'ts', code: 'const a = 1' },
    ])
  })

  it('normalizes a message list', () => {
    const messages = normalizeChatMessages([
      {
        id: 'u1',
        role: 'user',
        content: 'hi',
        createdAt: 1,
      },
      {
        id: 'a1',
        role: 'assistant',
        status: 'complete',
        content: 'hello',
        createdAt: 2,
      },
    ])

    expect(messages.map(message => message.id)).toEqual(['u1', 'a1'])
    expect(messages[1].status).toBe('complete')
  })

  it('gets text from text parts only', () => {
    const message = normalizeChatMessage({
      id: 'm1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'hello ' },
        { type: 'code', code: 'ignored' },
        { type: 'text', text: 'world' },
      ],
      createdAt: 1,
    })

    expect(getMessageText(message)).toBe('hello world')
  })

  it('appends message parts immutably', () => {
    const message = normalizeChatMessage({
      id: 'm1',
      role: 'assistant',
      content: 'hello',
      createdAt: 1,
    })

    const next = appendMessagePart(message, {
      type: 'text',
      text: ' world',
    })

    expect(message.parts).toHaveLength(1)
    expect(next.parts).toHaveLength(2)
  })

  it('patches content into text parts', () => {
    const message = normalizeChatMessage({
      id: 'm1',
      role: 'assistant',
      content: 'old',
      createdAt: 1,
    })

    const next = patchMessage(message, {
      content: 'new',
      status: 'complete',
    })

    expect(next.status).toBe('complete')
    expect(next.parts).toEqual([{ type: 'text', text: 'new' }])
  })
})
```

---

# 19. `packages/advanced/chat/__tests__/chat-store.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import { createChatStore } from '../src/core'

describe('createChatStore', () => {
  it('initializes with normalized messages', () => {
    const store = createChatStore([
      {
        id: 'm1',
        role: 'user',
        content: 'hello',
        createdAt: 1,
      },
    ])

    expect(store.getMessages()).toMatchObject([
      {
        id: 'm1',
        role: 'user',
        status: 'idle',
        parts: [{ type: 'text', text: 'hello' }],
      },
    ])
  })

  it('sets messages', () => {
    const store = createChatStore()

    const messages = store.setMessages([
      {
        id: 'm1',
        role: 'assistant',
        content: 'hello',
        createdAt: 1,
      },
    ])

    expect(messages).toHaveLength(1)
    expect(store.getSnapshot().messages[0].id).toBe('m1')
  })

  it('appends a new message', () => {
    const store = createChatStore()

    store.appendMessage({
      id: 'm1',
      role: 'user',
      content: 'hello',
      createdAt: 1,
    })

    expect(store.getMessages()).toHaveLength(1)
  })

  it('replaces duplicate message id on append', () => {
    const store = createChatStore([
      {
        id: 'm1',
        role: 'user',
        content: 'old',
        createdAt: 1,
      },
    ])

    store.appendMessage({
      id: 'm1',
      role: 'assistant',
      content: 'new',
      createdAt: 2,
    })

    const messages = store.getMessages()

    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('assistant')
    expect(messages[0].parts).toEqual([{ type: 'text', text: 'new' }])
  })

  it('updates a message', () => {
    const store = createChatStore([
      {
        id: 'm1',
        role: 'assistant',
        content: 'old',
        status: 'streaming',
        createdAt: 1,
      },
    ])

    store.updateMessage('m1', {
      content: 'new',
      status: 'complete',
    })

    expect(store.getMessages()[0]).toMatchObject({
      status: 'complete',
      parts: [{ type: 'text', text: 'new' }],
    })
  })

  it('appends a message part', () => {
    const store = createChatStore([
      {
        id: 'm1',
        role: 'assistant',
        content: 'hello',
        createdAt: 1,
      },
    ])

    store.appendMessagePart('m1', {
      type: 'text',
      text: ' world',
    })

    expect(store.getMessages()[0].parts).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'text', text: ' world' },
    ])
  })

  it('does not expose mutable internal state', () => {
    const store = createChatStore([
      {
        id: 'm1',
        role: 'assistant',
        content: 'hello',
        createdAt: 1,
      },
    ])

    const messages = store.getMessages()
    messages[0].parts.push({ type: 'text', text: ' mutated' })

    expect(store.getMessages()[0].parts).toEqual([
      { type: 'text', text: 'hello' },
    ])
  })

  it('clears messages', () => {
    const store = createChatStore([
      {
        id: 'm1',
        role: 'user',
        content: 'hello',
        createdAt: 1,
      },
    ])

    store.clear()

    expect(store.getMessages()).toEqual([])
  })
})
```

---

# 20. `packages/advanced/chat/__tests__/composer-state.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import { createComposerState, shouldSubmitFromKeyboardEvent } from '../src/core'

function createKeyboardEvent(
  init: KeyboardEventInit & { keyCode?: number },
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', init)

  if (init.keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', {
      configurable: true,
      value: init.keyCode,
    })
  }

  return event
}

describe('createComposerState', () => {
  it('stores value', () => {
    const state = createComposerState('hello')

    expect(state.getValue()).toBe('hello')

    state.setValue('world')
    expect(state.getSnapshot().value).toBe('world')

    state.clearValue()
    expect(state.getValue()).toBe('')
  })

  it('stores attachments immutably', () => {
    const state = createComposerState()

    state.addAttachment({
      id: 'a1',
      name: 'a.txt',
      metadata: {
        type: 'demo',
      },
    })

    const attachments = state.getAttachments()
    attachments[0].metadata = {
      type: 'mutated',
    }

    expect(state.getAttachments()[0].metadata).toEqual({
      type: 'demo',
    })
  })

  it('replaces attachment with same id', () => {
    const state = createComposerState()

    state.addAttachment({
      id: 'a1',
      name: 'old.txt',
    })

    state.addAttachment({
      id: 'a1',
      name: 'new.txt',
    })

    expect(state.getAttachments()).toEqual([
      {
        id: 'a1',
        name: 'new.txt',
      },
    ])
  })

  it('removes attachments', () => {
    const state = createComposerState('', [
      {
        id: 'a1',
        name: 'a.txt',
      },
      {
        id: 'a2',
        name: 'b.txt',
      },
    ])

    state.removeAttachment('a1')

    expect(state.getAttachments()).toEqual([
      {
        id: 'a2',
        name: 'b.txt',
      },
    ])

    state.clearAttachments()
    expect(state.getAttachments()).toEqual([])
  })
})

describe('shouldSubmitFromKeyboardEvent', () => {
  it('submits on plain enter', () => {
    expect(
      shouldSubmitFromKeyboardEvent(
        createKeyboardEvent({
          key: 'Enter',
        }),
        true,
      ),
    ).toBe(true)
  })

  it('does not submit when submitOnEnter is disabled', () => {
    expect(
      shouldSubmitFromKeyboardEvent(
        createKeyboardEvent({
          key: 'Enter',
        }),
        false,
      ),
    ).toBe(false)
  })

  it('does not submit on shift enter', () => {
    expect(
      shouldSubmitFromKeyboardEvent(
        createKeyboardEvent({
          key: 'Enter',
          shiftKey: true,
        }),
        true,
      ),
    ).toBe(false)
  })

  it('does not submit while composing', () => {
    const event = createKeyboardEvent({
      key: 'Enter',
    })

    Object.defineProperty(event, 'isComposing', {
      configurable: true,
      value: true,
    })

    expect(shouldSubmitFromKeyboardEvent(event, true)).toBe(false)
  })

  it('does not submit for keyCode 229', () => {
    expect(
      shouldSubmitFromKeyboardEvent(
        createKeyboardEvent({
          key: 'Enter',
          keyCode: 229,
        }),
        true,
      ),
    ).toBe(false)
  })
})
```

---

# 21. `packages/advanced/chat/__tests__/stream-buffer.spec.ts`

```ts
import { describe, expect, it, vi } from 'vitest'

import { createStreamBuffer } from '../src/core'

describe('createStreamBuffer', () => {
  it('coalesces chunks into one flush', () => {
    const queued: FrameRequestCallback[] = []
    const onFlush = vi.fn()

    const buffer = createStreamBuffer({
      onFlush,
      requestFrame(callback) {
        queued.push(callback)
        return queued.length
      },
      cancelFrame() {},
    })

    buffer.push('hello')
    buffer.push(' ')
    buffer.push('world')

    expect(buffer.getPendingValue()).toBe('hello world')
    expect(buffer.isScheduled()).toBe(true)
    expect(queued).toHaveLength(1)

    queued[0](0)

    expect(onFlush).toHaveBeenCalledWith('hello world')
    expect(buffer.getPendingValue()).toBe('')
    expect(buffer.isScheduled()).toBe(false)
  })

  it('flushes synchronously', () => {
    const onFlush = vi.fn()
    const cancelFrame = vi.fn()

    const buffer = createStreamBuffer({
      onFlush,
      requestFrame() {
        return 1
      },
      cancelFrame,
    })

    buffer.push('hello')
    buffer.flush()

    expect(cancelFrame).toHaveBeenCalledWith(1)
    expect(onFlush).toHaveBeenCalledWith('hello')
    expect(buffer.isScheduled()).toBe(false)
  })

  it('cancels pending chunks', () => {
    const onFlush = vi.fn()
    const cancelFrame = vi.fn()

    const buffer = createStreamBuffer({
      onFlush,
      requestFrame() {
        return 1
      },
      cancelFrame,
    })

    buffer.push('hello')
    buffer.cancel()
    buffer.flush()

    expect(cancelFrame).toHaveBeenCalledWith(1)
    expect(onFlush).not.toHaveBeenCalled()
    expect(buffer.getPendingValue()).toBe('')
  })

  it('ignores empty chunks', () => {
    const onFlush = vi.fn()

    const buffer = createStreamBuffer({
      onFlush,
      requestFrame() {
        return 1
      },
      cancelFrame() {},
    })

    buffer.push('')

    expect(buffer.isScheduled()).toBe(false)
    expect(buffer.getPendingValue()).toBe('')
  })
})
```

---

# 22. `packages/advanced/chat/__tests__/chat-components.spec.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

function analyzeComponent(path: string) {
  const source = readFileSync(resolve(workspaceRoot, path), 'utf-8')

  return analyzeFile({
    file: path,
    code: source,
  })
}

describe('chat advanced component protocol', () => {
  it('analyzes zw-chat', () => {
    const result = analyzeComponent(
      'packages/advanced/chat/src/components/chat.tsx',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat',
      props: {
        loading: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        disabled: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        autoScroll: {
          type: 'boolean',
          default: true,
        },
        virtual: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
      },
      events: {
        send: {
          name: 'send',
          reactName: 'onSend',
        },
        abort: {
          name: 'abort',
          reactName: 'onAbort',
        },
        regenerate: {
          name: 'regenerate',
          reactName: 'onRegenerate',
        },
        messageAction: {
          name: 'message-action',
          reactName: 'onMessageAction',
        },
        artifactOpen: {
          name: 'artifact-open',
          reactName: 'onArtifactOpen',
        },
      },
      methods: {
        appendMessage: {
          name: 'appendMessage',
          returns: 'void',
        },
        updateMessage: {
          name: 'updateMessage',
          returns: 'void',
        },
        appendMessagePart: {
          name: 'appendMessagePart',
          returns: 'void',
        },
        clear: {
          name: 'clear',
          returns: 'void',
        },
        getMessages: {
          name: 'getMessages',
          returns: 'NormalizedChatMessageData[]',
        },
        scrollToBottom: {
          name: 'scrollToBottom',
          returns: 'void',
        },
      },
      slots: {
        header: { name: 'header' },
        sidebar: { name: 'sidebar' },
        thread: { name: 'thread' },
        artifact: { name: 'artifact' },
        composer: { name: 'composer' },
        empty: { name: 'empty' },
        loading: { name: 'loading' },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining([
        'artifact',
        'composer',
        'container',
        'empty',
        'header',
        'loading',
        'root',
        'sidebar',
        'thread',
      ]),
    )
  })

  it('analyzes zw-chat-thread', () => {
    const result = analyzeComponent(
      'packages/advanced/chat/src/components/chat-thread.tsx',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat-thread',
      props: {
        count: {
          type: 'number',
          default: 0,
        },
        loading: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        empty: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        virtual: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
      },
      methods: {
        scrollToBottom: {
          name: 'scrollToBottom',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining(['root', 'viewport']),
    )
  })

  it('analyzes zw-chat-message', () => {
    const result = analyzeComponent(
      'packages/advanced/chat/src/components/chat-message.tsx',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat-message',
      props: {
        role: {
          type: 'string',
          values: ['system', 'user', 'assistant', 'tool'],
          default: 'assistant',
          reflect: true,
        },
        status: {
          type: 'string',
          values: ['idle', 'streaming', 'complete', 'error', 'aborted'],
          default: 'idle',
          reflect: true,
        },
        selected: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        interactive: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
      },
      events: {
        messageAction: {
          name: 'message-action',
          reactName: 'onMessageAction',
        },
      },
      slots: {
        default: { name: 'default' },
        avatar: { name: 'avatar' },
        header: { name: 'header' },
        footer: { name: 'footer' },
        actions: { name: 'actions' },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining([
        'actions',
        'avatar',
        'body',
        'content',
        'footer',
        'header',
        'message',
        'root',
      ]),
    )
  })

  it('analyzes zw-chat-composer', () => {
    const result = analyzeComponent(
      'packages/advanced/chat/src/components/chat-composer.tsx',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat-composer',
      props: {
        value: {
          type: 'string',
          reflect: true,
        },
        disabled: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        loading: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        submitOnEnter: {
          type: 'boolean',
          default: true,
        },
        rows: {
          type: 'number',
          default: 3,
        },
      },
      events: {
        send: {
          name: 'send',
          reactName: 'onSend',
        },
        valueChange: {
          name: 'value-change',
          reactName: 'onValueChange',
        },
        attachmentChange: {
          name: 'attachment-change',
          reactName: 'onAttachmentChange',
        },
      },
      methods: {
        focus: {
          name: 'focus',
          returns: 'void',
        },
        clear: {
          name: 'clear',
          returns: 'void',
        },
        submit: {
          name: 'submit',
          returns: 'void',
        },
      },
      slots: {
        prefix: { name: 'prefix' },
        attachments: { name: 'attachments' },
        submit: { name: 'submit' },
        suffix: { name: 'suffix' },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining([
        'attachments',
        'control',
        'form',
        'prefix',
        'root',
        'submit',
        'suffix',
      ]),
    )
  })

  it('analyzes support components', () => {
    const files = [
      'packages/advanced/chat/src/components/chat-code-block.tsx',
      'packages/advanced/chat/src/components/chat-tool-call.tsx',
      'packages/advanced/chat/src/components/chat-artifact.tsx',
      'packages/advanced/chat/src/components/chat-typing.tsx',
    ]

    const tags = [
      'zw-chat-code-block',
      'zw-chat-tool-call',
      'zw-chat-artifact',
      'zw-chat-typing',
    ]

    for (let index = 0; index < files.length; index += 1) {
      const result = analyzeComponent(files[index])

      expect(result.diagnostics).toEqual([])
      expect(result.components).toHaveLength(1)
      expect(result.components[0].tag).toBe(tags[index])
      expect(result.components[0].cssParts.length).toBeGreaterThan(0)
    }
  })
})
```

---

# Phase 2 验收命令

```bash
pnpm --filter @zeus-web/chat check
pnpm --filter @zeus-web/chat test

pnpm check
pnpm test-unit

pnpm --filter @zeus-web/chat build
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm release:plan
```

---

# Phase 2 完成标准

Phase 2 合格标准：

```txt
1. @zeus-web/chat 可以独立 build
2. @zeus-web/chat 可以独立 test
3. core 单测覆盖消息模型、store、composer、stream buffer
4. component analyzer 能识别所有 Chat 组件
5. 每个组件都有稳定 tag / props / events / methods / slots / parts
6. 不引入 provider 请求逻辑
7. 不引入 registry / ui 样式层
8. React/Vue wrapper 由 output 插件自动生成
```

完成后，下一阶段建议是：

```txt
Phase 3:
  chat registry source + @zeus-web/ui/chat + ai metadata + examples
```

一句话：**Phase 2 只把 `@zeus-web/chat` 的 headless 能力层做扎实，让 Chat 成为 advanced workspace 的第一个产品级组件族，但不提前绑定样式和模型请求。**
