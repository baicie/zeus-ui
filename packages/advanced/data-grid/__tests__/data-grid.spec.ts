import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { transformModule } from '@zeus-js/compiler'
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
        overscanColumns: {
          type: 'number',
          default: 2,
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
        diagnostics: {
          type: 'object',
          attr: false,
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
        viewportResize: {
          name: 'viewport-resize',
          reactName: 'onViewportResize',
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
          returns: 'unknown[]',
        },
        getColumns: {
          name: 'getColumns',
          returns: 'unknown[]',
        },
        getVisibleRows: {
          name: 'getVisibleRows',
          returns: 'unknown[]',
        },
        getSelection: {
          name: 'getSelection',
          returns: 'unknown',
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
          returns: 'unknown | undefined',
        },
        getRange: {
          name: 'getRange',
          returns: 'unknown',
        },
        getItems: {
          name: 'getItems',
          returns: 'unknown[]',
        },
        getTotalSize: {
          name: 'getTotalSize',
          returns: 'number',
        },
        getColumnRange: {
          name: 'getColumnRange',
          returns: 'unknown',
        },
        getColumnItems: {
          name: 'getColumnItems',
          returns: 'unknown[]',
        },
        getTotalColumnSize: {
          name: 'getTotalColumnSize',
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
        scrollToColumn: {
          name: 'scrollToColumn',
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
          returns: 'unknown | undefined',
        },
        moveActiveCell: {
          name: 'moveActiveCell',
          returns: 'void',
        },
        focusCell: {
          name: 'focusCell',
          returns: 'void',
        },
        focusActiveCell: {
          name: 'focusActiveCell',
          returns: 'void',
        },
        refreshViewport: {
          name: 'refreshViewport',
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

  it('uses controlled state model instead of ad-hoc source tracking', () => {
    const rebuildModelsSource = source.slice(
      source.indexOf('const rebuildModels ='),
      source.indexOf('const emitSnapshotIfChanged ='),
    )
    const controlledEffectSource = source.slice(
      source.indexOf('createEffect(() =>'),
      source.indexOf('const scrollToColumnIndex ='),
    )

    expect(source).toContain('createDataGridControlledStateController')
    expect(source).toContain('createDataGridControlledSortState')
    expect(source).toContain('readControlledStateSources')
    expect(source).toContain('syncControlledSources')
    expect(source).toContain('commitControlledState')
    expect(controlledEffectSource).toContain('syncControlledSources()')
    expect(rebuildModelsSource).not.toContain('syncControlledSources()')
    expect(source).not.toContain('rowsLength: resolveRows(props).length')
    expect(source).not.toContain('columnsLength: resolveColumns(props).length')
  })

  it('tracks controlled sort and active cell props', () => {
    expect(source).toContain('sortColumn: props.sortColumn')
    expect(source).toContain('sortDirection: props.sortDirection')
    expect(source).toContain('activeRowKey: props.activeRowKey')
    expect(source).toContain('activeColumnId: props.activeColumnId')
    expect(source).toContain('changes.sortChanged')
    expect(source).toContain('changes.activeCellChanged')
  })

  it('syncs internal model mutations back to host props', () => {
    expect(source).toContain('syncSelectionPropsFromModel')
    expect(source).toContain('syncSortPropsFromModel')
    expect(source).toContain('syncActiveCellPropsFromModel')
    expect(source).toContain('props.selectedKeys = selection.getState().keys')
    expect(source).toContain(
      'props.sortColumn = sort ? sort.columnId : undefined',
    )
    expect(source).toContain(
      'props.sortDirection = sort ? sort.direction : undefined',
    )
    expect(source).toContain(
      'props.activeRowKey = activeCell ? activeCell.rowKey : undefined',
    )
    expect(source).toContain(
      'props.activeColumnId = activeCell ? activeCell.columnId : undefined',
    )
  })

  it('keeps default column widths for reset', () => {
    expect(source).toContain('defaultColumnWidths')
    expect(source).toContain(
      'resetDataGridColumnWidths(baseColumns, defaultColumnWidths)',
    )
  })

  it('moves active cell from current cell without emitting intermediate cell state', () => {
    expect(source).toContain('moveActiveCellFromCell')
    expect(source).toContain('moveActiveCellFromCell(')
    expect(source).not.toContain(
      'setActiveCellByKey(row.key, column.id, nativeEvent)\n                          moveActiveCellByKey',
    )
  })

  it('uses a two-axis virtual window without unrelated advanced features', () => {
    expect(source).toContain('createDataGridColumnVirtualizer')
    expect(source).toContain('getColumnScrollOffset')
    expect(source).toContain('scrollToColumn')
    expect(source).not.toContain('treeData')
    expect(source).not.toContain('groupBy')
    expect(source).not.toContain('filterModel')
    expect(source).not.toContain('editor')
  })

  it('uses accessibility model for grid aria contract', () => {
    expect(source).toContain('getDataGridAriaSort')
    expect(source).toContain('getDataGridAriaSelected')
    expect(source).toContain('getDataGridAriaMultiSelectable')
    expect(source).toContain('getDataGridHeaderRowAriaIndex')
    expect(source).toContain('getDataGridDataRowAriaIndex')
    expect(source).toContain('getDataGridColumnAriaIndex')
    expect(source).toContain('getDataGridResizeHandleAriaLabel')
    expect(source).toContain('aria-sort')
    expect(source).toContain('aria-rowindex')
    expect(source).toContain('aria-colindex')
    expect(source).toContain('aria-selected')
    expect(source).toContain('aria-multiselectable')
  })

  it('compiles fixed header values without reactive effects', () => {
    const result = transformModule({
      source,
      filename: 'packages/advanced/data-grid/src/components/data-grid.tsx',
      target: 'dom',
      runtimeModule: '@zeus-js/runtime-dom',
      delegateEvents: true,
      sourceMap: false,
    })

    expect(result.diagnostics).toEqual([])

    const headerAriaBinding = result.code.match(
      /\$zeusBindAttr\([^;]+, "aria-rowindex", [^;]+\);/,
    )?.[0]

    expect(headerAriaBinding).toContain(', true)')
    expect(result.code).toContain('role=\\"columnheader\\" tabindex=\\"0\\"')
    expect(result.code).not.toContain(
      '$zeusBindAttr($zeusInlineElement0, "tabindex"',
    )
  })

  it('uses viewport measurement model and exposes refreshViewport', () => {
    expect(source).toContain('createDataGridViewportMeasureController')
    expect(source).toContain('shouldEmitDataGridViewportResize')
    expect(source).toContain('viewportResize')
    expect(source).toContain('refreshViewport')
    expect(source).toContain('ResizeObserver')
    expect(source).toContain('getResolvedViewportSize')
  })

  it('exposes focus helpers for runtime focus management', () => {
    expect(source).toContain('focusCell(')
    expect(source).toContain('focusActiveCell(')
    expect(source).toContain('focusCellElement')
    expect(source).toContain('focusActiveCellElement')
    expect(source).toContain('onFocus=')
  })

  it('schedules focus after virtual scroll navigation', () => {
    expect(source).toContain('scheduleFocusActiveCellElement')
    expect(source).toContain(
      "ctx.host.scrollToIndex(nextActiveCell.rowIndex, 'center')",
    )
    expect(source).toContain('scheduleFocusActiveCellElement()')
  })

  it('disconnects viewport observer when viewport ref is cleared', () => {
    expect(source).toContain('viewportResizeObserver?.disconnect()')
    expect(source).toContain('viewportResizeObserver = undefined')
    expect(source).toContain('viewport = undefined')
  })

  it('renders grid collections as nodes and binds native scroll directly', () => {
    expect(source).toContain('each={getHeaderColumnsForRender()}')
    expect(source).toContain('each={getBodyColumnsForRender()}')
    expect(source).toContain('by={getHeaderColumnReconciliationKey}')
    expect(source).toContain('by={getBodyColumnReconciliationKey}')
    expect(source).toContain('each={getBodyRowsForRender()}')
    expect(source).toContain(
      "element.addEventListener('scroll', scheduleUpdateRange)",
    )
    expect(source).not.toContain('{visibleColumns.map(')
    expect(source).not.toContain('{getBodyRows().map(')
  })
})
