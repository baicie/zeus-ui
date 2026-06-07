import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(workspaceRoot, 'packages/primitives/dialog/src/dialog.tsx'),
  'utf-8',
)

describe('dialog primitive protocol', () => {
  it('infers dialog component family from source', () => {
    const result = analyzeFile({
      file: 'packages/primitives/dialog/src/dialog.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components.map(item => item.tag)).toEqual([
      'zw-dialog',
      'zw-dialog-trigger',
      'zw-dialog-content',
      'zw-dialog-close',
      'zw-dialog-title',
      'zw-dialog-description',
    ])

    expect(result.components[0]).toMatchObject({
      tag: 'zw-dialog',
      props: {
        open: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        modal: {
          type: 'boolean',
          default: true,
          reflect: true,
        },
      },
      events: {
        openChange: {
          name: 'open-change',
          reactName: 'onOpenChange',
          detail: {
            open: 'boolean',
            nativeEvent: 'Event',
          },
        },
      },
      models: [
        {
          prop: 'open',
          event: 'open-change',
          eventPath: 'detail.open',
        },
      ],
      methods: {
        show: {
          name: 'show',
          returns: 'void',
        },
        close: {
          name: 'close',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
    })

    expect(result.components[2]).toMatchObject({
      tag: 'zw-dialog-content',
      props: {
        forceMount: {
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
      cssParts: ['content'],
    })

    expect(result.components[4]).toMatchObject({
      tag: 'zw-dialog-title',
      slots: {
        default: {
          name: 'default',
        },
      },
      cssParts: ['title'],
    })
  })
})
