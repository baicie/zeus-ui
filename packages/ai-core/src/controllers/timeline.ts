/**
 * Timeline controller (AI2-205): follow mode, reading anchor, jump to latest.
 *
 * Pure layout math over numbers the renderer reports, so it works with any
 * DOM, virtualizer or native list:
 *
 * - `follow`: `always` | `when-near-bottom` (default) | `never`;
 * - a user scroll away from the bottom leaves follow immediately, and new
 *   tokens never pull the viewport back;
 * - while not following, the controller keeps a logical anchor
 *   `{ itemId, offset }` and `scrollCorrection()` returns the scrollTop that
 *   keeps that item where the user was reading, even after older items were
 *   prepended or an item above changed height;
 * - "near bottom" is a threshold derived from the viewport (or supplied by
 *   the host), never a hard-coded pixel constant.
 */

import type { EntityId } from '../domain/types'
import type { Controller } from './view-store'

import { createViewStore, sameItems } from './view-store'

export type FollowMode = 'always' | 'when-near-bottom' | 'never'

export interface TimelineAnchor {
  itemId: EntityId
  /** Pixels between the item's top and the viewport top. */
  offset: number
}

export interface TimelineViewState {
  itemIds: readonly EntityId[]
  following: boolean
  anchor?: TimelineAnchor
  /** Items appended while the user was reading elsewhere. */
  unreadCount: number
  showJumpToLatest: boolean
}

export interface ViewportMetrics {
  scrollTop: number
  viewportHeight: number
  contentHeight: number
}

export interface ItemLayout {
  top: number
  height: number
}

export interface TimelineControllerOptions {
  follow?: FollowMode
  /**
   * Distance from the bottom that still counts as "at the bottom". Defaults
   * to a fraction of the viewport (min 16px) so it scales with the surface.
   */
  nearBottom?: (metrics: ViewportMetrics) => number
  initialItemIds?: readonly EntityId[]
}

export interface TimelineController extends Controller<TimelineViewState> {
  setItems: (itemIds: readonly EntityId[]) => void
  /** Report a scroll. `userInitiated` is false for programmatic scrolls. */
  onScroll: (metrics: ViewportMetrics, userInitiated: boolean) => void
  setLayout: (layouts: ReadonlyMap<EntityId, ItemLayout>) => void
  /**
   * The scrollTop the renderer should apply after content or layout changed,
   * or undefined to leave it alone.
   */
  scrollCorrection: (metrics: ViewportMetrics) => number | undefined
  jumpToLatest: () => void
  readonly mode: FollowMode
}

function defaultNearBottom(metrics: ViewportMetrics): number {
  return Math.max(16, Math.round(metrics.viewportHeight * 0.1))
}

function distanceFromBottom(metrics: ViewportMetrics): number {
  return metrics.contentHeight - metrics.viewportHeight - metrics.scrollTop
}

export function createTimelineController(
  options: TimelineControllerOptions = {},
): TimelineController {
  const mode = options.follow ?? 'when-near-bottom'
  const nearBottom = options.nearBottom ?? defaultNearBottom
  let layouts: ReadonlyMap<EntityId, ItemLayout> = new Map()
  /** A jump in `never` mode scrolls once without turning follow on. */
  let jumpRequested = false

  const view = createViewStore<TimelineViewState>({
    itemIds: options.initialItemIds ?? [],
    following: mode !== 'never',
    unreadCount: 0,
    showJumpToLatest: false,
  })

  function anchorAt(scrollTop: number): TimelineAnchor | undefined {
    for (const itemId of view.getSnapshot().itemIds) {
      const layout = layouts.get(itemId)
      if (!layout) continue
      if (layout.top + layout.height > scrollTop) {
        return { itemId, offset: scrollTop - layout.top }
      }
    }
    return undefined
  }

  return {
    mode,
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    setItems(itemIds): void {
      const current = view.getSnapshot()
      if (sameItems(current.itemIds, itemIds)) return

      const known = new Set(current.itemIds)
      const lastKnown = current.itemIds[current.itemIds.length - 1]
      const lastIndex =
        lastKnown === undefined ? -1 : itemIds.indexOf(lastKnown)
      // Only items after the previous tail are "new"; prepended history is not.
      const appended = itemIds
        .slice(lastIndex + 1)
        .filter(id => !known.has(id)).length

      view.update({
        itemIds: [...itemIds],
        unreadCount: current.following ? 0 : current.unreadCount + appended,
        showJumpToLatest:
          !current.following && current.unreadCount + appended > 0
            ? true
            : current.showJumpToLatest,
      })
    },
    onScroll(metrics, userInitiated): void {
      const current = view.getSnapshot()
      const atBottom = distanceFromBottom(metrics) <= nearBottom(metrics)

      if (mode === 'always') {
        view.update({ following: true, anchor: undefined })
        return
      }

      if (!userInitiated) {
        // Programmatic scrolls (our own corrections) never change intent,
        // but they do move the reading anchor.
        if (!current.following)
          view.update({ anchor: anchorAt(metrics.scrollTop) })
        return
      }

      if (mode === 'when-near-bottom' && atBottom) {
        view.update({
          following: true,
          anchor: undefined,
          unreadCount: 0,
          showJumpToLatest: false,
        })
        return
      }

      view.update({
        following: false,
        anchor: anchorAt(metrics.scrollTop),
        showJumpToLatest: !atBottom,
      })
    },
    setLayout(next): void {
      layouts = next
    },
    scrollCorrection(metrics): number | undefined {
      const current = view.getSnapshot()

      if (current.following || jumpRequested) {
        jumpRequested = false
        const bottom = Math.max(
          0,
          metrics.contentHeight - metrics.viewportHeight,
        )
        return bottom === metrics.scrollTop ? undefined : bottom
      }

      if (!current.anchor) return undefined

      const layout = layouts.get(current.anchor.itemId)
      if (!layout) return undefined

      const target = layout.top + current.anchor.offset
      return target === metrics.scrollTop ? undefined : target
    },
    jumpToLatest(): void {
      jumpRequested = true
      view.update({
        following: mode !== 'never',
        anchor: undefined,
        unreadCount: 0,
        showJumpToLatest: false,
      })
    },
    dispose(): void {
      view.dispose()
    },
  }
}
