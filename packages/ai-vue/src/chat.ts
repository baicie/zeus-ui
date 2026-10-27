/**
 * Conversation surface for Vue (AI2-502). Scoped slots: `toolbar`
 * (composer), `message` (timeline, `{ messageId }`), `block` (content,
 * `{ block, part }`), `actions` (message, `{ message }`).
 */

import type {
  AiSession,
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
import type { PropType, VNodeChild } from 'vue'

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
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  shallowRef,
  watch,
  watchEffect,
} from 'vue'
import {
  defaultCopy,
  focusById,
  useAiSession,
  useAiState,
  useController,
  useIds,
  useOwnedController,
} from './composables'
import { renderRoot, toVueProps } from './render'

const sessionProp = { type: Object as PropType<AiSession>, required: false }
const localeProp = { type: Object as PropType<AiLocale>, required: false }

export const AiComposer = defineComponent({
  name: 'AiComposer',
  props: {
    controller: {
      type: Object as PropType<ComposerController>,
      required: true,
    },
    label: String,
    locale: localeProp,
    contextPicker: { type: Object as PropType<ContextPicker>, required: false },
    disabled: Boolean,
  },
  setup(props, { slots }) {
    const ids = useIds()
    const view = useController(props.controller)
    const menu = props.contextPicker
      ? useController(props.contextPicker.combobox)
      : undefined

    return () =>
      renderRoot(
        composerView(view.value, props.controller, {
          ids,
          locale: props.locale,
          label: props.label,
          disabled: props.disabled,
          menu:
            props.contextPicker && menu
              ? { view: menu.value, controller: props.contextPicker.combobox }
              : undefined,
          afterInput: props.contextPicker
            ? () => props.contextPicker?.sync()
            : undefined,
        }),
        { slots: { toolbar: () => slots.toolbar?.() ?? null } },
      )
  },
})

const blockCache = new WeakMap<ContentPart, ContentBlock>()

function blockOf(part: ContentPart): ContentBlock {
  let block = blockCache.get(part)
  if (!block) {
    block = describePart(part)
    blockCache.set(part, block)
  }
  return block
}

export const AiAssetImage = defineComponent({
  name: 'AiAssetImage',
  props: {
    session: sessionProp,
    asset: { type: Object as PropType<AssetRef>, required: true },
    alt: { type: String, default: '' },
  },
  setup(props) {
    const session = useAiSession(props.session)
    const url = ref<string>()
    let objectUrl: string | undefined
    let cancelled = false
    const allowed =
      classifyPreview(props.asset.mimeType) === 'image' ||
      props.asset.mimeType === 'image/svg+xml'

    if (allowed && typeof URL !== 'undefined' && URL.createObjectURL) {
      session.host
        .loadAsset(props.asset)
        .then(content => new Response(content as BodyInit).blob())
        .then(blob => {
          if (cancelled) return
          objectUrl = URL.createObjectURL(
            new Blob([blob], { type: props.asset.mimeType }),
          )
          url.value = objectUrl
        })
        .catch(() => {})
    }

    onBeforeUnmount(() => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    })

    return () =>
      url.value
        ? h('img', { src: url.value, alt: props.alt })
        : h(
            'span',
            { role: 'img', 'aria-label': props.alt || props.asset.mimeType },
            props.alt,
          )
  },
})

export const AiMessageContent = defineComponent({
  name: 'AiMessageContent',
  props: {
    session: sessionProp,
    message: { type: Object as PropType<Message>, required: true },
    renderers: {
      type: Object as PropType<RendererRegistry<VNodeChild>>,
      required: false,
    },
    allowRemoteImages: Boolean,
    copy: {
      type: Function as PropType<(text: string) => void>,
      required: false,
    },
    locale: localeProp,
  },
  setup(props, { slots }) {
    const session = useAiSession(props.session)

    return () => {
      const parts = props.message.parts
      const byPart = new Map(parts.map(part => [part.id, part]))
      return renderRoot(
        messageContentView(parts.map(blockOf), {
          allowRemoteImages: props.allowRemoteImages,
          copy: props.copy ?? defaultCopy,
          locale: props.locale,
        }),
        {
          slots: {
            'content-block': (data, fallback) => {
              const block = data as ContentBlock
              const part = byPart.get(block.partId)
              if (part && slots.block) return slots.block({ block, part })
              const renderer: ContentRenderer<VNodeChild> | undefined =
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
                return fallback
              }
            },
            'asset-image': data => {
              const block = data as Extract<ContentBlock, { kind: 'image' }>
              return h(AiAssetImage, {
                session,
                asset: block.asset,
                alt: block.alt,
                key: block.partId,
              })
            },
          },
        },
      )
    }
  },
})

export const AiMessage = defineComponent({
  name: 'AiMessage',
  props: {
    messageId: { type: String, required: true },
    session: sessionProp,
    conversation: {
      type: Object as PropType<ConversationController>,
      required: false,
    },
    renderers: {
      type: Object as PropType<RendererRegistry<VNodeChild>>,
      required: false,
    },
    onEdit: {
      type: Function as PropType<(message: Message) => void>,
      required: false,
    },
    allowRemoteImages: Boolean,
    copy: {
      type: Function as PropType<(text: string) => void>,
      required: false,
    },
    locale: localeProp,
  },
  setup(props, { slots }) {
    const session = useAiSession(props.session)
    const ids = useIds()
    const streaming = useOwnedController(() =>
      createStreamingText({ store: session.store, messageId: props.messageId }),
    )
    // Re-render at most once per frame while streaming; terminal flush is sync.
    const revision = useController(
      streaming,
      view => `${view.revision}:${view.status ?? ''}`,
    )
    const branch = props.conversation
      ? useController(
          props.conversation,
          view => view.branches[props.messageId],
        )
      : undefined

    return () => {
      void revision.value
      const message = session.store.getState().messages.get(props.messageId)
      if (!message) return null
      const copy = props.copy ?? defaultCopy
      const parts = getMessageParts(message, {
        ids,
        locale: props.locale,
        branch: branch?.value,
        conversation: props.conversation,
        copy,
        onEdit: props.onEdit,
      })

      return renderRoot(messageView(parts, { type: 'slot', name: 'content' }), {
        slots: {
          content: () =>
            h(
              AiMessageContent,
              {
                session,
                message,
                renderers: props.renderers,
                allowRemoteImages: props.allowRemoteImages,
                copy,
                locale: props.locale,
              },
              slots.block ? { block: slots.block } : undefined,
            ),
          'message-actions': () => slots.actions?.({ message }) ?? null,
        },
      })
    }
  },
})

export const AiMessageTimeline = defineComponent({
  name: 'AiMessageTimeline',
  props: {
    conversation: {
      type: Object as PropType<ConversationController>,
      required: true,
    },
    session: sessionProp,
    follow: { type: String as PropType<FollowMode>, required: false },
    label: String,
    locale: localeProp,
    renderers: {
      type: Object as PropType<RendererRegistry<VNodeChild>>,
      required: false,
    },
  },
  setup(props, { slots }) {
    const session = useAiSession(props.session)
    const ids = useIds()
    const locale = props.locale ?? EN_LOCALE
    const timeline = useOwnedController(() =>
      createTimelineController({ follow: props.follow, virtualize: {} }),
    )
    const view = useController(timeline)
    const visible = useController(
      props.conversation,
      value => value.visibleMessageIds,
    )
    const busy = useAiState(session.store, state =>
      visible.value.some(id => {
        const status = state.messages.get(id)?.status
        return status === 'streaming' || status === 'pending'
      }),
    )
    const scroller = shallowRef<HTMLElement | null>(null)
    let programmatic = false
    let observer: ResizeObserver | undefined

    watch(visible, ids => timeline.setItems(ids), { immediate: true })

    function metrics(element: HTMLElement) {
      return {
        scrollTop: element.scrollTop,
        viewportHeight: element.clientHeight,
        contentHeight: element.scrollHeight,
      }
    }

    function correct(): void {
      const element = scroller.value
      if (!element) return
      const origin = element.getBoundingClientRect().top - element.scrollTop
      const layouts = new Map<string, { top: number; height: number }>()
      for (const item of Array.from(
        element.querySelectorAll<HTMLElement>('[data-message-id]'),
      )) {
        const rect = item.getBoundingClientRect()
        layouts.set(item.dataset.messageId as string, {
          top: rect.top - origin,
          height: rect.height,
        })
      }
      timeline.setLayout(layouts)
      const target = timeline.scrollCorrection(metrics(element))
      if (target !== undefined) {
        programmatic = true
        element.scrollTop = target
      }
    }

    function onScroll(): void {
      if (!scroller.value) return
      timeline.onScroll(metrics(scroller.value), !programmatic)
      programmatic = false
    }

    onMounted(() => {
      scroller.value?.addEventListener('scroll', onScroll, { passive: true })
      if (typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(() => correct())
      }
      correct()
    })
    watchEffect(() => {
      observer?.disconnect()
      if (!observer || !scroller.value) return
      observer.observe(scroller.value)
      for (const child of Array.from(scroller.value.children))
        observer.observe(child)
    })
    onUpdated(correct)
    onBeforeUnmount(() => {
      scroller.value?.removeEventListener('scroll', onScroll)
      observer?.disconnect()
    })

    return () =>
      renderRoot(
        timelineView(view.value, timeline, {
          ids,
          label: props.label ?? locale.conversationListLabel,
          busy: busy.value,
          announcement: busy.value ? 'Generating response' : '',
          locale,
          onFocusItem: id => focusById(ids.id(`message-${id}`)),
        }),
        {
          slots: {
            message: data => {
              const { messageId } = data as { messageId: EntityId }
              return slots.message
                ? slots.message({ messageId })
                : h(AiMessage, {
                    key: messageId,
                    messageId,
                    session,
                    conversation: props.conversation,
                    renderers: props.renderers,
                    locale: props.locale,
                  })
            },
          },
          refs: { scroller },
        },
      )
  },
})

export const AiCitationList = defineComponent({
  name: 'AiCitationList',
  props: {
    citations: { type: Array as PropType<readonly Citation[]>, required: true },
    locale: localeProp,
  },
  setup(props) {
    return () => {
      const parts = getCitationListParts(props.citations, {
        locale: props.locale,
      })
      return h(
        'ul',
        toVueProps(parts.root),
        parts.items.map((entry, index) =>
          h(
            'li',
            { ...toVueProps(entry.item), key: props.citations[index].partId },
            entry.link
              ? h('a', toVueProps(entry.link), entry.link.text)
              : h('span', toVueProps(entry.label), entry.label.text),
          ),
        ),
      )
    }
  },
})

export const AiArtifactPreview = defineComponent({
  name: 'AiArtifactPreview',
  props: {
    controller: {
      type: Object as PropType<ArtifactController>,
      required: true,
    },
    session: sessionProp,
    sandbox: Boolean,
    locale: localeProp,
  },
  setup(props) {
    const session = useAiSession(props.session)
    const preview = useController(props.controller, view => view.preview)
    const url = ref<string>()
    let objectUrl: string | undefined

    const mimeOf = (): string | undefined => {
      const id = preview.value?.artifactId
      return id
        ? session.store.getState().artifacts.get(id)?.asset.mimeType
        : undefined
    }

    watch(
      preview,
      value => {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        objectUrl = undefined
        url.value = undefined
        const mime = mimeOf()
        if (
          value?.status !== 'ready' ||
          !value.bytes ||
          !mime ||
          mime === 'text/html'
        ) {
          return
        }
        if (typeof URL === 'undefined' || !URL.createObjectURL) return
        objectUrl = URL.createObjectURL(
          new Blob([value.bytes as BlobPart], { type: mime }),
        )
        url.value = objectUrl
      },
      { immediate: true },
    )
    onBeforeUnmount(() => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    })

    return () =>
      renderRoot(artifactPreviewView(preview.value, { locale: props.locale }), {
        slots: {
          'artifact-binary': () => {
            const value = preview.value
            if (mimeOf() === 'text/html' && props.sandbox && value?.bytes) {
              return h('iframe', {
                sandbox: '',
                srcdoc: new TextDecoder().decode(value.bytes),
                title: 'Artifact preview',
                referrerpolicy: 'no-referrer',
              })
            }
            return url.value ? h('img', { src: url.value, alt: '' }) : null
          },
        },
      })
  },
})

export const AiConversationList = defineComponent({
  name: 'AiConversationList',
  props: {
    conversations: {
      type: Array as PropType<readonly Conversation[]>,
      required: true,
    },
    selectedId: String,
    locale: localeProp,
  },
  emits: {
    select: (conversationId: EntityId) => typeof conversationId === 'string',
  },
  setup(props, { emit }) {
    return () => {
      const parts = getConversationListParts(
        props.conversations,
        props.selectedId,
        id => emit('select', id),
        { locale: props.locale },
      )
      return h(
        'ul',
        toVueProps(parts.root),
        parts.items.map((item, index) =>
          h('li', { key: props.conversations[index].id }, [
            h('button', toVueProps(item), item.text),
          ]),
        ),
      )
    }
  },
})
