/**
 * Conversation surface parts: `AiConversationList`, `AiMessageTimeline`,
 * `AiMessage`, `AiCitationList`, `AiArtifactList` / `AiArtifactPreview`
 * (AI2-208, AI2-210).
 *
 * The timeline follows the WAI-ARIA feed pattern: each message is an
 * `article` with position info, PageDown / PageUp move between messages,
 * and a single polite live region summarises streaming instead of reading
 * every token.
 */

import type {
  ArtifactPreviewState,
  BranchInfo,
  Citation,
  Conversation,
  ConversationController,
  EntityId,
  Message,
  TimelineController,
  TimelineViewState,
} from '@zeus-web/ai-core'
import type { AiLocale } from './locale'
import type { IdScope, PartProps } from './parts'

import { partsToPlainText } from './content'
import { EN_LOCALE } from './locale'
import { ariaBool, part } from './parts'

export function getConversationListParts(
  conversations: readonly Conversation[],
  selectedId: EntityId | undefined,
  onSelect: (id: EntityId) => void,
  options: { locale?: AiLocale } = {},
): { root: PartProps; items: PartProps[] } {
  const locale = options.locale ?? EN_LOCALE
  return {
    root: part({ role: 'list', 'aria-label': locale.conversationListLabel }),
    items: conversations.map(conversation =>
      part(
        {
          type: 'button',
          'aria-current': conversation.id === selectedId ? 'page' : undefined,
          'data-selected': conversation.id === selectedId ? '' : undefined,
        },
        { click: () => onSelect(conversation.id) },
        conversation.title,
      ),
    ),
  }
}

export interface TimelineParts {
  root: PartProps
  item: (messageId: EntityId, index: number) => PartProps
  jumpToLatest?: PartProps
  /** Polite live region; render once per timeline. */
  live: PartProps
}

/** Message id focus should move to for a feed navigation key. */
export function feedTarget(
  itemIds: readonly EntityId[],
  currentId: EntityId | undefined,
  key: string | undefined,
): EntityId | undefined {
  const index = currentId === undefined ? -1 : itemIds.indexOf(currentId)
  switch (key) {
    case 'PageDown':
      return itemIds[Math.min(itemIds.length - 1, index + 1)]
    case 'PageUp':
      return itemIds[Math.max(0, index - 1)]
    case 'Home':
      return itemIds[0]
    case 'End':
      return itemIds[itemIds.length - 1]
    default:
      return undefined
  }
}

export function getTimelineParts(
  view: Readonly<TimelineViewState>,
  controller: Pick<TimelineController, 'jumpToLatest'>,
  options: {
    ids: IdScope
    label: string
    busy: boolean
    /** Status sentence for screen readers, e.g. from `StreamingTextController`. */
    announcement: string
    onFocusItem?: (messageId: EntityId) => void
    locale?: AiLocale
  },
): TimelineParts {
  const locale = options.locale ?? EN_LOCALE
  const total = view.itemIds.length

  return {
    root: part({
      role: 'feed',
      'aria-label': options.label,
      'aria-busy': ariaBool(options.busy),
      'data-following': view.following ? '' : undefined,
    }),
    item: (messageId, index) =>
      part(
        {
          id: options.ids.id(`message-${messageId}`),
          role: 'article',
          tabindex: 0,
          'aria-posinset': index + 1,
          'aria-setsize': total,
          'data-message-id': messageId,
        },
        {
          keydown: event => {
            const target = feedTarget(view.itemIds, messageId, event.key)
            if (target && target !== messageId) {
              event.preventDefault()
              options.onFocusItem?.(target)
            }
          },
        },
      ),
    jumpToLatest: view.showJumpToLatest
      ? part(
          {
            type: 'button',
            'aria-label': locale.jumpToLatest(view.unreadCount),
          },
          { click: () => controller.jumpToLatest() },
          locale.jumpToLatest(view.unreadCount),
        )
      : undefined,
    live: part(
      { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
      undefined,
      options.announcement,
    ),
  }
}

export interface MessageParts {
  root: PartProps
  author: PartProps
  copy: PartProps
  regenerate?: PartProps
  edit?: PartProps
  branch?: { previous: PartProps; position: PartProps; next: PartProps }
}

export interface MessagePartsOptions {
  ids: IdScope
  locale?: AiLocale
  branch?: BranchInfo
  conversation?: Pick<ConversationController, 'selectSibling' | 'retry'>
  /** Write text to the clipboard; adapters pass `navigator.clipboard`. */
  copy: (text: string) => void
  /** Prefill the composer with this message for editing. */
  onEdit?: (message: Message) => void
}

export function getMessageParts(
  message: Message,
  options: MessagePartsOptions,
): MessageParts {
  const locale = options.locale ?? EN_LOCALE
  const authorId = options.ids.id(`author-${message.id}`)
  const branch = options.branch

  return {
    root: part({
      'aria-labelledby': authorId,
      'data-author': message.author,
      'data-status': message.status,
      'aria-busy': ariaBool(
        message.status === 'streaming' || message.status === 'pending',
      ),
    }),
    author: part(
      { id: authorId },
      undefined,
      locale.messageFrom(message.author),
    ),
    copy: part(
      { type: 'button', 'aria-label': locale.copy },
      { click: () => options.copy(partsToPlainText(message.parts)) },
      locale.copy,
    ),
    regenerate:
      message.author === 'assistant' && options.conversation
        ? part(
            { type: 'button', 'aria-label': locale.regenerate },
            {
              click: () =>
                void options.conversation?.retry(message.id).catch(() => {}),
            },
            locale.regenerate,
          )
        : undefined,
    edit:
      message.author === 'user' && options.onEdit
        ? part(
            { type: 'button', 'aria-label': locale.edit },
            { click: () => options.onEdit?.(message) },
            locale.edit,
          )
        : undefined,
    branch:
      branch && options.conversation
        ? {
            previous: part(
              {
                type: 'button',
                'aria-label': locale.previousBranch,
                disabled: branch.index === 0,
              },
              {
                click: () =>
                  options.conversation?.selectSibling(message.id, 'previous'),
              },
              '‹',
            ),
            position: part(
              { 'aria-live': 'polite' },
              undefined,
              locale.branchPosition(branch.index, branch.siblingIds.length),
            ),
            next: part(
              {
                type: 'button',
                'aria-label': locale.nextBranch,
                disabled: branch.index === branch.siblingIds.length - 1,
              },
              {
                click: () =>
                  options.conversation?.selectSibling(message.id, 'next'),
              },
              '›',
            ),
          }
        : undefined,
  }
}

export function getCitationListParts(
  citations: readonly Citation[],
  options: { locale?: AiLocale } = {},
): {
  root: PartProps
  items: { item: PartProps; link?: PartProps; label: PartProps }[]
} {
  const locale = options.locale ?? EN_LOCALE
  return {
    root: part({ role: 'list', 'aria-label': locale.citationsLabel }),
    items: citations.map(citation => ({
      item: part({
        role: 'listitem',
        'data-missing': citation.missing ? '' : undefined,
      }),
      link: citation.url
        ? part(
            // External links never get the opener or the referrer.
            {
              href: citation.url,
              target: '_blank',
              rel: 'noopener noreferrer nofollow',
            },
            undefined,
            citation.label,
          )
        : undefined,
      label: part(
        { title: citation.missing ? locale.sourceUnavailable : undefined },
        undefined,
        citation.label,
      ),
    })),
  }
}

export function getArtifactListParts(
  artifactIds: readonly EntityId[],
  titles: (id: EntityId) => string,
  selectedId: EntityId | undefined,
  onSelect: (id: EntityId) => void,
  options: { ids: IdScope; locale?: AiLocale },
): { root: PartProps; items: PartProps[] } {
  const locale = options.locale ?? EN_LOCALE
  return {
    root: part({ role: 'listbox', 'aria-label': locale.artifactsLabel }),
    items: artifactIds.map(id =>
      part(
        {
          id: options.ids.id(`artifact-${id}`),
          role: 'option',
          tabindex: id === selectedId ? 0 : -1,
          'aria-selected': ariaBool(id === selectedId),
        },
        {
          click: () => onSelect(id),
          keydown: event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(id)
            }
          },
        },
        titles(id),
      ),
    ),
  }
}

export function getArtifactPreviewParts(
  preview: ArtifactPreviewState | undefined,
  options: { locale?: AiLocale } = {},
): { root: PartProps; message?: PartProps } {
  const locale = options.locale ?? EN_LOCALE
  const message =
    preview?.status === 'blocked'
      ? locale.previewBlocked
      : preview?.status === 'loading'
        ? locale.previewLoading
        : preview?.status === 'error'
          ? locale.previewFailed
          : undefined

  return {
    root: part({
      role: 'region',
      'aria-busy': ariaBool(preview?.status === 'loading'),
      'data-kind': preview?.kind,
      'data-status': preview?.status,
    }),
    message: message
      ? part(
          { role: preview?.status === 'error' ? 'alert' : 'status' },
          undefined,
          message,
        )
      : undefined,
  }
}
