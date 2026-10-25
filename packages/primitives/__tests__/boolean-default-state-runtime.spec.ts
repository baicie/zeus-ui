import { resolve } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

const controls = [
  [
    'checkbox',
    'checked',
    'defaultChecked',
    'default-checked',
    'checked',
    'unchecked',
  ],
  [
    'switch',
    'checked',
    'defaultChecked',
    'default-checked',
    'checked',
    'unchecked',
  ],
  ['dialog', 'open', 'defaultOpen', 'default-open', 'open', 'closed'],
  ['collapsible', 'open', 'defaultOpen', 'default-open', 'open', 'closed'],
  ['tooltip', 'open', 'defaultOpen', 'default-open', 'open', 'closed'],
] as const

interface RuntimeControl extends HTMLElement {
  checked?: boolean
  defaultChecked?: boolean
  open?: boolean
  defaultOpen?: boolean
  show: () => void | Promise<void>
  hide: () => void | Promise<void>
  close: () => void | Promise<void>
  componentOnReady: () => Promise<unknown>
}

beforeAll(async () => {
  for (const [name] of controls) {
    await import(resolve(`packages/primitives/${name}/dist/wc/auto.js`))
  }
})

afterEach(() => document.body.replaceChildren())

describe.each(controls)(
  '%s initial boolean state',
  (name, prop, defaultProp, attr, active, inactive) => {
    async function create(configure: (host: RuntimeControl) => void) {
      const host = document.createElement(`zw-${name}`) as RuntimeControl
      configure(host)
      document.body.append(host)
      await host.componentOnReady()
      return host
    }

    function expectState(host: RuntimeControl, enabled: boolean) {
      expect(host.getAttribute('data-state')).toBe(enabled ? active : inactive)
      const input = host.querySelector('input')
      if (prop === 'checked') expect(input).not.toBeNull()
      if (input) {
        expect(input.checked).toBe(enabled)
        expect(input.getAttribute('aria-checked')).toBe(String(enabled))
      }
    }

    it.each(['attribute', 'property'])(
      'uses the initial default %s when the controlled prop is absent',
      async mode => {
        const host = await create(host => {
          if (mode === 'attribute') host.setAttribute(attr, '')
          else host[defaultProp] = true
        })
        expect(host[prop]).toBeUndefined()
        expect(host[defaultProp]).toBe(true)
        expectState(host, true)
      },
    )

    it('honors explicit false over an enabled default', async () => {
      const host = await create(host => {
        host.setAttribute(attr, '')
        host[prop] = false
      })
      expectState(host, false)
    })

    it('can disable and enable the default without falling back after false', async () => {
      const host = await create(host => host.setAttribute(attr, ''))
      expectState(host, true)
      const input = host.querySelector('input')
      if (input) input.click()
      else if (name === 'dialog') await host.close()
      else await host.hide()
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(host[prop]).toBe(false)
      expectState(host, false)
      if (input) input.click()
      else await host.show()
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(host[prop]).toBe(true)
      expectState(host, true)
    })

    it('starts disabled when neither prop is supplied', async () => {
      const host = await create(() => {})
      expectState(host, false)
    })
  },
)
