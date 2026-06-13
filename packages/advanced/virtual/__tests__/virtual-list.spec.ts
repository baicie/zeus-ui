import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(
    workspaceRoot,
    'packages/advanced/virtual/src/components/virtual-list.tsx',
  ),
  'utf-8',
)

describe('virtual-list advanced component protocol', () => {
  it('infers props, events, methods, slots, and css parts from source', () => {
    const result = analyzeFile({
      file: 'packages/advanced/virtual/src/components/virtual-list.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-virtual-list',
      props: {
        count: {
          type: 'number',
          default: 0,
          reflect: true,
        },
        estimateSize: {
          type: 'number',
          default: 32,
          reflect: true,
        },
        overscan: {
          type: 'number',
          default: 2,
          reflect: true,
        },
        horizontal: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
      },
      events: {
        rangeChange: {
          name: 'range-change',
          reactName: 'onRangeChange',
        },
        scrollOffsetChange: {
          name: 'scroll-offset-change',
          reactName: 'onScrollOffsetChange',
        },
      },
      methods: {
        getRange: {
          name: 'getRange',
          returns: 'VirtualRange',
        },
        getItems: {
          name: 'getItems',
          returns: 'VirtualItem[]',
        },
        getTotalSize: {
          name: 'getTotalSize',
          returns: 'number',
        },
        scrollToIndex: {
          name: 'scrollToIndex',
          returns: 'void',
        },
        scrollToOffset: {
          name: 'scrollToOffset',
          returns: 'void',
        },
        measure: {
          name: 'measure',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
      cssParts: ['items', 'root', 'spacer', 'viewport'],
    })
  })
})
