import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(
    workspaceRoot,
    'packages/advanced/data-grid/src/components/data-grid.tsx',
  ),
  'utf-8',
)

describe('data-grid behavior contract', () => {
  it('does not use row or column length as the controlled update signal', () => {
    expect(source).not.toContain('rowsLength')
    expect(source).not.toContain('columnsLength')
    expect(source).toContain('rows: resolveRows(props)')
    expect(source).toContain('columns: resolveColumns(props)')
  })

  it('rebuilds columns and default widths when controlled columns change', () => {
    expect(source).toContain('changes.columnsChanged')
    expect(source).toContain(
      'baseColumns = normalizeDataGridColumns(columnsSource)',
    )
    expect(source).toContain(
      'defaultColumnWidths = createDataGridColumnWidthState(baseColumns)',
    )
    expect(source).toContain('columnWidths = { ...defaultColumnWidths }')
  })

  it('syncs controlled selectedKeys into selection model and clears undefined', () => {
    expect(source).toContain('changes.selectedKeysChanged')
    expect(source).toContain('selection.setKeys(props.selectedKeys ?? [])')
    expect(source).not.toContain('Array.isArray(props.selectedKeys)')
  })

  it('syncs controlled sort props into internal sort state', () => {
    expect(source).toContain('changes.sortChanged')
    expect(source).toContain(
      'sort = createDataGridControlledSortState(\n        props.sortColumn,\n        props.sortDirection,\n      )',
    )
  })

  it('syncs controlled active cell props into internal active cell state', () => {
    expect(source).toContain('changes.activeCellChanged')
    expect(source).toContain('shouldSyncActiveCellFromProps = true')
    expect(source).toContain('rowKey: shouldSyncActiveCellFromProps')
    expect(source).toContain('columnId: shouldSyncActiveCellFromProps')
  })

  it('commits internal mutations into controlled state controller', () => {
    expect(source).toContain('commitControlledState')
    expect(source).toContain(
      'controlledState.commit(readControlledStateSources())',
    )
  })

  it('clears controlled sort props when clearSort is called', () => {
    expect(source).toContain('sort = undefined')
    expect(source).toContain('syncSortPropsFromModel()')
  })

  it('does not emit intermediate active cell during keyboard navigation', () => {
    expect(source).toContain('moveActiveCellFromCell')
    expect(source).not.toContain(
      'setActiveCellByKey(row.key, column.id, nativeEvent)\n                          moveActiveCellByKey',
    )
  })

  it('declares getSort and getActiveCell with undefined source return type', () => {
    expect(source).toMatch(
      /getSort\(\):\s*DataGridSortState\s*\|\s*undefined\s*\{/,
    )
    expect(source).toMatch(
      /getActiveCell\(\):\s*DataGridActiveCell\s*\|\s*undefined\s*\{/,
    )
  })
})
