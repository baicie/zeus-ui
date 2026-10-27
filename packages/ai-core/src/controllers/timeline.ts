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
 *   the host), never a hard-coded pixel constant;
 * - with `virtualize`, conversations above a threshold (default 1000
 *   items) render only the visible range plus overscan, with spacer heights
 *   from measured (or estimated) item heights; the item holding focus is
 *   pinned so keyboard and screen-reader users never lose it.
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

/** One piece of a windowed list: a spacer, or a run of rendered items. */
export type TimelineSegment =
  | { kind: 'pad'; height: number }
  | { kind: 'items'; start: number; end: number }

export interface TimelineRange {
  start: number
  end: number
  /** Spacers and item runs in order; includes a pinned item outside the range. */
  segments: readonly TimelineSegment[]
}

export interface TimelineViewState {
  itemIds: readonly EntityId[]
  /** Present when windowing is active; render only these segments. */
  range?: TimelineRange
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
  /** Render only the visible range for long conversations. */
  virtualize?: {
    /** Item count from which windowing starts. Default 1000. */
    threshold?: number
    /** Height assumed for items not measured yet. Default 120. */
    estimatedItemHeight?: number
    /** Extra items rendered above and below the viewport. Default 8. */
    overscan?: number
  }
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
  /** Keep this item rendered while windowing (the focused message). */
  pin: (itemId: EntityId | undefined) => void
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
  const windowing = options.virtualize
  const heights = new Map<EntityId, number>()
  let lastMetrics: ViewportMetrics | undefined
  let pinned: EntityId | undefined

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

  function computeRange(
    itemIds: readonly EntityId[],
    following: boolean,
  ): TimelineRange | undefined {
    if (!windowing || itemIds.length < (windowing.threshold ?? 1000)) {
      return undefined
    }

    const estimate = windowing.estimatedItemHeight ?? 120
    const overscan = windowing.overscan ?? 8
    const count = itemIds.length
    const size = (index: number): number =>
      heights.get(itemIds[index]) ?? estimate
    // Zero means "not laid out yet" (hidden, detached, jsdom): estimate.
    const viewport =
      lastMetrics && lastMetrics.viewportHeight > 0
        ? lastMetrics.viewportHeight
        : estimate * 6
    let start: number
    let end: number

    if (following || !lastMetrics || lastMetrics.viewportHeight <= 0) {
      // Anchor at the bottom: fill one viewport upwards from the end.
      end = count
      start = count
      let filled = 0
      while (start > 0 && filled < viewport) {
        start -= 1
        filled += size(start)
      }
    } else {
      const top = lastMetrics.scrollTop
      let offset = 0
      start = 0
      while (start < count && offset + size(start) <= top) {
        offset += size(start)
        start += 1
      }
      end = start
      while (end < count && offset < top + viewport) {
        offset += size(end)
        end += 1
      }
    }

    start = Math.max(0, start - overscan)
    end = Math.min(count, end + overscan)

    const sum = (from: number, to: number): number => {
      let total = 0
      for (let index = from; index < to; index += 1) total += size(index)
      return total
    }
    const pinnedIndex = pinned === undefined ? -1 : itemIds.indexOf(pinned)
    const segments: TimelineSegment[] = []
    const pad = (from: number, to: number): void => {
      if (to > from) segments.push({ kind: 'pad', height: sum(from, to) })
    }

    if (pinnedIndex >= 0 && pinnedIndex < start) {
      pad(0, pinnedIndex)
      segments.push({ kind: 'items', start: pinnedIndex, end: pinnedIndex + 1 })
      pad(pinnedIndex + 1, start)
    } else {
      pad(0, start)
    }
    segments.push({ kind: 'items', start, end })
    if (pinnedIndex >= end) {
      pad(end, pinnedIndex)
      segments.push({ kind: 'items', start: pinnedIndex, end: pinnedIndex + 1 })
      pad(pinnedIndex + 1, count)
    } else {
      pad(end, count)
    }

    return { start, end, segments }
  }

  let rangeQueued = false
  /** Recompute the window once the current handler finished updating. */
  function queueRange(): void {
    if (rangeQueued) return
    rangeQueued = true
    Promise.resolve().then(() => {
      rangeQueued = false
      if (!view.disposed) updateRange()
    })
  }

  function updateRange(): void {
    const current = view.getSnapshot()
    const next = computeRange(current.itemIds, current.following)
    const same =
      next === current.range ||
      (next !== undefined &&
        current.range !== undefined &&
        JSON.stringify(next.segments) ===
          JSON.stringify(current.range.segments))
    if (!same) view.update({ range: next })
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
      const tail = itemIds.slice(lastIndex + 1)
      const appended = tail.filter(id => !known.has(id)).length

      view.update({
        itemIds: [...itemIds],
        unreadCount: current.following ? 0 : current.unreadCount + appended,
        showJumpToLatest:
          !current.following && current.unreadCount + appended > 0
            ? true
            : current.showJumpToLatest,
      })
      updateRange()
    },
    onScroll(metrics, userInitiated): void {
      lastMetrics = metrics
      // Re-window after whatever this scroll changes below.
      queueRange()
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
      let changed = false
      for (const [id, layout] of next) {
        // An unmeasured (zero-height) item keeps its estimate.
        if (layout.height > 0 && heights.get(id) !== layout.height) {
          heights.set(id, layout.height)
          changed = true
        }
      }
      if (changed) updateRange()
    },
    pin(itemId): void {
      if (pinned === itemId) return
      pinned = itemId
      updateRange()
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
      updateRange()
    },
    dispose(): void {
      view.dispose()
    },
  }
}
