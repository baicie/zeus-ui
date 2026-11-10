/* eslint-disable no-restricted-globals, no-alert */
/**
 * BYOK chat view.
 *
 * A second mode beside the Host agent. They share the shell and the visual
 * language, but nothing else: this view reads and writes only the local
 * conversation store and talks only to the user's gateway. Host replay state is
 * never mixed in, and these messages never reach the Host.
 *
 * Streaming writes into a single text node per turn instead of re-rendering the
 * message list, so a long answer does not thrash the DOM.
 */

import type { ChatTurn, LocalConversation } from './conversations'
import type { ChatMessage } from './gateway'
import { conversationStore, createConversation } from './conversations'
import { GatewayError, sendChat } from './gateway'
import { keyRecordId, providerStore } from './profiles'
import { vault } from './vault'

export interface ByokChatOptions {
  readonly mode: 'host' | 'byok'
  readonly onModeChange: (mode: 'host' | 'byok') => void
  /** Element the view mounts into. The caller owns its visibility. */
  readonly host: HTMLElement
}

export function mountByokChat(options: ByokChatOptions): () => void {
  const root = document.createElement('section')
  root.className = 'byok'
  root.dataset.testid = 'byok-chat'

  const header = document.createElement('div')
  header.className = 'conversation-head'
  const title = document.createElement('p')
  title.className = 'conversation-title'
  title.dataset.testid = 'byok-title'
  const providerLabel = document.createElement('span')
  providerLabel.className = 'conversation-mode'
  providerLabel.dataset.testid = 'byok-provider'
  header.append(title, providerLabel)

  const thread = document.createElement('div')
  thread.className = 'byok-thread'
  thread.dataset.testid = 'byok-thread'
  thread.setAttribute('role', 'log')
  thread.setAttribute('aria-live', 'polite')

  const empty = document.createElement('div')
  empty.className = 'welcome'
  empty.dataset.testid = 'byok-welcome'
  const emptyMark = document.createElement('div')
  emptyMark.className = 'welcome-mark'
  emptyMark.setAttribute('aria-hidden', 'true')
  emptyMark.textContent = 'Z'
  const emptyTitle = document.createElement('p')
  emptyTitle.className = 'welcome-title'
  emptyTitle.textContent = 'Chat with your own model'
  const emptyCopy = document.createElement('p')
  emptyCopy.className = 'welcome-copy'
  emptyCopy.textContent =
    'Configure a gateway in Settings, unlock the vault, then send a message. Requests go straight from this browser to your provider.'
  const emptyAction = document.createElement('button')
  emptyAction.type = 'button'
  emptyAction.className = 'btn btn-primary'
  emptyAction.dataset.testid = 'byok-open-settings'
  emptyAction.textContent = 'Open provider settings'
  emptyAction.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('byok:open-settings'))
  })
  empty.append(emptyMark, emptyTitle, emptyCopy, emptyAction)

  /* -------------------------------------------------------------- composer */

  const composerStack = document.createElement('div')
  composerStack.className = 'composer-stack'
  const composer = document.createElement('form')
  composer.className = 'byok-composer'
  composer.dataset.testid = 'byok-composer'
  const input = document.createElement('textarea')
  input.className = 'byok-input'
  input.rows = 1
  input.placeholder = 'Send a message…'
  input.dataset.testid = 'byok-input'
  input.setAttribute('aria-label', 'Message')
  const send = document.createElement('button')
  send.type = 'submit'
  send.className = 'byok-send'
  send.dataset.testid = 'byok-send'
  send.setAttribute('aria-label', 'Send')
  send.textContent = '↑'
  const stop = document.createElement('button')
  stop.type = 'button'
  stop.className = 'byok-stop'
  stop.dataset.testid = 'byok-stop'
  stop.setAttribute('aria-label', 'Stop generating')
  stop.textContent = '■'
  stop.hidden = true
  composer.append(input, send, stop)

  const meta = document.createElement('div')
  meta.className = 'composer-actions'
  const status = document.createElement('span')
  status.className = 'attach-status'
  status.dataset.testid = 'byok-status'
  status.setAttribute('role', 'status')
  const retry = document.createElement('button')
  retry.type = 'button'
  retry.className = 'btn btn-sm'
  retry.dataset.testid = 'byok-retry'
  retry.textContent = 'Retry'
  retry.hidden = true
  const clear = document.createElement('button')
  clear.type = 'button'
  clear.className = 'btn btn-sm'
  clear.dataset.testid = 'byok-clear'
  clear.textContent = 'Clear all chats'
  meta.append(status, retry, clear)
  composerStack.append(composer, meta)

  root.append(header, empty, thread, composerStack)

  /* ----------------------------------------------------------------- state */

  let conversation: LocalConversation | undefined
  let controller: AbortController | undefined
  let lastFailedPrompt: string | undefined

  function currentConversation(): LocalConversation | undefined {
    return conversation
  }

  function providerFor(
    value: LocalConversation | undefined,
  ): ReturnType<typeof providerStore.get> {
    if (!value) return undefined
    return providerStore.get(value.providerId) ?? providerStore.active()
  }

  /* --------------------------------------------------------------- render */

  function renderHeader(): void {
    const provider = providerFor(currentConversation())
    title.textContent = currentConversation()?.title ?? 'New chat'
    providerLabel.textContent = provider
      ? `${provider.name || 'Provider'} · ${provider.model || 'no model'}`
      : 'No provider configured'
    providerLabel.dataset.status = provider ? 'ready' : 'missing'
  }

  function renderThread(): void {
    const turns = currentConversation()?.turns ?? []
    empty.hidden = turns.length > 0
    thread.replaceChildren()
    for (const turn of turns) thread.append(renderTurn(turn))
    scrollToBottom()
  }

  function renderTurn(turn: ChatTurn): HTMLElement {
    const article = document.createElement('article')
    article.className = 'byok-turn'
    article.dataset.author = turn.role
    article.dataset.testid = `byok-turn-${turn.id}`
    const author = document.createElement('p')
    author.className = 'byok-author'
    author.textContent =
      turn.role === 'user'
        ? 'You'
        : turn.role === 'assistant'
          ? 'Assistant'
          : 'System'
    const body = document.createElement('div')
    body.className = 'byok-body'
    body.dataset.testid = 'byok-body'
    body.textContent = turn.content
    article.append(author, body)
    if (turn.error) {
      const error = document.createElement('p')
      error.className = 'byok-error'
      error.dataset.testid = 'byok-error'
      error.textContent = turn.error
      article.append(error)
    }
    if (turn.usage?.totalTokens) {
      const usage = document.createElement('p')
      usage.className = 'byok-usage'
      usage.textContent = `${turn.usage.totalTokens} tokens`
      article.append(usage)
    }
    const actions = document.createElement('div')
    actions.className = 'byok-actions'
    const copy = document.createElement('button')
    copy.type = 'button'
    copy.className = 'btn btn-sm'
    copy.textContent = 'Copy'
    copy.addEventListener('click', () => {
      void navigator.clipboard?.writeText(turn.content).catch(() => undefined)
    })
    actions.append(copy)
    article.append(actions)
    return article
  }

  /** Only follows when the reader is already at the bottom. */
  function scrollToBottom(): void {
    const distance =
      thread.scrollHeight - thread.scrollTop - thread.clientHeight
    if (distance < 120) thread.scrollTop = thread.scrollHeight
  }

  /* ---------------------------------------------------------------- send */

  async function resolveKey(): Promise<string | undefined> {
    const profile = providerFor(currentConversation())
    if (!profile) return undefined
    if (vault.getState().status !== 'unlocked') return undefined
    return vault.get(keyRecordId(profile.id)).catch(() => undefined)
  }

  function ensureConversation(): LocalConversation {
    if (conversation) return conversation
    const profile = providerStore.active()
    const next = createConversation(profile?.id ?? '', profile?.model ?? '')
    conversation = next
    conversationStore.setActive(next.id)
    void conversationStore.save(next)
    return next
  }

  async function submit(): Promise<void> {
    const text = input.value.trim()
    if (!text || controller) return
    const profile = providerFor(currentConversation())
    if (!profile) {
      setStatus('Add and activate a provider in Settings first.', 'error')
      return
    }
    const apiKey = await resolveKey()
    if (!apiKey) {
      setStatus(
        vault.getState().status === 'unlocked'
          ? 'This provider has no saved key. Add one in Settings.'
          : 'Unlock the vault to use the saved key.',
        'error',
      )
      return
    }

    const active = ensureConversation()
    if (active.turns.length === 0) {
      active.title = text.slice(0, 48)
    }
    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    const assistantTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      model: profile.model,
    }
    active.turns.push(userTurn, assistantTurn)
    input.value = ''
    autoGrow()
    lastFailedPrompt = undefined
    retry.hidden = true
    renderThread()
    renderHeader()
    await conversationStore.save(active)

    const node = thread.querySelector<HTMLElement>(
      `[data-testid="byok-turn-${assistantTurn.id}"] [data-testid="byok-body"]`,
    )

    controller = new AbortController()
    send.hidden = true
    stop.hidden = false
    setStatus('Generating…', 'busy')
    try {
      const history: ChatMessage[] = active.turns
        .filter(turn => !turn.error && turn.content.length > 0)
        .map(turn => ({ role: turn.role, content: turn.content }))
      const result = await sendChat(
        profile,
        apiKey,
        history,
        controller.signal,
        {
          // Write straight into the text node; re-rendering the list on every
          // chunk would rebuild every message and lose the scroll position.
          onText: accumulated => {
            assistantTurn.content = accumulated
            if (node) node.textContent = accumulated
            scrollToBottom()
          },
          onUsage: usage => {
            assistantTurn.usage = usage
          },
        },
      )
      assistantTurn.content = result.text
      if (result.usage) assistantTurn.usage = result.usage
      if (node) node.textContent = result.text
      if (result.finishReason === 'length') {
        setStatus('The answer was cut off at the token limit.', 'error')
      } else {
        setStatus('', 'idle')
      }
    } catch (cause) {
      const message =
        cause instanceof GatewayError
          ? cause.hint
            ? `${cause.message} ${cause.hint}`
            : cause.message
          : cause instanceof Error && cause.name === 'AbortError'
            ? 'Stopped.'
            : String(cause)
      const aborted =
        (cause instanceof Error && cause.name === 'AbortError') ||
        controller?.signal.aborted === true
      assistantTurn.error = aborted
        ? 'Stopped before the answer finished.'
        : message
      if (!aborted) lastFailedPrompt = text
      retry.hidden = aborted
      if (node && !assistantTurn.content) node.textContent = ''
      setStatus(message, aborted ? 'idle' : 'error')
    } finally {
      controller = undefined
      send.hidden = false
      stop.hidden = true
      renderThread()
      await conversationStore.save(active)
    }
  }

  function setStatus(text: string, tone: 'idle' | 'busy' | 'error'): void {
    status.textContent = text
    status.dataset.tone = tone
  }

  function autoGrow(): void {
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`
  }

  input.addEventListener('input', autoGrow)
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault()
      void submit()
    }
  })

  composer.addEventListener('submit', event => {
    event.preventDefault()
    void submit()
  })

  stop.addEventListener('click', () => {
    controller?.abort()
  })

  retry.addEventListener('click', () => {
    const prompt = lastFailedPrompt
    if (!prompt) return
    const active = currentConversation()
    if (active) {
      // Drop the failed user/assistant pair so a retry does not stack a
      // duplicate turn above the new one.
      active.turns.splice(-2, 2)
      void conversationStore.save(active)
    }
    lastFailedPrompt = undefined
    retry.hidden = true
    // Re-enter the prompt through the composer so `submit` is the single path
    // that records turns, aborts and streams.
    input.value = prompt
    autoGrow()
    void submit()
  })

  clear.addEventListener('click', () => {
    if (!window.confirm('Delete every locally stored BYOK chat?')) return
    conversation = undefined
    void conversationStore.clear().then(() => {
      renderThread()
      renderHeader()
    })
  })

  /* ------------------------------------------------------------- lifecycle */

  function syncConversation(): void {
    const active = conversationStore.active()
    conversation = active
    renderHeader()
    renderThread()
  }

  const unsubscribeConversations = conversationStore.subscribe(() => {
    if (!conversation && conversationStore.active()) syncConversation()
  })

  const unsubscribeProviders = providerStore.subscribe(() => {
    renderHeader()
  })

  void conversationStore.load().then(() => {
    syncConversation()
    if (conversationStore.list().length === 0) ensureConversation()
  })
  void providerStore.load()

  options.host.replaceChildren(root)
  options.onModeChange(options.mode)
  renderHeader()
  renderThread()

  return () => {
    controller?.abort()
    unsubscribeConversations()
    unsubscribeProviders()
    options.host.replaceChildren()
  }
}
