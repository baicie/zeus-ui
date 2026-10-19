// @vitest-environment jsdom

import type {
  DataGridCellRenderer,
  DataGridCellRendererInput,
  DataGridCellRendererSlot,
} from '../src/core/cell-renderer-adapter'

import { createRequire } from 'node:module'

import { afterEach, describe, expect, it } from 'vitest'
import { createDataGridCellRendererAdapter } from '../src/core/cell-renderer-adapter'

const require = createRequire(import.meta.url)
const React = require('react') as any
const { createPortal, flushSync } = require('react-dom') as any
const { createRoot } = require('react-dom/client') as any
const { createApp, defineComponent, h, nextTick, ref, Teleport } =
  require('vue') as any

interface TestRow {
  id: string
}

type CellInput = DataGridCellRendererInput<TestRow, string>

interface ReactHandle {
  container: HTMLElement
  input: CellInput
  root: any
}

interface VueHandle {
  app: any
  container: HTMLElement
  input: CellInput
  state: any
}

interface ReactPortalHandle {
  container: HTMLElement
  input: CellInput
  root: any
  target: HTMLElement
  ownsTarget: boolean
}

interface VueTeleportHandle {
  app: any
  container: HTMLElement
  input: CellInput
  state: any
  target: HTMLElement
  ownsTarget: boolean
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

function createReactPortalRenderer(options?: { target?: HTMLElement }) {
  const mounted: ReactPortalHandle[] = []
  const disposed: ReactPortalHandle[] = []
  const renderer: DataGridCellRenderer<
    TestRow,
    string,
    ReactPortalHandle,
    HTMLElement
  > = {
    mount(container, input) {
      const ownsTarget = options?.target === undefined
      const target = options?.target ?? globalThis.document.createElement('div')
      if (ownsTarget) {
        target.dataset.owner = 'react-portal-adapter'
        globalThis.document.body.append(target)
      }
      const root = createRoot(container)
      const handle = { container, input, root, target, ownsTarget }

      flushSync(() => {
        root.render(
          React.createElement(
            React.Fragment,
            null,
            React.createElement(
              'span',
              { 'data-inline-row-key': input.rowKey },
              input.value,
            ),
            createPortal(
              React.createElement(
                'button',
                {
                  'data-portal-row-key': input.rowKey,
                  type: 'button',
                },
                input.value,
              ),
              target,
            ),
          ),
        )
      })
      mounted.push(handle)
      return handle
    },
    update(handle, input) {
      handle.input = input
      flushSync(() => {
        handle.root.render(
          React.createElement(
            React.Fragment,
            null,
            React.createElement(
              'span',
              { 'data-inline-row-key': input.rowKey },
              input.value,
            ),
            createPortal(
              React.createElement(
                'button',
                {
                  'data-portal-row-key': input.rowKey,
                  type: 'button',
                },
                input.value,
              ),
              handle.target,
            ),
          ),
        )
      })
    },
    dispose(handle) {
      handle.root.unmount()
      if (handle.ownsTarget) handle.target.remove()
      disposed.push(handle)
    },
  }

  return { disposed, mounted, renderer }
}

function createVueTeleportRenderer(options?: { target?: HTMLElement }) {
  const mounted: VueTeleportHandle[] = []
  const disposed: VueTeleportHandle[] = []
  let targetSequence = 0
  const renderer: DataGridCellRenderer<
    TestRow,
    string,
    VueTeleportHandle,
    HTMLElement
  > = {
    mount(container, input) {
      const ownsTarget = options?.target === undefined
      const target = options?.target ?? globalThis.document.createElement('div')
      if (ownsTarget) {
        target.dataset.owner = 'vue-teleport-adapter'
        target.id = `vue-teleport-target-${targetSequence++}`
        globalThis.document.body.append(target)
      } else if (!target.id) {
        target.id = `vue-external-teleport-target-${targetSequence++}`
      }
      const targetSelector = `#${target.id}`
      const state = ref(input)
      const component = defineComponent({
        setup() {
          return () =>
            h(
              Teleport,
              { to: targetSelector },
              h(
                'button',
                {
                  'data-teleport-row-key': state.value.rowKey,
                  type: 'button',
                },
                state.value.value,
              ),
            )
        },
      })
      const app = createApp(component)
      const handle = {
        app,
        container,
        input,
        target,
        ownsTarget,
        state,
      }

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
      if (handle.ownsTarget) handle.target.remove()
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

  it('cleans owned React Portal targets across host disconnect and reconnect', () => {
    const adapter = createDataGridCellRendererAdapter<
      TestRow,
      string,
      HTMLElement
    >()
    const { disposed, mounted, renderer } = createReactPortalRenderer()
    const host = globalThis.document.createElement('section')
    const container = globalThis.document.createElement('div')
    host.append(container)
    globalThis.document.body.append(host)

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Ada')])
    const firstTarget = mounted[0]!.target
    const firstButton = firstTarget.querySelector('button')!
    expect(firstTarget.dataset.owner).toBe('react-portal-adapter')
    expect(firstButton.textContent).toBe('Ada')

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Grace')])

    expect(firstTarget.querySelector('button')).toBe(firstButton)
    expect(firstButton.textContent).toBe('Grace')

    host.remove()
    adapter.clear()

    expect(adapter.getMountedCount()).toBe(0)
    expect(container.childElementCount).toBe(0)
    expect(firstTarget.isConnected).toBe(false)
    expect(firstTarget.querySelector('button')).toBeNull()
    expect(disposed).toHaveLength(1)

    const reconnectHost = globalThis.document.createElement('section')
    const reconnectContainer = globalThis.document.createElement('div')
    reconnectHost.append(reconnectContainer)
    globalThis.document.body.append(reconnectHost)
    adapter.reconcile([
      createSlot(renderer, reconnectContainer, 'row-2', 'Reconnected'),
    ])
    const reconnectTarget = mounted[1]!.target
    expect(reconnectTarget).not.toBe(firstTarget)
    expect(reconnectTarget.querySelector('button')!.textContent).toBe(
      'Reconnected',
    )

    adapter.dispose()
    expect(reconnectTarget.isConnected).toBe(false)
    expect(disposed).toHaveLength(2)
  })

  it('preserves an external React Portal target and its non-framework children', () => {
    const adapter = createDataGridCellRendererAdapter<
      TestRow,
      string,
      HTMLElement
    >()
    const externalTarget = globalThis.document.createElement('div')
    const marker = globalThis.document.createElement('span')
    marker.dataset.owner = 'external'
    marker.textContent = 'keep me'
    externalTarget.append(marker)
    globalThis.document.body.append(externalTarget)
    const host = globalThis.document.createElement('section')
    const container = globalThis.document.createElement('div')
    host.append(container)
    globalThis.document.body.append(host)
    const { renderer } = createReactPortalRenderer({ target: externalTarget })

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Ada')])
    expect(externalTarget.querySelector('[data-portal-row-key]')).not.toBeNull()

    host.remove()
    adapter.clear()

    expect(externalTarget.isConnected).toBe(true)
    expect(externalTarget.contains(marker)).toBe(true)
    expect(externalTarget.querySelector('[data-portal-row-key]')).toBeNull()
  })

  it('cleans owned Vue Teleport targets across host disconnect and reconnect', async () => {
    const adapter = createDataGridCellRendererAdapter<
      TestRow,
      string,
      HTMLElement
    >()
    const { disposed, mounted, renderer } = createVueTeleportRenderer()
    const host = globalThis.document.createElement('section')
    const container = globalThis.document.createElement('div')
    host.append(container)
    globalThis.document.body.append(host)

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Ada')])
    await nextTick()
    const firstTarget = mounted[0]!.target
    const firstButton = firstTarget.querySelector('button')!
    expect(firstTarget.dataset.owner).toBe('vue-teleport-adapter')
    expect(firstButton.textContent).toBe('Ada')

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Grace')])
    await nextTick()

    expect(firstTarget.querySelector('button')).toBe(firstButton)
    expect(firstButton.textContent).toBe('Grace')

    host.remove()
    adapter.clear()
    await nextTick()

    expect(adapter.getMountedCount()).toBe(0)
    expect(container.childElementCount).toBe(0)
    expect(firstTarget.isConnected).toBe(false)
    expect(firstTarget.querySelector('button')).toBeNull()
    expect(disposed).toHaveLength(1)

    const reconnectHost = globalThis.document.createElement('section')
    const reconnectContainer = globalThis.document.createElement('div')
    reconnectHost.append(reconnectContainer)
    globalThis.document.body.append(reconnectHost)
    adapter.reconcile([
      createSlot(renderer, reconnectContainer, 'row-2', 'Reconnected'),
    ])
    await nextTick()
    const reconnectTarget = mounted[1]!.target
    expect(reconnectTarget).not.toBe(firstTarget)
    expect(reconnectTarget.querySelector('button')!.textContent).toBe(
      'Reconnected',
    )

    adapter.dispose()
    await nextTick()
    expect(reconnectTarget.isConnected).toBe(false)
    expect(disposed).toHaveLength(2)
  })

  it('preserves an external Vue Teleport target and its non-framework children', async () => {
    const adapter = createDataGridCellRendererAdapter<
      TestRow,
      string,
      HTMLElement
    >()
    const externalTarget = globalThis.document.createElement('div')
    const marker = globalThis.document.createElement('span')
    marker.dataset.owner = 'external'
    marker.textContent = 'keep me'
    externalTarget.append(marker)
    globalThis.document.body.append(externalTarget)
    const host = globalThis.document.createElement('section')
    const container = globalThis.document.createElement('div')
    host.append(container)
    globalThis.document.body.append(host)
    const { renderer } = createVueTeleportRenderer({ target: externalTarget })

    adapter.reconcile([createSlot(renderer, container, 'row-1', 'Ada')])
    await nextTick()
    expect(
      externalTarget.querySelector('[data-teleport-row-key]'),
    ).not.toBeNull()

    host.remove()
    adapter.clear()
    await nextTick()

    expect(externalTarget.isConnected).toBe(true)
    expect(externalTarget.contains(marker)).toBe(true)
    expect(externalTarget.querySelector('[data-teleport-row-key]')).toBeNull()
  })
})
