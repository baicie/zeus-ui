/**
 * PR-24 accessibility and keyboard contract, automated in jsdom.
 *
 * These are the checks that do not need a real browser: ARIA wiring computed
 * from the DOM, label/description linking, focus movement, and the keyboard
 * script each surface must share. Anything that needs layout or paint (200%
 * zoom, RTL mirroring, focus-visible rendering) is out of scope here and is
 * covered by `manual-acceptance.md`.
 */

import type { MountedHost } from './types'

import { DataGrid as ReactDataGrid } from '@zeus-web/data-grid/react'
import { DataGrid as VueDataGrid } from '@zeus-web/data-grid/vue'
import { Dialog as ReactDialog } from '@zeus-web/dialog/react'
import { Dialog as VueDialog } from '@zeus-web/dialog/vue'
import { FormField as ReactFormField } from '@zeus-web/form-field/react'
import { FormField as VueFormField } from '@zeus-web/form-field/vue'
import { Input as ReactInput } from '@zeus-web/input/react'
import { Input as VueInput } from '@zeus-web/input/vue'
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
  mountNative,
  mountReact,
  mountVue,
  mountWc,
  nextFrame,
  waitForSelector,
} from './cross-host-harness'

import {
  NativeDataGrid,
  NativeDialog,
  NativeFormField,
  NativeInput,
  NativeSelect,
} from './native-hosts.native'

afterEach(async () => {
  await disposeHosts()
})

/** Dispatches a keydown that bubbles out of `target`. */
function press(target: EventTarget, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  })

  target.dispatchEvent(event)

  return event
}

function focused(mounted: MountedHost): Element | null {
  return mounted.element.ownerDocument.activeElement
}

function within(mounted: MountedHost, node: Element | null): boolean {
  return Boolean(node && mounted.element.contains(node))
}

const selectOptionsHtml =
  '<option value="a">Alpha</option><option value="b">Beta</option>'

describe('a11y contract: input', () => {
  it('reports invalid state and its accessible name on the native control', async () => {
    await forEachHost(
      {
        wc: () =>
          mountWc('zw-input', element => {
            element.setAttribute('aria-label', 'Email')
            element.setAttribute('invalid', '')
            element.setAttribute('required', '')
          }),
        react: () =>
          mountReact(
            () =>
              createElement(ReactInput, {
                ariaLabel: 'Email',
                invalid: true,
                required: true,
              }),
            'zw-input',
          ),
        vue: () =>
          mountVue(
            () =>
              h(VueInput, {
                ariaLabel: 'Email',
                invalid: true,
                required: true,
              }),
            'zw-input',
          ),
        native: () =>
          mountNative(
            () =>
              NativeInput({
                ariaLabel: 'Email',
                invalid: true,
                required: true,
              }) as HTMLElement,
            'zw-input',
          ),
      },
      mounted => {
        const control = mounted.element.querySelector(
          "[data-slot='input']",
        ) as HTMLInputElement

        expect(control, `${mounted.host} renders a native input`).toBeTruthy()
        expect(control.getAttribute('aria-invalid')).toBe('true')
        expect(control.getAttribute('aria-label')).toBe('Email')
        // `required` is the native constraint; `aria-required` is added by
        // `zw-form-field-control`, not by the input itself.
        expect(control.hasAttribute('required')).toBe(true)
      },
    )
  })

  it('keeps the control focusable and emits focus-change once per focus', async () => {
    const counts: Record<string, number> = {}

    await forEachHost(
      {
        wc: () => mountWc('zw-input'),
        react: () => mountReact(() => createElement(ReactInput), 'zw-input'),
        vue: () => mountVue(() => h(VueInput), 'zw-input'),
        native: () =>
          mountNative(() => NativeInput({}) as HTMLElement, 'zw-input'),
      },
      async mounted => {
        const control = mounted.element.querySelector(
          "[data-slot='input']",
        ) as HTMLInputElement
        let count = 0

        mounted.element.addEventListener('focus-change', () => {
          count += 1
        })

        control.focus()
        await nextFrame()

        expect(focused(mounted)).toBe(control)
        expect(count).toBe(1)
        counts[mounted.host] = count
      },
    )

    expect(counts).toEqual({ wc: 1, react: 1, vue: 1, native: 1 })
  })
})

describe('a11y contract: select keyboard script', () => {
  it('opens with ArrowDown, moves activation, and closes with Escape', async () => {
    await forEachHost(
      {
        wc: () =>
          mountWc('zw-select', element => {
            element.innerHTML = selectOptionsHtml
          }),
        react: () =>
          mountReact(
            () =>
              createElement(
                ReactSelect,
                null,
                createElement('option', { value: 'a' }, 'Alpha'),
                createElement('option', { value: 'b' }, 'Beta'),
              ),
            'zw-select',
          ),
        vue: () =>
          mountVue(
            () =>
              h(VueSelect, null, {
                default: () => [
                  h('option', { value: 'a' }, 'Alpha'),
                  h('option', { value: 'b' }, 'Beta'),
                ],
              }),
            'zw-select',
          ),
        native: () =>
          mountNative(
            () => NativeSelect({}) as HTMLElement,
            'zw-select',
            element => {
              element.innerHTML = selectOptionsHtml
            },
          ),
      },
      async mounted => {
        const trigger = mounted.element.querySelector(
          "[data-slot='select-trigger']",
        ) as HTMLElement
        const content = await waitForSelector(
          mounted.element,
          "[data-slot='select-content']",
        )

        press(trigger, 'ArrowDown')
        await nextFrame()

        expect(trigger.getAttribute('aria-expanded')).toBe('true')
        expect(content.hidden).toBe(false)
        expect(trigger.getAttribute('aria-activedescendant')).toBeTruthy()

        press(trigger, 'ArrowDown')
        await nextFrame()

        const activeId = trigger.getAttribute('aria-activedescendant') as string
        const active = mounted.element.ownerDocument.getElementById(activeId)

        expect(active, `${mounted.host} marks an active option`).toBeTruthy()
        expect(active?.getAttribute('role')).toBe('option')

        press(trigger, 'Escape')
        await nextFrame()

        expect(trigger.getAttribute('aria-expanded')).toBe('false')
        expect(content.hidden).toBe(true)
      },
    )
  })

  it('commits the active option on Enter', async () => {
    const values: Record<string, string | undefined> = {}

    await forEachHost(
      {
        wc: () =>
          mountWc('zw-select', element => {
            element.innerHTML = selectOptionsHtml
          }),
        react: () =>
          mountReact(
            () =>
              createElement(
                ReactSelect,
                null,
                createElement('option', { value: 'a' }, 'Alpha'),
                createElement('option', { value: 'b' }, 'Beta'),
              ),
            'zw-select',
          ),
        vue: () =>
          mountVue(
            () =>
              h(VueSelect, null, {
                default: () => [
                  h('option', { value: 'a' }, 'Alpha'),
                  h('option', { value: 'b' }, 'Beta'),
                ],
              }),
            'zw-select',
          ),
        native: () =>
          mountNative(
            () => NativeSelect({}) as HTMLElement,
            'zw-select',
            element => {
              element.innerHTML = selectOptionsHtml
            },
          ),
      },
      async mounted => {
        const trigger = mounted.element.querySelector(
          "[data-slot='select-trigger']",
        ) as HTMLElement

        press(trigger, 'ArrowDown')
        await nextFrame()
        press(trigger, 'ArrowDown')
        await nextFrame()
        press(trigger, 'Enter')
        await nextFrame()

        values[mounted.host] = (
          mounted.element as HTMLElement & { value?: string }
        ).value
      },
    )

    expect(values.react).toBe(values.wc)
    expect(values.vue).toBe(values.wc)
    expect(values.native).toBe(values.wc)
    expect(values.wc).toBe('b')
  })
})

describe('a11y contract: dialog', () => {
  it('moves focus into the panel and restores it to the trigger on Escape', async () => {
    await forEachHost(
      {
        wc: () =>
          mountWc('zw-dialog', element => {
            element.innerHTML =
              '<zw-dialog-trigger><button type="button">open</button></zw-dialog-trigger><zw-dialog-content><button type="button">ok</button></zw-dialog-content>'
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
                createElement(
                  'zw-dialog-content',
                  null,
                  createElement('button', { type: 'button' }, 'ok'),
                ),
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
                  h('zw-dialog-content', null, [
                    h('button', { type: 'button' }, 'ok'),
                  ]),
                ],
              }),
            'zw-dialog',
          ),
        native: () =>
          mountNative(() => NativeDialog({}) as HTMLElement, 'zw-dialog'),
      },
      async mounted => {
        const trigger = mounted.element.querySelector(
          'zw-dialog-trigger button',
        ) as HTMLElement
        const panel = await waitForSelector(mounted.element, "[part='content']")

        trigger.focus()
        trigger.click()
        await nextFrame()
        await nextFrame()

        expect(
          within(mounted, focused(mounted)),
          `${mounted.host} moves focus into the panel`,
        ).toBe(true)
        expect(panel.getAttribute('role')).toBe('dialog')
        expect(panel.getAttribute('aria-modal')).toBe('true')

        press(focused(mounted) as EventTarget, 'Escape')
        await nextFrame()
        await nextFrame()

        expect(
          mounted.element.hasAttribute('open'),
          `${mounted.host} closes on Escape`,
        ).toBe(false)
        expect(
          focused(mounted),
          `${mounted.host} returns focus to the trigger`,
        ).toBe(trigger)
      },
    )
  })

  it('links the panel to its title and description', async () => {
    await forEachHost(
      {
        wc: () =>
          mountWc('zw-dialog', element => {
            element.innerHTML =
              '<zw-dialog-trigger><button type="button">open</button></zw-dialog-trigger><zw-dialog-content><zw-dialog-title>Title</zw-dialog-title><zw-dialog-description>Body</zw-dialog-description></zw-dialog-content>'
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
                createElement(
                  'zw-dialog-content',
                  null,
                  createElement('zw-dialog-title', null, 'Title'),
                  createElement('zw-dialog-description', null, 'Body'),
                ),
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
                  h('zw-dialog-content', null, [
                    h('zw-dialog-title', null, 'Title'),
                    h('zw-dialog-description', null, 'Body'),
                  ]),
                ],
              }),
            'zw-dialog',
          ),
        native: () =>
          mountNative(
            () => NativeDialog({}) as HTMLElement,
            'zw-dialog',
            element => {
              element
                .querySelector('zw-dialog-content')
                ?.append(
                  globalThis.document.createElement('zw-dialog-title'),
                  globalThis.document.createElement('zw-dialog-description'),
                )
              const title = element.querySelector('zw-dialog-title')
              const description = element.querySelector('zw-dialog-description')

              if (title) title.textContent = 'Title'
              if (description) description.textContent = 'Body'
            },
          ),
      },
      async mounted => {
        const panel = await waitForSelector(mounted.element, "[part='content']")
        const labelledby = panel.getAttribute('aria-labelledby')
        const describedby = panel.getAttribute('aria-describedby')

        expect(labelledby, `${mounted.host} labels the dialog`).toBeTruthy()
        expect(describedby, `${mounted.host} describes the dialog`).toBeTruthy()
        expect(
          mounted.element.ownerDocument.getElementById(labelledby as string)
            ?.textContent,
        ).toBe('Title')
        expect(
          mounted.element.ownerDocument.getElementById(describedby as string)
            ?.textContent,
        ).toBe('Body')
      },
    )
  })
})

describe('a11y contract: form field', () => {
  it('links label, description and message to the managed control', async () => {
    await forEachHost(
      {
        wc: () =>
          mountWc('zw-form-field', element => {
            element.setAttribute('invalid', '')
            element.setAttribute('required', '')
            element.innerHTML =
              '<zw-form-field-label>Email</zw-form-field-label><zw-form-field-description>Help</zw-form-field-description><zw-form-field-control><input type="email"></zw-form-field-control><zw-form-field-message>Required</zw-form-field-message>'
          }),
        react: () =>
          mountReact(
            () =>
              createElement(
                ReactFormField,
                { invalid: true, required: true },
                createElement('zw-form-field-label', null, 'Email'),
                createElement('zw-form-field-description', null, 'Help'),
                createElement(
                  'zw-form-field-control',
                  null,
                  createElement('input', { type: 'email' }),
                ),
                createElement('zw-form-field-message', null, 'Required'),
              ),
            'zw-form-field',
          ),
        vue: () =>
          mountVue(
            () =>
              h(
                VueFormField,
                { invalid: true, required: true },
                {
                  default: () => [
                    h('zw-form-field-label', null, 'Email'),
                    h('zw-form-field-description', null, 'Help'),
                    h('zw-form-field-control', null, [
                      h('input', { type: 'email' }),
                    ]),
                    h('zw-form-field-message', null, 'Required'),
                  ],
                },
              ),
            'zw-form-field',
          ),
        native: () =>
          mountNative(
            () =>
              NativeFormField({ invalid: true, required: true }) as HTMLElement,
            'zw-form-field',
          ),
      },
      async mounted => {
        const label = await waitForSelector(
          mounted.element,
          "[data-slot='form-field-label'] label",
        )
        const control = (await waitForSelector(
          mounted.element,
          'input',
        )) as HTMLInputElement
        const description = await waitForSelector(
          mounted.element,
          "[data-slot='form-field-description']",
        )
        const message = await waitForSelector(
          mounted.element,
          "[data-slot='form-field-message']",
        )

        expect(
          control.id,
          `${mounted.host} generates a control id`,
        ).toBeTruthy()
        expect(label.getAttribute('for')).toBe(control.id)

        const describedBy = (control.getAttribute('aria-describedby') || '')
          .split(/\s+/)
          .filter(Boolean)

        expect(describedBy).toContain(description.id)
        expect(describedBy).toContain(message.id)
        expect(control.getAttribute('aria-invalid')).toBe('true')
        expect(control.getAttribute('aria-required')).toBe('true')
      },
    )
  })
})

describe('a11y contract: data grid keyboard navigation', () => {
  function gridFixtureProps() {
    return { columns: contractColumns, rows: contractRows }
  }

  it('keeps a single tab stop and moves the active cell with arrow keys', async () => {
    await forEachHost(
      {
        wc: () =>
          mountWc('zw-data-grid', element => {
            Object.assign(element, gridFixtureProps())
          }),
        react: () =>
          mountReact(
            () => createElement(ReactDataGrid, gridFixtureProps()),
            'zw-data-grid',
          ),
        vue: () =>
          mountVue(() => h(VueDataGrid, gridFixtureProps()), 'zw-data-grid'),
        native: () =>
          mountNative(
            () => NativeDataGrid(gridFixtureProps()) as HTMLElement,
            'zw-data-grid',
          ),
      },
      async mounted => {
        const viewport = await waitForSelector(mounted.element, "[role='grid']")
        const cell = await waitForSelector(
          mounted.element,
          "[data-slot='data-grid-cell']",
        )

        expect(viewport.getAttribute('aria-rowcount')).toBeTruthy()
        expect(viewport.getAttribute('aria-colcount')).toBeTruthy()

        const tabStops = mounted.element.querySelectorAll(
          "[data-slot='data-grid-cell'][tabindex='0']",
        )

        expect(
          tabStops.length,
          `${mounted.host} keeps one roving tab stop`,
        ).toBe(1)
        expect(tabStops[0]).toBe(cell)

        cell.focus()
        await nextFrame()
        expect(focused(mounted)).toBe(cell)

        press(cell, 'ArrowRight')
        await nextFrame()
        await nextFrame()

        const next = focused(mounted) as HTMLElement | null

        expect(
          within(mounted, next),
          `${mounted.host} keeps focus inside the grid`,
        ).toBe(true)
        expect(next?.getAttribute('data-slot')).toBe('data-grid-cell')
        expect(next?.getAttribute('data-column-id')).toBe('role')
      },
    )
  })
})
