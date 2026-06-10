import { useCallback, useState } from 'react'

export interface DemoEventRecord {
  id: number
  name: string
  detail?: string
}

export function useDemoEventLog() {
  const [records, setRecords] = useState<DemoEventRecord[]>([])

  const log = useCallback((name: string, detail?: unknown) => {
    setRecords(current => [
      {
        id: Date.now() + Math.random(),
        name,
        detail:
          detail === undefined
            ? undefined
            : typeof detail === 'string'
              ? detail
              : JSON.stringify(detail),
      },
      ...current,
    ])
  }, [])

  const clear = useCallback(() => {
    setRecords([])
  }, [])

  return {
    records,
    log,
    clear,
  }
}

export function readDetailValue(event: unknown, fallback = ''): string {
  const payload = readPayload(event)
  const value = payload?.value

  return typeof value === 'string' ? value : fallback
}

export function readDetailChecked(event: unknown, fallback = false): boolean {
  const payload = readPayload(event)
  const checked = payload?.checked

  return typeof checked === 'boolean' ? checked : fallback
}

export function readDetailOpen(event: unknown, fallback = false): boolean {
  const payload = readPayload(event)
  const open = payload?.open

  return typeof open === 'boolean' ? open : fallback
}

function readPayload(event: unknown): Record<string, unknown> | undefined {
  if (!event || typeof event !== 'object') return undefined

  const maybeEvent = event as {
    detail?: unknown
    target?: {
      value?: unknown
      checked?: unknown
    }
    value?: unknown
    checked?: unknown
    open?: unknown
  }

  if (maybeEvent.detail && typeof maybeEvent.detail === 'object') {
    return maybeEvent.detail as Record<string, unknown>
  }

  if (maybeEvent.target) {
    return maybeEvent.target as Record<string, unknown>
  }

  return maybeEvent as Record<string, unknown>
}
