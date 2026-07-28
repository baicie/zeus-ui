import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

interface SelectRuntimeElement extends HTMLElement {
  value?: string
  values?: string[]
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  multiple?: boolean
  componentOnReady: () => Promise<SelectRuntimeElement>
  focus: () => void
  blur: () => void
  formDisabledCallback: (disabled: boolean) => void
}

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')
const distPath = resolve(
  workspaceRoot,
  'packages',
  'primitives',
  'select',
  'dist',
  'wc',
  'auto.js',
)

function nextRender(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve())
}

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector)
  if (!element) throw new Error(`Expected element matching ${selector}.`)
  return element
}

function createSelect(): Promise<SelectRuntimeElement> {
  const element = document.createElement('zw-select') as SelectRuntimeElement
  element.setAttribute('aria-label', 'Environment')
  element.innerHTML = [
    '<option value="development">Development</option>',
    '<option value="staging" disabled>Staging</option>',
    '<option value="production">Production</option>',
  ].join('')
  document.body.append(element)
  return customElements
    .whenDefined('zw-select')
    .then(() => element.componentOnReady())
    .then(() => nextRender())
    .then(() => element)
}

function press(element: Element, key: string): void {
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
}

beforeAll(() => import(distPath))

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('select runtime', () => {
  it('renders a custom combobox and listbox from option children', async () => {
    const select = await createSelect()

    const trigger = requireElement<HTMLButtonElement>(
      select,
      '[data-slot="select-trigger"]',
    )
    const listbox = requireElement<HTMLDivElement>(
      select,
      '[data-slot="select-content"]',
    )
    const native = requireElement<HTMLSelectElement>(
      select,
      '[data-slot="select-native"]',
    )
    const options = select.querySelectorAll('[role="option"]')

    expect(trigger).toHaveAttribute('role', 'combobox')
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-label', 'Environment')
    expect(listbox).toHaveAttribute('role', 'listbox')
    expect(listbox).toHaveAttribute('aria-label', 'Environment')
    expect(listbox).toHaveAttribute('hidden')
    expect(native).toHaveAttribute('aria-hidden', 'true')
    expect(native.tabIndex).toBe(-1)
    expect(options).toHaveLength(3)
    expect(options[1]).toHaveAttribute('aria-disabled', 'true')
  })

  it('skips disabled options and emits one value-change event', async () => {
    const select = await createSelect()
    const trigger = requireElement<HTMLButtonElement>(
      select,
      '[data-slot="select-trigger"]',
    )
    const listener = vi.fn<EventListener>()
    select.addEventListener('value-change', listener)

    press(trigger, 'ArrowDown')
    press(trigger, 'ArrowDown')

    const activeId = trigger.getAttribute('aria-activedescendant')
    expect(activeId).toBeTruthy()
    const active = requireElement<HTMLElement>(select, `#${activeId}`)
    expect(active).toHaveAttribute('data-value', 'production')

    press(trigger, 'Enter')

    expect(select.value).toBe('production')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0]).toHaveProperty('detail', {
      value: 'production',
      values: ['production'],
      nativeEvent: expect.any(Event),
    })
  })

  it('supports typeahead without exposing a native select control', async () => {
    const select = await createSelect()
    const trigger = requireElement<HTMLButtonElement>(
      select,
      '[data-slot="select-trigger"]',
    )

    press(trigger, 'p')

    const activeId = trigger.getAttribute('aria-activedescendant')
    expect(activeId).toBeTruthy()
    expect(requireElement<HTMLElement>(select, `#${activeId}`)).toHaveAttribute(
      'data-value',
      'production',
    )

    press(trigger, 'Enter')
    expect(select.value).toBe('production')
  })

  it('uses Space to commit the active option', async () => {
    const select = await createSelect()
    const trigger = requireElement<HTMLButtonElement>(
      select,
      '[data-slot="select-trigger"]',
    )

    press(trigger, 'ArrowDown')
    press(trigger, 'ArrowDown')
    press(trigger, ' ')

    expect(select.value).toBe('production')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('synchronizes declared multiple values into the listbox', async () => {
    const select = document.createElement('zw-select') as SelectRuntimeElement
    select.setAttribute('multiple', '')
    select.values = ['development', 'production']
    select.innerHTML = [
      '<option value="development">Development</option>',
      '<option value="staging">Staging</option>',
      '<option value="production">Production</option>',
    ].join('')
    document.body.append(select)

    await select.componentOnReady()
    await nextRender()

    expect(
      Array.from(select.querySelectorAll('[role="option"]')).map(option => [
        option.getAttribute('data-value'),
        option.getAttribute('aria-selected'),
      ]),
    ).toEqual([
      ['development', 'true'],
      ['staging', 'false'],
      ['production', 'true'],
    ])
    expect(
      requireElement(select, '[data-slot="select-value"]'),
    ).toHaveTextContent('Development, Production')
  })

  it('keeps array selection APIs property-only', async () => {
    const select = await createSelect()

    select.setAttribute('multiple', '')
    select.setAttribute('values', '["production"]')
    select.setAttribute('default-values', '["production"]')
    await nextRender()

    expect(select.values).toEqual(['development'])
    expect(select.value).toBe('development')
  })

  it('keeps multiple selections unchanged when Tab closes the popup', async () => {
    const select = await createSelect()
    const trigger = requireElement<HTMLButtonElement>(
      select,
      '[data-slot="select-trigger"]',
    )
    const listener = vi.fn<EventListener>()

    select.multiple = true
    select.values = ['development', 'production']
    select.addEventListener('value-change', listener)
    await nextRender()

    press(trigger, 'Enter')
    press(trigger, 'Tab')

    expect(select.values).toEqual(['development', 'production'])
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(listener).not.toHaveBeenCalled()
  })

  it('does not restore stale values after switching multiple mode off and on', async () => {
    const select = await createSelect()
    const trigger = requireElement<HTMLButtonElement>(
      select,
      '[data-slot="select-trigger"]',
    )

    select.multiple = true
    select.values = ['development', 'production']
    await nextRender()

    select.multiple = false
    await nextRender()
    press(trigger, 'Enter')
    press(trigger, 'End')
    press(trigger, 'Enter')
    expect(select.value).toBe('production')

    select.multiple = true
    await nextRender()

    expect(select.values).toEqual(['production'])
    expect(
      Array.from(
        requireElement<HTMLSelectElement>(select, '[data-slot="select-native"]')
          .selectedOptions,
      ).map(option => option.value),
    ).toEqual(['production'])
  })

  it('synchronizes option mutations into the custom listbox', async () => {
    const select = await createSelect()
    const native = requireElement<HTMLSelectElement>(
      select,
      '[data-slot="select-native"]',
    )
    const option = document.createElement('option')
    option.value = 'preview'
    option.textContent = 'Preview'

    native.append(option)
    await nextRender()

    expect(select.querySelectorAll('[role="option"]')).toHaveLength(4)
    expect(
      requireElement<HTMLElement>(
        select,
        '[role="option"][data-value="preview"]',
      ),
    ).toHaveTextContent('Preview')
  })

  it('adopts a dynamically selected option in single mode', async () => {
    const select = await createSelect()
    const native = requireElement<HTMLSelectElement>(
      select,
      '[data-slot="select-native"]',
    )

    native.options[2].setAttribute('selected', '')
    await nextRender()

    expect(select.value).toBe('production')
    expect(
      requireElement<HTMLElement>(
        select,
        '[role="option"][data-value="production"]',
      ),
    ).toHaveAttribute('aria-selected', 'true')
  })

  it('adopts dynamically selected options in multiple mode', async () => {
    const select = document.createElement('zw-select') as SelectRuntimeElement
    select.setAttribute('multiple', '')
    select.innerHTML = [
      '<option value="development">Development</option>',
      '<option value="staging">Staging</option>',
      '<option value="production">Production</option>',
    ].join('')
    document.body.append(select)

    await select.componentOnReady()
    await nextRender()

    const native = requireElement<HTMLSelectElement>(
      select,
      '[data-slot="select-native"]',
    )
    native.options[0].setAttribute('selected', '')
    native.options[2].setAttribute('selected', '')
    await nextRender()

    expect(select.values).toEqual(['development', 'production'])
  })

  it('keeps form-disabled state separate from the disabled attribute', async () => {
    const select = await createSelect()
    const trigger = requireElement<HTMLButtonElement>(
      select,
      '[data-slot="select-trigger"]',
    )

    select.formDisabledCallback(true)
    await nextRender()

    expect(select).not.toHaveAttribute('disabled')
    expect(trigger).toBeDisabled()

    select.formDisabledCallback(false)
    await nextRender()

    expect(select).not.toHaveAttribute('disabled')
    expect(trigger).not.toBeDisabled()
  })

  it('delegates focus and blur to the combobox trigger', async () => {
    const select = await createSelect()
    const trigger = requireElement<HTMLButtonElement>(
      select,
      '[data-slot="select-trigger"]',
    )

    select.focus()
    expect(document.activeElement).toBe(trigger)

    select.blur()
    expect(document.activeElement).not.toBe(trigger)
  })

  it('disconnects its option observer when removed', async () => {
    const disconnect = vi.spyOn(
      globalThis.MutationObserver.prototype,
      'disconnect',
    )
    const select = await createSelect()

    select.remove()
    await nextRender()

    expect(disconnect).toHaveBeenCalled()
  })

  it('synchronizes dynamic boolean attributes as boolean properties', async () => {
    const select = await createSelect()
    const trigger = requireElement<HTMLButtonElement>(
      select,
      '[data-slot="select-trigger"]',
    )

    select.setAttribute('required', '')
    select.setAttribute('invalid', '')
    select.setAttribute('multiple', '')
    select.setAttribute('disabled', '')
    await nextRender()

    expect(select.required).toBe(true)
    expect(select.invalid).toBe(true)
    expect(select.multiple).toBe(true)
    expect(select.disabled).toBe(true)
    expect(trigger).toHaveAttribute('aria-required', 'true')
    expect(trigger).toHaveAttribute('aria-invalid', 'true')
    expect(trigger).toBeDisabled()

    select.removeAttribute('required')
    select.removeAttribute('invalid')
    select.removeAttribute('multiple')
    select.removeAttribute('disabled')
    await nextRender()

    expect(select.required).toBe(false)
    expect(select.invalid).toBe(false)
    expect(select.multiple).toBe(false)
    expect(select.disabled).toBe(false)
    expect(trigger).not.toHaveAttribute('aria-required')
    expect(trigger).not.toHaveAttribute('aria-invalid')
    expect(trigger).not.toBeDisabled()
  })
})
