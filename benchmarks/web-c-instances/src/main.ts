import type { Root } from 'react-dom/client'
import type { App, Component, Ref } from 'vue'
import type {
  WebCInstanceBenchmarkApi,
  WebCInstanceBenchmarkInput,
  WebCInstanceBenchmarkKind,
  WebCMountMetric,
  WebCOperationMetric,
  WebCStructureSnapshot,
} from './benchmark-types'
import { Button as ReactButton } from '@zeus-web/button/react'
import { Button as VueButton } from '@zeus-web/button/vue'
import React from 'react'

import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { createApp, h, nextTick, ref, Fragment as VueFragment } from 'vue'
import { WEB_C_INSTANCE_BENCHMARK_KEY } from './benchmark-types'

import '@zeus-web/accordion/wc/auto'
import '@zeus-web/button/wc/auto'

interface BenchmarkAccordionElement extends HTMLElement {
  value?: string
}

interface BenchmarkScenarioState {
  container: HTMLElement
  update: () => Promise<void>
  dispose: () => Promise<void>
}

type BenchmarkOperation = () => void | Promise<void>

let activeState: BenchmarkScenarioState | undefined

function createContainer(): HTMLElement {
  const container = globalThis.document.createElement('div')
  container.dataset.benchmarkContainer = 'true'
  return container
}

function forceLayout(): void {
  void globalThis.document.body.offsetHeight
}

function measureOperation(
  operation: BenchmarkOperation,
): Promise<WebCOperationMetric> {
  const start = globalThis.performance.now()

  return Promise.resolve()
    .then(operation)
    .then(() => {
      forceLayout()
      return {
        durationMs: globalThis.performance.now() - start,
      }
    })
}

function getZeusElements(root: HTMLElement): HTMLElement[] {
  const descendants = Array.from(root.querySelectorAll<HTMLElement>('*'))

  return [root].concat(descendants).filter(element => {
    return element.localName.startsWith('zw-')
  })
}

function waitForZeusElements(root: HTMLElement): Promise<void> {
  return Promise.all(
    getZeusElements(root).map(element => {
      return globalThis.customElements
        .whenDefined(element.localName)
        .then(() => {
          const componentOnReady = Reflect.get(element, 'componentOnReady')

          if (typeof componentOnReady !== 'function') return undefined
          return Reflect.apply(componentOnReady, element, [])
        })
    }),
  ).then(() => {})
}

function createNativeButtonState(
  count: number,
  tagName: 'button' | 'zw-button',
): BenchmarkScenarioState {
  const container = createContainer()
  const fragment = globalThis.document.createDocumentFragment()
  const elements: HTMLElement[] = []
  let updated = false

  for (let index = 0; index < count; index += 1) {
    const element = globalThis.document.createElement(tagName)
    element.textContent = `Button ${index + 1}`
    elements.push(element)
    fragment.append(element)
  }

  container.append(fragment)
  globalThis.document.body.append(container)

  return {
    container,
    update() {
      updated = !updated

      for (const element of elements) {
        if (tagName === 'button') {
          ;(element as HTMLButtonElement).disabled = updated
        } else {
          Reflect.set(element, 'pressed', updated)
        }
      }

      return Promise.resolve()
    },
    dispose() {
      container.remove()
      elements.length = 0
      return Promise.resolve()
    },
  }
}

function renderReactButtons(root: Root, count: number, pressed: boolean): void {
  const Component = ReactButton as unknown as React.ElementType
  const children = Array.from({ length: count }, (_, index) => {
    return React.createElement(
      Component,
      {
        key: index,
        pressed,
      },
      `Button ${index + 1}`,
    )
  })

  flushSync(() => {
    root.render(React.createElement(React.Fragment, null, children))
  })
}

function createReactButtonState(count: number): BenchmarkScenarioState {
  const container = createContainer()
  const root = createRoot(container)
  let pressed = false

  globalThis.document.body.append(container)
  renderReactButtons(root, count, pressed)

  return {
    container,
    update() {
      pressed = !pressed
      renderReactButtons(root, count, pressed)
      return Promise.resolve()
    },
    dispose() {
      root.unmount()
      container.remove()
      return Promise.resolve()
    },
  }
}

function renderVueButtons(
  count: number,
  pressed: Ref<boolean>,
): ReturnType<typeof h> {
  const ComponentDefinition = VueButton as unknown as Component

  return h(
    VueFragment,
    null,
    Array.from({ length: count }, (_, index) => {
      return h(
        ComponentDefinition,
        {
          key: index,
          pressed: pressed.value,
        },
        () => `Button ${index + 1}`,
      )
    }),
  )
}

function createVueButtonState(count: number): BenchmarkScenarioState {
  const container = createContainer()
  const pressed = ref(false)
  const app: App = createApp({
    render() {
      return renderVueButtons(count, pressed)
    },
  })

  globalThis.document.body.append(container)
  app.mount(container)

  return {
    container,
    update() {
      pressed.value = !pressed.value
      return nextTick().then(() => {})
    },
    dispose() {
      app.unmount()
      container.remove()
      return Promise.resolve()
    },
  }
}

function createAccordionItem(index: number): HTMLElement {
  const item = globalThis.document.createElement('zw-accordion-item')
  const trigger = globalThis.document.createElement('zw-accordion-trigger')
  const content = globalThis.document.createElement('zw-accordion-content')

  item.setAttribute('value', `item-${index}`)
  trigger.textContent = `Trigger ${index}`
  content.textContent = `Content ${index}`
  item.append(trigger, content)

  return item
}

function createNativeAccordionState(count: number): BenchmarkScenarioState {
  const container = createContainer()
  const accordion = globalThis.document.createElement(
    'zw-accordion',
  ) as BenchmarkAccordionElement
  const fragment = globalThis.document.createDocumentFragment()
  let selectedIndex = 0

  for (let index = 0; index < count; index += 1) {
    fragment.append(createAccordionItem(index))
  }

  accordion.append(fragment)
  container.append(accordion)
  globalThis.document.body.append(container)

  return {
    container,
    update() {
      selectedIndex = (selectedIndex + 1) % count
      accordion.value = `item-${selectedIndex}`
      return Promise.resolve()
    },
    dispose() {
      container.remove()
      return Promise.resolve()
    },
  }
}

function assertPositiveCount(count: number): void {
  if (!Number.isInteger(count) || count <= 0) {
    throw new TypeError('Benchmark instance count must be a positive integer.')
  }
}

function createScenarioState(
  input: WebCInstanceBenchmarkInput,
): BenchmarkScenarioState {
  assertPositiveCount(input.count)

  switch (input.kind) {
    case 'native-button-baseline':
      return createNativeButtonState(input.count, 'button')
    case 'native-button':
      return createNativeButtonState(input.count, 'zw-button')
    case 'react-button':
      return createReactButtonState(input.count)
    case 'vue-button':
      return createVueButtonState(input.count)
    case 'native-accordion':
      return createNativeAccordionState(input.count)
  }
}

function getActiveState(): BenchmarkScenarioState {
  if (!activeState) throw new Error('No benchmark scenario is mounted.')
  return activeState
}

function getStructureSnapshot(container: HTMLElement): WebCStructureSnapshot {
  const elements = [container].concat(
    Array.from(container.querySelectorAll<HTMLElement>('*')),
  )

  return {
    buttonCount: container.querySelectorAll('button').length,
    customElementCount: elements.filter(element => {
      return element.localName.startsWith('zw-')
    }).length,
    totalElementCount: elements.length,
    updatedElementCount: container.querySelectorAll(
      '[pressed], button:disabled, zw-accordion[value]',
    ).length,
  }
}

function mount(input: WebCInstanceBenchmarkInput): Promise<WebCMountMetric> {
  if (activeState) {
    return Promise.reject(new Error('A benchmark scenario is already mounted.'))
  }

  return measureOperation(() => {
    activeState = createScenarioState(input)
    return waitForZeusElements(activeState.container)
  }).then(metric => {
    return {
      durationMs: metric.durationMs,
      structure: getStructureSnapshot(getActiveState().container),
    }
  })
}

function update(): Promise<WebCOperationMetric> {
  const state = getActiveState()
  return measureOperation(() => state.update())
}

function disconnect(): Promise<WebCOperationMetric> {
  const state = getActiveState()
  return measureOperation(() => {
    state.container.remove()
  })
}

function reconnect(): Promise<WebCOperationMetric> {
  const state = getActiveState()
  return measureOperation(() => {
    globalThis.document.body.append(state.container)
    return waitForZeusElements(state.container)
  })
}

function dispose(): Promise<WebCOperationMetric> {
  const state = getActiveState()

  return measureOperation(() => state.dispose()).then(metric => {
    activeState = undefined
    return metric
  })
}

function prepare(kind: WebCInstanceBenchmarkKind): Promise<void> {
  return mount({ kind, count: 1 })
    .then(() => dispose())
    .then(() => {})
}

const benchmarkApi: WebCInstanceBenchmarkApi = {
  prepare,
  mount,
  update,
  disconnect,
  reconnect,
  dispose,
  snapshot() {
    return getStructureSnapshot(getActiveState().container)
  },
}

Reflect.set(globalThis, WEB_C_INSTANCE_BENCHMARK_KEY, benchmarkApi)
globalThis.document.body.dataset.benchmarkReady = 'true'
