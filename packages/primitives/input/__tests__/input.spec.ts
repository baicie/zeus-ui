import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(workspaceRoot, 'packages/primitives/input/src/input.tsx'),
  'utf-8',
)
const primitiveBuildConfig = readFileSync(
  resolve(workspaceRoot, 'scripts/rolldown/createPrimitiveRolldownConfig.mjs'),
  'utf-8',
)

describe('input primitive protocol', () => {
  it('enables the React custom event bridge', () => {
    expect(primitiveBuildConfig).toMatch(/wrapper:\s*['"]event-bridge['"]/)
  })

  it('infers models, methods, slots, and css parts from source', () => {
    const result = analyzeFile({
      file: 'packages/primitives/input/src/input.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-input',
      props: {
        disabled: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        invalid: {
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
        valueChange: {
          name: 'value-change',
          reactName: 'onValueChange',
          detail: {
            value: 'string',
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
          prop: 'value',
          event: 'value-change',
          eventPath: 'detail.value',
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
        select: {
          name: 'select',
          returns: 'void',
        },
      },
      slots: {
        prefix: {
          name: 'prefix',
        },
        suffix: {
          name: 'suffix',
        },
        message: {
          name: 'message',
        },
      },
      cssParts: ['control', 'message', 'prefix', 'root', 'suffix'],
    })
  })
})
