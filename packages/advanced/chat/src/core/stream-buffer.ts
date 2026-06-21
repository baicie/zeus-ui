export interface StreamBufferOptions {
  onFlush: (value: string) => void
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (handle: number) => void
}

export interface StreamBuffer {
  push: (chunk: string) => void
  flush: () => void
  cancel: () => void
  getPendingValue: () => string
  isScheduled: () => boolean
}

function defaultRequestFrame(callback: FrameRequestCallback): number {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback)
  }

  return setTimeout(() => callback(Date.now()), 16) as unknown as number
}

function defaultCancelFrame(handle: number): void {
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(handle)
    return
  }

  clearTimeout(handle)
}

export function createStreamBuffer(options: StreamBufferOptions): StreamBuffer {
  const requestFrame = options.requestFrame ?? defaultRequestFrame
  const cancelFrame = options.cancelFrame ?? defaultCancelFrame

  let buffer = ''
  let frameHandle: number | undefined

  const run = () => {
    frameHandle = undefined

    if (!buffer) return

    const value = buffer
    buffer = ''

    options.onFlush(value)
  }

  return {
    push(chunk: string): void {
      if (!chunk) return

      buffer += chunk

      if (frameHandle !== undefined) return

      frameHandle = requestFrame(run)
    },

    flush(): void {
      if (frameHandle !== undefined) {
        cancelFrame(frameHandle)
        frameHandle = undefined
      }

      run()
    },

    cancel(): void {
      if (frameHandle !== undefined) {
        cancelFrame(frameHandle)
      }

      frameHandle = undefined
      buffer = ''
    },

    getPendingValue(): string {
      return buffer
    },

    isScheduled(): boolean {
      return frameHandle !== undefined
    },
  }
}
