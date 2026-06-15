import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const sourcePath = resolve(
  workspaceRoot,
  'packages/advanced/revogrid-adapter/src/components/revogrid-adapter.tsx',
)
const source = readFileSync(sourcePath, 'utf-8')

describe('revogrid-adapter component protocol', () => {
  it('infers props, events, methods and parts', () => {
    const result = analyzeFile({
      file: 'packages/advanced/revogrid-adapter/src/components/revogrid-adapter.tsx',
      code: source,
    })

    const component = result.components[0]
    expect(component).toBeDefined()
    expect(component.tag).toBe('zw-revogrid-adapter')
    expect(component.cssParts).toEqual(expect.arrayContaining(['root', 'grid']))
  })

  it('renders a RevoGrid-compatible custom element target', () => {
    expect(source).toContain('<revo-grid')
    expect(source).toContain('data-slot="revogrid-adapter-grid"')
    expect(source).toContain('applyStateToGrid')
    expect(source).toContain('gridElement.columns = state.columns')
    expect(source).toContain('gridElement.source = state.source')
    expect(source).toContain('gridElement.sorting = state.sort')
    expect(source).toContain(
      'gridElement.selectedRows = state.selection.rowIndexes',
    )
  })

  it('does not import RevoGrid implementation directly', () => {
    expect(source).not.toContain('@revolist/revogrid')
    expect(source).not.toContain('revogrid/loader')
    expect(source).not.toContain('defineCustomElements')
  })

  it('keeps adapter separate from DataGrid core implementation', () => {
    expect(source).not.toContain('createDataGridRowVirtualizer')
    expect(source).not.toContain('sortDataGridRows')
    expect(source).not.toContain('createDataGridSelectionModel')
  })
})
