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
  'packages/primitives/tabs/dist/wc/auto.js',
)

beforeAll(() => import(distPath))

afterEach(() => {
  document.body.replaceChildren()
})

describe('tabs runtime context', () => {
  it('resolves context when the full subtree connects together', async () => {
    const tabs = document.createElement('zw-tabs') as ReadyElement
    tabs.setAttribute('default-value', 'account')
    tabs.innerHTML = `
      <zw-tabs-list><zw-tabs-trigger value="account">Account</zw-tabs-trigger></zw-tabs-list>
      <zw-tabs-content value="account">Account settings</zw-tabs-content>
    `
    document.body.append(tabs)
    await Promise.all(
      [tabs, ...Array.from(tabs.querySelectorAll<ReadyElement>('*'))]
        .filter(element => element.localName.startsWith('zw-'))
        .map(element => element.componentOnReady()),
    )

    expect(tabs.querySelector('zw-tabs-list')).toHaveAttribute(
      'aria-orientation',
      'horizontal',
    )
    expect(tabs.querySelector('[role="tab"]')).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('shares root orientation and selection with independently loaded entries', async () => {
    const tabs = document.createElement('zw-tabs') as ReadyElement
    tabs.setAttribute('orientation', 'vertical')
    tabs.setAttribute('value', 'account')
    document.body.append(tabs)
    await tabs.componentOnReady()

    const list = document.createElement('zw-tabs-list') as ReadyElement
    tabs.append(list)
    await list.componentOnReady()

    const trigger = document.createElement('zw-tabs-trigger') as ReadyElement
    trigger.setAttribute('value', 'account')
    trigger.textContent = 'Account'
    list.append(trigger)
    await trigger.componentOnReady()

    const content = document.createElement('zw-tabs-content') as ReadyElement
    content.setAttribute('value', 'account')
    content.textContent = 'Account settings'
    tabs.append(content)
    await content.componentOnReady()

    expect(list).toHaveAttribute('aria-orientation', 'vertical')
    expect(trigger.querySelector('[role="tab"]')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(content).toHaveAttribute('data-state', 'active')
    expect(content).not.toHaveAttribute('hidden')
  })
})
