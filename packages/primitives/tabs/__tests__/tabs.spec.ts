import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(workspaceRoot, 'packages/primitives/tabs/src/tabs.tsx'),
  'utf-8',
)

describe('tabs primitive protocol', () => {
  it('infers tabs component family from source', () => {
    const result = analyzeFile({
      file: 'packages/primitives/tabs/src/tabs.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components.map(item => item.tag)).toEqual([
      'zw-tabs',
      'zw-tabs-list',
      'zw-tabs-trigger',
      'zw-tabs-content',
    ])

    expect(result.components[0]).toMatchObject({
      tag: 'zw-tabs',
      props: {
        orientation: {
          type: 'string',
          values: ['horizontal', 'vertical'],
          default: 'horizontal',
          reflect: true,
        },
      },
      events: {
        valueChange: {
          name: 'value-change',
          reactName: 'onValueChange',
          detail: {
            value: 'unknown',
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
      slots: {
        default: {
          name: 'default',
        },
      },
    })

    expect(result.components[2]).toMatchObject({
      tag: 'zw-tabs-trigger',
      props: {
        value: {
          type: 'string',
        },
        disabled: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
      },
      methods: {
        focus: {
          name: 'focus',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
      cssParts: ['trigger'],
    })

    expect(result.components[3]).toMatchObject({
      tag: 'zw-tabs-content',
      props: {
        value: {
          type: 'string',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
      cssParts: ['content'],
    })
  })
})
