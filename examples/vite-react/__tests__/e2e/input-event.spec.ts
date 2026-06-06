import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

// This integration test intentionally exercises the generated public wrapper.
// eslint-disable-next-line antfu/no-import-dist
import { Input } from '../../../../packages/primitives/input/dist/react/index.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('react input wrapper', () => {
  it('bridges value-change to onValueChange', async () => {
    const container = globalThis.document.createElement('div')
    const onValueChange = vi.fn()
    const root = createRoot(container)

    await act(async () => {
      root.render(createElement(Input, { onValueChange }))
    })

    const input = container.querySelector('zw-input')
    const event = new CustomEvent('value-change', {
      detail: {
        value: 'Zeus',
        nativeEvent: new Event('input'),
      },
    })

    input?.dispatchEvent(event)

    expect(onValueChange).toHaveBeenCalledOnce()
    expect(onValueChange).toHaveBeenCalledWith(event)

    await act(async () => {
      root.unmount()
    })
  })
})
