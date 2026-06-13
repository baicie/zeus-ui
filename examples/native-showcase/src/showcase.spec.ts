/* eslint-disable no-restricted-globals */
import { describe, expect, it } from 'vitest'
import { renderNativeShowcase } from './showcase'

import '@zeus-web/ui'

describe('native showcase', () => {
  it('registers styled native Web Components from @zeus-web/ui', () => {
    expect(customElements.get('zw-button')).toBeTypeOf('function')
    expect(customElements.get('zw-input')).toBeTypeOf('function')
  })

  it('renders styled native Web Component examples', () => {
    const root = document.createElement('div')

    renderNativeShowcase(root)

    expect(root.querySelector('h1')?.textContent).toBe(
      'Native Web Component Showcase',
    )

    expect(root.querySelectorAll('zw-button').length).toBeGreaterThanOrEqual(8)
    expect(root.querySelectorAll('zw-input')).toHaveLength(4)

    expect(
      root.querySelector('zw-button[variant="primary"]')?.textContent,
    ).toBe('primary')

    expect(
      root.querySelector('zw-input[placeholder="Email address"]'),
    ).toBeTruthy()

    expect(root.textContent).toContain("import '@zeus-web/ui'")
    expect(root.textContent).toContain("import '@zeus-web/ui/button'")
    expect(root.textContent).toContain("import '@zeus-web/ui/input'")
  })
})
