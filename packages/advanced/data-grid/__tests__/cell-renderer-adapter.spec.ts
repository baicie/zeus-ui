// @vitest-environment jsdom

import type {
  DataGridCellRenderer,
  DataGridCellRendererInput,
  DataGridCellRendererSlot,
} from '../src/core/cell-renderer-adapter'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDataGridCellRendererAdapter,
  getDataGridCellRendererKey,
} from '../src/core/cell-renderer-adapter'

interface TestRow {
  id: string
  label: string
}

interface TestHandle {
  id: number
  container: Element
  input: DataGridCellRendererInput<TestRow, string>
}

function createRenderer() {
  let nextId = 0
  const mounted: TestHandle[] = []
  const disposed: TestHandle[] = []
  const renderer: DataGridCellRenderer<TestRow, string, TestHandle, Element> = {
    mount(container, input) {
      const handle = { id: nextId++, container, input }
      mounted.push(handle)
      return handle
    },
    update(handle, input) {
      handle.input = input
    },
    dispose(handle) {
      disposed.push(handle)
    },
  }

  return { renderer, mounted, disposed }
}

function createSlot(
  renderer: DataGridCellRenderer<TestRow, string, TestHandle, Element>,
  container: Element,
  rowKey: string,
  columnId: string,
  value: string,
): DataGridCellRendererSlot<TestRow, string> {
  return {
    container,
    renderer,
    input: {
      rowKey,
      columnId,
      row: { id: rowKey, label: value },
      value,
    },
  }
}

describe('data grid cell renderer adapter PoC', () => {
  beforeEach(() => {
    globalThis.document.body.innerHTML = ''
  })

  it('keeps visible handles keyed by row and column and updates them in place', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const { renderer, mounted, disposed } = createRenderer()
    const first = globalThis.document.createElement('div')
    const second = globalThis.document.createElement('div')
    const update = vi.spyOn(renderer, 'update')

    adapter.reconcile([
      createSlot(renderer, first, 'row-1', 'name', 'Ada'),
      createSlot(renderer, second, 'row-1', 'role', 'Admin'),
    ])
    const firstHandle = mounted[0]
    const secondHandle = mounted[1]

    adapter.reconcile([
      createSlot(renderer, first, 'row-1', 'name', 'Grace'),
      createSlot(renderer, second, 'row-2', 'role', 'Owner'),
    ])

    expect(mounted).toHaveLength(3)
    expect(update).toHaveBeenCalledTimes(1)
    expect(firstHandle?.input.value).toBe('Grace')
    expect(disposed).toEqual([secondHandle])
    expect(adapter.getMountedCount()).toBe(2)
    expect(adapter.getMountedKeys()).toEqual([
      getDataGridCellRendererKey('row-1', 'name'),
      getDataGridCellRendererKey('row-2', 'role'),
    ])
  })

  it('reuses the same handle when the visible slot is stable', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const { renderer, mounted, disposed } = createRenderer()
    const container = globalThis.document.createElement('div')
    const update = vi.spyOn(renderer, 'update')

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'name', 'Ada')])
    const handle = mounted[0]
    adapter.reconcile([
      createSlot(renderer, container, 'row-1', 'name', 'Grace'),
    ])

    expect(mounted).toEqual([handle])
    expect(update).toHaveBeenCalledTimes(1)
    expect(handle?.input.value).toBe('Grace')
    expect(disposed).toHaveLength(0)
  })

  it('disposes before remounting when renderer identity or host changes', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const first = createRenderer()
    const second = createRenderer()
    const container = globalThis.document.createElement('div')

    adapter.reconcile([
      createSlot(first.renderer, container, 'row-1', 'name', 'Ada'),
    ])
    const firstHandle = first.mounted[0]
    adapter.reconcile([
      createSlot(second.renderer, container, 'row-1', 'name', 'Grace'),
    ])

    expect(first.disposed).toEqual([firstHandle])
    expect(second.mounted).toHaveLength(1)

    const replacementContainer = globalThis.document.createElement('div')
    const secondHandle = second.mounted[0]
    adapter.reconcile([
      createSlot(second.renderer, replacementContainer, 'row-1', 'name', 'Ada'),
    ])
    expect(second.disposed).toEqual([secondHandle])
    expect(second.mounted).toHaveLength(2)
  })

  it('disposes an old key before mounting a new key into the reused host', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const container = globalThis.document.createElement('div')
    const events: string[] = []
    const renderer: DataGridCellRenderer<TestRow, string, TestHandle, Element> =
      {
        mount(container, input) {
          events.push(`mount:${input.rowKey}`)
          return { id: events.length, container, input }
        },
        update: vi.fn(),
        dispose(handle) {
          events.push(`dispose:${handle.input.rowKey}`)
        },
      }

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'name', 'Ada')])
    adapter.reconcile([
      createSlot(renderer, container, 'row-2', 'name', 'Grace'),
    ])

    expect(events).toEqual(['mount:row-1', 'dispose:row-1', 'mount:row-2'])
    expect(adapter.getMountedKeys()).toEqual([
      getDataGridCellRendererKey('row-2', 'name'),
    ])
  })

  it('rejects a host reused by two visible keys before changing ownership', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const { renderer, mounted, disposed } = createRenderer()
    const container = globalThis.document.createElement('div')

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'name', 'Ada')])
    expect(() =>
      adapter.reconcile([
        createSlot(renderer, container, 'row-1', 'name', 'Grace'),
        createSlot(renderer, container, 'row-2', 'name', 'Owner'),
      ]),
    ).toThrow('duplicate container')

    expect(mounted).toHaveLength(1)
    expect(disposed).toHaveLength(0)
  })

  it('disposes both owners before mounting when visible hosts are exchanged', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const firstHost = globalThis.document.createElement('div')
    const secondHost = globalThis.document.createElement('div')
    const events: string[] = []
    const renderer: DataGridCellRenderer<TestRow, string, TestHandle, Element> =
      {
        mount(container, input) {
          events.push(`mount:${input.rowKey}`)
          return { id: events.length, container, input }
        },
        update: vi.fn(),
        dispose(handle) {
          events.push(`dispose:${handle.input.rowKey}`)
        },
      }

    adapter.reconcile([
      createSlot(renderer, firstHost, 'row-1', 'name', 'Ada'),
      createSlot(renderer, secondHost, 'row-2', 'name', 'Grace'),
    ])
    events.length = 0

    adapter.reconcile([
      createSlot(renderer, secondHost, 'row-1', 'name', 'Ada'),
      createSlot(renderer, firstHost, 'row-2', 'name', 'Grace'),
    ])

    expect(events).toEqual([
      'dispose:row-1',
      'dispose:row-2',
      'mount:row-1',
      'mount:row-2',
    ])
  })

  it('cleans newly mounted handles when a later mount fails', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const first = createRenderer()
    const failing: DataGridCellRenderer<TestRow, string, TestHandle> = {
      mount() {
        throw new Error('mount failed')
      },
      update: vi.fn(),
      dispose: vi.fn(),
    }

    adapter.reconcile([
      createSlot(
        first.renderer,
        globalThis.document.createElement('div'),
        'row-1',
        'name',
        'Ada',
      ),
    ])
    expect(() =>
      adapter.reconcile([
        createSlot(
          first.renderer,
          globalThis.document.createElement('div'),
          'row-2',
          'name',
          'Grace',
        ),
        createSlot(
          failing,
          globalThis.document.createElement('div'),
          'row-3',
          'name',
          'Error',
        ),
      ]),
    ).toThrow('mount failed')

    expect(first.disposed).toHaveLength(1)
    expect(adapter.getMountedCount()).toBe(1)
    expect(adapter.getMountedKeys()).toEqual([
      getDataGridCellRendererKey('row-1', 'name'),
    ])
  })

  it('keeps the previous handle tracked when an update fails', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const first = createRenderer()
    const update = vi
      .spyOn(first.renderer, 'update')
      .mockImplementationOnce(() => {
        throw new Error('update failed')
      })
    const container = globalThis.document.createElement('div')

    adapter.reconcile([
      createSlot(first.renderer, container, 'row-1', 'name', 'Ada'),
    ])
    const handle = first.mounted[0]

    expect(() =>
      adapter.reconcile([
        createSlot(first.renderer, container, 'row-1', 'name', 'Grace'),
      ]),
    ).toThrow('update failed')

    expect(update).toHaveBeenCalledTimes(1)
    expect(first.disposed).toHaveLength(0)
    expect(adapter.getMountedCount()).toBe(1)
    expect(() =>
      adapter.reconcile([
        createSlot(first.renderer, container, 'row-1', 'name', 'Retry'),
      ]),
    ).not.toThrow()
    expect(handle?.input.value).toBe('Retry')
  })

  it('rejects duplicate visible cells before mounting anything', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const { renderer, mounted } = createRenderer()
    const duplicate = [
      createSlot(
        renderer,
        globalThis.document.createElement('div'),
        'row-1',
        'name',
        'Ada',
      ),
      createSlot(
        renderer,
        globalThis.document.createElement('div'),
        'row-1',
        'name',
        'Grace',
      ),
    ]

    expect(() => adapter.reconcile(duplicate)).toThrow('duplicate key')
    expect(mounted).toHaveLength(0)
    expect(adapter.getMountedCount()).toBe(0)
  })

  it('disposes every visible handle on disconnect and rejects later renders', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const { renderer, mounted, disposed } = createRenderer()

    adapter.reconcile([
      createSlot(
        renderer,
        globalThis.document.createElement('div'),
        'row-1',
        'name',
        'Ada',
      ),
      createSlot(
        renderer,
        globalThis.document.createElement('div'),
        'row-2',
        'name',
        'Grace',
      ),
    ])
    adapter.dispose()

    expect(disposed).toEqual(mounted)
    expect(adapter.getMountedCount()).toBe(0)
    expect(() => adapter.reconcile([])).toThrow('disposed')
  })

  it('clears visible handles without closing the adapter for reconnect', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const renderer = createRenderer()

    adapter.reconcile([
      createSlot(
        renderer.renderer,
        globalThis.document.createElement('div'),
        'row-1',
        'name',
        'Ada',
      ),
    ])
    const firstHandle = renderer.mounted[0]

    adapter.clear()

    expect(renderer.disposed).toEqual([firstHandle])
    expect(adapter.getMountedCount()).toBe(0)
    expect(() =>
      adapter.reconcile([
        createSlot(
          renderer.renderer,
          globalThis.document.createElement('div'),
          'row-2',
          'name',
          'Grace',
        ),
      ]),
    ).not.toThrow()
    expect(adapter.getMountedCount()).toBe(1)
  })

  it('retains a handle when dispose fails so disconnect cleanup can retry', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const renderer = createRenderer()
    const dispose = vi
      .spyOn(renderer.renderer, 'dispose')
      .mockImplementationOnce(() => {
        throw new Error('dispose failed')
      })
    adapter.reconcile([
      createSlot(
        renderer.renderer,
        globalThis.document.createElement('div'),
        'row-1',
        'name',
        'Ada',
      ),
    ])

    expect(() => adapter.dispose()).toThrow('dispose failed')
    expect(adapter.getMountedCount()).toBe(1)
    expect(() => adapter.dispose()).not.toThrow()
    expect(dispose).toHaveBeenCalledTimes(2)
    expect(adapter.getMountedCount()).toBe(0)
  })

  it('retains the old handle when replacement cleanup fails', () => {
    const adapter = createDataGridCellRendererAdapter<TestRow, string>()
    const first = createRenderer()
    const second = createRenderer()
    const dispose = vi
      .spyOn(first.renderer, 'dispose')
      .mockImplementationOnce(() => {
        throw new Error('replace dispose failed')
      })
    const container = globalThis.document.createElement('div')

    adapter.reconcile([
      createSlot(first.renderer, container, 'row-1', 'name', 'Ada'),
    ])

    expect(() =>
      adapter.reconcile([
        createSlot(second.renderer, container, 'row-1', 'name', 'Grace'),
      ]),
    ).toThrow('replace dispose failed')
    expect(adapter.getMountedCount()).toBe(1)
    expect(second.mounted).toHaveLength(0)

    expect(() =>
      adapter.reconcile([
        createSlot(second.renderer, container, 'row-1', 'name', 'Grace'),
      ]),
    ).not.toThrow()
    expect(dispose).toHaveBeenCalledTimes(2)
    expect(first.disposed).toHaveLength(1)
    expect(second.mounted).toHaveLength(1)
  })
})
