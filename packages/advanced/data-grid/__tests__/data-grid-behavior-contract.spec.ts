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
    expect(source).toContain('rows: resolveRows(props, fallbackRows)')
    expect(source).toContain('columns: resolveColumns(props, fallbackColumns)')
  })

  it('rebuilds columns and default widths when controlled columns change', () => {
    expect(source).toContain('changes.columnsChanged')
    expect(source).toContain(
      'baseColumns = normalizeDataGridColumns(columnsSource)',
    )
    expect(source).toContain(
      'defaultColumnWidths = createDataGridColumnWidthState(baseColumns)',
    )
    expect(source).toContain(
      'columnWidths = createDataGridColumnWidthState(baseColumns)',
    )
    expect(source).toContain('shouldRefreshColumnsForRender = true')
    expect(source).toContain('setColumnRenderVersion(value => value + 1)')
  })

  it('tracks column overscan as a layout input', () => {
    expect(source).toContain('overscanColumns: resolveColumnOverscan(props)')
    expect(source).toContain('createDataGridColumnVirtualizer')
    expect(source).toContain('shouldUpdateDataGridColumnVirtualSnapshot')
  })

  it('refreshes keyed rows when a controlled row keeps the same key', () => {
    expect(source).toContain('shouldRefreshRowsForRender = true')
    expect(source).toContain('setRowRenderVersion(value => value + 1)')
    expect(source).toContain('void rowRenderVersion()')
  })

  it('batches model-to-prop synchronization', () => {
    expect(source).toContain('batch(() => {')
    expect(source).toContain('syncSelectionPropsFromModel')
    expect(source).toContain('syncSortPropsFromModel')
    expect(source).toContain('syncActiveCellPropsFromModel')
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
    expect(source).toContain('controlledState.commit(nextSources)')
    expect(source).toContain('commitControlledState({ rows: nextRows })')
    expect(source).toContain('commitControlledState({ columns: nextColumns })')
    expect(source).not.toContain(
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

  it('scrolls the horizontal virtual window during keyboard focus navigation', () => {
    expect(source).toContain(
      "scrollToColumnIndex(nextActiveCell.columnIndex, 'center')",
    )
    expect(source).toContain("scrollToColumnIndex(columnIndex, 'center')")
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
