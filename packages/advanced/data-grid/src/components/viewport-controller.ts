export interface DataGridViewportClientSize {
  height: number
  width: number
}

export interface DataGridViewportResizeObserver {
  observe: (element: HTMLElement) => void
  disconnect: () => void
}

export type DataGridViewportResizeObserverFactory = (
  onResize: () => void,
) => DataGridViewportResizeObserver

export interface DataGridViewportControllerOptions {
  onResize: () => void
  createResizeObserver?: DataGridViewportResizeObserverFactory
}

export interface DataGridViewportController {
  connect: (element: HTMLElement) => void
  disconnect: () => void
  getClientSize: () => DataGridViewportClientSize
}

function getDefaultResizeObserverFactory():
  | DataGridViewportResizeObserverFactory
  | undefined {
  if (typeof globalThis.ResizeObserver === 'undefined') return undefined

  return onResize => {
    const observer = new globalThis.ResizeObserver(onResize)

    return {
      observe: element => observer.observe(element),
      disconnect: () => observer.disconnect(),
    }
  }
}

/** Owns the DOM viewport connection without owning range calculation. */
export function createDataGridViewportController(
  options: DataGridViewportControllerOptions,
): DataGridViewportController {
  const createResizeObserver =
    options.createResizeObserver || getDefaultResizeObserverFactory()
  let element: HTMLElement | undefined
  let observer: DataGridViewportResizeObserver | undefined
  let connectionId = 0

  const disconnect = (): void => {
    connectionId += 1
    const previousObserver = observer
    observer = undefined
    element = undefined

    if (previousObserver) previousObserver.disconnect()
  }

  return {
    connect(nextElement): void {
      if (element === nextElement && observer !== undefined) return

      disconnect()
      element = nextElement
      const activeConnectionId = connectionId
      let nextObserver: DataGridViewportResizeObserver | undefined

      if (!createResizeObserver) return

      try {
        nextObserver = createResizeObserver(() => {
          if (connectionId !== activeConnectionId) return
          options.onResize()
        })
        observer = nextObserver
        nextObserver.observe(nextElement)
      } catch (error) {
        connectionId += 1
        observer = undefined
        element = undefined

        if (nextObserver) {
          try {
            nextObserver.disconnect()
          } catch {
            // Preserve the observer setup error while clearing the connection.
          }
        }

        throw error
      }
    },

    disconnect,

    getClientSize(): DataGridViewportClientSize {
      return {
        height: element ? element.clientHeight : 0,
        width: element ? element.clientWidth : 0,
      }
    },
  }
}
