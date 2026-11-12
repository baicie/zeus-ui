/* eslint-disable no-restricted-globals */
/**
 * BYOK chat view — the user's own OpenAI-compatible gateway, in the same
 * ChatGPT-style surface as the Host chat.
 *
 * What this view owns:
 * - the centred 768px thread, with the user's message as a right-aligned bubble
 *   and the assistant's reply as plain document text (as ChatGPT reads)
 * - the composer *element* (the shell docks it; see `composer-dock.ts`)
 * - streaming into a single text node per turn, so a long answer does not
 *   rebuild the message list on every chunk
 * - inline errors with a retry action
 *
 * What it does not own: the shell, the sidebar, settings, or where the composer
 * is shown. Those belong to `main.ts`, and the two chat modes share them.
 *
 * Conversation switching is explicit: every conversation this view shows gets
 * a token, and a stream that finishes after the reader moved on is dropped
 * instead of being written into whatever is on screen now.
 */

import type { ViewNode } from '@zeus-web/ai-primitives'
import type { CopyScope } from '../copy'
import type { ChatTurn, LocalConversation } from './conversations'
import type { ChatMessage } from './gateway'
import { contentBlockView, parseMarkdown } from '@zeus-web/ai-primitives'
import { patchChildren } from '@zeus-web/ai-wc'
import { createCopy, refreshOnLanguageChange } from '../copy'
import { getAiLocale, t } from '../locale'
import { conversationStore, createConversation } from './conversations'
import { GatewayError, sendChat } from './gateway'
import { keyRecordId, providerStore } from './profiles'
import { vault } from './vault'

export interface ByokChatOptions {
  /** Element the thread mounts into (inside the shell's scroll column). */
  readonly host: HTMLElement
  /**
   * Where this view's composer element is created. The shell decides where it
   * is *shown*; this view owns the element itself.
   */
  readonly composerHost: HTMLElement
  /** Reports the active provider/model so the topbar picker can show it. */
  readonly onTitle?: (title: string) => void
  /** The shell's conversation list; a UUID is unreadable in the sidebar. */
  readonly onTitleChange?: (title: string) => void
  /** A conversation was created, opened or renamed; the sidebar must redraw. */
  readonly onConversationsChange?: () => void
}

export interface ByokChatActions {
  /** Starts an empty conversation and shows it. */
  readonly newConversation: () => void
  /** Shows an existing conversation by id. */
  readonly openConversation: (id: string) => void
  readonly activeConversationId: () => string | undefined
  /** Focuses this view's composer. */
  readonly focus: () => void
  /** Titles of the stored conversations, newest first. */
  readonly conversations: () => readonly { id: string; title: string }[]
}

export interface ByokChatView {
  /** Removes the thread, the composer and every subscription. Idempotent. */
  readonly dispose: () => void
  /** The composer element; the shell's dock decides where it is shown. */
  readonly composer: HTMLElement
  readonly actions: ByokChatActions
}

export function mountByokChat(options: ByokChatOptions): ByokChatView {
  // One copy scope for the panel; the language subscription below re-runs it
  // without touching the conversation, the streaming turn or the composer.
  const copy: CopyScope = createCopy()
  const stopCopy = refreshOnLanguageChange(copy)

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
  copy.node(emptyTitle, 'byok.emptyTitle')
  const emptyCopy = document.createElement('p')
  emptyCopy.className = 'byok-empty-copy'
  copy.node(emptyCopy, 'byok.emptyCopy')
  const emptyAction = document.createElement('button')
  emptyAction.type = 'button'
  emptyAction.className = 'byok-link'
  emptyAction.dataset.testid = 'byok-open-settings'
  copy.node(emptyAction, 'byok.openSettings')
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
  copy.node(retry, 'byok.retry')
  retry.hidden = true
  const errorDismiss = document.createElement('button')
  errorDismiss.type = 'button'
  copy.node(errorDismiss, 'byok.dismiss')
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
  input.dataset.testid = 'byok-input'
  copy.attr(input, 'placeholder', 'workbench.composerPlaceholder')
  copy.attr(input, 'aria-label', 'byok.messageLabel')

  const plus = document.createElement('button')
  plus.type = 'button'
  plus.className = 'byok-plus'
  copy.attr(plus, 'aria-label', 'byok.addFiles')
  plus.disabled = true
  copy.attr(plus, 'title', 'byok.attachmentsUnsupported')
  plus.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'

  const send = document.createElement('button')
  send.type = 'submit'
  send.className = 'byok-send'
  send.dataset.testid = 'byok-send'
  copy.attr(send, 'aria-label', 'byok.send')
  send.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>'

  const stop = document.createElement('button')
  stop.type = 'button'
  stop.className = 'byok-send is-stop'
  stop.dataset.testid = 'byok-stop'
  copy.attr(stop, 'aria-label', 'byok.stop')
  stop.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
  stop.hidden = true

  composer.append(plus, input, send, stop)

  const hint = document.createElement('p')
  hint.className = 'byok-hint'
  copy.node(hint, 'byok.hint')

  composerStack.append(errorLine, composer, hint)
  options.composerHost.append(composerStack)

  /* ----------------------------------------------------------------- state */

  let conversation: LocalConversation | undefined
  let controller: AbortController | undefined
  let lastFailedPrompt: string | undefined
  /**
   * Set synchronously on submit. `controller` is only created after the key is
   * resolved, so without this a second Enter during that await would start a
   * second request for the same draft.
   */
  let busy = false
  const assistantNodes = new Map<string, HTMLElement>()
  /**
   * Bumped for every conversation this view is asked to show. A stream that
   * finishes after the reader moved on compares its own token and writes
   * nothing, so a late reply can never land in another conversation's DOM.
   */
  let conversationToken = 0

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
    // Provider names and model ids are data: never translated. Only the
    // fallback words around them come from the catalog.
    options.onTitle?.(
      provider
        ? `${provider.name || t('byok.providerFallback')} · ${provider.model || t('byok.noModel')}`
        : t('byok.noProviderConfigured'),
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
    // While a turn is streaming, the text is written straight into this node
    // (see `submit`), so it stays plain text. Once it is finished, the same
    // markdown renderer the Host timeline uses formats it, including fenced
    // code blocks — the reference's answers are markdown, not pre-wrap text.
    const streaming =
      turn.role === 'assistant' &&
      turn.content.length > 0 &&
      article.dataset.streaming === 'true'
    if (turn.role === 'user' || streaming) {
      body.textContent = turn.content
    } else {
      renderMarkdownInto(body, turn.content)
    }

    if (turn.role === 'user') {
      article.append(body)
      return article
    }

    const actions = document.createElement('div')
    actions.className = 'byok-actions'
    const copyButton = document.createElement('button')
    copyButton.type = 'button'
    copyButton.className = 'byok-action'
    // The label is bound to the turn: it follows the language without
    // re-rendering the turn (which would drop the streamed text node).
    copy.attr(copyButton, 'aria-label', 'byok.copyResponse')
    copyButton.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
    copyButton.addEventListener('click', () => {
      void navigator.clipboard?.writeText(turn.content).catch(() => undefined)
    })
    actions.append(copyButton)
    if (turn.usage?.totalTokens) {
      const usage = document.createElement('span')
      usage.className = 'byok-usage'
      copy.node(usage, 'byok.tokens', () => ({
        count: turn.usage?.totalTokens ?? 0,
      }))
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

  /**
   * Renders markdown through the shared primitives so the BYOK surface and the
   * Host timeline read the same, and code blocks get the same markup.
   */
  function renderMarkdownInto(target: HTMLElement, source: string): void {
    if (source.length === 0) return
    const blocks = parseMarkdown(source)
    const nodes: ViewNode[] = blocks.map((_, index) =>
      contentBlockView(
        { kind: 'markdown', partId: `byok-${index}`, blocks: [blocks[index]!] },
        { locale: getAiLocale() },
      ),
    )
    patchChildren(target, nodes)
  }

  /** Only follows when the reader is already at the bottom. */
  function scrollToBottom(): void {
    const scroller = thread.closest<HTMLElement>('.wb-thread') ?? thread
    const distance =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
    if (distance < 120) scroller.scrollTop = scroller.scrollHeight
  }

  /* ------------------------------------------------------------ switching */

  /**
   * Shows one conversation. The token bump is what makes a stream from the
   * previous conversation harmless: it still finishes, and the caller saves
   * its own turns, but it no longer writes into this view.
   */
  function syncConversation(): void {
    // A conversation switch ends any answer in flight. Leaving the request
    // running would bill tokens for an answer nobody will read, and its
    // stream would be the one racing the new conversation's DOM.
    controller?.abort()
    conversationToken += 1
    conversation = conversationStore.active()
    if (conversation) {
      lastFailedPrompt = undefined
      clearError()
    }
    renderHeader()
    renderThread()
    options.onTitleChange?.(conversation?.title ?? '')
  }

  function newConversation(): LocalConversation {
    const profile = providerStore.active()
    const next = createConversation(
      profile?.id ?? '',
      profile?.model ?? '',
      t('workbench.newChat'),
    )
    conversationStore.add(next)
    void conversationStore.save(next)
    syncConversation()
    // A new chat starts from an empty composer, as the reference does; the
    // previous conversation's draft was never sent and must not leak here.
    input.value = ''
    autoGrow()
    options.onConversationsChange?.()
    return next
  }

  function openConversation(id: string): void {
    if (conversationStore.open(id)) {
      syncConversation()
      options.onConversationsChange?.()
    }
  }

  function ensureConversation(): LocalConversation {
    if (conversation) return conversation
    const next = newConversation()
    return next
  }

  /* ------------------------------------------------------------------ send */

  async function resolveKey(): Promise<string | undefined> {
    const profile = providerFor(currentConversation())
    if (!profile) return undefined
    if (vault.getState().status !== 'unlocked') return undefined
    return vault.get(keyRecordId(profile.id)).catch(() => undefined)
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
    if (!text || busy) return
    // Take the draft synchronously: the user must never be able to press
    // Enter again while this request is starting and get a second one.
    busy = true
    try {
      const profile = providerFor(currentConversation())
      if (!profile) {
        showError(t('byok.addProviderFirst'), false)
        return
      }
      const apiKey = await resolveKey()
      if (!apiKey) {
        showError(
          vault.getState().status === 'unlocked'
            ? t('byok.noSavedKey')
            : t('byok.unlockToUseKey'),
          false,
        )
        return
      }

      clearError()
      const active = ensureConversation()
      const token = conversationToken
      if (active.turns.length === 0) {
        active.title = text.slice(0, 48)
        options.onTitleChange?.(active.title)
        options.onConversationsChange?.()
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

      const article = assistantNodes.get(assistantTurn.id)
      if (article) article.dataset.streaming = 'true'
      const node = article?.querySelector<HTMLElement>(
        '[data-testid="byok-body"]',
      )

      /*
       * Reasoning models answer slowly and, before the first token of the
       * answer, stream only `delta.reasoning_content`. Without a visible
       * thinking state those seconds look exactly like a hung page — which is
       * one of the ways this demo stopped feeling like a real chat. The
       * placeholder is replaced by the first content delta and is never part
       * of the saved answer.
       */
      const thinking = (): void => {
        if (token !== conversationToken || !node) return
        if (assistantTurn.content.length > 0) return
        node.classList.add('is-thinking')
        node.textContent = t('byok.thinking')
      }

      const owned = new AbortController()
      controller = owned
      send.hidden = true
      stop.hidden = false
      thinking()
      try {
        const history: ChatMessage[] = active.turns
          .filter(turn => !turn.error && turn.content.length > 0)
          .map(turn => ({ role: turn.role, content: turn.content }))
        const result = await sendChat(profile, apiKey, history, owned.signal, {
          // Write straight into the text node; re-rendering the list on
          // every chunk would rebuild every message and lose scroll.
          onText: accumulated => {
            assistantTurn.content = accumulated
            if (token === conversationToken && node) {
              node.classList.remove('is-thinking')
              node.textContent = accumulated
              scrollToBottom()
            }
          },
          onReasoning: () => {
            // The reasoning text itself is not part of the answer; only its
            // arrival matters here.
            thinking()
          },
          onUsage: usage => {
            assistantTurn.usage = usage
          },
        })
        assistantTurn.content = result.text
        if (result.usage) assistantTurn.usage = result.usage
        if (token === conversationToken && node) {
          node.textContent = result.text
        }
        if (result.finishReason === 'aborted') {
          // A cancelled stream resolves normally with what arrived so far, so
          // the catch below never sees a Stop. Without this the turn looked
          // exactly like a finished answer.
          assistantTurn.error = t('byok.stoppedBeforeFinished')
        } else if (result.finishReason === 'length') {
          showError(t('byok.truncated'), false)
        }
      } catch (cause) {
        const aborted =
          (cause instanceof Error && cause.name === 'AbortError') ||
          owned.signal.aborted
        const message =
          cause instanceof GatewayError
            ? cause.hint
              ? `${cause.message} ${cause.hint}`
              : cause.message
            : aborted
              ? t('byok.stopped')
              : String(cause)
        // Mark the turn whether or not text had arrived: a Stop that leaves
        // no trace reads as "nothing happened", even though the request was
        // really cancelled.
        assistantTurn.error = aborted
          ? t('byok.stoppedBeforeFinished')
          : message
        if (!aborted) lastFailedPrompt = text
        if (token === conversationToken && node && !assistantTurn.content) {
          node.textContent = ''
        }
        if (token === conversationToken) {
          showError(message, !aborted && Boolean(lastFailedPrompt))
        }
      } finally {
        if (article) delete article.dataset.streaming
        node?.classList.remove('is-thinking')
        if (controller === owned) {
          controller = undefined
          send.hidden = false
          stop.hidden = true
        }
        if (token === conversationToken) renderThread()
        await conversationStore.save(active)
      }
    } finally {
      busy = false
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

  const unsubscribeConversations = conversationStore.subscribe(() => {
    // A store notification is not always a switch: a save from this view also
    // fires it. Only follow when the active id actually changed.
    if (conversationStore.activeIdValue() !== conversation?.id) {
      syncConversation()
    }
  })

  const unsubscribeProviders = providerStore.subscribe(() => {
    renderHeader()
  })

  void conversationStore.load().then(() => {
    conversation = conversationStore.active()
    if (!conversation) newConversation()
    else syncConversation()
  })
  void providerStore.load()

  renderHeader()
  renderThread()

  let disposed = false
  return {
    composer: composerStack,
    actions: {
      newConversation,
      openConversation,
      activeConversationId: () => conversation?.id,
      focus: () => input.focus(),
      conversations: () =>
        conversationStore.list().map(item => ({
          id: item.id,
          title: item.title,
        })),
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      stopCopy()
      copy.dispose()
      controller?.abort()
      unsubscribeConversations()
      unsubscribeProviders()
      // Remove only what this view created. The shell owns `options.host`
      // and the dock; emptying the dock here is what let a teardown delete
      // the other mode's composer.
      root.remove()
      composerStack.remove()
    },
  }
}
