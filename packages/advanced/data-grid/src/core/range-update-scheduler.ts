import type { FrameSchedulerOptions, RafScheduler } from '@zeus-web/virtual'
import type { DataGridCommitSource } from '../types'

import { createRafScheduler } from '@zeus-web/virtual'

export interface DataGridRangeUpdate<Event = unknown> {
  event?: Event
  source: DataGridCommitSource
  inputTime?: number | null
  handlerStartTime?: number
  handlerEndTime?: number
  measure: boolean
  preserve: boolean
}

export interface DataGridRangeUpdateScheduler<Event = unknown> {
  schedule: (update: DataGridRangeUpdate<Event>) => void
  flush: () => void
  cancel: () => void
  hasPending: () => boolean
  clearDiagnosticTiming: () => void
}

export interface DataGridRangeUpdateSchedulerOptions<
  Event = unknown,
> extends FrameSchedulerOptions {
  commit: (update: DataGridRangeUpdate<Event>) => void
}

function earliestTime(
  left: number | null | undefined,
  right: number | null | undefined,
): number | null | undefined {
  if (left === undefined) return right
  if (right === undefined) return left
  if (left === null) return right
  if (right === null) return left
  return Math.min(left, right)
}

function mergeUpdates<Event>(
  previous: DataGridRangeUpdate<Event>,
  next: DataGridRangeUpdate<Event>,
): void {
  // Measurement work wins over scroll-only work. Equal priority keeps the
  // latest source and handler timing while preserving the earliest input time.
  const shouldReplaceTiming = Number(next.measure) >= Number(previous.measure)

  if (next.event !== undefined) previous.event = next.event
  if (shouldReplaceTiming) {
    previous.inputTime =
      previous.source === next.source
        ? earliestTime(previous.inputTime, next.inputTime)
        : next.inputTime
    previous.source = next.source
    previous.handlerStartTime = next.handlerStartTime
    previous.handlerEndTime = next.handlerEndTime
  }
  previous.measure ||= next.measure
  previous.preserve ||= next.preserve
}

/** Owns Data Grid range update coalescing independently from any DOM host. */
export function createDataGridRangeUpdateScheduler<Event = unknown>(
  options: DataGridRangeUpdateSchedulerOptions<Event>,
): DataGridRangeUpdateScheduler<Event> {
  const frameScheduler: RafScheduler = createRafScheduler(options)
  let pending: DataGridRangeUpdate<Event> | undefined

  const commitPending = (): void => {
    const update = pending
    pending = undefined
    if (update) options.commit(update)
  }

  return {
    schedule(update): void {
      if (pending) mergeUpdates(pending, update)
      else pending = { ...update }

      frameScheduler.schedule(commitPending)
    },

    flush(): void {
      frameScheduler.flush()
      commitPending()
    },

    cancel(): void {
      frameScheduler.cancel()
      pending = undefined
    },

    hasPending(): boolean {
      return pending !== undefined
    },

    clearDiagnosticTiming(): void {
      if (!pending) return
      pending.inputTime = null
      pending.handlerStartTime = undefined
      pending.handlerEndTime = undefined
    },
  }
}
