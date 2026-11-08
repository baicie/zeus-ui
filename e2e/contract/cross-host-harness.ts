/**
 * PR-24 cross-host contract harness.
 *
 * Mounts the same core component through all four consumer surfaces and
 * returns the host element so a spec can assert one shared contract:
 *
 * - `wc`     — `document.createElement(tag)` after the built `dist/wc/auto.js`
 * - `react`  — `@zeus-web/<x>/react` (built dist wrapper)
 * - `vue`    — `@zeus-web/<x>/vue` (built dist wrapper)
 * - `native` — Zeus JSX compiled at test time (see `native-hosts.native.tsx`)
 *
 * Mounting is async on purpose. Zeus elements resolve their children's DOM
 * context through the root's `componentOnReady()`, and DataGrid reads its
 * `columns`/`rows` properties before it paints, so a host is only "ready"
 * after one macrotask. Specs never assume otherwise.
 */

import type { DataGridColumn, DataGridRowData } from '@zeus-web/data-grid'
import type { HostName, MountedHost } from './types'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect } from 'vitest'
import { createApp, nextTick } from 'vue'

// Register the Web Component entries the `wc` host uses. The built
// `dist/wc/auto.js` entries are imported on purpose (as the primitive runtime
// specs do): a source alias would skip the lazy registration effect that real
// `@zeus-web/<x>/wc/auto` consumers rely on.
/* eslint-disable antfu/no-import-dist */
import '../../packages/advanced/data-grid/dist/wc/auto.js'
import '../../packages/primitives/dialog/dist/wc/auto.js'
import '../../packages/primitives/form-field/dist/wc/auto.js'
import '../../packages/primitives/input/dist/wc/auto.js'
import '../../packages/primitives/popover/dist/wc/auto.js'
import '../../packages/primitives/select/dist/wc/auto.js'
/* eslint-enable antfu/no-import-dist */

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const disposers: Array<() => Promise<void> | void> = []

function createHostContainer(): HTMLElement {
  const container = globalThis.document.createElement('div')

  globalThis.document.body.append(container)

  return container
}

/** Unmounts everything mounted since the last call (call from afterEach). */
export async function disposeHosts(): Promise<void> {
  while (disposers.length) {
    const dispose = disposers.pop()

    if (dispose) await dispose()
  }

  globalThis.document.body.replaceChildren()
}

/** One animation frame plus a macrotask, matching the runtime specs. */
export async function nextFrame(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise<void>(resolve => {
    setTimeout(resolve, 0)
  })

  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve())
    })
  }
}

async function componentReady(element: HTMLElement): Promise<void> {
  const target = element as HTMLElement & {
    componentOnReady?: () => Promise<void>
  }

  if (typeof target.componentOnReady === 'function') {
    await target.componentOnReady()
  }

  await nextFrame()
}

function waitForElement(container: HTMLElement, tagName: string): HTMLElement {
  const element = container.querySelector(tagName)

  expect(element, `${tagName} should be mounted`).toBeTruthy()

  return element as HTMLElement
}

async function flushReact(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

export function mountWc(
  tagName: string,
  setup?: (element: HTMLElement) => void,
): MountedHost {
  const container = createHostContainer()
  const element = globalThis.document.createElement(tagName)

  setup?.(element)
  container.append(element)
  disposers.push(() => element.remove())

  return {
    host: 'wc',
    element,
    ready: componentReady(element),
    unmount: async () => {
      element.remove()
    },
  }
}

export function mountReact(
  render: () => unknown,
  tagName: string,
  afterMount?: (element: HTMLElement) => void,
): MountedHost {
  const container = createHostContainer()
  const root = createRoot(container)

  act(() => {
    root.render(render() as never)
  })

  // The wrapper may render its element one tick later, so `element` is only
  // valid after `ready` resolves.
  const resolveElement = (): HTMLElement =>
    container.querySelector(tagName) as HTMLElement

  disposers.push(async () => {
    await act(async () => {
      root.unmount()
    })
    await flushReact()
  })

  return {
    host: 'react',
    get element() {
      return resolveElement()
    },
    ready: flushReact()
      .then(() => nextFrame())
      .then(() => {
        const element = waitForElement(container, tagName)

        afterMount?.(element)
        return componentReady(element)
      }),
    unmount: async () => {
      await act(async () => {
        root.unmount()
      })
      await flushReact()
    },
  }
}

export function mountVue(
  render: () => unknown,
  tagName: string,
  afterMount?: (element: HTMLElement) => void,
): MountedHost {
  const container = createHostContainer()
  const app = createApp({ render: render as () => never })

  app.mount(container)

  disposers.push(async () => {
    app.unmount()
    await nextTick()
  })

  return {
    host: 'vue',
    get element() {
      return container.querySelector(tagName) as HTMLElement
    },
    ready: nextTick()
      .then(() => nextFrame())
      .then(() => {
        const element = waitForElement(container, tagName)

        afterMount?.(element)
        return componentReady(element)
      }),
    unmount: async () => {
      app.unmount()
      await nextTick()
    },
  }
}

/**
 * Mounts the result of a compiled `e2e/contract/*.native.tsx` factory.
 *
 * The factory runs inside the spec's scope, so signal ownership and cleanup
 * follow the test lifecycle like any other host.
 */
export function mountNative(
  render: () => HTMLElement,
  tagName: string,
  afterMount?: (element: HTMLElement) => void,
): MountedHost {
  const container = createHostContainer()
  const rendered = render()

  container.append(rendered)

  const element = waitForElement(container, tagName)

  afterMount?.(element)

  disposers.push(() => element.remove())

  return {
    host: 'native',
    element,
    ready: componentReady(element),
    unmount: async () => {
      element.remove()
    },
  }
}

export interface HostFactories {
  native: () => MountedHost
  react: () => MountedHost
  vue: () => MountedHost
  wc: () => MountedHost
}

export const HOST_NAMES: HostName[] = ['wc', 'react', 'vue', 'native']

/** Runs `assert` for each host in turn, disposing each one afterwards. */
export async function forEachHost(
  factories: HostFactories,
  assert: (mounted: MountedHost) => Promise<void> | void,
): Promise<void> {
  for (const name of HOST_NAMES) {
    const mounted = factories[name]()

    await mounted.ready

    try {
      await assert(mounted)
    } finally {
      await mounted.unmount()
    }
  }
}

export const contractColumns: DataGridColumn[] = [
  { id: 'name', header: 'Name', field: 'name', width: 160, sortable: true },
  { id: 'role', header: 'Role', field: 'role', width: 140 },
]

export const contractRows: DataGridRowData[] = [
  { id: 'r1', name: 'Ada', role: 'Engineer' },
  { id: 'r2', name: 'Grace', role: 'Compiler' },
]

/**
 * Polls `selector` inside `root` until it appears or `timeout` elapses.
 *
 * Hosts paint asynchronously (DataGrid computes layout on its own frame), so
 * specs wait for the element instead of assuming a fixed number of ticks.
 */
export async function waitForSelector(
  root: ParentNode,
  selector: string,
  timeout = 1000,
): Promise<HTMLElement> {
  const deadline = Date.now() + timeout

  for (;;) {
    const found = root.querySelector(selector)

    if (found) return found as HTMLElement
    if (Date.now() > deadline) {
      throw new Error(`selector ${selector} did not appear within ${timeout}ms`)
    }

    await nextFrame()
  }
}

/** Waits for one event of `type` and resolves its `detail` object. */
export function nextDetail<T = Record<string, unknown>>(
  target: EventTarget,
  type: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no ${type} event within 1000ms`)),
      1000,
    )

    target.addEventListener(
      type,
      event => {
        clearTimeout(timer)
        resolve((event as CustomEvent<T>).detail)
      },
      { once: true },
    )
  })
}

export type { HostName, MountedHost }
