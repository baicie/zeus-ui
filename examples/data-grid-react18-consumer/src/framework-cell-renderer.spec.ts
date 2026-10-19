import type {
  DataGridCellRenderer,
  DataGridCellRendererInput,
  DataGridCellRendererSlot,
} from '../../../packages/advanced/data-grid/src/core/cell-renderer-adapter'

import React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { createDataGridCellRendererAdapter } from '../../../packages/advanced/data-grid/src/core/cell-renderer-adapter'

interface TestRow {
  id: string
}

type CellInput = DataGridCellRendererInput<TestRow, string>

interface ReactHandle {
  container: HTMLElement
  input: CellInput
  root: ReturnType<typeof createRoot>
}

function appendContainer(): HTMLElement {
  const container = globalThis.document.createElement('div')
  globalThis.document.body.append(container)
  return container
}

function createSlot(
  renderer: DataGridCellRenderer<TestRow, string, ReactHandle, HTMLElement>,
  container: HTMLElement,
  rowKey: string,
  value: string,
): DataGridCellRendererSlot<TestRow, string, HTMLElement> {
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

function ReactCell({ input }: { input: CellInput }) {
  return React.createElement(
    'button',
    {
      'data-row-key': input.rowKey,
      type: 'button',
    },
    input.value,
  )
}

function createReact18Renderer() {
  const mounted: ReactHandle[] = []
  const disposed: ReactHandle[] = []
  const renderer: DataGridCellRenderer<
    TestRow,
    string,
    ReactHandle,
    HTMLElement
  > = {
    mount(container, input) {
      const root = createRoot(container)
      const handle = { container, input, root }
      flushSync(() => {
        root.render(React.createElement(ReactCell, { input }))
      })
      mounted.push(handle)
      return handle
    },
    update(handle, input) {
      handle.input = input
      flushSync(() => {
        handle.root.render(React.createElement(ReactCell, { input }))
      })
    },
    dispose(handle) {
      handle.root.unmount()
      disposed.push(handle)
    },
  }

  return { disposed, mounted, renderer }
}

describe('react 18 DataGrid cell renderer consumer', () => {
  afterEach(() => {
    globalThis.document.body.innerHTML = ''
  })

  it('keeps keyed cell DOM identity through update and releases the React 18 root', async () => {
    const adapter = createDataGridCellRendererAdapter<
      TestRow,
      string,
      HTMLElement
    >()
    const { disposed, mounted, renderer } = createReact18Renderer()
    const container = appendContainer()

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Ada')])
    await Promise.resolve()

    const firstButton = container.querySelector('button')!
    const firstHandle = mounted[0]!
    firstButton.focus()

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Grace')])
    await Promise.resolve()

    expect(container.querySelector('button')).toBe(firstButton)
    expect(firstButton.textContent).toBe('Grace')
    expect(globalThis.document.activeElement).toBe(firstButton)
    expect(disposed).toHaveLength(0)

    adapter.reconcile([createSlot(renderer, container, 'row-2', 'Owner')])
    await Promise.resolve()

    expect(disposed).toEqual([firstHandle])
    expect(mounted).toHaveLength(2)
    expect(container.querySelector('button')).not.toBe(firstButton)

    adapter.clear()

    expect(adapter.getMountedCount()).toBe(0)
    expect(container.childElementCount).toBe(0)
    expect(disposed).toHaveLength(2)
  })

  it('can reconnect after clear without reusing a disposed React 18 root', async () => {
    const adapter = createDataGridCellRendererAdapter<
      TestRow,
      string,
      HTMLElement
    >()
    const { disposed, mounted, renderer } = createReact18Renderer()
    const firstContainer = appendContainer()

    adapter.reconcile([createSlot(renderer, firstContainer, 'row-1', 'Ada')])
    await Promise.resolve()
    adapter.clear()

    const reconnectContainer = appendContainer()
    adapter.reconcile([
      createSlot(renderer, reconnectContainer, 'row-1', 'Reconnected'),
    ])
    await Promise.resolve()

    expect(mounted).toHaveLength(2)
    expect(disposed).toHaveLength(1)
    expect(reconnectContainer.textContent).toBe('Reconnected')
    expect(reconnectContainer.querySelector('button')).not.toBe(
      firstContainer.querySelector('button'),
    )

    adapter.dispose()
    expect(adapter.getMountedCount()).toBe(0)
    expect(reconnectContainer.childElementCount).toBe(0)
    expect(disposed).toHaveLength(2)
  })
})
