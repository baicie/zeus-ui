/**
 * Conversation elements (AI2-503): `zw-ai-composer`,
 * `zw-ai-message-timeline`, `zw-ai-message`, `zw-ai-citation-list`,
 * `zw-ai-artifact-preview`, `zw-ai-conversation-list`.
 *
 * ```ts
 * import { defineAiComposer } from '@zeus-web/ai-wc'
 * defineAiComposer()
 * document.querySelector('zw-ai-composer').controller = composer // property
 * ```
 */

import type {
  AiSession,
  ArtifactController,
  Citation,
  ComposerController,
  ContentPart,
  Conversation,
  ConversationController,
  EntityId,
  FollowMode,
} from '@zeus-web/ai-core'
import type {
  ContentBlock,
  ContentRenderer,
  ContextPicker,
  RendererRegistry,
} from '@zeus-web/ai-primitives'
import type { AiElementInstance } from './element'
import type { SlotRenderer } from './patch'

import {
  classifyPreview,
  createStreamingText,
  createTimelineController,
} from '@zeus-web/ai-core'
import {
  artifactPreviewView,
  composerView,
  describePart,
  el,
  EN_LOCALE,
  getCitationListParts,
  getConversationListParts,
  getMessageParts,
  messageContentView,
  messageView,
  timelineView,
} from '@zeus-web/ai-primitives'
import { defineAiElement, elementSlot, emit, projectSlot } from './element'

type Registry = CustomElementRegistry | undefined

interface Props {
  [name: string]: unknown
}

function props(element: AiElementInstance): Props {
  return element as unknown as Props
}

function copyText(text: string): void {
  const clipboard = (globalThis as { navigator?: Navigator }).navigator
    ?.clipboard
  if (clipboard) void clipboard.writeText(text).catch(() => {})
}

// ---------------------------------------------------------------------------

export function defineAiComposer(registry?: Registry): void {
  defineAiElement(
    'zw-ai-composer',
    ['controller', 'contextPicker'],
    element => {
      const p = props(element)
      return {
        connect: () => {
          const controller = p.controller as ComposerController | undefined
          const picker = p.contextPicker as ContextPicker | undefined
          return [
            controller?.subscribe(
              view => view,
              () => element.requestRender(),
            ),
            picker?.combobox.subscribe(
              view => view,
              () => element.requestRender(),
            ),
          ].filter((entry): entry is () => void => Boolean(entry))
        },
        view: () => {
          const controller = p.controller as ComposerController | undefined
          if (!controller) return null
          const picker = p.contextPicker as ContextPicker | undefined
          return composerView(controller.getSnapshot(), controller, {
            ids: element.ids,
            label: element.getAttribute('label') ?? undefined,
            disabled: element.hasAttribute('disabled'),
            menu: picker
              ? {
                  view: picker.combobox.getSnapshot(),
                  controller: picker.combobox,
                }
              : undefined,
            afterInput: picker ? () => picker.sync() : undefined,
          })
        },
        slots: () => ({ toolbar: projectSlot(element, 'toolbar') }),
      }
    },
    ['label', 'disabled'],
    registry,
  )
}

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

/** Loads host-authorized images as blob URLs into a slot wrapper. */
function assetImageSlot(session: AiSession): SlotRenderer {
  return (wrapper, data, renderFallback) => {
    const block = data as Extract<ContentBlock, { kind: 'image' }>
    const mime = block.asset.mimeType
    const allowed =
      classifyPreview(mime) === 'image' || mime === 'image/svg+xml'
    const existing = wrapper.querySelector('img')
    if (existing?.dataset.assetId === block.asset.id) return

    renderFallback()
    if (!allowed || typeof URL === 'undefined' || !URL.createObjectURL) return

    session.host
      .loadAsset(block.asset)
      .then(content => new Response(content as BodyInit).blob())
      .then(blob => {
        const image = wrapper.ownerDocument.createElement('img')
        image.src = URL.createObjectURL(new Blob([blob], { type: mime }))
        image.alt = block.alt
        image.dataset.assetId = block.asset.id
        wrapper.replaceChildren(image)
      })
      .catch(() => {})
  }
}

export function defineAiMessage(registry?: Registry): void {
  defineAiElement(
    'zw-ai-message',
    ['session', 'messageId', 'conversation', 'renderers', 'onEdit'],
    element => {
      const p = props(element)
      return {
        connect: () => {
          const session = p.session as AiSession | undefined
          const messageId = p.messageId as EntityId | undefined
          if (!session || !messageId) return []
          // Frame-batched while streaming; terminal status flushes at once.
          const streaming = createStreamingText({
            store: session.store,
            messageId,
          })
          const conversation = p.conversation as
            | ConversationController
            | undefined
          return [
            streaming.subscribe(
              view => `${view.revision}:${view.status ?? ''}`,
              () => element.requestRender(),
            ),
            () => streaming.dispose(),
            conversation?.subscribe(
              view => view.branches[messageId],
              () => element.requestRender(),
            ),
          ].filter((entry): entry is () => void => Boolean(entry))
        },
        view: () => {
          const session = p.session as AiSession | undefined
          const messageId = p.messageId as EntityId | undefined
          const message =
            session && messageId
              ? session.store.getState().messages[messageId]
              : undefined
          if (!message) return null
          const conversation = p.conversation as
            | ConversationController
            | undefined
          const parts = getMessageParts(message, {
            ids: element.ids,
            branch: conversation?.getSnapshot().branches[message.id],
            conversation,
            copy: copyText,
            onEdit: p.onEdit as ((value: typeof message) => void) | undefined,
          })
          const content = messageContentView(message.parts.map(blockOf), {
            copy: copyText,
            allowRemoteImages: element.hasAttribute('allow-remote-images'),
          })
          return messageView(parts, content)
        },
        slots: () => {
          const session = p.session as AiSession
          const renderers = p.renderers as RendererRegistry<Node> | undefined
          const message =
            session.store.getState().messages[p.messageId as EntityId]
          const byPart = new Map(
            (message?.parts ?? []).map(part => [part.id, part]),
          )
          return {
            'content-block': (wrapper, data, renderFallback) => {
              const block = data as ContentBlock
              const part = byPart.get(block.partId)
              const renderer: ContentRenderer<Node> | undefined =
                part && renderers?.resolve(part, block)
              if (!part || !renderer) {
                renderFallback()
                return
              }
              try {
                wrapper.replaceChildren(
                  renderer.render({
                    part,
                    block,
                    resolveAsset: asset => session.host.loadAsset(asset),
                    capability: new Set(),
                  }),
                )
              } catch {
                // A failing renderer degrades to the safe default.
                wrapper.textContent = ''
                renderFallback()
              }
            },
            'asset-image': assetImageSlot(session),
            'message-actions': projectSlot(element, 'actions'),
          }
        },
      }
    },
    ['allow-remote-images'],
    registry,
  )
}

// ---------------------------------------------------------------------------

export function defineAiMessageTimeline(registry?: Registry): void {
  defineAiMessage(registry)

  defineAiElement(
    'zw-ai-message-timeline',
    ['session', 'conversation', 'renderers'],
    element => {
      const p = props(element)
      const follow =
        (element.getAttribute('follow') as FollowMode | null) ?? undefined
      const timeline = createTimelineController({ follow })
      let scroller: HTMLElement | null = null
      let programmatic = false
      let observer: ResizeObserver | undefined
      let busy = false

      const metrics = (target: HTMLElement) => ({
        scrollTop: target.scrollTop,
        viewportHeight: target.clientHeight,
        contentHeight: target.scrollHeight,
      })

      const correct = (): void => {
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
        const target = timeline.scrollCorrection(metrics(scroller))
        if (target !== undefined) {
          programmatic = true
          scroller.scrollTop = target
        }
      }

      const onScroll = (): void => {
        if (!scroller) return
        timeline.onScroll(metrics(scroller), !programmatic)
        programmatic = false
      }

      return {
        connect: () => {
          const session = p.session as AiSession | undefined
          const conversation = p.conversation as
            | ConversationController
            | undefined
          if (!session || !conversation) return [() => timeline.dispose()]

          const syncBusy = (): void => {
            const state = session.store.getState()
            const next = conversation
              .getSnapshot()
              .visibleMessageIds.some(id => {
                const status = state.messages[id]?.status
                return status === 'streaming' || status === 'pending'
              })
            if (next !== busy) {
              busy = next
              element.requestRender()
            }
          }

          timeline.setItems(conversation.getSnapshot().visibleMessageIds)
          syncBusy()

          return [
            conversation.subscribe(
              view => view.visibleMessageIds,
              ids => {
                timeline.setItems(ids)
                syncBusy()
              },
            ),
            timeline.subscribe(
              view => view,
              () => element.requestRender(),
            ),
            session.store.subscribe(state => state.messages, syncBusy),
            () => {
              scroller?.removeEventListener('scroll', onScroll)
              observer?.disconnect()
              scroller = null
              timeline.dispose()
            },
          ]
        },
        view: () => {
          if (!p.session || !p.conversation) return null
          return timelineView(timeline.getSnapshot(), timeline, {
            ids: element.ids,
            label:
              element.getAttribute('label') ?? EN_LOCALE.conversationListLabel,
            busy,
            announcement: busy ? 'Generating response' : '',
            onFocusItem: id =>
              element.ownerDocument
                .getElementById(element.ids.id(`message-${id}`))
                ?.focus(),
          })
        },
        slots: () => ({
          message: elementSlot('zw-ai-message', data => ({
            session: p.session,
            conversation: p.conversation,
            renderers: p.renderers,
            messageId: (data as { messageId: EntityId }).messageId,
          })),
        }),
        afterRender: () => {
          const next = element.querySelector<HTMLElement>(
            '[data-part="scroller"]',
          )
          if (next !== scroller) {
            scroller?.removeEventListener('scroll', onScroll)
            scroller = next
            scroller?.addEventListener('scroll', onScroll, { passive: true })
            observer?.disconnect()
            observer =
              typeof ResizeObserver === 'function'
                ? new ResizeObserver(() => correct())
                : undefined
            if (scroller) observer?.observe(scroller)
          }
          if (scroller && observer) {
            for (const child of Array.from(scroller.children))
              observer.observe(child)
          }
          correct()
        },
      }
    },
    ['follow', 'label'],
    registry,
  )
}

// ---------------------------------------------------------------------------

export function defineAiCitationList(registry?: Registry): void {
  defineAiElement(
    'zw-ai-citation-list',
    ['citations'],
    element => ({
      connect: () => [],
      view: () => {
        const citations =
          (props(element).citations as readonly Citation[] | undefined) ?? []
        const parts = getCitationListParts(citations)
        return el(
          'ul',
          parts.root,
          parts.items.map((entry, index) =>
            el(
              'li',
              entry.item,
              [entry.link ? el('a', entry.link) : el('span', entry.label)],
              citations[index].partId,
            ),
          ),
        )
      },
    }),
    [],
    registry,
  )
}

export function defineAiArtifactPreview(registry?: Registry): void {
  defineAiElement(
    'zw-ai-artifact-preview',
    ['controller', 'session'],
    element => {
      const p = props(element)
      let objectUrl: string | undefined
      return {
        connect: () => {
          const controller = p.controller as ArtifactController | undefined
          return [
            controller?.subscribe(
              view => view.preview,
              () => element.requestRender(),
            ),
            () => {
              if (objectUrl) URL.revokeObjectURL(objectUrl)
            },
          ].filter((entry): entry is () => void => Boolean(entry))
        },
        view: () => {
          const controller = p.controller as ArtifactController | undefined
          return controller
            ? artifactPreviewView(controller.getSnapshot().preview)
            : null
        },
        slots: () => ({
          'artifact-binary': wrapper => {
            const preview = (p.controller as ArtifactController).getSnapshot()
              .preview
            const session = p.session as AiSession | undefined
            const mime =
              preview &&
              session?.store.getState().artifacts[preview.artifactId]?.asset
                .mimeType
            if (!preview?.bytes || !mime) return
            if (wrapper.dataset.artifactId === preview.artifactId) return
            wrapper.dataset.artifactId = preview.artifactId
            const doc = wrapper.ownerDocument

            if (mime === 'text/html') {
              if (!element.hasAttribute('sandbox')) return
              // No allow-scripts, no allow-same-origin: the document is inert.
              const frame = doc.createElement('iframe')
              frame.setAttribute('sandbox', '')
              frame.setAttribute('referrerpolicy', 'no-referrer')
              frame.title = 'Artifact preview'
              frame.srcdoc = new TextDecoder().decode(preview.bytes)
              wrapper.replaceChildren(frame)
              return
            }
            if (objectUrl) URL.revokeObjectURL(objectUrl)
            objectUrl = URL.createObjectURL(
              new Blob([preview.bytes as BlobPart], { type: mime }),
            )
            const image = doc.createElement('img')
            image.src = objectUrl
            image.alt = ''
            wrapper.replaceChildren(image)
          },
        }),
      }
    },
    ['sandbox'],
    registry,
  )
}

export function defineAiConversationList(registry?: Registry): void {
  defineAiElement(
    'zw-ai-conversation-list',
    ['conversations', 'selectedId'],
    element => ({
      connect: () => [],
      view: () => {
        const p = props(element)
        const conversations =
          (p.conversations as readonly Conversation[] | undefined) ?? []
        const parts = getConversationListParts(
          conversations,
          p.selectedId as string | undefined,
          id => emit(element, 'zw-ai-select', { conversationId: id }),
        )
        return el(
          'ul',
          parts.root,
          parts.items.map((item, index) =>
            el('li', undefined, [el('button', item)], conversations[index].id),
          ),
        )
      },
    }),
    [],
    registry,
  )
}
