/* eslint-disable no-restricted-globals */
/**
 * BYOK chat view — the user's own OpenAI-compatible gateway, in the same
 * ChatGPT-style surface as the Host chat.
 *
 * What this view owns:
 * - the centred 768px thread, with the user's message as a right-aligned bubble
 *   and the assistant's reply as plain document text (as ChatGPT reads)
 * - the composer at the bottom of that column
 * - streaming into a single text node per turn, so a long answer does not
 *   rebuild the message list on every chunk
 * - inline errors with a retry action
 *
 * What it does not own: the shell, the sidebar, settings. Those belong to
 * `main.ts`, and the two chat modes share them.
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
  /** Element the thread mounts into (inside the shell's scroll column). */
  readonly host: HTMLElement
  /** Element the composer mounts into; the shell owns its position. */
  readonly composerHost: HTMLElement
  /** Reports the active provider/model so the topbar picker can show it. */
  readonly onTitle?: (title: string) => void
}

export function mountByokChat(options: ByokChatOptions): () => void {
  const root = document.createElement('section')
  root.className = 'byok'
  root.dataset.testid = 'byok-chat'

  const thread = document.createElement('div')
  thread.className = 'byok-thread'
  thread.dataset.testid = 'byok-thread'
  thread.setAttribute('role', 'log')
  thread.setAttribute('aria-live', 'polite')

  const empty = document.createElement('div')
  empty.className = 'byok-empty'
  empty.dataset.testid = 'byok-welcome'
  const emptyTitle = document.createElement('p')
  emptyTitle.className = 'byok-empty-title'
  emptyTitle.textContent = 'Configure a model to start'
  const emptyCopy = document.createElement('p')
  emptyCopy.className = 'byok-empty-copy'
  emptyCopy.textContent =
    'Add an OpenAI-compatible gateway in Settings. Requests go straight from this browser to your provider; the key is encrypted in this browser behind your passphrase.'
  const emptyAction = document.createElement('button')
  emptyAction.type = 'button'
  emptyAction.className = 'byok-link'
  emptyAction.dataset.testid = 'byok-open-settings'
  emptyAction.textContent = 'Open provider settings'
  emptyAction.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('byok:open-settings'))
  })
  empty.append(emptyTitle, emptyCopy, emptyAction)

  root.append(empty, thread)
  options.host.append(root)

  /* -------------------------------------------------------------- composer */

  const composerStack = document.createElement('div')
  composerStack.className = 'byok-composer-stack'
  const errorLine = document.createElement('div')
  errorLine.className = 'byok-error-line'
  errorLine.dataset.testid = 'byok-error'
  errorLine.hidden = true
  const errorText = document.createElement('span')
  const retry = document.createElement('button')
  retry.type = 'button'
  retry.dataset.testid = 'byok-retry'
  retry.textContent = 'Retry'
  retry.hidden = true
  const errorDismiss = document.createElement('button')
  errorDismiss.type = 'button'
  errorDismiss.textContent = 'Dismiss'
  errorDismiss.addEventListener('click', () => {
    errorLine.hidden = true
    retry.hidden = true
  })
  errorLine.append(errorText, retry, errorDismiss)

  const composer = document.createElement('form')
  composer.className = 'byok-composer'
  composer.dataset.testid = 'byok-composer'

  const input = document.createElement('textarea')
  input.className = 'byok-input'
  input.rows = 1
  input.placeholder = 'Ask anything'
  input.dataset.testid = 'byok-input'
  input.setAttribute('aria-label', 'Message')

  const plus = document.createElement('button')
  plus.type = 'button'
  plus.className = 'byok-plus'
  plus.setAttribute('aria-label', 'Add files and more')
  plus.disabled = true
  plus.title = 'Attachments are not supported by the browser gateway yet'
  plus.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'

  const send = document.createElement('button')
  send.type = 'submit'
  send.className = 'byok-send'
  send.dataset.testid = 'byok-send'
  send.setAttribute('aria-label', 'Send')
  send.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>'

  const stop = document.createElement('button')
  stop.type = 'button'
  stop.className = 'byok-send is-stop'
  stop.dataset.testid = 'byok-stop'
  stop.setAttribute('aria-label', 'Stop generating')
  stop.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
  stop.hidden = true

  composer.append(plus, input, send, stop)

  const hint = document.createElement('p')
  hint.className = 'byok-hint'
  hint.textContent = 'Enter to send · Shift+Enter for a new line'

  composerStack.append(errorLine, composer, hint)
  options.composerHost.append(composerStack)

  /* ----------------------------------------------------------------- state */

  let conversation: LocalConversation | undefined
  let controller: AbortController | undefined
  let lastFailedPrompt: string | undefined
  const assistantNodes = new Map<string, HTMLElement>()

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
    options.onTitle?.(
      provider
        ? `${provider.name || 'Provider'} · ${provider.model || 'no model'}`
        : 'No provider configured',
    )
  }

  function renderThread(): void {
    const turns = currentConversation()?.turns ?? []
    empty.hidden = turns.length > 0
    thread.replaceChildren()
    assistantNodes.clear()
    if (turns.length === 0) {
      thread.append(empty)
      return
    }
    for (const turn of turns) {
      const article = renderTurn(turn)
      if (turn.role === 'assistant') assistantNodes.set(turn.id, article)
      thread.append(article)
    }
    scrollToBottom()
  }

  function renderTurn(turn: ChatTurn): HTMLElement {
    const article = document.createElement('article')
    article.className = 'byok-turn'
    article.dataset.author = turn.role
    article.dataset.testid = `byok-turn-${turn.id}`

    const body = document.createElement('div')
    body.className = 'byok-body'
    body.dataset.testid = 'byok-body'
    body.textContent = turn.content

    if (turn.role === 'user') {
      article.append(body)
      return article
    }

    const actions = document.createElement('div')
    actions.className = 'byok-actions'
    const copy = document.createElement('button')
    copy.type = 'button'
    copy.className = 'byok-action'
    copy.setAttribute('aria-label', 'Copy response')
    copy.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
    copy.addEventListener('click', () => {
      void navigator.clipboard?.writeText(turn.content).catch(() => undefined)
    })
    actions.append(copy)
    if (turn.usage?.totalTokens) {
      const usage = document.createElement('span')
      usage.className = 'byok-usage'
      usage.textContent = `${turn.usage.totalTokens} tokens`
      actions.append(usage)
    }
    article.append(body, actions)
    if (turn.error) {
      const error = document.createElement('p')
      error.className = 'byok-turn-error'
      error.dataset.testid = 'byok-turn-error'
      error.textContent = turn.error
      article.append(error)
    }
    return article
  }

  /** Only follows when the reader is already at the bottom. */
  function scrollToBottom(): void {
    const scroller = thread.closest<HTMLElement>('.wb-thread') ?? thread
    const distance =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
    if (distance < 120) scroller.scrollTop = scroller.scrollHeight
  }

  /* ------------------------------------------------------------------ send */

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

  function showError(message: string, canRetry: boolean): void {
    errorLine.hidden = false
    errorText.textContent = message
    retry.hidden = !canRetry
  }

  function clearError(): void {
    errorLine.hidden = true
    retry.hidden = true
  }

  async function submit(): Promise<void> {
    const text = input.value.trim()
    if (!text || controller) return
    const profile = providerFor(currentConversation())
    if (!profile) {
      showError('Add and activate a provider in Settings first.', false)
      return
    }
    const apiKey = await resolveKey()
    if (!apiKey) {
      showError(
        vault.getState().status === 'unlocked'
          ? 'This provider has no saved key. Add one in Settings.'
          : 'Unlock the vault to use the saved key.',
        false,
      )
      return
    }

    clearError()
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
    renderThread()
    renderHeader()
    await conversationStore.save(active)

    const node = assistantNodes
      .get(assistantTurn.id)
      ?.querySelector<HTMLElement>('[data-testid="byok-body"]')

    controller = new AbortController()
    send.hidden = true
    stop.hidden = false
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
        showError('The answer was cut off at the token limit.', false)
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
      if (node && !assistantTurn.content) node.textContent = ''
      showError(message, !aborted && Boolean(lastFailedPrompt))
    } finally {
      controller = undefined
      send.hidden = false
      stop.hidden = true
      renderThread()
      await conversationStore.save(active)
    }
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
    clearError()
    // Re-enter the prompt through the composer so `submit` is the single path
    // that records turns, aborts and streams.
    input.value = prompt
    autoGrow()
    void submit()
  })

  /* ------------------------------------------------------------ lifecycle */

  const knownTitles = new Map<string, string>()

  function syncConversation(): void {
    conversation = conversationStore.active()
    if (conversation) knownTitles.set(conversation.id, conversation.title)
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

  options.onModeChange(options.mode)
  renderHeader()
  renderThread()

  return () => {
    controller?.abort()
    unsubscribeConversations()
    unsubscribeProviders()
    options.host.replaceChildren()
    options.composerHost.replaceChildren()
  }
}
