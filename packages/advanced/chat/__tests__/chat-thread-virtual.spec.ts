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
    'packages/advanced/chat/src/components/chat-thread.tsx',
  ),
  'utf-8',
)

describe('chat-thread virtual protocol', () => {
  it('infers virtual props, events, methods, slots, and css parts', () => {
    const result = analyzeFile({
      file: 'packages/advanced/chat/src/components/chat-thread.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat-thread',
      props: {
        count: {
          type: 'number',
          default: 0,
        },
        loading: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        empty: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        virtual: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        estimateSize: {
          type: 'number',
          default: 64,
        },
        overscan: {
          type: 'number',
          default: 4,
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
        scrollToBottom: {
          name: 'scrollToBottom',
          returns: 'void',
        },
        getRange: {
          name: 'getRange',
          returns: 'ChatThreadVirtualRange',
        },
        getItems: {
          name: 'getItems',
          returns: 'ChatThreadVirtualItem[]',
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
        resetMeasurements: {
          name: 'resetMeasurements',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining(['items', 'root', 'spacer', 'viewport']),
    )
  })

  it('uses @zeus-web/virtual instead of duplicating virtualizer logic', () => {
    expect(source).toContain("from '@zeus-web/virtual'")
    expect(source).toContain('createRafScheduler')
    expect(source).toContain('areVirtualRangesEqual')
  })

  it('does not render chat messages directly', () => {
    expect(source).not.toContain('document.createElement')
    expect(source).not.toContain('zw-chat-message')
    expect(source).toContain('<Slot />')
  })
})
