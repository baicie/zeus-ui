import type { DataGridRowKey } from '../types'

/**
 * The framework-neutral payload handed to a cell renderer.
 *
 * This is intentionally internal. A React/Vue adapter owns the framework
 * handle and the grid only owns its visible-cell lifetime.
 */
export interface DataGridCellRendererInput<TRow = unknown, TValue = unknown> {
  rowKey: DataGridRowKey
  columnId: string
  row: TRow
  value: TValue
}

export interface DataGridCellRenderer<
  TRow = unknown,
  TValue = unknown,
  THandle = unknown,
  TContainer = unknown,
> {
  /* eslint-disable ts/method-signature-style -- bivariant handles keep framework-specific adapters assignable. */
  mount(
    container: TContainer,
    input: DataGridCellRendererInput<TRow, TValue>,
  ): THandle
  update(handle: THandle, input: DataGridCellRendererInput<TRow, TValue>): void
  dispose(handle: THandle): void
  /* eslint-enable ts/method-signature-style */
}

export interface DataGridCellRendererSlot<
  TRow = unknown,
  TValue = unknown,
  TContainer = unknown,
> {
  container: TContainer
  input: DataGridCellRendererInput<TRow, TValue>
  renderer: DataGridCellRenderer<TRow, TValue, unknown, TContainer>
}

export interface DataGridCellRendererAdapter<
  TRow = unknown,
  TValue = unknown,
  TContainer = unknown,
> {
  reconcile: (
    slots: readonly DataGridCellRendererSlot<TRow, TValue, TContainer>[],
  ) => void
  getMountedKeys: () => readonly string[]
  getMountedCount: () => number
  /** Release all mounted handles while keeping the adapter reusable. */
  clear: () => void
  /** Permanently dispose the adapter and reject future reconciliations. */
  dispose: () => void
}

interface MountedCellRenderer<TRow, TValue, TContainer> {
  container: TContainer
  input: DataGridCellRendererInput<TRow, TValue>
  renderer: DataGridCellRenderer<TRow, TValue, unknown, TContainer>
  handle: unknown
}

function encodeKeyPart(value: string): string {
  return `${value.length}:${value}`
}

/**
 * Stable row/column identity. Length prefixes keep keys unambiguous even if
 * row keys or column ids contain the separator used by this function.
 */
export function getDataGridCellRendererKey(
  rowKey: DataGridRowKey,
  columnId: string,
): string {
  return `${encodeKeyPart(rowKey)}|${encodeKeyPart(columnId)}`
}

function firstError(current: unknown, next: unknown): unknown {
  return current === undefined ? next : current
}

function throwIfError(error: unknown): void {
  if (error !== undefined) throw error
}

/**
 * Reconciles framework-owned cell handles for one visible range.
 *
 * The adapter never inspects a framework node or VNode. A record remains
 * mounted only while its row key, column id, renderer identity, and host
 * container all remain stable. Renderer replacement disposes the old handle
 * before mounting the new one so a container is never owned by two roots.
 */
export function createDataGridCellRendererAdapter<
  TRow = unknown,
  TValue = unknown,
  TContainer = unknown,
>(): DataGridCellRendererAdapter<TRow, TValue, TContainer> {
  const records = new Map<
    string,
    MountedCellRenderer<TRow, TValue, TContainer>
  >()
  let disposed = false

  function assertActive(): void {
    if (disposed) {
      throw new Error('Data grid cell renderer adapter has been disposed.')
    }
  }

  function disposeRecord(
    record: MountedCellRenderer<TRow, TValue, TContainer>,
  ): unknown {
    try {
      record.renderer.dispose(record.handle)
      return undefined
    } catch (error) {
      return error
    }
  }

  function reconcile(
    slots: readonly DataGridCellRendererSlot<TRow, TValue, TContainer>[],
  ): void {
    assertActive()

    const nextKeys = new Set<string>()
    const nextContainers = new Set<TContainer>()
    const plansByKey = new Map<
      string,
      {
        key: string
        slot: DataGridCellRendererSlot<TRow, TValue, TContainer>
        previous: MountedCellRenderer<TRow, TValue, TContainer> | undefined
        canUpdate: boolean
      }
    >()
    const plans: Array<{
      key: string
      slot: DataGridCellRendererSlot<TRow, TValue, TContainer>
      previous: MountedCellRenderer<TRow, TValue, TContainer> | undefined
      canUpdate: boolean
    }> = []
    for (const slot of slots) {
      const key = getDataGridCellRendererKey(
        slot.input.rowKey,
        slot.input.columnId,
      )
      if (nextKeys.has(key)) {
        throw new Error(
          `Data grid cell renderer received duplicate key "${key}".`,
        )
      }
      if (nextContainers.has(slot.container)) {
        throw new Error(
          `Data grid cell renderer received duplicate container for key "${key}".`,
        )
      }
      nextKeys.add(key)
      nextContainers.add(slot.container)
      const previous = records.get(key)
      const plan = {
        key,
        slot,
        previous,
        canUpdate:
          previous !== undefined &&
          previous.renderer === slot.renderer &&
          previous.container === slot.container,
      }
      plans.push(plan)
      plansByKey.set(key, plan)
    }

    // Release owners of reused hosts before mounting new handles. Unrelated
    // stale handles stay available until the new visible range mounts cleanly.
    let staleDisposalError: unknown
    for (const [key, record] of records) {
      const plan = plansByKey.get(key)
      const mustReleaseBeforeMount =
        (plan !== undefined && !plan.canUpdate) ||
        (plan === undefined && nextContainers.has(record.container))
      if (!mustReleaseBeforeMount) continue
      const error = disposeRecord(record)
      if (error === undefined) records.delete(key)
      staleDisposalError = firstError(staleDisposalError, error)
    }
    throwIfError(staleDisposalError)

    const mountedDuringReconcile: string[] = []

    try {
      for (const plan of plans) {
        if (plan.canUpdate) {
          plan.slot.renderer.update(plan.previous!.handle, plan.slot.input)
          plan.previous!.input = plan.slot.input
          continue
        }

        const handle = plan.slot.renderer.mount(
          plan.slot.container,
          plan.slot.input,
        )
        records.set(plan.key, {
          container: plan.slot.container,
          input: plan.slot.input,
          renderer: plan.slot.renderer,
          handle,
        })
        mountedDuringReconcile.push(plan.key)
      }
    } catch (error) {
      // Do not leave newly mounted framework roots behind when a later cell
      // fails. Existing records remain available for a retry.
      let cleanupError: unknown
      for (const key of mountedDuringReconcile) {
        const record = records.get(key)
        if (!record) continue
        const disposeError = disposeRecord(record)
        if (disposeError === undefined) records.delete(key)
        cleanupError = firstError(cleanupError, disposeError)
      }
      if (cleanupError !== undefined) {
        const primaryMessage =
          error instanceof Error ? error.message : String(error)
        const cleanupMessage =
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError)
        throw new Error(`${primaryMessage}; cleanup failed: ${cleanupMessage}`)
      }
      throw error
    }

    let disposalError: unknown
    for (const [key, record] of records) {
      if (nextKeys.has(key)) continue
      const error = disposeRecord(record)
      if (error === undefined) records.delete(key)
      disposalError = firstError(disposalError, error)
    }
    throwIfError(disposalError)
  }

  function clear(): void {
    let disposalError: unknown
    for (const [key, record] of records) {
      const error = disposeRecord(record)
      if (error === undefined) records.delete(key)
      disposalError = firstError(disposalError, error)
    }
    throwIfError(disposalError)
  }

  function dispose(): void {
    if (disposed && records.size === 0) return

    disposed = true
    clear()
  }

  return {
    reconcile,
    getMountedKeys: () => Array.from(records.keys()),
    getMountedCount: () => records.size,
    clear,
    dispose,
  }
}
