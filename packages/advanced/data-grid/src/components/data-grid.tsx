import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type { VirtualScrollAlign } from '@zeus-web/virtual'

import type {
  DataGridCellActionDetail,
  DataGridColumn,
  DataGridRangeChangeDetail,
  DataGridRow,
  DataGridRowActionDetail,
  DataGridRowData,
  DataGridRowKey,
  DataGridScrollOffsetChangeDetail,
  DataGridSelectionChangeDetail,
  DataGridSelectionMode,
  DataGridSelectionState,
  DataGridSortChangeDetail,
  DataGridSortDirection,
  DataGridSortState,
  DataGridVirtualItem,
  DataGridVirtualRange,
  DataGridVirtualSnapshot,
  NormalizedDataGridColumn,
} from '../types'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'
import { createEmptyVirtualRange, createRafScheduler } from '@zeus-web/virtual'
import {
  createDataGridRows,
  createDataGridRowVirtualizer,
  createDataGridSelectionModel,
  createNextDataGridSortState,
  getDataGridCellValue,
  getDataGridColumnById,
  getDataGridRowByKey,
  getTotalColumnWidth,
  getVisibleDataGridColumns,
  normalizeDataGridColumns,
  shouldUpdateDataGridVirtualSnapshot,
  sortDataGridRows,
} from '../core'

export interface DataGridProps {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  rowHeight?: number
  overscan?: number
  virtual?: boolean
  selectionMode?: DataGridSelectionMode
  selectedKeys?: DataGridRowKey[]
  sortColumn?: string
  sortDirection?: DataGridSortDirection
  ariaLabel?: string
}

export interface DataGridElement extends HTMLElement {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  setRows: (rows: DataGridRowData[]) => void
  setColumns: (columns: DataGridColumn[]) => void
  getRows: () => DataGridRow[]
  getColumns: () => NormalizedDataGridColumn[]
  getVisibleRows: () => DataGridRow[]
  getSelection: () => DataGridSelectionState
  setSelection: (keys: DataGridRowKey[]) => void
  clearSelection: () => void
  toggleRowSelection: (key: DataGridRowKey) => void
  setSort: (
    columnId: string,
    direction?: DataGridSortDirection,
    nativeEvent?: Event,
  ) => void
  clearSort: () => void
  getSort: () => DataGridSortState | undefined
  getRange: () => DataGridVirtualRange
  getItems: () => DataGridVirtualItem[]
  getTotalSize: () => number
  scrollToIndex: (index: number, align?: VirtualScrollAlign) => void
  scrollToOffset: (offset: number) => void
  measure: (index?: number, size?: number) => void
  resetMeasurements: () => void
}

interface DataGridEmits extends Record<string, EventDefinition<unknown>> {
  rangeChange: EventDefinition<DataGridRangeChangeDetail>
  scrollOffsetChange: EventDefinition<DataGridScrollOffsetChangeDetail>
  selectionChange: EventDefinition<DataGridSelectionChangeDetail>
  sortChange: EventDefinition<DataGridSortChangeDetail>
  rowAction: EventDefinition<DataGridRowActionDetail>
  cellAction: EventDefinition<DataGridCellActionDetail>
}

function resolveRows(props: DataGridProps): DataGridRowData[] {
  return Array.isArray(props.rows) ? props.rows : []
}

function resolveColumns(props: DataGridProps): DataGridColumn[] {
  return Array.isArray(props.columns) ? props.columns : []
}

function resolveRowHeight(props: DataGridProps): number {
  const value = props.rowHeight ?? 40

  if (!Number.isFinite(value) || value <= 0) return 40

  return value
}

function resolveOverscan(props: DataGridProps): number {
  const value = props.overscan ?? 4

  if (!Number.isFinite(value) || value < 0) return 4

  return Math.floor(value)
}

function resolveSelectionMode(
  value: DataGridSelectionMode | undefined,
): DataGridSelectionMode {
  return value ?? 'none'
}

function getScrollOffset(viewport: HTMLElement | undefined): number {
  return viewport?.scrollTop ?? 0
}

function getViewportSize(viewport: HTMLElement | undefined): number {
  return viewport?.clientHeight ?? 0
}

function setScrollOffset(
  viewport: HTMLElement | undefined,
  offset: number,
): void {
  if (!viewport) return

  viewport.scrollTop = Math.max(0, offset)
}

function cloneEmptySnapshot(): DataGridVirtualSnapshot {
  return {
    range: createEmptyVirtualRange(),
    items: [],
    totalSize: 0,
  }
}

function setup(
  props: DataGridProps,
  ctx: DefineElementContext<DataGridElement, DataGridEmits>,
) {
  let viewport: HTMLElement | undefined

  let columns = normalizeDataGridColumns(resolveColumns(props))
  let visibleColumns = getVisibleDataGridColumns(columns)
  let rows = createDataGridRows(resolveRows(props))
  let sort: DataGridSortState | undefined =
    props.sortColumn && props.sortDirection
      ? { columnId: props.sortColumn, direction: props.sortDirection }
      : undefined
  let visibleRows = sortDataGridRows(rows, columns, sort)
  const selection = createDataGridSelectionModel(
    resolveSelectionMode(props.selectionMode),
    props.selectedKeys ?? [],
  )
  let virtualizer = createDataGridRowVirtualizer({
    rows: visibleRows,
    rowHeight: resolveRowHeight(props),
    overscan: resolveOverscan(props),
  })
  let currentSnapshot = cloneEmptySnapshot()
  let signature = ''
  const scheduler = createRafScheduler()

  const getSignature = (): string =>
    JSON.stringify({
      rowsLength: resolveRows(props).length,
      columnsLength: resolveColumns(props).length,
      rowHeight: resolveRowHeight(props),
      overscan: resolveOverscan(props),
      sort,
      selectionMode: resolveSelectionMode(props.selectionMode),
    })

  const rebuildModels = (): void => {
    const nextSignature = getSignature()

    if (nextSignature === signature) return

    signature = nextSignature
    columns = normalizeDataGridColumns(resolveColumns(props))
    visibleColumns = getVisibleDataGridColumns(columns)
    rows = createDataGridRows(resolveRows(props))
    visibleRows = sortDataGridRows(rows, columns, sort)
    selection.setMode(resolveSelectionMode(props.selectionMode))
    virtualizer = createDataGridRowVirtualizer({
      rows: visibleRows,
      rowHeight: resolveRowHeight(props),
      overscan: resolveOverscan(props),
    })
    currentSnapshot = cloneEmptySnapshot()
  }

  const emitSnapshotIfChanged = (
    nextSnapshot: DataGridVirtualSnapshot,
    scrollOffset: number,
    viewportSize: number,
  ): void => {
    if (!shouldUpdateDataGridVirtualSnapshot(currentSnapshot, nextSnapshot)) {
      return
    }

    currentSnapshot = nextSnapshot

    ctx.emit.rangeChange({
      range: currentSnapshot.range,
      items: currentSnapshot.items,
      scrollOffset,
      viewportSize,
      totalSize: currentSnapshot.totalSize,
    })
  }

  const getSnapshot = (): DataGridVirtualSnapshot => {
    rebuildModels()

    if (!props.virtual) {
      const rowHeight = resolveRowHeight(props)
      const total = visibleRows.length * rowHeight

      return {
        range: {
          start: 0,
          end: visibleRows.length - 1,
          overscanStart: 0,
          overscanEnd: visibleRows.length - 1,
        },
        items: visibleRows.map((row, index) => ({
          index,
          key: row.key,
          start: index * rowHeight,
          size: rowHeight,
          end: (index + 1) * rowHeight,
          data: row,
        })),
        totalSize: total,
      }
    }

    return virtualizer.getSnapshot(
      getScrollOffset(viewport),
      getViewportSize(viewport),
    )
  }

  const updateRange = (nativeEvent?: Event): void => {
    rebuildModels()

    const scrollOffset = getScrollOffset(viewport)
    const viewportSize = getViewportSize(viewport)
    const nextSnapshot = getSnapshot()

    emitSnapshotIfChanged(nextSnapshot, scrollOffset, viewportSize)

    if (nativeEvent) {
      ctx.emit.scrollOffsetChange({
        offset: scrollOffset,
        nativeEvent,
      })
    }
  }

  const scheduleUpdateRange = (nativeEvent?: Event): void => {
    scheduler.schedule(() => updateRange(nativeEvent))
  }

  const syncHostProps = (): void => {
    ctx.host.rows = resolveRows(props)
    ctx.host.columns = resolveColumns(props)
  }

  const emitSelection = (
    key: DataGridRowKey | undefined,
    nativeEvent?: Event,
  ): void => {
    const row = key ? getDataGridRowByKey(rows, key) : undefined

    ctx.emit.selectionChange({
      selection: selection.getState(),
      row,
      nativeEvent,
    })
  }

  const applySort = (
    columnId: string,
    direction?: DataGridSortDirection,
    nativeEvent?: Event,
  ): void => {
    rebuildModels()

    const column = getDataGridColumnById(columns, columnId)

    if (!column || !column.sortable) return

    sort = createNextDataGridSortState(sort, columnId, direction)
    visibleRows = sortDataGridRows(rows, columns, sort)
    virtualizer = createDataGridRowVirtualizer({
      rows: visibleRows,
      rowHeight: resolveRowHeight(props),
      overscan: resolveOverscan(props),
    })
    currentSnapshot = cloneEmptySnapshot()

    ctx.emit.sortChange({
      sort,
      column,
      nativeEvent,
    })

    updateRange()
  }

  ctx.expose({
    setRows(nextRows: DataGridRowData[]): void {
      props.rows = nextRows
      syncHostProps()
      signature = ''
      updateRange()
    },

    setColumns(nextColumns: DataGridColumn[]): void {
      props.columns = nextColumns
      syncHostProps()
      signature = ''
      updateRange()
    },

    getRows(): DataGridRow[] {
      rebuildModels()
      return rows.map(row => ({ ...row }))
    },

    getColumns(): NormalizedDataGridColumn[] {
      rebuildModels()
      return columns.map(column => ({ ...column }))
    },

    getVisibleRows(): DataGridRow[] {
      rebuildModels()
      return visibleRows.map(row => ({ ...row }))
    },

    getSelection(): DataGridSelectionState {
      return selection.getState()
    },

    setSelection(keys: DataGridRowKey[]): void {
      selection.setKeys(keys)
      emitSelection(undefined)
    },

    clearSelection(): void {
      selection.clear()
      emitSelection(undefined)
    },

    toggleRowSelection(key: DataGridRowKey): void {
      selection.toggle(key)
      emitSelection(key)
    },

    setSort(
      columnId: string,
      direction?: DataGridSortDirection,
      nativeEvent?: Event,
    ): void {
      applySort(columnId, direction, nativeEvent)
    },

    clearSort(): void {
      sort = undefined
      visibleRows = sortDataGridRows(rows, columns, sort)
      currentSnapshot = cloneEmptySnapshot()

      ctx.emit.sortChange({
        sort,
      })

      updateRange()
    },

    getSort(): DataGridSortState | undefined {
      return sort ? { ...sort } : undefined
    },

    getRange(): DataGridVirtualRange {
      return currentSnapshot.range
    },

    getItems(): DataGridVirtualItem[] {
      return currentSnapshot.items
    },

    getTotalSize(): number {
      rebuildModels()

      return props.virtual
        ? virtualizer.getTotalSize()
        : visibleRows.length * resolveRowHeight(props)
    },

    scrollToIndex(index: number, align: VirtualScrollAlign = 'start'): void {
      rebuildModels()

      const offset = props.virtual
        ? virtualizer.getOffsetForIndex(index, align, getViewportSize(viewport))
        : index * resolveRowHeight(props)

      setScrollOffset(viewport, offset)
      updateRange()
    },

    scrollToOffset(offset: number): void {
      setScrollOffset(viewport, offset)
      updateRange()
    },

    measure(index?: number, size?: number): void {
      rebuildModels()

      if (
        props.virtual &&
        typeof index === 'number' &&
        typeof size === 'number' &&
        Number.isFinite(index) &&
        Number.isFinite(size)
      ) {
        virtualizer.measure(index, size)
      }

      updateRange()
    },

    resetMeasurements(): void {
      rebuildModels()
      virtualizer.resetMeasurements()
      updateRange()
    },
  })

  const getBodyRows = (): DataGridVirtualItem[] => {
    const snapshot = getSnapshot()

    return snapshot.items
  }

  const getSpacerStyle = (): Record<string, string> => {
    if (!props.virtual) return { display: 'none' }

    return {
      height: `${virtualizer.getTotalSize()}px`,
      width: '1px',
      pointerEvents: 'none',
    }
  }

  const getGridTemplateColumns = (): string =>
    visibleColumns.map(column => `${column.width}px`).join(' ')

  const emitRowAction = (
    action: 'click' | 'dblclick' | 'keydown',
    row: DataGridRow,
    nativeEvent: Event,
  ): void => {
    ctx.emit.rowAction({
      action,
      row,
      nativeEvent,
    })
  }

  const emitCellAction = (
    action: 'click' | 'dblclick' | 'keydown',
    row: DataGridRow,
    column: NormalizedDataGridColumn,
    nativeEvent: Event,
  ): void => {
    ctx.emit.cellAction({
      action,
      cell: {
        row,
        column,
        value: getDataGridCellValue(row, column.field),
      },
      nativeEvent,
    })
  }

  syncHostProps()

  return (
    <Host
      part="root"
      data-slot="data-grid-root"
      data-virtual={() => (props.virtual ? '' : undefined)}
      data-selection-mode={() => resolveSelectionMode(props.selectionMode)}
      data-row-count={() => String(resolveRows(props).length)}
      data-column-count={() => String(resolveColumns(props).length)}
      data-total-size={() => String(virtualizer.getTotalSize())}
    >
      <div
        part="viewport"
        data-slot="data-grid-viewport"
        role="grid"
        aria-label={() => props.ariaLabel}
        aria-rowcount={() => String(resolveRows(props).length)}
        aria-colcount={() => String(visibleColumns.length)}
        onScroll={(nativeEvent: Event) => {
          scheduleUpdateRange(nativeEvent)
        }}
        ref={(element: HTMLElement | null) => {
          if (element) {
            viewport = element
            scheduleUpdateRange()
          }
        }}
      >
        <div
          part="header"
          data-slot="data-grid-header"
          role="row"
          style={() => ({
            display: 'grid',
            gridTemplateColumns: getGridTemplateColumns(),
            width: `${getTotalColumnWidth(columns)}px`,
          })}
        >
          {visibleColumns.map(column => (
            <div
              key={column.id}
              part="header-cell"
              data-slot="data-grid-header-cell"
              data-column-id={column.id}
              data-sortable={() => (column.sortable ? '' : undefined)}
              data-sort-direction={() =>
                sort?.columnId === column.id ? sort.direction : undefined
              }
              role="columnheader"
              tabindex={0}
              onClick={(nativeEvent: Event) => {
                applySort(column.id, undefined, nativeEvent)
              }}
              onKeyDown={(nativeEvent: KeyboardEvent) => {
                if (
                  column.sortable &&
                  (nativeEvent.key === 'Enter' || nativeEvent.key === ' ')
                ) {
                  applySort(column.id, undefined, nativeEvent)
                }
              }}
            >
              {column.header}
            </div>
          ))}
        </div>

        <div
          part="spacer"
          data-slot="data-grid-spacer"
          aria-hidden="true"
          style={() => getSpacerStyle()}
        />

        <div part="body" data-slot="data-grid-body" role="rowgroup">
          {getBodyRows().map(item => {
            const row = item.data

            if (!row) return null

            return (
              <div
                key={item.key}
                part="row"
                data-slot="data-grid-row"
                data-row-key={row.key}
                data-row-index={() => String(row.index)}
                data-selected={() =>
                  selection.isSelected(row.key) ? '' : undefined
                }
                role="row"
                style={() => ({
                  display: 'grid',
                  gridTemplateColumns: getGridTemplateColumns(),
                  width: `${getTotalColumnWidth(columns)}px`,
                  transform: props.virtual
                    ? `translateY(${item.start}px)`
                    : undefined,
                })}
                onClick={(nativeEvent: Event) => {
                  if (resolveSelectionMode(props.selectionMode) !== 'none') {
                    selection.toggle(row.key)
                    emitSelection(row.key, nativeEvent)
                  }

                  emitRowAction('click', row, nativeEvent)
                }}
                onDblClick={(nativeEvent: Event) => {
                  emitRowAction('dblclick', row, nativeEvent)
                }}
                onKeyDown={(nativeEvent: KeyboardEvent) => {
                  emitRowAction('keydown', row, nativeEvent)
                }}
              >
                {visibleColumns.map(column => (
                  <div
                    key={column.id}
                    part="cell"
                    data-slot="data-grid-cell"
                    data-column-id={column.id}
                    data-row-key={row.key}
                    data-align={column.align}
                    role="gridcell"
                    onClick={(nativeEvent: Event) => {
                      emitCellAction('click', row, column, nativeEvent)
                    }}
                    onDblClick={(nativeEvent: Event) => {
                      emitCellAction('dblclick', row, column, nativeEvent)
                    }}
                    onKeyDown={(nativeEvent: KeyboardEvent) => {
                      emitCellAction('keydown', row, column, nativeEvent)
                    }}
                  >
                    {String(getDataGridCellValue(row, column.field) ?? '')}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div part="empty" data-slot="data-grid-empty">
          <Slot name="empty" />
        </div>
      </div>
    </Host>
  )
}

export const DataGrid = defineElement<
  DataGridProps,
  DataGridElement,
  DataGridEmits
>(
  'zw-data-grid',
  {
    shadow: false,
    props: {
      rows: Array,
      columns: Array,
      rowHeight: prop(Number, {
        attr: 'row-height',
        default: 40,
      }),
      overscan: prop(Number, {
        default: 4,
      }),
      virtual: prop(Boolean, {
        reflect: true,
      }),
      selectionMode: prop(['none', 'single', 'multiple'], {
        attr: 'selection-mode',
        default: 'none',
        reflect: true,
      }),
      selectedKeys: Array,
      sortColumn: prop(String, {
        attr: 'sort-column',
      }),
      sortDirection: prop(['asc', 'desc'], {
        attr: 'sort-direction',
      }),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
    },
    emits: {
      rangeChange: event<DataGridRangeChangeDetail>(),
      scrollOffsetChange: event<DataGridScrollOffsetChangeDetail>(),
      selectionChange: event<DataGridSelectionChangeDetail>(),
      sortChange: event<DataGridSortChangeDetail>(),
      rowAction: event<DataGridRowActionDetail>(),
      cellAction: event<DataGridCellActionDetail>(),
    },
    meta: {
      description:
        'Headless data grid advanced component with row virtualization, selection and sorting.',
    },
  },
  setup,
)
