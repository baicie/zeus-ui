import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type { VirtualScrollAlign } from '@zeus-web/virtual'

import type {
  DataGridActiveCell,
  DataGridActiveCellChangeDetail,
  DataGridCellActionDetail,
  DataGridColumn,
  DataGridColumnResizeDetail,
  DataGridColumnResizeEndDetail,
  DataGridColumnResizeStartDetail,
  DataGridNavigationKey,
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
  applyDataGridColumnWidths,
  areDataGridActiveCellsEqual,
  createDataGridActiveCell,
  createDataGridColumnWidthState,
  createDataGridRows,
  createDataGridRowVirtualizer,
  createDataGridSelectionModel,
  createInitialDataGridActiveCell,
  createNextDataGridSortState,
  getDataGridActiveCellId,
  getDataGridCellValue,
  getDataGridColumnById,
  getDataGridRowByKey,
  getTotalColumnWidth,
  getVisibleDataGridColumns,
  moveDataGridActiveCell,
  normalizeDataGridColumns,
  resetDataGridColumnWidths,
  resizeDataGridColumn,
  resizeDataGridColumnByDelta,
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
  resizable?: boolean
  keyboardNavigation?: boolean
  activeRowKey?: DataGridRowKey
  activeColumnId?: string
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
  resizeColumn: (columnId: string, width: number, nativeEvent?: Event) => void
  resetColumnWidths: () => void
  getColumnWidths: () => Record<string, number>
  setActiveCell: (
    rowKey: DataGridRowKey,
    columnId: string,
    nativeEvent?: Event,
  ) => void
  getActiveCell: () => DataGridActiveCell | undefined
  moveActiveCell: (key: DataGridNavigationKey, nativeEvent?: Event) => void
}

interface DataGridEmits extends Record<string, EventDefinition<unknown>> {
  rangeChange: EventDefinition<DataGridRangeChangeDetail>
  scrollOffsetChange: EventDefinition<DataGridScrollOffsetChangeDetail>
  selectionChange: EventDefinition<DataGridSelectionChangeDetail>
  sortChange: EventDefinition<DataGridSortChangeDetail>
  rowAction: EventDefinition<DataGridRowActionDetail>
  cellAction: EventDefinition<DataGridCellActionDetail>
  columnResizeStart: EventDefinition<DataGridColumnResizeStartDetail>
  columnResize: EventDefinition<DataGridColumnResizeDetail>
  columnResizeEnd: EventDefinition<DataGridColumnResizeEndDetail>
  activeCellChange: EventDefinition<DataGridActiveCellChangeDetail>
}

interface ResizeSession {
  columnId: string
  startX: number
  startWidth: number
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

function isNavigationKey(key: string): key is DataGridNavigationKey {
  return (
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'Home' ||
    key === 'End' ||
    key === 'PageUp' ||
    key === 'PageDown'
  )
}

function setup(
  props: DataGridProps,
  ctx: DefineElementContext<DataGridElement, DataGridEmits>,
) {
  let viewport: HTMLElement | undefined
  let resizeSession: ResizeSession | undefined

  let rowsSource = resolveRows(props)
  let columnsSource = resolveColumns(props)
  let selectedKeysSource = props.selectedKeys

  let baseColumns = normalizeDataGridColumns(columnsSource)
  let defaultColumnWidths = createDataGridColumnWidthState(baseColumns)
  let columnWidths = { ...defaultColumnWidths }
  let columns = applyDataGridColumnWidths(baseColumns, columnWidths)
  let visibleColumns = getVisibleDataGridColumns(columns)
  let rows = createDataGridRows(rowsSource)
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
  let activeCell = createInitialDataGridActiveCell({
    rows: visibleRows,
    columns: visibleColumns,
    rowKey: props.activeRowKey,
    columnId: props.activeColumnId,
  })
  let signature = ''
  let modelVersion = 0
  let activeRowKeySource = props.activeRowKey
  let activeColumnIdSource = props.activeColumnId
  let shouldSyncActiveCellFromProps = false
  const scheduler = createRafScheduler()

  const touchExternalModelVersion = (): void => {
    const nextRowsSource = resolveRows(props)
    const nextColumnsSource = resolveColumns(props)
    const nextSelectedKeysSource = props.selectedKeys
    const nextActiveRowKeySource = props.activeRowKey
    const nextActiveColumnIdSource = props.activeColumnId

    const columnsChanged = nextColumnsSource !== columnsSource
    const activeCellPropsChanged =
      nextActiveRowKeySource !== activeRowKeySource ||
      nextActiveColumnIdSource !== activeColumnIdSource

    if (
      nextRowsSource !== rowsSource ||
      columnsChanged ||
      nextSelectedKeysSource !== selectedKeysSource ||
      activeCellPropsChanged
    ) {
      rowsSource = nextRowsSource
      columnsSource = nextColumnsSource
      selectedKeysSource = nextSelectedKeysSource
      activeRowKeySource = nextActiveRowKeySource
      activeColumnIdSource = nextActiveColumnIdSource

      if (columnsChanged) {
        baseColumns = normalizeDataGridColumns(columnsSource)
        defaultColumnWidths = createDataGridColumnWidthState(baseColumns)
        columnWidths = { ...defaultColumnWidths }
      }

      if (activeCellPropsChanged) {
        shouldSyncActiveCellFromProps = true
      }

      modelVersion += 1
    }
  }

  const getSignature = (): string => {
    touchExternalModelVersion()

    return JSON.stringify({
      modelVersion,
      rowHeight: resolveRowHeight(props),
      overscan: resolveOverscan(props),
      sort,
      selectionMode: resolveSelectionMode(props.selectionMode),
      resizable: Boolean(props.resizable),
      keyboardNavigation: props.keyboardNavigation !== false,
    })
  }

  const rebuildModels = (): void => {
    const nextSignature = getSignature()

    if (nextSignature === signature) return

    signature = nextSignature
    baseColumns = normalizeDataGridColumns(columnsSource)
    columns = applyDataGridColumnWidths(baseColumns, columnWidths)
    visibleColumns = getVisibleDataGridColumns(columns)
    rows = createDataGridRows(rowsSource)

    if (Array.isArray(props.selectedKeys)) {
      selection.setKeys(props.selectedKeys)
    }

    selection.setMode(resolveSelectionMode(props.selectionMode))
    visibleRows = sortDataGridRows(rows, columns, sort)
    virtualizer = createDataGridRowVirtualizer({
      rows: visibleRows,
      rowHeight: resolveRowHeight(props),
      overscan: resolveOverscan(props),
    })
    activeCell = createInitialDataGridActiveCell({
      rows: visibleRows,
      columns: visibleColumns,
      rowKey: shouldSyncActiveCellFromProps
        ? props.activeRowKey
        : (activeCell?.rowKey ?? props.activeRowKey),
      columnId: shouldSyncActiveCellFromProps
        ? props.activeColumnId
        : (activeCell?.columnId ?? props.activeColumnId),
    })
    shouldSyncActiveCellFromProps = false
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

  const emitActiveCell = (
    nextActiveCell: DataGridActiveCell | undefined,
    nativeEvent?: Event,
  ): void => {
    if (areDataGridActiveCellsEqual(activeCell, nextActiveCell)) return

    const previousActiveCell = activeCell
    activeCell = nextActiveCell

    props.activeRowKey = activeCell?.rowKey
    props.activeColumnId = activeCell?.columnId
    activeRowKeySource = props.activeRowKey
    activeColumnIdSource = props.activeColumnId
    modelVersion += 1
    signature = ''

    ctx.emit.activeCellChange({
      activeCell,
      previousActiveCell,
      nativeEvent,
    })
  }

  const setActiveCellByKey = (
    rowKey: DataGridRowKey,
    columnId: string,
    nativeEvent?: Event,
  ): void => {
    rebuildModels()

    const rowIndex = visibleRows.findIndex(row => row.key === rowKey)
    const columnIndex = visibleColumns.findIndex(
      column => column.id === columnId,
    )

    if (rowIndex < 0 || columnIndex < 0) return

    emitActiveCell(
      createDataGridActiveCell(
        visibleRows,
        visibleColumns,
        rowIndex,
        columnIndex,
      ),
      nativeEvent,
    )
  }

  const moveActiveCellByKey = (
    key: DataGridNavigationKey,
    nativeEvent?: Event,
  ): void => {
    rebuildModels()

    if (props.keyboardNavigation === false) return

    const nextActiveCell = moveDataGridActiveCell({
      rows: visibleRows,
      columns: visibleColumns,
      current: activeCell,
      key,
      pageSize: Math.max(
        1,
        Math.floor(getViewportSize(viewport) / resolveRowHeight(props)),
      ),
    })

    emitActiveCell(nextActiveCell, nativeEvent)

    if (nextActiveCell) {
      ctx.host.scrollToIndex(nextActiveCell.rowIndex, 'center')
    }
  }

  const moveActiveCellFromCell = (
    rowKey: DataGridRowKey,
    columnId: string,
    key: DataGridNavigationKey,
    nativeEvent?: Event,
  ): void => {
    rebuildModels()

    if (props.keyboardNavigation === false) return

    const rowIndex = visibleRows.findIndex(row => row.key === rowKey)
    const columnIndex = visibleColumns.findIndex(
      column => column.id === columnId,
    )

    if (rowIndex < 0 || columnIndex < 0) return

    const current = createDataGridActiveCell(
      visibleRows,
      visibleColumns,
      rowIndex,
      columnIndex,
    )

    const nextActiveCell = moveDataGridActiveCell({
      rows: visibleRows,
      columns: visibleColumns,
      current,
      key,
      pageSize: Math.max(
        1,
        Math.floor(getViewportSize(viewport) / resolveRowHeight(props)),
      ),
    })

    emitActiveCell(nextActiveCell, nativeEvent)

    if (nextActiveCell) {
      ctx.host.scrollToIndex(nextActiveCell.rowIndex, 'center')
    }
  }

  const applyColumnResize = (
    columnId: string,
    width: number,
    nativeEvent?: Event,
  ): void => {
    rebuildModels()

    const result = resizeDataGridColumn(columns, columnId, width, columnWidths)
    if (!result.column || result.width === undefined) return

    columnWidths = result.widths
    columns = result.columns
    visibleColumns = getVisibleDataGridColumns(columns)
    modelVersion += 1
    signature = ''

    ctx.emit.columnResize({
      column: result.column,
      width: result.width,
      previousWidth: result.previousWidth ?? result.width,
      nativeEvent,
    })
  }

  const startResize = (
    column: NormalizedDataGridColumn,
    nativeEvent: PointerEvent,
  ): void => {
    if (!props.resizable || !column.resizable) return

    resizeSession = {
      columnId: column.id,
      startX: nativeEvent.clientX,
      startWidth: column.width,
    }

    ctx.emit.columnResizeStart({
      column,
      width: column.width,
      nativeEvent,
    })

    const target = nativeEvent.currentTarget as HTMLElement | null
    target?.setPointerCapture?.(nativeEvent.pointerId)
  }

  const moveResize = (nativeEvent: PointerEvent): void => {
    if (!resizeSession) return

    const result = resizeDataGridColumnByDelta({
      columns,
      widths: columnWidths,
      columnId: resizeSession.columnId,
      baseWidth: resizeSession.startWidth,
      delta: nativeEvent.clientX - resizeSession.startX,
    })

    if (!result.column || result.width === undefined) return

    columnWidths = result.widths
    columns = result.columns
    visibleColumns = getVisibleDataGridColumns(columns)
    modelVersion += 1
    signature = ''

    ctx.emit.columnResize({
      column: result.column,
      width: result.width,
      previousWidth: result.previousWidth ?? result.width,
      nativeEvent,
    })
  }

  const endResize = (nativeEvent: PointerEvent): void => {
    if (!resizeSession) return

    const column = getDataGridColumnById(columns, resizeSession.columnId)
    resizeSession = undefined

    if (!column) return

    ctx.emit.columnResizeEnd({
      column,
      width: column.width,
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
    modelVersion += 1
    signature = ''
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
      rowsSource = nextRows
      modelVersion += 1
      syncHostProps()
      signature = ''
      updateRange()
    },

    setColumns(nextColumns: DataGridColumn[]): void {
      props.columns = nextColumns
      columnsSource = nextColumns
      baseColumns = normalizeDataGridColumns(nextColumns)
      defaultColumnWidths = createDataGridColumnWidthState(baseColumns)
      columnWidths = { ...defaultColumnWidths }
      modelVersion += 1
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
      props.selectedKeys = selection.getState().keys
      selectedKeysSource = props.selectedKeys
      modelVersion += 1
      emitSelection(undefined)
    },

    clearSelection(): void {
      selection.clear()
      props.selectedKeys = []
      selectedKeysSource = props.selectedKeys
      modelVersion += 1
      emitSelection(undefined)
    },

    toggleRowSelection(key: DataGridRowKey): void {
      selection.toggle(key)
      props.selectedKeys = selection.getState().keys
      selectedKeysSource = props.selectedKeys
      modelVersion += 1
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
      modelVersion += 1
      signature = ''
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

    resizeColumn(columnId: string, width: number, nativeEvent?: Event): void {
      applyColumnResize(columnId, width, nativeEvent)
    },

    resetColumnWidths(): void {
      rebuildModels()

      const result = resetDataGridColumnWidths(baseColumns, defaultColumnWidths)
      columnWidths = result.widths
      columns = result.columns
      visibleColumns = getVisibleDataGridColumns(columns)
      modelVersion += 1
      signature = ''
      updateRange()
    },

    getColumnWidths(): Record<string, number> {
      rebuildModels()
      return { ...columnWidths }
    },

    setActiveCell(
      rowKey: DataGridRowKey,
      columnId: string,
      nativeEvent?: Event,
    ): void {
      setActiveCellByKey(rowKey, columnId, nativeEvent)
    },

    getActiveCell(): DataGridActiveCell | undefined {
      return activeCell ? { ...activeCell } : undefined
    },

    moveActiveCell(key: DataGridNavigationKey, nativeEvent?: Event): void {
      moveActiveCellByKey(key, nativeEvent)
    },
  })

  const getBodyRows = (): DataGridVirtualItem[] => {
    const snapshot = getSnapshot()
    currentSnapshot = snapshot

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
      data-resizable={() => (props.resizable ? '' : undefined)}
      data-keyboard-navigation={() =>
        props.keyboardNavigation !== false ? '' : undefined
      }
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
        aria-activedescendant={() => getDataGridActiveCellId(activeCell)}
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
              data-resizable={() =>
                props.resizable && column.resizable ? '' : undefined
              }
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
              <span part="header-label" data-slot="data-grid-header-label">
                {column.header}
              </span>

              <span
                part="resize-handle"
                data-slot="data-grid-resize-handle"
                role="separator"
                aria-orientation="vertical"
                aria-valuenow={() => String(column.width)}
                aria-valuemin={() => String(column.minWidth)}
                aria-valuemax={() => String(column.maxWidth)}
                tabindex={() =>
                  props.resizable && column.resizable ? 0 : undefined
                }
                hidden={() => !(props.resizable && column.resizable)}
                onPointerDown={(nativeEvent: PointerEvent) => {
                  startResize(column, nativeEvent)
                }}
                onPointerMove={(nativeEvent: PointerEvent) => {
                  moveResize(nativeEvent)
                }}
                onPointerUp={(nativeEvent: PointerEvent) => {
                  endResize(nativeEvent)
                }}
                onPointerCancel={(nativeEvent: PointerEvent) => {
                  endResize(nativeEvent)
                }}
                onKeyDown={(nativeEvent: KeyboardEvent) => {
                  if (!props.resizable || !column.resizable) return

                  if (nativeEvent.key === 'ArrowLeft') {
                    nativeEvent.preventDefault()
                    applyColumnResize(column.id, column.width - 16, nativeEvent)
                  }

                  if (nativeEvent.key === 'ArrowRight') {
                    nativeEvent.preventDefault()
                    applyColumnResize(column.id, column.width + 16, nativeEvent)
                  }

                  if (nativeEvent.key === 'Home') {
                    nativeEvent.preventDefault()
                    applyColumnResize(column.id, column.minWidth, nativeEvent)
                  }

                  if (nativeEvent.key === 'End') {
                    nativeEvent.preventDefault()
                    applyColumnResize(column.id, column.maxWidth, nativeEvent)
                  }
                }}
              />
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
                    props.selectedKeys = selection.getState().keys
                    selectedKeysSource = props.selectedKeys
                    modelVersion += 1
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
                {visibleColumns.map(column => {
                  const isActive =
                    activeCell?.rowKey === row.key &&
                    activeCell?.columnId === column.id
                  const cellId =
                    getDataGridActiveCellId({
                      rowIndex: row.index,
                      rowKey: row.key,
                      columnId: column.id,
                      columnIndex: visibleColumns.findIndex(
                        item => item.id === column.id,
                      ),
                    }) ?? undefined

                  return (
                    <div
                      key={column.id}
                      id={cellId}
                      part="cell"
                      data-slot="data-grid-cell"
                      data-column-id={column.id}
                      data-row-key={row.key}
                      data-align={column.align}
                      data-active={() => (isActive ? '' : undefined)}
                      role="gridcell"
                      tabindex={() =>
                        props.keyboardNavigation === false
                          ? undefined
                          : isActive
                            ? 0
                            : -1
                      }
                      onClick={(nativeEvent: Event) => {
                        setActiveCellByKey(row.key, column.id, nativeEvent)
                        emitCellAction('click', row, column, nativeEvent)
                      }}
                      onDblClick={(nativeEvent: Event) => {
                        emitCellAction('dblclick', row, column, nativeEvent)
                      }}
                      onKeyDown={(nativeEvent: KeyboardEvent) => {
                        if (
                          props.keyboardNavigation !== false &&
                          isNavigationKey(nativeEvent.key)
                        ) {
                          nativeEvent.preventDefault()
                          moveActiveCellFromCell(
                            row.key,
                            column.id,
                            nativeEvent.key,
                            nativeEvent,
                          )
                        }

                        emitCellAction('keydown', row, column, nativeEvent)
                      }}
                    >
                      {String(getDataGridCellValue(row, column.field) ?? '')}
                    </div>
                  )
                })}
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
      resizable: prop(Boolean, {
        reflect: true,
      }),
      keyboardNavigation: prop(Boolean, {
        attr: 'keyboard-navigation',
        default: true,
      }),
      activeRowKey: prop(String, {
        attr: 'active-row-key',
      }),
      activeColumnId: prop(String, {
        attr: 'active-column-id',
      }),
    },
    emits: {
      rangeChange: event<DataGridRangeChangeDetail>(),
      scrollOffsetChange: event<DataGridScrollOffsetChangeDetail>(),
      selectionChange: event<DataGridSelectionChangeDetail>(),
      sortChange: event<DataGridSortChangeDetail>(),
      rowAction: event<DataGridRowActionDetail>(),
      cellAction: event<DataGridCellActionDetail>(),
      columnResizeStart: event<DataGridColumnResizeStartDetail>(),
      columnResize: event<DataGridColumnResizeDetail>(),
      columnResizeEnd: event<DataGridColumnResizeEndDetail>(),
      activeCellChange: event<DataGridActiveCellChangeDetail>(),
    },
    meta: {
      description:
        'Headless data grid advanced component with row virtualization, column resizing, keyboard navigation, selection and sorting.',
    },
  },
  setup,
)
