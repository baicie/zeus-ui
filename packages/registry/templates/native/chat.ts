export const chatNativeSource = String.raw`
import '@zeus-web/chat/wc/auto'

interface ChatDemoMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status?: 'idle' | 'streaming' | 'complete' | 'error' | 'aborted'
}

const chatDemoMessages: ChatDemoMessage[] = [
  {
    id: 'u1',
    role: 'user',
    content: '帮我总结一下 Zeus Web Chat 的能力。',
    status: 'complete',
  },
  {
    id: 'a1',
    role: 'assistant',
    content:
      'Zeus Web Chat 提供 headless 的消息容器、线程、消息、输入框、代码块、工具调用、Artifact 和 Typing 组件，可在原生 Web Component、React、Vue 中复用。',
    status: 'complete',
  },
]

export function mountChatDemo(root: HTMLElement): void {
  root.innerHTML = ''

  const chat = document.createElement('zw-chat')
  chat.setAttribute('empty-text', '暂无消息')
  chat.setAttribute('auto-scroll', '')

  const thread = document.createElement('zw-chat-thread')
  thread.setAttribute('slot', 'thread')
  thread.setAttribute('aria-label', 'Chat messages')
  thread.setAttribute('count', String(chatDemoMessages.length))

  for (const message of chatDemoMessages) {
    const item = document.createElement('zw-chat-message')
    item.setAttribute('message-id', message.id)
    item.setAttribute('role', message.role)
    item.setAttribute('status', message.status ?? 'complete')
    item.textContent = message.content
    thread.append(item)
  }

  const composer = document.createElement('zw-chat-composer')
  composer.setAttribute('slot', 'composer')
  composer.setAttribute('placeholder', '输入消息...')
  composer.setAttribute('aria-label', 'Message input')

  composer.addEventListener('send', event => {
    const detail = (event as CustomEvent<{ value: string }>).detail
    const message = document.createElement('zw-chat-message')
    message.setAttribute('message-id', 'local-' + Date.now())
    message.setAttribute('role', 'user')
    message.setAttribute('status', 'complete')
    message.textContent = detail.value
    thread.append(message)
    thread.setAttribute('count', String(thread.children.length))
    thread.scrollToBottom({ behavior: 'smooth' })
  })

  chat.append(thread, composer)
  root.append(chat)
}
`.trim()
