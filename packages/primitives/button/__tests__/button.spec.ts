import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(workspaceRoot, 'packages/primitives/button/src/button.tsx'),
  'utf-8',
)

describe('button primitive protocol', () => {
  it('infers props, events, methods, slots, and css parts from source', () => {
    const result = analyzeFile({
      file: 'packages/primitives/button/src/button.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-button',
      props: {
        disabled: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        loading: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        variant: {
          type: 'string',
          values: [
            'default',
            'primary',
            'secondary',
            'outline',
            'ghost',
            'danger',
          ],
          default: 'default',
          reflect: true,
        },
        size: {
          type: 'string',
          values: ['sm', 'md', 'lg', 'icon'],
          default: 'md',
          reflect: true,
        },
      },
      events: {
        press: {
          name: 'press',
          reactName: 'onPress',
          detail: {
            nativeEvent: 'unknown',
          },
        },
      },
      methods: {
        focus: {
          name: 'focus',
          returns: 'void',
        },
        blur: {
          name: 'blur',
          returns: 'void',
        },
        click: {
          name: 'click',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
        prefix: {
          name: 'prefix',
        },
        suffix: {
          name: 'suffix',
        },
      },
      cssParts: ['button', 'label', 'prefix', 'suffix'],
    })
  })
})
