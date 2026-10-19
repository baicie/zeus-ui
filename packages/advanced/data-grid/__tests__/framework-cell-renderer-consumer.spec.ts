// @vitest-environment jsdom

import type { Root } from 'react-dom/client'
import type { App, Ref } from 'vue'
import type {
  DataGridCellRenderer,
  DataGridCellRendererInput,
  DataGridCellRendererSlot,
} from '../src/core/cell-renderer-adapter'

import * as React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { createDataGridCellRendererAdapter } from '../src/core/cell-renderer-adapter'

interface TestRow {
  id: string
}

type CellInput = DataGridCellRendererInput<TestRow, string>

interface ReactHandle {
  container: HTMLElement
  input: CellInput
  root: Root
}

interface VueHandle {
  app: App
  container: HTMLElement
  input: CellInput
  state: Ref<CellInput>
}

function createSlot<THandle>(
  renderer: DataGridCellRenderer<TestRow, string, THandle, HTMLElement>,
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

function appendContainer(): HTMLElement {
  const container = globalThis.document.createElement('div')
  globalThis.document.body.append(container)
  return container
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

function createReactRenderer() {
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

function createVueRenderer() {
  const mounted: VueHandle[] = []
  const disposed: VueHandle[] = []
  const renderer: DataGridCellRenderer<
    TestRow,
    string,
    VueHandle,
    HTMLElement
  > = {
    mount(container, input) {
      const state = ref(input)
      const component = defineComponent({
        setup() {
          return () =>
            h(
              'button',
              {
                'data-row-key': state.value.rowKey,
                type: 'button',
              },
              state.value.value,
            )
        },
      })
      const app = createApp(component)
      const handle = { app, container, input, state }

      app.mount(container)
      mounted.push(handle)
      return handle
    },
    update(handle, input) {
      handle.input = input
      handle.state.value = input
    },
    dispose(handle) {
      handle.app.unmount()
      disposed.push(handle)
    },
  }

  return { disposed, mounted, renderer }
}

describe('framework cell renderer consumers', () => {
  afterEach(() => {
    globalThis.document.body.innerHTML = ''
  })

  it('mounts, updates, clears, and reconnects a React 19 renderer', () => {
    const adapter = createDataGridCellRendererAdapter<
      TestRow,
      string,
      HTMLElement
    >()
    const { disposed, mounted, renderer } = createReactRenderer()
    const container = appendContainer()

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Ada')])
    const firstButton = container.querySelector('button')!
    const firstHandle = mounted[0]!
    firstButton.focus()

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Grace')])

    expect(container.querySelector('button')).toBe(firstButton)
    expect(firstButton.textContent).toBe('Grace')
    expect(globalThis.document.activeElement).toBe(firstButton)
    expect(disposed).toHaveLength(0)

    adapter.reconcile([createSlot(renderer, container, 'row-2', 'Owner')])

    expect(disposed).toEqual([firstHandle])
    expect(mounted).toHaveLength(2)
    expect(container.querySelector('button')).not.toBe(firstButton)

    adapter.clear()

    expect(adapter.getMountedCount()).toBe(0)
    expect(container.childElementCount).toBe(0)

    const reconnectContainer = appendContainer()
    adapter.reconcile([
      createSlot(renderer, reconnectContainer, 'row-3', 'Reconnected'),
    ])

    expect(adapter.getMountedCount()).toBe(1)
    expect(reconnectContainer.textContent).toBe('Reconnected')
    adapter.dispose()
    expect(adapter.getMountedCount()).toBe(0)
    expect(reconnectContainer.childElementCount).toBe(0)
    expect(disposed).toHaveLength(3)
  })

  it('mounts, updates, clears, and reconnects a Vue 3 renderer', async () => {
    const adapter = createDataGridCellRendererAdapter<
      TestRow,
      string,
      HTMLElement
    >()
    const { disposed, mounted, renderer } = createVueRenderer()
    const container = appendContainer()

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Ada')])
    await nextTick()
    const firstButton = container.querySelector('button')!
    const firstHandle = mounted[0]!
    firstButton.focus()

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Grace')])
    await nextTick()

    expect(container.querySelector('button')).toBe(firstButton)
    expect(firstButton.textContent).toBe('Grace')
    expect(globalThis.document.activeElement).toBe(firstButton)
    expect(disposed).toHaveLength(0)

    adapter.reconcile([createSlot(renderer, container, 'row-2', 'Owner')])
    await nextTick()

    expect(disposed).toEqual([firstHandle])
    expect(mounted).toHaveLength(2)
    expect(container.querySelector('button')).not.toBe(firstButton)

    adapter.clear()

    expect(adapter.getMountedCount()).toBe(0)
    expect(container.childElementCount).toBe(0)

    const reconnectContainer = appendContainer()
    adapter.reconcile([
      createSlot(renderer, reconnectContainer, 'row-3', 'Reconnected'),
    ])
    await nextTick()

    expect(adapter.getMountedCount()).toBe(1)
    expect(reconnectContainer.textContent).toBe('Reconnected')
    adapter.dispose()
    expect(adapter.getMountedCount()).toBe(0)
    expect(reconnectContainer.childElementCount).toBe(0)
    expect(disposed).toHaveLength(3)
  })
})
