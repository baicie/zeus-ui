import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(workspaceRoot, 'packages/primitives/checkbox/src/checkbox.tsx'),
  'utf-8',
)

describe('checkbox primitive protocol', () => {
  it('infers props, events, models, methods, slots, and css parts from source', () => {
    const result = analyzeFile({
      file: 'packages/primitives/checkbox/src/checkbox.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-checkbox',
      props: {
        checked: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        indeterminate: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        size: {
          type: 'string',
          values: ['sm', 'md', 'lg'],
          default: 'md',
          reflect: true,
        },
      },
      events: {
        checkedChange: {
          name: 'checked-change',
          reactName: 'onCheckedChange',
          detail: {
            checked: 'boolean',
            nativeEvent: 'Event',
          },
        },
        focusChange: {
          name: 'focus-change',
          reactName: 'onFocusChange',
          detail: {
            focused: 'boolean',
            nativeEvent: 'FocusEvent',
          },
        },
      },
      models: [
        {
          prop: 'checked',
          event: 'checked-change',
          eventPath: 'detail.checked',
        },
      ],
      methods: {
        focus: {
          name: 'focus',
          returns: 'void',
        },
        blur: {
          name: 'blur',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
        indicator: {
          name: 'indicator',
        },
      },
      cssParts: ['control', 'indicator', 'label', 'root'],
    })
  })
})
