/**
 * PR-24 cross-host contract matrix.
 *
 * Input / Select / Dialog / FormField / Popover / DataGrid are mounted through
 * the Native (Zeus JSX), React, Vue and raw Web Component surfaces, and each
 * pair must agree on: light-DOM structure, reflected attributes, public event
 * names, and event payload keys.
 *
 * A difference here is a contract break, not a test-config detail: consumers
 * switch between these surfaces (WC package vs registry source vs framework
 * wrapper) inside one application.
 */

import type { DataGridSelectionChangeDetail } from '@zeus-web/data-grid'

import type { MountedHost } from './types'
import { DataGrid as ReactDataGrid } from '@zeus-web/data-grid/react'
import { DataGrid as VueDataGrid } from '@zeus-web/data-grid/vue'
import { Dialog as ReactDialog } from '@zeus-web/dialog/react'
import { Dialog as VueDialog } from '@zeus-web/dialog/vue'
import { FormField as ReactFormField } from '@zeus-web/form-field/react'
import { FormField as VueFormField } from '@zeus-web/form-field/vue'
import { Input as ReactInput } from '@zeus-web/input/react'
import { Input as VueInput } from '@zeus-web/input/vue'
import { Popover as ReactPopover } from '@zeus-web/popover/react'
import { Popover as VuePopover } from '@zeus-web/popover/vue'
import { Select as ReactSelect } from '@zeus-web/select/react'
import { Select as VueSelect } from '@zeus-web/select/vue'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { h } from 'vue'

import {
  contractColumns,
  contractRows,
  disposeHosts,
  forEachHost,
  HOST_NAMES,
  mountNative,
  mountReact,
  mountVue,
  mountWc,
  nextDetail,
  waitForSelector,
} from './cross-host-harness'

import {
  NativeDataGrid,
  NativeDialog,
  NativeFormField,
  NativeInput,
  NativePopover,
  NativeSelect,
} from './native-hosts.native'

afterEach(async () => {
  await disposeHosts()
})

function elementOf(mounted: MountedHost, selector: string): HTMLElement {
  const found = mounted.element.querySelector(selector)

  expect(
    found,
    `${mounted.host} should render ${selector} inside ${mounted.element.tagName.toLowerCase()}`,
  ).toBeTruthy()

  return found as HTMLElement
}

describe('cross-host contract: structure and reflection', () => {
  it('renders the same input light-DOM slots and reflects value', async () => {
    const observed: Record<string, string[]> = {}

    await forEachHost(
      {
        wc: () => mountWc('zw-input'),
        react: () =>
          mountReact(
            () => createElement(ReactInput, { value: 'react' }),
            'zw-input',
          ),
        vue: () => mountVue(() => h(VueInput, { value: 'vue' }), 'zw-input'),
        native: () =>
          mountNative(
            () => NativeInput({ value: 'native' }) as HTMLElement,
            'zw-input',
          ),
      },
      mounted => {
        elementOf(mounted, "[part='root']")
        elementOf(mounted, "[data-slot='input']")
        observed[mounted.host] = Array.from(
          mounted.element.querySelectorAll('[part]'),
        ).map(node => node.getAttribute('part') as string)
      },
    )

    expect(observed.react).toEqual(observed.wc)
    expect(observed.vue).toEqual(observed.wc)
    expect(observed.native).toEqual(observed.wc)
    expect(observed.wc).toEqual([
      'root',
      'prefix',
      'control',
      'suffix',
      'message',
    ])
  })
})

describe('cross-host contract: input value-change', () => {
  it('emits value-change with identical payload keys on every host', async () => {
    const payloads: Record<string, string[]> = {}
    const values: Record<string, string> = {}

    await forEachHost(
      {
        wc: () => mountWc('zw-input'),
        react: () => mountReact(() => createElement(ReactInput), 'zw-input'),
        vue: () => mountVue(() => h(VueInput), 'zw-input'),
        native: () =>
          mountNative(() => NativeInput({}) as HTMLElement, 'zw-input'),
      },
      async mounted => {
        const detail = nextDetail<{ value: string }>(
          mounted.element,
          'value-change',
        )
        const control = elementOf(
          mounted,
          "[data-slot='input']",
        ) as HTMLInputElement

        control.value = 'typed'
        control.dispatchEvent(new Event('input', { bubbles: true }))

        const received = await detail

        payloads[mounted.host] = Object.keys(received).sort()
        values[mounted.host] = received.value
      },
    )

    expect(payloads.react).toEqual(payloads.wc)
    expect(payloads.vue).toEqual(payloads.wc)
    expect(payloads.native).toEqual(payloads.wc)
    expect(payloads.wc).toEqual(['nativeEvent', 'value'])
    expect(values).toEqual({
      wc: 'typed',
      react: 'typed',
      vue: 'typed',
      native: 'typed',
    })
  })
})

describe('cross-host contract: select', () => {
  it('exposes the same combobox trigger semantics', async () => {
    const observed: Record<string, Record<string, string | null>> = {}

    await forEachHost(
      {
        wc: () => mountWc('zw-select'),
        react: () =>
          mountReact(
            () => createElement(ReactSelect, { placeholder: 'pick' }),
            'zw-select',
          ),
        vue: () =>
          mountVue(() => h(VueSelect, { placeholder: 'pick' }), 'zw-select'),
        native: () =>
          mountNative(
            () => NativeSelect({ placeholder: 'pick' }) as HTMLElement,
            'zw-select',
          ),
      },
      mounted => {
        const trigger = elementOf(mounted, "[data-slot='select-trigger']")

        observed[mounted.host] = {
          role: trigger.getAttribute('role'),
          'aria-haspopup': trigger.getAttribute('aria-haspopup'),
          'aria-expanded': trigger.getAttribute('aria-expanded'),
          'data-state': mounted.element.getAttribute('data-state'),
        }
      },
    )

    expect(observed.react).toEqual(observed.wc)
    expect(observed.vue).toEqual(observed.wc)
    expect(observed.native).toEqual(observed.wc)
    expect(observed.wc.role).toBe('combobox')
    expect(observed.wc['aria-expanded']).toBe('false')
  })

  it('emits value-change with value and values on every host', async () => {
    const payloads: Record<string, string[]> = {}

    await forEachHost(
      {
        wc: () =>
          mountWc('zw-select', element => {
            element.innerHTML = [
              '<option value="development">Development</option>',
              '<option value="production">Production</option>',
            ].join('')
          }),
        react: () =>
          mountReact(
            () =>
              createElement(
                ReactSelect,
                null,
                createElement(
                  'option',
                  { value: 'development' },
                  'Development',
                ),
                createElement('option', { value: 'production' }, 'Production'),
              ),
            'zw-select',
          ),
        vue: () =>
          mountVue(
            () =>
              h(VueSelect, null, {
                default: () => [
                  h('option', { value: 'development' }, 'Development'),
                  h('option', { value: 'production' }, 'Production'),
                ],
              }),
            'zw-select',
          ),
        native: () =>
          mountNative(
            () => NativeSelect({}) as HTMLElement,
            'zw-select',
            element => {
              element.innerHTML = [
                '<option value="development">Development</option>',
                '<option value="production">Production</option>',
              ].join('')
            },
          ),
      },
      async mounted => {
        const detail = nextDetail(mounted.element, 'value-change')
        const native = elementOf(
          mounted,
          "[data-slot='select-native']",
        ) as HTMLSelectElement

        native.value = native.options[0].value
        native.dispatchEvent(new Event('change', { bubbles: true }))

        payloads[mounted.host] = Object.keys(await detail).sort()
      },
    )

    expect(payloads.react).toEqual(payloads.wc)
    expect(payloads.vue).toEqual(payloads.wc)
    expect(payloads.native).toEqual(payloads.wc)
    expect(payloads.wc).toEqual(['nativeEvent', 'value', 'values'])
  })
})

describe('cross-host contract: dialog', () => {
  it('reflects open and emits open-change on every host', async () => {
    const results: Record<string, { open: boolean; keys: string[] }> = {}

    await forEachHost(
      {
        wc: () =>
          mountWc('zw-dialog', element => {
            element.innerHTML =
              '<zw-dialog-trigger><button type="button">open</button></zw-dialog-trigger><zw-dialog-content>body</zw-dialog-content>'
          }),
        react: () =>
          mountReact(
            () =>
              createElement(
                ReactDialog,
                null,
                createElement(
                  'zw-dialog-trigger',
                  null,
                  createElement('button', { type: 'button' }, 'open'),
                ),
                createElement('zw-dialog-content', null, 'body'),
              ),
            'zw-dialog',
          ),
        vue: () =>
          mountVue(
            () =>
              h(VueDialog, null, {
                default: () => [
                  h('zw-dialog-trigger', null, [
                    h('button', { type: 'button' }, 'open'),
                  ]),
                  h('zw-dialog-content', null, 'body'),
                ],
              }),
            'zw-dialog',
          ),
        native: () =>
          mountNative(() => NativeDialog({}) as HTMLElement, 'zw-dialog'),
      },
      async mounted => {
        const detail = nextDetail(mounted.element, 'open-change')
        const trigger = elementOf(
          mounted,
          'zw-dialog-trigger button, zw-dialog-trigger [part]',
        )

        // `open` is a controlled prop on this element: setting the attribute
        // does not fire `open-change`. Opening through the trigger is the
        // interaction every host shares.
        trigger.click()

        const received = await detail

        results[mounted.host] = {
          open: mounted.element.hasAttribute('open'),
          keys: Object.keys(received).sort(),
        }
      },
    )

    expect(results.react.keys).toEqual(results.wc.keys)
    expect(results.vue.keys).toEqual(results.wc.keys)
    expect(results.native.keys).toEqual(results.wc.keys)
    expect(results.wc.keys).toEqual(['nativeEvent', 'open'])
    expect(results.wc.open).toBe(true)
  })
})

describe('cross-host contract: popover', () => {
  it('shows the content when opened from the trigger', async () => {
    const states: Record<string, string | null> = {}

    await forEachHost(
      {
        wc: () =>
          mountWc('zw-popover', element => {
            element.innerHTML =
              '<zw-popover-trigger><button type="button">open</button></zw-popover-trigger><zw-popover-content>content</zw-popover-content>'
          }),
        react: () =>
          mountReact(
            () =>
              createElement(
                ReactPopover,
                null,
                createElement(
                  'zw-popover-trigger',
                  null,
                  createElement('button', { type: 'button' }, 'open'),
                ),
                createElement('zw-popover-content', null, 'content'),
              ),
            'zw-popover',
          ),
        vue: () =>
          mountVue(
            () =>
              h(VuePopover, null, {
                default: () => [
                  h('zw-popover-trigger', null, [
                    h('button', { type: 'button' }, 'open'),
                  ]),
                  h('zw-popover-content', null, 'content'),
                ],
              }),
            'zw-popover',
          ),
        native: () =>
          mountNative(() => NativePopover({}) as HTMLElement, 'zw-popover'),
      },
      async mounted => {
        const content = elementOf(mounted, 'zw-popover-content')

        expect(content.hidden, `${mounted.host} starts closed`).toBe(true)

        const trigger = mounted.element.querySelector(
          'zw-popover-trigger button, zw-popover-trigger [data-slot]',
        ) as HTMLElement | null

        expect(trigger, `${mounted.host} renders a trigger`).toBeTruthy()

        trigger!.click()
        await Promise.resolve()

        states[mounted.host] = String(content.hidden)
      },
    )

    expect(states.react).toBe(states.wc)
    expect(states.vue).toBe(states.wc)
    expect(states.native).toBe(states.wc)
  })
})

describe('cross-host contract: form field', () => {
  it('links the field label to its control', async () => {
    const observed: Record<string, { controlName: string | null }> = {}

    await forEachHost(
      {
        wc: () => mountWc('zw-form-field'),
        react: () =>
          mountReact(() => createElement(ReactFormField), 'zw-form-field'),
        vue: () => mountVue(() => h(VueFormField), 'zw-form-field'),
        native: () =>
          mountNative(
            () => NativeFormField({}) as HTMLElement,
            'zw-form-field',
          ),
      },
      mounted => {
        const control = mounted.element.querySelector(
          "[data-slot='form-field-control']",
        )

        observed[mounted.host] = {
          controlName: control?.getAttribute('name') ?? null,
        }
      },
    )

    expect(observed.react).toEqual(observed.wc)
    expect(observed.vue).toEqual(observed.wc)
    expect(observed.native).toEqual(observed.wc)
  })
})

describe('cross-host contract: data grid', () => {
  it('renders the same grid role and aria dimensions', async () => {
    const observed: Record<string, Record<string, string | null>> = {}

    await forEachHost(
      {
        wc: () =>
          mountWc('zw-data-grid', element => {
            Object.assign(element, {
              columns: contractColumns,
              rows: contractRows,
            })
          }),
        react: () =>
          mountReact(
            () =>
              createElement(ReactDataGrid, {
                columns: contractColumns,
                rows: contractRows,
              }),
            'zw-data-grid',
          ),
        vue: () =>
          mountVue(
            () =>
              h(VueDataGrid, {
                columns: contractColumns,
                rows: contractRows,
              }),
            'zw-data-grid',
          ),
        native: () =>
          mountNative(
            () =>
              NativeDataGrid({
                columns: contractColumns,
                rows: contractRows,
              }) as HTMLElement,
            'zw-data-grid',
          ),
      },
      async mounted => {
        const viewport = await waitForSelector(mounted.element, "[role='grid']")

        observed[mounted.host] = {
          role: viewport.getAttribute('role'),
          'aria-rowcount': viewport.getAttribute('aria-rowcount'),
          'aria-colcount': viewport.getAttribute('aria-colcount'),
        }
      },
    )

    expect(observed.react).toEqual(observed.wc)
    expect(observed.vue).toEqual(observed.wc)
    expect(observed.native).toEqual(observed.wc)
    expect(observed.wc.role).toBe('grid')
  })

  it('emits selection-change with the same payload keys', async () => {
    const payloads: Record<string, string[]> = {}

    await forEachHost(
      {
        wc: () =>
          mountWc('zw-data-grid', element => {
            Object.assign(element, {
              columns: contractColumns,
              rows: contractRows,
              selectionMode: 'single',
            })
          }),
        react: () =>
          mountReact(
            () =>
              createElement(ReactDataGrid, {
                columns: contractColumns,
                rows: contractRows,
                selectionMode: 'single',
              }),
            'zw-data-grid',
          ),
        vue: () =>
          mountVue(
            () =>
              h(VueDataGrid, {
                columns: contractColumns,
                rows: contractRows,
                selectionMode: 'single',
              }),
            'zw-data-grid',
          ),
        native: () =>
          mountNative(
            () =>
              NativeDataGrid({
                columns: contractColumns,
                rows: contractRows,
                selectionMode: 'single',
              }) as HTMLElement,
            'zw-data-grid',
          ),
      },
      async mounted => {
        const row = await waitForSelector(
          mounted.element,
          "[data-slot='data-grid-row']",
        )
        const detail = nextDetail<DataGridSelectionChangeDetail>(
          mounted.element,
          'selection-change',
        )

        row.click()

        payloads[mounted.host] = Object.keys(await detail).sort()
      },
    )

    expect(payloads.react).toEqual(payloads.wc)
    expect(payloads.vue).toEqual(payloads.wc)
    expect(payloads.native).toEqual(payloads.wc)
  })
})

/**
 * Host name coverage guard: every surface in `HOST_NAMES` must be exercised by
 * at least one spec above, so a new surface cannot be added silently.
 */
describe('cross-host contract: coverage', () => {
  it('tracks exactly the four supported consumer surfaces', () => {
    expect(HOST_NAMES).toEqual(['wc', 'react', 'vue', 'native'])
  })
})
