type FrameCallback = () => void

export interface FrameSchedulerOptions {
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (handle: number) => void
}

export interface RafScheduler {
  schedule: (callback: FrameCallback) => void
  flush: () => void
  cancel: () => void
}

function defaultRequestFrame(callback: FrameRequestCallback): number {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback)
  }

  return setTimeout(callback, 16) as unknown as number
}

function defaultCancelFrame(handle: number): void {
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(handle)
    return
  }

  clearTimeout(handle)
}

export function createRafScheduler(
  options: FrameSchedulerOptions = {},
): RafScheduler {
  const requestFrame = options.requestFrame ?? defaultRequestFrame
  const cancelFrame = options.cancelFrame ?? defaultCancelFrame

  let frameHandle: number | undefined
  let queuedCallback: FrameCallback | undefined

  const run = () => {
    frameHandle = undefined
    const callback = queuedCallback
    queuedCallback = undefined
    callback?.()
  }

  return {
    schedule(callback): void {
      queuedCallback = callback

      if (frameHandle !== undefined) return

      frameHandle = requestFrame(run)
    },

    flush(): void {
      if (frameHandle === undefined && queuedCallback === undefined) return

      if (frameHandle !== undefined) {
        cancelFrame(frameHandle)
      }

      run()
    },

    cancel(): void {
      if (frameHandle !== undefined) {
        cancelFrame(frameHandle)
      }

      frameHandle = undefined
      queuedCallback = undefined
    },
  }
}
