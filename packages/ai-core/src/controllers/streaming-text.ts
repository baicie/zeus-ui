/**
 * Streaming text view (AI2-204).
 *
 * The store applies every `message.part.delta` the moment it arrives, in
 * revision order; correctness never depends on rendering. This view only
 * decides *when the UI looks*: it batches updates to at most one per frame,
 * and flushes synchronously when the message reaches a terminal status so
 * the final text is never left waiting on a frame that may not come.
 *
 * Because the view always reads the current canonical text at flush time,
 * coalescing frames cannot drop or duplicate a token.
 *
 * It also produces a polite live-region summary that changes only on
 * status transitions, not per token (02-INTERACTION-SPEC F5).
 */

import type { EntityId, MessageStatus } from '../domain/types'
import type { AiStore } from '../store/store'
import type { Controller } from './view-store'

import { selectMessageText } from '../store/selectors'
import { createViewStore } from './view-store'

/** Schedules `callback` for the next frame; returns a cancel function. */
export type FrameScheduler = (callback: () => void) => () => void

export const defaultFrameScheduler: FrameScheduler = callback => {
  if (typeof requestAnimationFrame === 'function') {
    const handle = requestAnimationFrame(() => callback())
    return () => cancelAnimationFrame(handle)
  }

  const handle = setTimeout(callback, 16)
  return () => clearTimeout(handle)
}

export interface StreamingTextViewState {
  messageId: EntityId
  text: string
  status?: MessageStatus
  /** Message revision the visible text corresponds to. */
  revision: number
  /** Short status for an `aria-live="polite"` region. */
  announcement: string
}

export interface StreamingTextOptions {
  store: AiStore
  messageId: EntityId
  schedule?: FrameScheduler
  /** Localized announcements per status. */
  announce?: (status: MessageStatus | undefined) => string
}

export interface StreamingTextController extends Controller<StreamingTextViewState> {
  /** Render whatever is pending now (e.g. before unmount or on blur). */
  flush: () => void
}

const TERMINAL: readonly MessageStatus[] = ['complete', 'failed', 'cancelled']

function defaultAnnouncement(status: MessageStatus | undefined): string {
  switch (status) {
    case 'pending':
    case 'streaming':
      return 'Generating response'
    case 'complete':
      return 'Response complete'
    case 'failed':
      return 'Response failed'
    case 'cancelled':
      return 'Response stopped'
    default:
      return ''
  }
}

export function createStreamingText(
  options: StreamingTextOptions,
): StreamingTextController {
  const schedule = options.schedule ?? defaultFrameScheduler
  const announce = options.announce ?? defaultAnnouncement
  let cancelFrame: (() => void) | undefined

  function read(): StreamingTextViewState {
    const state = options.store.getState()
    const message = state.messages.get(options.messageId)

    return {
      messageId: options.messageId,
      text: selectMessageText(state, options.messageId),
      status: message?.status,
      revision: message?.revision ?? 0,
      announcement: announce(message?.status),
    }
  }

  const view = createViewStore<StreamingTextViewState>(read())

  function flush(): void {
    cancelFrame?.()
    cancelFrame = undefined
    view.update(read())
  }

  view.onDispose(
    options.store.subscribe(
      state => state.messages.get(options.messageId),
      message => {
        if (message && TERMINAL.includes(message.status)) {
          // The final flush is synchronous: nothing may wait on a frame.
          flush()
          return
        }
        if (!cancelFrame) {
          cancelFrame = schedule(() => {
            cancelFrame = undefined
            view.update(read())
          })
        }
      },
    ),
  )
  view.onDispose(() => cancelFrame?.())

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    flush,
    dispose(): void {
      view.dispose()
    },
  }
}
