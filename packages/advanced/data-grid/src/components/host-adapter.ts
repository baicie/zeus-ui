import type { DataGridCellRendererAdapter } from '../core/cell-renderer-adapter'
import type { DataGridRangeUpdateScheduler } from '../core/range-update-scheduler'
import type { DataGridViewportController } from './viewport-controller'

/**
 * The small lifecycle bridge owned by the Web Component host.
 *
 * The host owns the browser connection, while range coalescing and renderer
 * reconciliation remain replaceable collaborators. Keeping this bridge
 * callback-free makes the disconnect contract deterministic in Node tests.
 */
export interface DataGridHostAdapterOptions<Event = unknown> {
  viewportController: DataGridViewportController
  scheduler: Pick<DataGridRangeUpdateScheduler<Event>, 'cancel'>
  renderer?: Pick<DataGridCellRendererAdapter, 'clear'>
}

export interface DataGridHostAdapter {
  connect: (element: HTMLElement) => void
  disconnect: () => void
  isConnected: () => boolean
}

function firstError(current: unknown, next: unknown): unknown {
  return current === undefined ? next : current
}

function throwIfError(error: unknown): void {
  if (error !== undefined) throw error
}

/**
 * Connects the DOM host boundary and releases all per-connection work.
 *
 * `disconnect` deliberately calls every cleanup collaborator even if one
 * throws; the first error is rethrown after the host is left disconnected.
 * A renderer uses `clear`, rather than permanent `dispose`, so a custom
 * element can disconnect and reconnect without rebuilding its setup scope.
 */
export function createDataGridHostAdapter<Event = unknown>(
  options: DataGridHostAdapterOptions<Event>,
): DataGridHostAdapter {
  let connectedElement: HTMLElement | undefined

  const disconnect = (): void => {
    let cleanupError: unknown

    try {
      options.viewportController.disconnect()
    } catch (error) {
      cleanupError = firstError(cleanupError, error)
    }

    try {
      options.scheduler.cancel()
    } catch (error) {
      cleanupError = firstError(cleanupError, error)
    }

    if (options.renderer) {
      try {
        options.renderer.clear()
      } catch (error) {
        cleanupError = firstError(cleanupError, error)
      }
    }

    connectedElement = undefined
    throwIfError(cleanupError)
  }

  return {
    connect(element): void {
      if (connectedElement === element) return

      if (connectedElement !== undefined) disconnect()

      options.viewportController.connect(element)
      connectedElement = element
    },

    disconnect,

    isConnected: () => connectedElement !== undefined,
  }
}
