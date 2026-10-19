import type { Root } from 'react-dom/client'
import type { App, Ref } from 'vue'

import type {
  DataGridCellRenderer,
  DataGridCellRendererInput,
  DataGridCellRendererSlot,
} from '../../../../packages/advanced/data-grid/src/core/cell-renderer-adapter'
import React from 'react'
import { createPortal, flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { createApp, defineComponent, h, nextTick, ref, Teleport } from 'vue'
import { createDataGridCellRendererAdapter } from '../../../../packages/advanced/data-grid/src/core/cell-renderer-adapter'

interface RendererRow {
  id: string
}

type CellInput = DataGridCellRendererInput<RendererRow, string>
type CellSlot = DataGridCellRendererSlot<RendererRow, string, HTMLElement>

interface ReactHandle {
  root: Root
  container: HTMLElement
  input: CellInput
}

interface VueHandle {
  app: App
  container: HTMLElement
  input: CellInput
  state: Ref<CellInput>
}

interface FixtureSnapshot {
  hostConnected: boolean
  reactText: string
  vueText: string
  portalText: string
  teleportText: string
  externalTargetExists: boolean
  externalSentinelCount: number
  reactMounted: number
  reactDisposed: number
  vueMounted: number
  vueDisposed: number
}

interface FixtureUpdateResult extends FixtureSnapshot {
  sameReactButton: boolean
  sameVueButton: boolean
}

interface FixtureApi {
  update: (value: string) => Promise<FixtureUpdateResult>
  disconnect: () => void
  reconnect: () => void
  snapshot: () => FixtureSnapshot
}

const externalTargetSelector = '#external-renderer-target'
const rowKey = 'row-1'
const columnId = 'name'

function getInput(value: string): CellInput {
  return {
    rowKey,
    columnId,
    row: { id: rowKey },
    value,
  }
}

function getExternalTarget(): HTMLElement {
  const target = document.querySelector<HTMLElement>(externalTargetSelector)
  if (!target) throw new Error('External renderer target is missing.')
  return target
}

function createReactRenderer(diagnostics: {
  mounted: number
  disposed: number
}): DataGridCellRenderer<RendererRow, string, ReactHandle, HTMLElement> {
  const Cell = ({ input }: { input: CellInput }) => {
    const target = getExternalTarget()
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'button',
        {
          'data-renderer': 'react',
          type: 'button',
        },
        input.value,
      ),
      createPortal(
        React.createElement(
          'span',
          { 'data-portal-renderer': 'react' },
          `portal:${input.value}`,
        ),
        target,
      ),
    )
  }

  return {
    mount(container, input) {
      const root = createRoot(container)
      const handle = { container, input, root }
      flushSync(() => {
        root.render(React.createElement(Cell, { input }))
      })
      diagnostics.mounted += 1
      return handle
    },
    update(handle, input) {
      handle.input = input
      flushSync(() => {
        handle.root.render(React.createElement(Cell, { input }))
      })
    },
    dispose(handle) {
      handle.root.unmount()
      diagnostics.disposed += 1
    },
  }
}

function createVueRenderer(diagnostics: {
  mounted: number
  disposed: number
}): DataGridCellRenderer<RendererRow, string, VueHandle, HTMLElement> {
  return {
    mount(container, input) {
      const state = ref(input)
      const component = defineComponent({
        setup() {
          return () =>
            h('div', { 'data-renderer-root': 'vue' }, [
              h(
                'button',
                {
                  'data-renderer': 'vue',
                  type: 'button',
                },
                state.value.value,
              ),
              h(
                Teleport,
                { to: externalTargetSelector },
                h(
                  'span',
                  { 'data-teleport-renderer': 'vue' },
                  `teleport:${state.value.value}`,
                ),
              ),
            ])
        },
      })
      const app = createApp(component)
      const handle = { app, container, input, state }
      app.mount(container)
      diagnostics.mounted += 1
      return handle
    },
    update(handle, input) {
      handle.input = input
      handle.state.value = input
    },
    dispose(handle) {
      handle.app.unmount()
      diagnostics.disposed += 1
    },
  }
}

function createSlot(
  renderer:
    | DataGridCellRenderer<RendererRow, string, ReactHandle, HTMLElement>
    | DataGridCellRenderer<RendererRow, string, VueHandle, HTMLElement>,
  container: HTMLElement,
  value: string,
): CellSlot {
  return {
    container,
    renderer,
    input: getInput(value),
  }
}

class DataGridRendererHost extends HTMLElement {
  private readonly reactAdapter = createDataGridCellRendererAdapter<
    RendererRow,
    string,
    HTMLElement
  >()

  private readonly vueAdapter = createDataGridCellRendererAdapter<
    RendererRow,
    string,
    HTMLElement
  >()

  private readonly reactDiagnostics = { mounted: 0, disposed: 0 }
  private readonly vueDiagnostics = { mounted: 0, disposed: 0 }
  private readonly reactRenderer = createReactRenderer(this.reactDiagnostics)
  private readonly vueRenderer = createVueRenderer(this.vueDiagnostics)
  private value = 'Ada'

  connectedCallback(): void {
    if (!this.querySelector('[data-renderer-container="react"]')) {
      const reactContainer = document.createElement('div')
      reactContainer.dataset.rendererContainer = 'react'
      this.append(reactContainer)
    }
    if (!this.querySelector('[data-renderer-container="vue"]')) {
      const vueContainer = document.createElement('div')
      vueContainer.dataset.rendererContainer = 'vue'
      this.append(vueContainer)
    }
    this.reconcile()
  }

  disconnectedCallback(): void {
    this.reactAdapter.clear()
    this.vueAdapter.clear()
  }

  update(value: string): Promise<FixtureUpdateResult> {
    const previousReactButton = this.querySelector('[data-renderer="react"]')
    const previousVueButton = this.querySelector('[data-renderer="vue"]')
    this.value = value
    this.reconcile()
    return nextTick().then(() => {
      const snapshot = this.snapshot()
      return {
        ...snapshot,
        sameReactButton:
          previousReactButton === this.querySelector('[data-renderer="react"]'),
        sameVueButton:
          previousVueButton === this.querySelector('[data-renderer="vue"]'),
      }
    })
  }

  snapshot(): FixtureSnapshot {
    const target = document.querySelector<HTMLElement>(externalTargetSelector)
    return {
      hostConnected: this.isConnected,
      reactText:
        this.querySelector('[data-renderer="react"]')?.textContent ?? '',
      vueText: this.querySelector('[data-renderer="vue"]')?.textContent ?? '',
      portalText:
        target?.querySelector('[data-portal-renderer="react"]')?.textContent ??
        '',
      teleportText:
        target?.querySelector('[data-teleport-renderer="vue"]')?.textContent ??
        '',
      externalTargetExists: target !== null,
      externalSentinelCount:
        target?.querySelectorAll('[data-external-sentinel="true"]').length ?? 0,
      reactMounted: this.reactDiagnostics.mounted,
      reactDisposed: this.reactDiagnostics.disposed,
      vueMounted: this.vueDiagnostics.mounted,
      vueDisposed: this.vueDiagnostics.disposed,
    }
  }

  private reconcile(): void {
    const reactContainer = this.querySelector<HTMLElement>(
      '[data-renderer-container="react"]',
    )
    const vueContainer = this.querySelector<HTMLElement>(
      '[data-renderer-container="vue"]',
    )
    if (!reactContainer || !vueContainer) {
      throw new Error('Framework renderer containers are missing.')
    }
    this.reactAdapter.reconcile([
      createSlot(this.reactRenderer, reactContainer, this.value),
    ])
    this.vueAdapter.reconcile([
      createSlot(this.vueRenderer, vueContainer, this.value),
    ])
  }
}

if (!customElements.get('data-grid-renderer-host')) {
  customElements.define('data-grid-renderer-host', DataGridRendererHost)
}

const host = document.querySelector<DataGridRendererHost>('#renderer-host')
if (!host) throw new Error('Renderer host is missing.')

const fixture: FixtureApi = {
  update(value) {
    return host.update(value)
  },
  disconnect() {
    host.remove()
  },
  reconnect() {
    document.body.append(host)
  },
  snapshot() {
    return host.snapshot()
  },
}

Object.assign(globalThis, { __dataGridFixture: fixture })
