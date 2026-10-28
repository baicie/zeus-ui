/**
 * Conversation surface for React (AI2-501): `AiComposer`,
 * `AiMessageTimeline`, `AiMessage`, `AiMessageContent`, `AiCitationList`,
 * `AiArtifactPreview`, `AiConversationList`.
 */

import type {
  AiSession,
  AiState,
  ArtifactController,
  AssetRef,
  Citation,
  ComposerController,
  ContentPart,
  Conversation,
  ConversationController,
  EntityId,
  FollowMode,
  Message,
} from '@zeus-web/ai-core'
import type {
  AiLocale,
  ContentBlock,
  ContentRenderer,
  ContextPicker,
  RendererRegistry,
} from '@zeus-web/ai-primitives'
import type { ReactElement, ReactNode } from 'react'
import type { SlotRenderer } from './render'

import {
  classifyPreview,
  createStreamingText,
  createTimelineController,
} from '@zeus-web/ai-core'
import {
  artifactPreviewView,
  composerView,
  describePart,
  EN_LOCALE,
  getCitationListParts,
  getConversationListParts,
  getMessageParts,
  messageContentView,
  messageView,
  timelineView,
} from '@zeus-web/ai-primitives'
import {
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  defaultCopy,
  focusById,
  useAiSession,
  useAiState,
  useController,
  useIds,
  useOptionalController,
  useOwnedController,
} from './hooks'
import { renderView, toReactProps } from './render'

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

export interface AiComposerProps {
  controller: ComposerController
  label?: string
  locale?: AiLocale
  /** Optional @ / slash picker created with `createContextPicker`. */
  contextPicker?: ContextPicker
  /** Extra controls next to the send button (attach, model, voice…). */
  toolbar?: ReactNode
  disabled?: boolean
}

export function AiComposer(props: AiComposerProps): ReactElement {
  const ids = useIds()
  const view = useController(props.controller)
  const picker = props.contextPicker
  const menuView = useOptionalController(picker?.combobox, value => value)

  const node = composerView(view, props.controller, {
    ids,
    locale: props.locale,
    label: props.label,
    disabled: props.disabled,
    menu:
      picker && menuView
        ? { view: menuView, controller: picker.combobox }
        : undefined,
    afterInput: picker ? () => picker.sync() : undefined,
  })

  return renderView(node, {
    slots: { toolbar: () => props.toolbar ?? null },
  }) as ReactElement
}

// ---------------------------------------------------------------------------
// Message content
// ---------------------------------------------------------------------------

const blockCache = new WeakMap<ContentPart, ContentBlock>()

function blockOf(part: ContentPart): ContentBlock {
  let block = blockCache.get(part)
  if (!block) {
    block = describePart(part)
    blockCache.set(part, block)
  }
  return block
}

export interface AiAssetImageProps {
  session?: AiSession
  asset: AssetRef
  alt: string
}

/** Loads a host-authorized raster/SVG image as a blob URL (never as markup). */
export function AiAssetImage(props: AiAssetImageProps): ReactElement {
  const session = useAiSession(props.session)
  const [url, setUrl] = useState<string>()
  const allowed =
    classifyPreview(props.asset.mimeType) === 'image' ||
    props.asset.mimeType === 'image/svg+xml'

  useEffect(() => {
    if (!allowed || typeof URL === 'undefined' || !URL.createObjectURL) return
    let revoked = false
    let objectUrl: string | undefined

    session.host
      .loadAsset(props.asset)
      .then(content => new Response(content as BodyInit).blob())
      .then(blob => {
        if (revoked) return
        objectUrl = URL.createObjectURL(
          new Blob([blob], { type: props.asset.mimeType }),
        )
        setUrl(objectUrl)
      })
      .catch(() => {})

    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [allowed, props.asset, session])

  return url
    ? createElement('img', { src: url, alt: props.alt })
    : createElement(
        'span',
        { role: 'img', 'aria-label': props.alt || props.asset.mimeType },
        props.alt,
      )
}

export interface AiMessageContentProps {
  session?: AiSession
  message: Message
  renderers?: RendererRegistry<ReactNode>
  allowRemoteImages?: boolean
  copy?: (text: string) => void
  locale?: AiLocale
}

export function AiMessageContent(props: AiMessageContentProps): ReactElement {
  const session = useAiSession(props.session)
  const blocks = props.message.parts.map(blockOf)
  const byPart = new Map(props.message.parts.map(part => [part.id, part]))
  const node = messageContentView(blocks, {
    allowRemoteImages: props.allowRemoteImages,
    copy: props.copy ?? defaultCopy,
    locale: props.locale,
  })

  return renderView(node, {
    slots: {
      'content-block': (data, fallback) => {
        const block = data as ContentBlock
        const part = byPart.get(block.partId)
        const renderer: ContentRenderer<ReactNode> | undefined =
          part && props.renderers?.resolve(part, block)
        if (!part || !renderer) return fallback
        try {
          return renderer.render({
            part,
            block,
            resolveAsset: asset => session.host.loadAsset(asset),
            capability: new Set(),
          })
        } catch {
          // A failing renderer degrades to the safe default.
          return fallback
        }
      },
      'asset-image': data => {
        const block = data as Extract<ContentBlock, { kind: 'image' }>
        return createElement(AiAssetImage, {
          session,
          asset: block.asset,
          alt: block.alt,
        })
      },
    },
  }) as ReactElement
}

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

export interface AiMessageProps {
  messageId: EntityId
  session?: AiSession
  conversation?: ConversationController
  onEdit?: (message: Message) => void
  renderers?: RendererRegistry<ReactNode>
  /** Extra per-message actions. */
  actions?: (message: Message) => ReactNode
  allowRemoteImages?: boolean
  copy?: (text: string) => void
  locale?: AiLocale
}

export function AiMessage(props: AiMessageProps): ReactElement | null {
  const session = useAiSession(props.session)
  const ids = useIds()
  // Re-render at most once per frame while streaming; final flush is sync.
  const streaming = useOwnedController(
    () =>
      createStreamingText({ store: session.store, messageId: props.messageId }),
    [session.store, props.messageId],
  )
  useController(streaming, view => view.revision)
  useController(streaming, view => view.status)
  const conversation = props.conversation
  const branch = useOptionalController(
    conversation,
    view => view.branches[props.messageId],
  )
  const message = session.store.getState().messages.get(props.messageId)

  if (!message) return null

  const copy = props.copy ?? defaultCopy
  const parts = getMessageParts(message, {
    ids,
    locale: props.locale,
    branch,
    conversation,
    copy,
    onEdit: props.onEdit,
  })
  const content = createElement(AiMessageContent, {
    session,
    message,
    renderers: props.renderers,
    allowRemoteImages: props.allowRemoteImages,
    copy,
    locale: props.locale,
  })

  return renderView(messageView(parts, { type: 'slot', name: 'content' }), {
    slots: {
      content: () => content,
      'message-actions': () => props.actions?.(message) ?? null,
    },
  }) as ReactElement
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface AiMessageTimelineProps {
  conversation: ConversationController
  session?: AiSession
  follow?: FollowMode
  label?: string
  locale?: AiLocale
  /** Render a message natively; defaults to `<AiMessage>`. */
  renderMessage?: (messageId: EntityId) => ReactNode
  messageProps?: Omit<AiMessageProps, 'messageId' | 'session' | 'conversation'>
}

function readMetrics(scroller: HTMLElement) {
  return {
    scrollTop: scroller.scrollTop,
    viewportHeight: scroller.clientHeight,
    contentHeight: scroller.scrollHeight,
  }
}

export function AiMessageTimeline(props: AiMessageTimelineProps): ReactElement {
  const session = useAiSession(props.session)
  const ids = useIds()
  const locale = props.locale ?? EN_LOCALE
  const timeline = useOwnedController(
    () => createTimelineController({ follow: props.follow, virtualize: {} }),
    [props.follow],
  )
  const view = useController(timeline)
  const visible = useController(
    props.conversation,
    value => value.visibleMessageIds,
  )
  const selectBusy = (state: AiState) =>
    visible.some(id => {
      const status = state.messages.get(id)?.status
      return status === 'streaming' || status === 'pending'
    })
  const busy = useAiState(session.store, selectBusy)
  const scrollerRef = useRef<HTMLElement>(null)
  const programmatic = useRef(false)

  useEffect(() => {
    timeline.setItems(visible)
  }, [timeline, visible])

  const correct = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const origin = scroller.getBoundingClientRect().top - scroller.scrollTop
    const layouts = new Map<string, { top: number; height: number }>()
    for (const item of Array.from(
      scroller.querySelectorAll<HTMLElement>('[data-message-id]'),
    )) {
      const rect = item.getBoundingClientRect()
      layouts.set(item.dataset.messageId as string, {
        top: rect.top - origin,
        height: rect.height,
      })
    }
    timeline.setLayout(layouts)
    const target = timeline.scrollCorrection(readMetrics(scroller))
    if (target !== undefined) {
      programmatic.current = true
      scroller.scrollTop = target
    }
  }, [timeline])

  useLayoutEffect(correct)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return undefined

    const onScroll = (): void => {
      timeline.onScroll(readMetrics(scroller), !programmatic.current)
      programmatic.current = false
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })

    // Streaming text and images change heights without a timeline render.
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => correct())
        : undefined
    observer?.observe(scroller)
    for (const child of Array.from(scroller.children)) observer?.observe(child)

    return () => {
      scroller.removeEventListener('scroll', onScroll)
      observer?.disconnect()
    }
  }, [timeline, correct, visible])

  const node = timelineView(view, timeline, {
    ids,
    label: props.label ?? locale.conversationListLabel,
    busy,
    announcement: busy ? 'Generating response' : '',
    locale,
    onFocusItem: id => {
      focusById(ids.id(`message-${id}`))
    },
  })

  const renderMessage: SlotRenderer = data => {
    const { messageId } = data as { messageId: EntityId }
    return props.renderMessage
      ? props.renderMessage(messageId)
      : createElement(AiMessage, {
          ...props.messageProps,
          messageId,
          session,
          conversation: props.conversation,
        })
  }

  return renderView(node, {
    slots: { message: renderMessage },
    refs: { scroller: scrollerRef },
  }) as ReactElement
}

// ---------------------------------------------------------------------------
// Citations, artifacts, conversations
// ---------------------------------------------------------------------------

export function AiCitationList(props: {
  citations: readonly Citation[]
  locale?: AiLocale
}): ReactElement {
  const parts = getCitationListParts(props.citations, { locale: props.locale })
  return createElement(
    'ul',
    toReactProps(parts.root),
    parts.items.map((entry, index) =>
      createElement(
        'li',
        { ...toReactProps(entry.item), key: props.citations[index].partId },
        entry.link
          ? createElement('a', toReactProps(entry.link), entry.link.text)
          : createElement('span', toReactProps(entry.label), entry.label.text),
      ),
    ),
  )
}

export interface AiArtifactPreviewProps {
  controller: ArtifactController
  session?: AiSession
  /** Allow HTML previews inside a script-less sandboxed iframe. */
  sandbox?: boolean
  locale?: AiLocale
}

export function AiArtifactPreview(props: AiArtifactPreviewProps): ReactElement {
  const session = useAiSession(props.session)
  const preview = useController(props.controller, view => view.preview)
  const [url, setUrl] = useState<string>()
  const bytes = preview?.status === 'ready' ? preview.bytes : undefined
  const mime = preview?.artifactId
    ? session.store.getState().artifacts.get(preview.artifactId)?.asset.mimeType
    : undefined

  useEffect(() => {
    if (
      !bytes ||
      !mime ||
      mime === 'text/html' ||
      typeof URL === 'undefined' ||
      !URL.createObjectURL
    ) {
      return
    }
    const objectUrl = URL.createObjectURL(
      new Blob([bytes as BlobPart], { type: mime }),
    )
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [bytes, mime])

  return renderView(artifactPreviewView(preview, { locale: props.locale }), {
    slots: {
      'artifact-binary': () => {
        if (mime === 'text/html' && props.sandbox && bytes) {
          // No allow-scripts, no allow-same-origin: the document is inert.
          return createElement('iframe', {
            sandbox: '',
            srcDoc: new TextDecoder().decode(bytes),
            title: 'Artifact preview',
            referrerPolicy: 'no-referrer',
          })
        }
        return url ? createElement('img', { src: url, alt: '' }) : null
      },
    },
  }) as ReactElement
}

export interface AiConversationListProps {
  conversations: readonly Conversation[]
  selectedId?: EntityId
  onSelect: (conversationId: EntityId) => void
  locale?: AiLocale
}

export function AiConversationList(
  props: AiConversationListProps,
): ReactElement {
  const parts = getConversationListParts(
    props.conversations,
    props.selectedId,
    props.onSelect,
    {
      locale: props.locale,
    },
  )
  return createElement(
    'ul',
    toReactProps(parts.root),
    parts.items.map((item, index) =>
      createElement(
        'li',
        { key: props.conversations[index].id },
        createElement('button', toReactProps(item), item.text),
      ),
    ),
  )
}
