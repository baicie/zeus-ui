/**
 * Conversation controller (AI2-203).
 *
 * Messages form a tree through `parentMessageId`. The controller projects the
 * visible branch — one path from a root to a leaf — and lets the user switch
 * between siblings without touching canonical state:
 *
 * - editing an old message asks the host for a *sibling* (`message.edit`);
 *   the original branch stays intact;
 * - retrying asks the host for a new execution (`execution.retry` with
 *   `retryOf`); the failed execution is never reopened in place;
 * - which sibling is shown is local view state. Without a local choice the
 *   host's `selectedLeafMessageId` decides, then the newest sibling.
 */

import type { EntityId, Message } from '../domain/types'
import type { CommandAck } from '../protocol/commands'
import type { AiState } from '../store/state'
import type { AiSession } from './session'
import type { Controller, IdGenerator } from './view-store'

import { createCommand } from '../protocol/commands'
import { createViewStore, defaultIdGenerator, sameItems } from './view-store'

export interface BranchInfo {
  /** All siblings sharing this message's parent, in host order. */
  siblingIds: readonly EntityId[]
  index: number
}

export interface ConversationViewState {
  conversationId: EntityId
  /** Visible path from root to leaf. */
  visibleMessageIds: readonly EntityId[]
  /** Branch position for every visible message that has siblings. */
  branches: Readonly<Record<EntityId, BranchInfo>>
  leafMessageId?: EntityId
}

export interface ConversationControllerOptions {
  session: Pick<AiSession, 'store' | 'execute'>
  conversationId: EntityId
  createId?: IdGenerator
}

export interface ConversationController extends Controller<ConversationViewState> {
  /** Show another sibling of `messageId`: a relative step or an index. */
  selectSibling: (messageId: EntityId, to: 'previous' | 'next' | number) => void
  /** Ask the host for an edited sibling of a user message. */
  edit: (messageId: EntityId, text: string) => Promise<CommandAck>
  /** Ask the host to regenerate an answer as a new execution. */
  retry: (messageId: EntityId) => Promise<CommandAck>
}

const ROOT = '\u0000root'

/** Children of each parent (or ROOT) in host order. */
function childrenIndex(messages: readonly Message[]): Map<string, EntityId[]> {
  const index = new Map<string, EntityId[]>()

  for (const message of messages) {
    const key = message.parentMessageId ?? ROOT
    const list = index.get(key)
    if (list) list.push(message.id)
    else index.set(key, [message.id])
  }

  return index
}

export function projectVisibleBranch(
  state: AiState,
  conversationId: EntityId,
  choices: ReadonlyMap<string, EntityId> = new Map(),
): Omit<ConversationViewState, 'conversationId'> {
  const ids = state.conversationMessageIds[conversationId] ?? []
  const messages = ids
    .map(id => state.messages.get(id))
    .filter((message): message is Message => message !== undefined)
  const children = childrenIndex(messages)

  // Path the host selected, so its ancestors are preferred by default.
  const preferred = new Set<EntityId>()
  let cursor = state.conversations.get(conversationId)?.selectedLeafMessageId
  while (cursor !== undefined) {
    preferred.add(cursor)
    cursor = state.messages.get(cursor)?.parentMessageId
  }

  const visible: EntityId[] = []
  const branches: Record<EntityId, BranchInfo> = {}
  let parent = ROOT

  for (;;) {
    const siblings = children.get(parent)
    if (!siblings || siblings.length === 0) break

    const local = choices.get(parent)
    const chosen =
      (local !== undefined && siblings.includes(local) ? local : undefined) ??
      siblings.find(id => preferred.has(id)) ??
      siblings[siblings.length - 1]

    visible.push(chosen)
    if (siblings.length > 1) {
      branches[chosen] = {
        siblingIds: siblings,
        index: siblings.indexOf(chosen),
      }
    }
    parent = chosen
  }

  return {
    visibleMessageIds: visible,
    branches,
    leafMessageId: visible[visible.length - 1],
  }
}

export function createConversationController(
  options: ConversationControllerOptions,
): ConversationController {
  const { store } = options.session
  const createId = options.createId ?? defaultIdGenerator
  const choices = new Map<string, EntityId>()

  function project(): ConversationViewState {
    return {
      conversationId: options.conversationId,
      ...projectVisibleBranch(
        store.getState(),
        options.conversationId,
        choices,
      ),
    }
  }

  const view = createViewStore<ConversationViewState>(project())

  function refresh(): void {
    const next = project()
    const current = view.getSnapshot()

    view.update({
      visibleMessageIds: sameItems(
        current.visibleMessageIds,
        next.visibleMessageIds,
      )
        ? current.visibleMessageIds
        : next.visibleMessageIds,
      branches:
        JSON.stringify(current.branches) === JSON.stringify(next.branches)
          ? current.branches
          : next.branches,
      leafMessageId: next.leafMessageId,
    })
  }

  // Only the conversation's index, its messages' tree links and the host
  // leaf affect the projection; token deltas do not.
  view.onDispose(
    store.subscribe(state => {
      const ids = state.conversationMessageIds[options.conversationId]
      return `${(ids ?? []).join(',')}|${(ids ?? [])
        .map(id => state.messages.get(id)?.parentMessageId ?? '')
        .join(
          ',',
        )}|${state.conversations.get(options.conversationId)?.selectedLeafMessageId ?? ''}`
    }, refresh),
  )

  function send(
    type: string,
    targetKind: string,
    targetId: EntityId,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<CommandAck> {
    return options.session.execute(
      createCommand({
        commandId: createId('cmd'),
        idempotencyKey,
        type,
        target: { kind: targetKind, id: targetId },
        payload,
      }),
    )
  }

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    selectSibling(messageId, to): void {
      const message = store.getState().messages.get(messageId)
      if (!message || message.conversationId !== options.conversationId) return

      const parent = message.parentMessageId ?? ROOT
      const siblings = (
        store.getState().conversationMessageIds[options.conversationId] ?? []
      ).filter(
        id =>
          (store.getState().messages.get(id)?.parentMessageId ?? ROOT) ===
          parent,
      )
      const index = siblings.indexOf(messageId)
      const target =
        to === 'previous' ? index - 1 : to === 'next' ? index + 1 : to

      if (target < 0 || target >= siblings.length) return

      choices.set(parent, siblings[target])
      refresh()
    },
    edit(messageId, text): Promise<CommandAck> {
      const message = store.getState().messages.get(messageId)

      if (!message || message.conversationId !== options.conversationId) {
        return Promise.resolve({
          accepted: false,
          commandId: '',
          code: 'AI_MESSAGE_UNKNOWN',
          message: `message ${messageId} is not in this conversation`,
        })
      }

      return send(
        'message.edit',
        'message',
        messageId,
        {
          conversationId: options.conversationId,
          parentMessageId: message.parentMessageId,
          text,
        },
        createId(`edit-${messageId}`),
      )
    },
    retry(messageId): Promise<CommandAck> {
      const message = store.getState().messages.get(messageId)

      if (!message || message.conversationId !== options.conversationId) {
        return Promise.resolve({
          accepted: false,
          commandId: '',
          code: 'AI_MESSAGE_UNKNOWN',
          message: `message ${messageId} is not in this conversation`,
        })
      }

      // The host starts a new execution; the old one keeps its history.
      return send(
        'execution.retry',
        'message',
        messageId,
        {
          conversationId: options.conversationId,
          retryOf: message.executionId,
          parentMessageId: message.parentMessageId,
        },
        createId(`retry-${messageId}`),
      )
    },
    dispose(): void {
      view.dispose()
    },
  }
}
