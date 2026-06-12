/* eslint-disable no-restricted-globals */
import { describe, expect, it } from 'vitest'

import { renderNativeShowcase } from './showcase'

describe('native showcase', () => {
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
