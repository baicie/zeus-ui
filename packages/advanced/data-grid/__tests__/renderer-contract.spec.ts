import type {
  DataGridCellRenderer,
  DataGridCellRendererInput,
  DataGridCellRendererSlot,
} from '../src/core/cell-renderer-adapter'

import { describe, expect, it } from 'vitest'
import { createDataGridCellRendererAdapter } from '../src/core/cell-renderer-adapter'

interface TestContainer {
  name: string
}

interface TestRow {
  id: string
}

function createSlot(
  renderer: DataGridCellRenderer<TestRow, string, unknown, TestContainer>,
  container: TestContainer,
  rowKey: string,
  value: string,
): DataGridCellRendererSlot<TestRow, string, TestContainer> {
  return {
    container,
    renderer,
    input: {
      rowKey,
      columnId: 'name',
      row: { id: rowKey },
      value,
    },
  }
}

describe('data grid renderer contract', () => {
  it('reconciles framework-neutral containers without DOM globals', () => {
    const mounted: unknown[] = []
    const disposed: unknown[] = []
    const renderer: DataGridCellRenderer<
      TestRow,
      string,
      unknown,
      TestContainer
    > = {
      mount(container, input) {
        const handle = { container, input }
        mounted.push(handle)
        return handle
      },
      update(handle, input) {
        ;(
          handle as { input: DataGridCellRendererInput<TestRow, string> }
        ).input = input
      },
      dispose(handle) {
        disposed.push(handle)
      },
    }
    const adapter = createDataGridCellRendererAdapter<
      TestRow,
      string,
      TestContainer
    >()
    const container = { name: 'cell-1' }

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Ada')])
    const firstHandle = mounted[0]
    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Grace')])

    expect(mounted).toHaveLength(1)
    expect(disposed).toHaveLength(0)
    expect(
      (firstHandle as { input: DataGridCellRendererInput<TestRow, string> })
        .input.value,
    ).toBe('Grace')

    adapter.clear()

    expect(disposed).toEqual([firstHandle])
    expect(adapter.getMountedCount()).toBe(0)
  })
})
