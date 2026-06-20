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
  DataGridViewportMeasurement,
  DataGridViewportResizeDetail,
  DataGridVirtualItem,
  DataGridVirtualRange,
  DataGridVirtualSnapshot,
  NormalizedDataGridColumn,
} from '../types'
import {
  defineElement,
  event,
  For,
  Host,
  prop,
  Slot,
  state,
} from '@zeus-js/zeus'
import { createEmptyVirtualRange, createRafScheduler } from '@zeus-web/virtual'
import {
  applyDataGridColumnWidths,
  areDataGridActiveCellsEqual,
  createDataGridActiveCell,
  createDataGridColumnWidthState,
  createDataGridControlledSortState,
  createDataGridControlledStateController,
  createDataGridRows,
  createDataGridRowVirtualizer,
  createDataGridSelectionModel,
  createDataGridViewportMeasureController,
  createInitialDataGridActiveCell,
  createNextDataGridSortState,
  getDataGridActiveCellId,
  getDataGridActiveDescendant,
  getDataGridAriaMultiSelectable,
  getDataGridAriaSelected,
  getDataGridAriaSort,
  getDataGridCellTabIndex,
  getDataGridCellValue,
  getDataGridColumnAriaIndex,
  getDataGridColumnById,
  getDataGridDataRowAriaIndex,
  getDataGridHeaderRowAriaIndex,
  getDataGridResizeHandleAriaLabel,
  getDataGridRowByKey,
  getTotalColumnWidth,
  getVisibleDataGridColumns,
  moveDataGridActiveCell,
  normalizeDataGridColumns,
  resetDataGridColumnWidths,
  resizeDataGridColumn,
  resizeDataGridColumnByDelta,
  shouldEmitDataGridViewportResize,
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
  rowHeight?: number
  overscan?: number
  virtual?: boolean
  selectionMode?: 'none' | 'single' | 'multiple'
  selectedKeys?: DataGridRowKey[]
  sortColumn?: string
  sortDirection?: DataGridSortDirection
  resizable?: boolean
  keyboardNavigation?: boolean
  activeRowKey?: DataGridRowKey
  activeColumnId?: string
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
  focusCell: (rowKey: DataGridRowKey, columnId: string) => void
  focusActiveCell: () => void
  refreshViewport: () => void
}

interface DataGridEmits extends Record<string, EventDefinition<unknown>> {
  rangeChange: EventDefinition<DataGridRangeChangeDetail>
  scrollOffsetChange: EventDefinition<DataGridScrollOffsetChangeDetail>
  viewportResize: EventDefinition<DataGridViewportResizeDetail>
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

function resolveVirtual(props: DataGridProps): boolean {
  return Boolean(props.virtual)
}

function resolveResizable(props: DataGridProps): boolean {
  return Boolean(props.resizable)
}

function resolveKeyboardNavigation(props: DataGridProps): boolean {
  return props.keyboardNavigation !== false
}

function getScrollOffset(viewport: HTMLElement | undefined): number {
  return viewport?.scrollTop ?? 0
}

function getViewportClientHeight(viewport: HTMLElement | undefined): number {
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

function escapeDataGridSelectorValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function setup(
  props: DataGridProps,
  ctx: DefineElementContext<DataGridElement, DataGridEmits>,
) {
  let viewport: HTMLElement | undefined
  let viewportResizeObserver: ResizeObserver | undefined
  let resizeSession: ResizeSession | undefined

  let rowsSource = resolveRows(props)
  let columnsSource = resolveColumns(props)

  let baseColumns = normalizeDataGridColumns(columnsSource)
  let defaultColumnWidths = createDataGridColumnWidthState(baseColumns)
  let columnWidths = { ...defaultColumnWidths }
  let columns = applyDataGridColumnWidths(baseColumns, columnWidths)
  let visibleColumns = getVisibleDataGridColumns(columns)
  let rows = createDataGridRows(rowsSource)
  let sort: DataGridSortState | undefined = createDataGridControlledSortState(
    props.sortColumn,
    props.sortDirection,
  )
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
  const renderVersion = state(0)
  let activeCell = createInitialDataGridActiveCell({
    rows: visibleRows,
    columns: visibleColumns,
    rowKey: props.activeRowKey,
    columnId: props.activeColumnId,
  })
  let shouldSyncActiveCellFromProps = true
  let modelVersion = 0
  let signature = ''
  const scheduler = createRafScheduler()

  const viewportMeasure = createDataGridViewportMeasureController()
  let viewportMeasurement: DataGridViewportMeasurement =
    viewportMeasure.measure(0, resolveRowHeight(props), visibleRows.length)

  const controlledState = createDataGridControlledStateController({
    rows: rowsSource,
    columns: columnsSource,
    selectedKeys: props.selectedKeys,
    sortColumn: props.sortColumn,
    sortDirection: props.sortDirection,
    activeRowKey: props.activeRowKey,
    activeColumnId: props.activeColumnId,
    rowHeight: resolveRowHeight(props),
    overscan: resolveOverscan(props),
    virtual: resolveVirtual(props),
    selectionMode: resolveSelectionMode(props.selectionMode),
    resizable: resolveResizable(props),
    keyboardNavigation: resolveKeyboardNavigation(props),
  })

  const readControlledStateSources = () => ({
    rows: resolveRows(props),
    columns: resolveColumns(props),
    selectedKeys: props.selectedKeys,
    sortColumn: props.sortColumn,
    sortDirection: props.sortDirection,
    activeRowKey: props.activeRowKey,
    activeColumnId: props.activeColumnId,
    rowHeight: resolveRowHeight(props),
    overscan: resolveOverscan(props),
    virtual: resolveVirtual(props),
    selectionMode: resolveSelectionMode(props.selectionMode),
    resizable: resolveResizable(props),
    keyboardNavigation: resolveKeyboardNavigation(props),
  })

  const measureViewport = (): DataGridViewportMeasurement => {
    const previousViewportSize = viewportMeasurement.size
    const nextMeasurement = viewportMeasure.measure(
      getViewportClientHeight(viewport),
      resolveRowHeight(props),
      visibleRows.length,
    )

    if (
      shouldEmitDataGridViewportResize(viewportMeasurement, nextMeasurement)
    ) {
      viewportMeasurement = nextMeasurement

      ctx.emit.viewportResize({
        viewportSize: viewportMeasurement.size,
        source: viewportMeasurement.source,
        previousViewportSize,
      })
    } else {
      viewportMeasurement = nextMeasurement
    }

    return viewportMeasurement
  }

  const getResolvedViewportSize = (): number => measureViewport().size

  const queryCell = (
    rowKey: DataGridRowKey,
    columnId: string,
  ): HTMLElement | null => {
    return ctx.host.querySelector<HTMLElement>(
      `[data-slot="data-grid-cell"][data-row-key="${escapeDataGridSelectorValue(
        rowKey,
      )}"][data-column-id="${escapeDataGridSelectorValue(columnId)}"]`,
    )
  }

  const focusCellElement = (rowKey: DataGridRowKey, columnId: string): void => {
    queryCell(rowKey, columnId)?.focus()
  }

  const focusActiveCellElement = (): void => {
    if (!activeCell) return

    focusCellElement(activeCell.rowKey, activeCell.columnId)
  }

  const scheduleFocusActiveCellElement = (): void => {
    scheduler.schedule(() => {
      focusActiveCellElement()
    })
  }

  const syncControlledSources = (): void => {
    const changes = controlledState.update(readControlledStateSources())

    if (!changes.changed) return

    rowsSource = resolveRows(props)
    columnsSource = resolveColumns(props)

    if (changes.columnsChanged) {
      baseColumns = normalizeDataGridColumns(columnsSource)
      defaultColumnWidths = createDataGridColumnWidthState(baseColumns)
      columnWidths = { ...defaultColumnWidths }
    }

    if (changes.selectedKeysChanged) {
      selection.setKeys(props.selectedKeys ?? [])
    }

    if (changes.selectionModeChanged) {
      selection.setMode(resolveSelectionMode(props.selectionMode))
    }

    if (changes.sortChanged) {
      sort = createDataGridControlledSortState(
        props.sortColumn,
        props.sortDirection,
      )
    }

    if (changes.activeCellChanged) {
      shouldSyncActiveCellFromProps = true
    }

    modelVersion += 1
  }

  const getSignature = (): string => {
    syncControlledSources()

    return JSON.stringify({
      modelVersion,
      columnWidths,
      sort,
      rowHeight: resolveRowHeight(props),
      overscan: resolveOverscan(props),
      virtual: resolveVirtual(props),
      selectionMode: resolveSelectionMode(props.selectionMode),
      resizable: resolveResizable(props),
      keyboardNavigation: resolveKeyboardNavigation(props),
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
    selection.setMode(resolveSelectionMode(props.selectionMode))

    selection.setKeys(props.selectedKeys ?? [])

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
    renderVersion.value += 1

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
      getResolvedViewportSize(),
    )
  }

  const updateRange = (nativeEvent?: Event): void => {
    rebuildModels()
    measureViewport()

    const scrollOffset = getScrollOffset(viewport)
    const viewportSize = getResolvedViewportSize()
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

  const connectViewportObserver = (element: HTMLElement): void => {
    viewportResizeObserver?.disconnect()

    if (typeof ResizeObserver === 'undefined') return

    viewportResizeObserver = new ResizeObserver(() => {
      measureViewport()
      scheduleUpdateRange()
    })
    viewportResizeObserver.observe(element)
  }

  const commitControlledState = (): void => {
    controlledState.commit(readControlledStateSources())
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

  const syncSelectionPropsFromModel = (): void => {
    props.selectedKeys = selection.getState().keys
    commitControlledState()
    modelVersion += 1
    signature = ''
  }

  const syncSortPropsFromModel = (): void => {
    props.sortColumn = sort?.columnId
    props.sortDirection = sort?.direction
    commitControlledState()
    modelVersion += 1
    signature = ''
  }

  const syncActiveCellPropsFromModel = (): void => {
    props.activeRowKey = activeCell?.rowKey
    props.activeColumnId = activeCell?.columnId
    commitControlledState()
    modelVersion += 1
    signature = ''
  }

  const emitActiveCell = (
    nextActiveCell: DataGridActiveCell | undefined,
    nativeEvent?: Event,
  ): void => {
    if (areDataGridActiveCellsEqual(activeCell, nextActiveCell)) return

    const previousActiveCell = activeCell
    activeCell = nextActiveCell
    syncActiveCellPropsFromModel()

    ctx.emit.activeCellChange({
      activeCell,
      previousActiveCell,
      nativeEvent,
    })

    scheduleFocusActiveCellElement()
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
        Math.floor(getResolvedViewportSize() / resolveRowHeight(props)),
      ),
    })

    emitActiveCell(nextActiveCell, nativeEvent)

    if (nextActiveCell) {
      ctx.host.scrollToIndex(nextActiveCell.rowIndex, 'center')
      scheduleFocusActiveCellElement()
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
        Math.floor(getResolvedViewportSize() / resolveRowHeight(props)),
      ),
    })

    emitActiveCell(nextActiveCell, nativeEvent)

    if (nextActiveCell) {
      ctx.host.scrollToIndex(nextActiveCell.rowIndex, 'center')
      scheduleFocusActiveCellElement()
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
    syncSortPropsFromModel()
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
      commitControlledState()
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
      commitControlledState()
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
      rebuildModels()
      return selection.getState()
    },

    setSelection(keys: DataGridRowKey[]): void {
      selection.setKeys(keys)
      syncSelectionPropsFromModel()
      emitSelection(undefined)
    },

    clearSelection(): void {
      selection.clear()
      syncSelectionPropsFromModel()
      emitSelection(undefined)
    },

    toggleRowSelection(key: DataGridRowKey): void {
      selection.toggle(key)
      syncSelectionPropsFromModel()
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
      syncSortPropsFromModel()
      visibleRows = sortDataGridRows(rows, columns, sort)
      currentSnapshot = cloneEmptySnapshot()

      ctx.emit.sortChange({
        sort,
      })

      updateRange()
    },

    getSort(): DataGridSortState | undefined {
      rebuildModels()
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
        ? virtualizer.getOffsetForIndex(index, align, getResolvedViewportSize())
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
      rebuildModels()
      return activeCell ? { ...activeCell } : undefined
    },

    moveActiveCell(key: DataGridNavigationKey, nativeEvent?: Event): void {
      moveActiveCellByKey(key, nativeEvent)
    },

    focusCell(rowKey: DataGridRowKey, columnId: string): void {
      rebuildModels()

      const rowIndex = visibleRows.findIndex(row => row.key === rowKey)

      if (rowIndex >= 0) {
        ctx.host.scrollToIndex(rowIndex, 'center')
      }

      setActiveCellByKey(rowKey, columnId)
      scheduleFocusActiveCellElement()
    },

    focusActiveCell(): void {
      rebuildModels()
      focusActiveCellElement()
    },

    refreshViewport(): void {
      measureViewport()
      updateRange()
    },
  })

  const getBodyRows = (): DataGridVirtualItem[] => {
    const snapshot = getSnapshot()
    currentSnapshot = snapshot

    return snapshot.items
  }

  const getBodyRowsForRender = (): DataGridVirtualItem[] => {
    void renderVersion.value
    return getBodyRows()
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
        aria-rowcount={() => String(resolveRows(props).length + 1)}
        aria-colcount={() => String(visibleColumns.length)}
        aria-activedescendant={() =>
          getDataGridActiveDescendant(activeCell, getDataGridActiveCellId)
        }
        aria-multiselectable={() =>
          getDataGridAriaMultiSelectable(
            resolveSelectionMode(props.selectionMode),
          )
        }
        ref={(element: HTMLElement | null) => {
          if (element) {
            if (viewport && viewport !== element) {
              viewport.removeEventListener('scroll', scheduleUpdateRange)
            }

            viewport = element
            element.addEventListener('scroll', scheduleUpdateRange)
            connectViewportObserver(element)
            measureViewport()
            scheduleUpdateRange()
            return
          }

          viewportResizeObserver?.disconnect()
          viewportResizeObserver = undefined

          if (viewport) {
            viewport.removeEventListener('scroll', scheduleUpdateRange)
          }

          viewport = undefined
        }}
      >
        <div
          part="header"
          data-slot="data-grid-header"
          role="row"
          aria-rowindex={() => String(getDataGridHeaderRowAriaIndex())}
          style={() => ({
            display: 'grid',
            gridTemplateColumns: getGridTemplateColumns(),
            width: `${getTotalColumnWidth(columns)}px`,
          })}
        >
          <For each={visibleColumns} by={column => column.id}>
            {(column, index) => (
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
                aria-colindex={() => String(getDataGridColumnAriaIndex(index))}
                aria-sort={() => getDataGridAriaSort(column, sort)}
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
                  aria-label={() => getDataGridResizeHandleAriaLabel(column)}
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
                      applyColumnResize(
                        column.id,
                        column.width - 16,
                        nativeEvent,
                      )
                    }

                    if (nativeEvent.key === 'ArrowRight') {
                      nativeEvent.preventDefault()
                      applyColumnResize(
                        column.id,
                        column.width + 16,
                        nativeEvent,
                      )
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
            )}
          </For>
        </div>

        <div
          part="spacer"
          data-slot="data-grid-spacer"
          aria-hidden="true"
          style={() => getSpacerStyle()}
        />

        <div part="body" data-slot="data-grid-body" role="rowgroup">
          <For each={getBodyRowsForRender()} by={item => item.key}>
            {item =>
              (() => {
                const row = item.data as DataGridRow

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
                    aria-rowindex={() =>
                      String(getDataGridDataRowAriaIndex(row.index))
                    }
                    aria-selected={() =>
                      getDataGridAriaSelected(
                        resolveSelectionMode(props.selectionMode),
                        selection.isSelected(row.key),
                      )
                    }
                    style={() => ({
                      display: 'grid',
                      gridTemplateColumns: getGridTemplateColumns(),
                      width: `${getTotalColumnWidth(columns)}px`,
                      transform: props.virtual
                        ? `translateY(${item.start}px)`
                        : undefined,
                    })}
                    onClick={(nativeEvent: Event) => {
                      if (
                        resolveSelectionMode(props.selectionMode) !== 'none'
                      ) {
                        selection.toggle(row.key)
                        syncSelectionPropsFromModel()
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
                    <For each={visibleColumns} by={column => column.id}>
                      {(column, columnIndex) =>
                        (() => {
                          const isActive =
                            activeCell?.rowKey === row.key &&
                            activeCell?.columnId === column.id
                          const cellId =
                            getDataGridActiveCellId({
                              rowIndex: row.index,
                              rowKey: row.key,
                              columnId: column.id,
                              columnIndex,
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
                              aria-colindex={() =>
                                String(getDataGridColumnAriaIndex(columnIndex))
                              }
                              aria-selected={() =>
                                getDataGridAriaSelected(
                                  resolveSelectionMode(props.selectionMode),
                                  selection.isSelected(row.key),
                                )
                              }
                              tabindex={() =>
                                getDataGridCellTabIndex(
                                  props.keyboardNavigation !== false,
                                  isActive,
                                )
                              }
                              onFocus={(nativeEvent: FocusEvent) => {
                                setActiveCellByKey(
                                  row.key,
                                  column.id,
                                  nativeEvent,
                                )
                              }}
                              onClick={(nativeEvent: Event) => {
                                setActiveCellByKey(
                                  row.key,
                                  column.id,
                                  nativeEvent,
                                )
                                emitCellAction(
                                  'click',
                                  row,
                                  column,
                                  nativeEvent,
                                )
                              }}
                              onDblClick={(nativeEvent: Event) => {
                                emitCellAction(
                                  'dblclick',
                                  row,
                                  column,
                                  nativeEvent,
                                )
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

                                emitCellAction(
                                  'keydown',
                                  row,
                                  column,
                                  nativeEvent,
                                )
                              }}
                            >
                              {String(
                                getDataGridCellValue(row, column.field) ?? '',
                              )}
                            </div>
                          )
                        })()
                      }
                    </For>
                  </div>
                )
              })()
            }
          </For>
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
      viewportResize: event<DataGridViewportResizeDetail>(),
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
        'Headless data grid advanced component with controlled state, row virtualization, column resizing, keyboard navigation, selection and sorting.',
    },
  },
  setup,
)
