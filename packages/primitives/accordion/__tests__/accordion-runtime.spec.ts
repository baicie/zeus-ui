import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

interface ReadyElement extends HTMLElement {
  componentOnReady: () => Promise<unknown>
}

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')
const distPath = resolve(
  workspaceRoot,
  'packages/primitives/accordion/dist/wc/auto.js',
)

beforeAll(() => import(distPath))

afterEach(() => {
  document.body.replaceChildren()
})

describe('accordion runtime context', () => {
  it('resolves context when the full subtree connects together', async () => {
    const accordion = document.createElement('zw-accordion') as ReadyElement
    accordion.setAttribute('default-value', 'billing')
    accordion.innerHTML = `
      <zw-accordion-item value="billing">
        <zw-accordion-trigger>Billing</zw-accordion-trigger>
        <zw-accordion-content>Billing details</zw-accordion-content>
      </zw-accordion-item>
    `
    document.body.append(accordion)
    await Promise.all(
      [accordion, ...Array.from(accordion.querySelectorAll<ReadyElement>('*'))]
        .filter(element => element.localName.startsWith('zw-'))
        .map(element => element.componentOnReady()),
    )

    expect(accordion.querySelector('zw-accordion-item')).toHaveAttribute(
      'data-state',
      'open',
    )
    expect(accordion.querySelector('zw-accordion-content')).not.toHaveAttribute(
      'hidden',
    )
  })

  it('shares root and item state with independently loaded entries', async () => {
    const accordion = document.createElement('zw-accordion') as ReadyElement
    accordion.setAttribute('value', 'billing')
    accordion.setAttribute('orientation', 'horizontal')
    document.body.append(accordion)
    await accordion.componentOnReady()

    const item = document.createElement('zw-accordion-item') as ReadyElement
    item.setAttribute('value', 'billing')
    accordion.append(item)
    await item.componentOnReady()

    const trigger = document.createElement(
      'zw-accordion-trigger',
    ) as ReadyElement
    trigger.textContent = 'Billing'
    item.append(trigger)
    await trigger.componentOnReady()

    const content = document.createElement(
      'zw-accordion-content',
    ) as ReadyElement
    content.textContent = 'Billing details'
    item.append(content)
    await content.componentOnReady()

    expect(accordion).toHaveAttribute('data-orientation', 'horizontal')
    expect(trigger.querySelector('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(content).toHaveAttribute('data-state', 'open')
    expect(content).not.toHaveAttribute('hidden')
  })
})
