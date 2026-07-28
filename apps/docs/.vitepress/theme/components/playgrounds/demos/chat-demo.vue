<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

type ChatRole = 'system' | 'user' | 'assistant' | 'tool'
type ChatMessageStatus = 'idle' | 'streaming' | 'complete' | 'error' | 'aborted'

interface ChatMessage {
  id: string
  role: ChatRole
  status: ChatMessageStatus
  content: string
}

interface ChatThreadElement extends HTMLElement {
  scrollToBottom?: (options?: ScrollIntoViewOptions) => void | Promise<void>
}

interface ChatComposerElement extends HTMLElement {
  focus?: () => void | Promise<void>
}

interface ChatSendDetail {
  value?: string
}

const ui = useLocalizedMessages({
  en: {
    welcome:
      'This playground composes the real chat root, thread, message, typing, and composer elements.',
    question: 'Can I send a message without a model provider?',
    answer:
      'Yes. The component owns local UI behavior; your application owns transport and model requests.',
    prompt: 'Type a message and press Enter.',
    you: 'You',
    assistant: 'Assistant',
    tool: 'Tool',
    system: 'System',
    typing: 'Assistant is preparing a local reply…',
    sendEvent: (value: string) => `Send event: “${value}”`,
    localReply:
      'Local reply received. Connect this event to your own provider at the application boundary.',
    resetEvent: 'Conversation reset.',
    focusComposer: 'Focus composer',
    reset: 'Reset',
    assistantTitle: 'Zeus assistant',
    localDemo: 'Local demo · no provider',
    conversationLabel: 'Playground conversation',
    composerLabel: 'Message Zeus assistant',
    placeholder: 'Ask about the component contract',
    send: 'Send',
  },
  zh: {
    welcome: '此演示组合了真实的聊天根组件、会话、消息、输入状态和编辑器组件。',
    question: '不接入模型服务也能发送消息吗？',
    answer: '可以。组件负责本地 UI 行为，传输和模型请求由应用负责。',
    prompt: '输入消息并按 Enter。',
    you: '你',
    assistant: '助手',
    tool: '工具',
    system: '系统',
    typing: '助手正在准备本地回复……',
    sendEvent: (value: string) => `发送事件：“${value}”`,
    localReply: '已收到本地回复。请在应用边界将此事件接入自己的服务。',
    resetEvent: '会话已重置。',
    focusComposer: '聚焦编辑器',
    reset: '重置',
    assistantTitle: 'Zeus 助手',
    localDemo: '本地演示 · 未接入服务',
    conversationLabel: '交互演示会话',
    composerLabel: '给 Zeus 助手发送消息',
    placeholder: '询问组件契约',
    send: '发送',
  },
})

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    status: 'complete',
    content: ui.value.welcome,
  },
  {
    id: 'question',
    role: 'user',
    status: 'complete',
    content: ui.value.question,
  },
  {
    id: 'answer',
    role: 'assistant',
    status: 'complete',
    content: ui.value.answer,
  },
]

const thread = ref<ChatThreadElement | null>(null)
const composer = ref<ChatComposerElement | null>(null)
const messageList = ref<HTMLElement | null>(null)
const messages = ref<ChatMessage[]>(initialMessages.slice())
const waiting = ref(false)
const eventLabel = ref(ui.value.prompt)

let activeComposer: ChatComposerElement | null = null
let replyTimer: ReturnType<typeof setTimeout> | undefined
let messageSequence = 0

function roleLabel(role: ChatRole): string {
  if (role === 'user') return ui.value.you
  if (role === 'assistant') return ui.value.assistant
  if (role === 'tool') return ui.value.tool
  return ui.value.system
}

function roleInitial(role: ChatRole): string {
  return role === 'assistant' ? 'Z' : roleLabel(role).slice(0, 1)
}

function scrollThread(): void {
  nextTick().then(() => {
    const element = thread.value

    if (element && typeof element.scrollToBottom === 'function') {
      element.scrollToBottom({ behavior: 'smooth' })
    }
  })
}

function createMessageElement(
  ownerDocument: Document,
  message: ChatMessage,
): HTMLElement {
  const element = ownerDocument.createElement('zw-chat-message')
  const avatar = ownerDocument.createElement('span')
  const header = ownerDocument.createElement('strong')
  const content = ownerDocument.createElement('p')

  element.setAttribute('message-id', message.id)
  element.setAttribute('role', message.role)
  element.setAttribute('status', message.status)

  avatar.setAttribute('slot', 'avatar')
  avatar.className = 'message-avatar'
  avatar.textContent = roleInitial(message.role)

  header.setAttribute('slot', 'header')
  header.textContent = roleLabel(message.role)
  content.textContent = message.content

  element.appendChild(avatar)
  element.appendChild(header)
  element.appendChild(content)

  return element
}

function renderThread(): void {
  const container = messageList.value

  if (!container) return

  while (container.firstChild) {
    container.removeChild(container.firstChild)
  }

  for (const message of messages.value) {
    container.appendChild(
      createMessageElement(container.ownerDocument, message),
    )
  }

  if (waiting.value) {
    const typing = container.ownerDocument.createElement('zw-chat-typing')
    typing.setAttribute('active', '')
    typing.setAttribute('text', ui.value.typing)
    container.appendChild(typing)
  }
}

function appendMessage(message: ChatMessage): void {
  messages.value = messages.value.concat(message)
  renderThread()
  scrollThread()
}

function handleSend(event: Event): void {
  const customEvent = event as CustomEvent<ChatSendDetail>
  const detail = customEvent.detail
  const value =
    detail && typeof detail.value === 'string' ? detail.value.trim() : ''

  if (!value) return

  messageSequence += 1
  appendMessage({
    id: `user-${messageSequence}`,
    role: 'user',
    status: 'complete',
    content: value,
  })

  eventLabel.value = ui.value.sendEvent(value)
  waiting.value = true
  renderThread()

  if (replyTimer !== undefined) clearTimeout(replyTimer)

  replyTimer = setTimeout(() => {
    replyTimer = undefined
    waiting.value = false

    messageSequence += 1
    appendMessage({
      id: `assistant-${messageSequence}`,
      role: 'assistant',
      status: 'complete',
      content: ui.value.localReply,
    })
  }, 450)
}

function focusComposer(): void {
  const element = composer.value

  if (element && typeof element.focus === 'function') {
    element.focus()
  }
}

function resetConversation(): void {
  if (replyTimer !== undefined) {
    clearTimeout(replyTimer)
    replyTimer = undefined
  }

  waiting.value = false
  messages.value = initialMessages.slice()
  eventLabel.value = ui.value.resetEvent
  renderThread()
  scrollThread()
}

onMounted(() => {
  const composerElement = composer.value

  if (composerElement) {
    activeComposer = composerElement
    composerElement.addEventListener('send', handleSend)
  }

  renderThread()
})

onUnmounted(() => {
  if (replyTimer !== undefined) {
    clearTimeout(replyTimer)
    replyTimer = undefined
  }

  if (activeComposer) {
    activeComposer.removeEventListener('send', handleSend)
  }

  activeComposer = null
})
</script>

<template>
  <div class="advanced-demo" data-playground-demo="chat">
    <div class="demo-toolbar">
      <span aria-live="polite">{{ eventLabel }}</span>
      <button type="button" @click="focusComposer">
        {{ ui.focusComposer }}
      </button>
      <button type="button" @click="resetConversation">{{ ui.reset }}</button>
    </div>

    <zw-chat>
      <header v-bind="{ slot: 'header' }" class="chat-header">
        <strong>{{ ui.assistantTitle }}</strong>
        <small>{{ ui.localDemo }}</small>
      </header>

      <zw-chat-thread
        ref="thread"
        v-bind="{ slot: 'thread' }"
        :aria-label="ui.conversationLabel"
      >
        <div ref="messageList" class="chat-message-list" />
      </zw-chat-thread>

      <zw-chat-composer
        ref="composer"
        v-bind="{ slot: 'composer' }"
        :loading="waiting"
        :aria-label="ui.composerLabel"
        :placeholder="ui.placeholder"
        rows="2"
      >
        <span v-bind="{ slot: 'submit' }">{{ ui.send }}</span>
      </zw-chat-composer>
    </zw-chat>
  </div>
</template>

<style scoped>
.advanced-demo {
  display: grid;
  gap: 0.75rem;
}

.demo-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.demo-toolbar span {
  flex: 1;
  min-width: 14rem;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}

button {
  padding: 0.4rem 0.7rem;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.45rem;
  cursor: pointer;
}

zw-chat {
  display: block;
}

:deep(zw-chat > [data-slot='chat']) {
  display: flex;
  flex-direction: column;
  height: 31rem;
  overflow: hidden;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.8rem;
}

:deep(zw-chat > [data-slot='chat'] > [data-slot='chat-header']) {
  padding: 0;
}

:deep(zw-chat > [data-slot='chat'] > [data-slot='chat-sidebar']),
:deep(zw-chat > [data-slot='chat'] > [data-slot='chat-artifact']),
:deep(zw-chat > [data-slot='chat'] > [data-slot='chat-empty']),
:deep(zw-chat > [data-slot='chat'] > [data-slot='chat-loading']) {
  display: none;
}

:deep(zw-chat > [data-slot='chat'] > [data-slot='chat-thread']) {
  flex: 1;
  min-height: 0;
}

:deep(zw-chat > [data-slot='chat'] > [data-slot='chat-composer']) {
  padding: 0.75rem;
  border-top: 1px solid var(--vp-c-divider);
}

.chat-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
}

.chat-header small {
  color: var(--vp-c-text-2);
}

zw-chat-thread {
  display: block;
  height: 100%;
}

:deep(zw-chat-thread > [data-slot='chat-thread']) {
  height: 100%;
  padding: 1rem;
  overflow-y: auto;
}

:deep(zw-chat-thread [data-slot='chat-thread-spacer']) {
  display: none;
}

:deep(zw-chat-thread [data-slot='chat-thread-items']) {
  display: block;
}

.chat-message-list {
  display: grid;
  gap: 0.75rem;
}

zw-chat-message {
  display: block;
}

:deep(zw-chat-message [data-slot='chat-message']) {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: 0.65rem;
  max-width: 88%;
}

zw-chat-message[role='user'] {
  margin-left: auto;
}

:deep(zw-chat-message[role='user'] [data-slot='chat-message']) {
  grid-template-columns: minmax(0, 1fr);
}

:deep(zw-chat-message[role='user'] [data-slot='chat-message-avatar']),
:deep(zw-chat-message[role='user'] [data-slot='chat-message-header']) {
  display: none;
}

:deep(zw-chat-message [data-slot='chat-message-header']) {
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
}

:deep(zw-chat-message [data-slot='chat-message-content']) {
  padding: 0.6rem 0.75rem;
  background: var(--vp-c-bg-soft);
  border-radius: 0.65rem;
}

:deep(zw-chat-message[role='user'] [data-slot='chat-message-content']) {
  color: var(--vp-c-bg);
  background: var(--vp-c-brand-1);
}

:deep(zw-chat-message [data-slot='chat-message-content'] p) {
  margin: 0;
  line-height: 1.5;
}

.message-avatar {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  color: white;
  background: var(--vp-c-brand-1);
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 800;
}

zw-chat-typing {
  display: block;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}

zw-chat-composer {
  display: block;
}

:deep(zw-chat-composer [data-slot='chat-composer']) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.6rem;
  align-items: end;
}

:deep(zw-chat-composer [data-slot='chat-composer-control']) {
  min-height: 2.75rem;
  max-height: 7rem;
  padding: 0.65rem 0.75rem;
  color: var(--vp-c-text-1);
  resize: vertical;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.65rem;
}

:deep(zw-chat-composer [data-slot='chat-composer-submit']) {
  min-height: 2.75rem;
  padding: 0 0.9rem;
  color: white;
  background: var(--vp-c-brand-1);
  border: 0;
  border-radius: 0.65rem;
  cursor: pointer;
}

@media (max-width: 640px) {
  :deep(zw-chat > [data-slot='chat']) {
    height: 34rem;
  }

  :deep(zw-chat-message [data-slot='chat-message']) {
    max-width: 100%;
  }
}
</style>
