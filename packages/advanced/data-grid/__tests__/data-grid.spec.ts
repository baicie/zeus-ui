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
    'packages/advanced/data-grid/src/components/data-grid.tsx',
  ),
  'utf-8',
)

describe('data-grid component protocol', () => {
  it('infers props, events, methods, slots, and parts', () => {
    const result = analyzeFile({
      file: 'packages/advanced/data-grid/src/components/data-grid.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-data-grid',
      props: {
        rowHeight: {
          type: 'number',
          default: 40,
        },
        overscan: {
          type: 'number',
          default: 4,
        },
        virtual: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        selectionMode: {
          type: 'string',
          values: ['none', 'single', 'multiple'],
          default: 'none',
          reflect: true,
        },
        resizable: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        keyboardNavigation: {
          type: 'boolean',
          default: true,
        },
        activeRowKey: {
          type: 'string',
        },
        activeColumnId: {
          type: 'string',
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
        selectionChange: {
          name: 'selection-change',
          reactName: 'onSelectionChange',
        },
        sortChange: {
          name: 'sort-change',
          reactName: 'onSortChange',
        },
        rowAction: {
          name: 'row-action',
          reactName: 'onRowAction',
        },
        cellAction: {
          name: 'cell-action',
          reactName: 'onCellAction',
        },
        columnResizeStart: {
          name: 'column-resize-start',
          reactName: 'onColumnResizeStart',
        },
        columnResize: {
          name: 'column-resize',
          reactName: 'onColumnResize',
        },
        columnResizeEnd: {
          name: 'column-resize-end',
          reactName: 'onColumnResizeEnd',
        },
        activeCellChange: {
          name: 'active-cell-change',
          reactName: 'onActiveCellChange',
        },
      },
      methods: {
        setRows: {
          name: 'setRows',
          returns: 'void',
        },
        setColumns: {
          name: 'setColumns',
          returns: 'void',
        },
        getRows: {
          name: 'getRows',
          returns: 'DataGridRow[]',
        },
        getColumns: {
          name: 'getColumns',
          returns: 'NormalizedDataGridColumn[]',
        },
        getVisibleRows: {
          name: 'getVisibleRows',
          returns: 'DataGridRow[]',
        },
        getSelection: {
          name: 'getSelection',
          returns: 'DataGridSelectionState',
        },
        setSelection: {
          name: 'setSelection',
          returns: 'void',
        },
        clearSelection: {
          name: 'clearSelection',
          returns: 'void',
        },
        toggleRowSelection: {
          name: 'toggleRowSelection',
          returns: 'void',
        },
        setSort: {
          name: 'setSort',
          returns: 'void',
        },
        clearSort: {
          name: 'clearSort',
          returns: 'void',
        },
        getSort: {
          name: 'getSort',
          returns: 'DataGridSortState | unknown',
        },
        getRange: {
          name: 'getRange',
          returns: 'DataGridVirtualRange',
        },
        getItems: {
          name: 'getItems',
          returns: 'DataGridVirtualItem[]',
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
        resizeColumn: {
          name: 'resizeColumn',
          returns: 'void',
        },
        resetColumnWidths: {
          name: 'resetColumnWidths',
          returns: 'void',
        },
        getColumnWidths: {
          name: 'getColumnWidths',
          returns: 'Record<string, number>',
        },
        setActiveCell: {
          name: 'setActiveCell',
          returns: 'void',
        },
        getActiveCell: {
          name: 'getActiveCell',
          returns: 'DataGridActiveCell | unknown',
        },
        moveActiveCell: {
          name: 'moveActiveCell',
          returns: 'void',
        },
      },
      slots: {
        empty: {
          name: 'empty',
        },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining([
        'body',
        'cell',
        'empty',
        'header',
        'header-cell',
        'header-label',
        'resize-handle',
        'root',
        'row',
        'spacer',
        'viewport',
      ]),
    )
  })

  it('uses @zeus-web/virtual instead of duplicating row virtualization', () => {
    expect(source).toContain("from '@zeus-web/virtual'")
    expect(source).toContain('createRafScheduler')
    expect(source).toContain('createDataGridRowVirtualizer')
  })

  it('does not implement non-lite features', () => {
    expect(source).not.toContain('columnVirtual')
    expect(source).not.toContain('treeData')
    expect(source).not.toContain('groupBy')
    expect(source).not.toContain('filterModel')
    expect(source).not.toContain('editor')
  })

  it('tracks model version for same-length row and column updates', () => {
    expect(source).toContain('modelVersion')
    expect(source).toContain('touchExternalModelVersion')
    expect(source).toContain('rowsSource')
    expect(source).toContain('columnsSource')
    expect(source).toContain('selectedKeysSource')
    expect(source).not.toContain('rowsLength: resolveRows(props).length')
    expect(source).not.toContain('columnsLength: resolveColumns(props).length')
  })

  it('keeps rendered snapshot in sync with public getItems state', () => {
    expect(source).toContain('currentSnapshot = snapshot')
    expect(source).toContain('const getBodyRows')
  })

  it('uses column resize and navigation models', () => {
    expect(source).toContain('resizeDataGridColumn')
    expect(source).toContain('resizeDataGridColumnByDelta')
    expect(source).toContain('moveDataGridActiveCell')
    expect(source).toContain('activeCellChange')
    expect(source).toContain('columnResize')
  })

  it('supports aria active descendant and resize handle', () => {
    expect(source).toContain('aria-activedescendant')
    expect(source).toContain('getDataGridActiveCellId')
    expect(source).toContain('data-grid-resize-handle')
    expect(source).toContain('role="separator"')
  })

  it('tracks controlled active cell props in model signature', () => {
    expect(source).toContain('activeRowKeySource')
    expect(source).toContain('activeColumnIdSource')
    expect(source).toContain('shouldSyncActiveCellFromProps')
    expect(source).toContain('nextActiveRowKeySource')
    expect(source).toContain('nextActiveColumnIdSource')
  })

  it('moves active cell from current cell without emitting intermediate cell state', () => {
    expect(source).toContain('moveActiveCellFromCell')
    expect(source).toMatch(
      /moveActiveCellFromCell\(\s*row\.key,\s*column\.id,\s*nativeEvent\.key,\s*nativeEvent/,
    )
    expect(source).not.toMatch(
      /setActiveCellByKey\(row\.key, column\.id, nativeEvent\)\n\s+moveActiveCellByKey/,
    )
  })

  it('keeps default column widths for reset', () => {
    expect(source).toContain('defaultColumnWidths')
    expect(source).toContain(
      'resetDataGridColumnWidths(baseColumns, defaultColumnWidths)',
    )
  })
})
