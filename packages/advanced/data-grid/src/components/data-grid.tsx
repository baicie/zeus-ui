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
  DataGridColumnVirtualItem,
  DataGridColumnVirtualRange,
  DataGridColumnVirtualSnapshot,
  DataGridCommitSource,
  DataGridDiagnostics,
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
  batch,
  createEffect,
  createSignal,
  defineElement,
  event,
  For,
  Host,
  prop,
  Slot,
} from '@zeus-js/zeus'
import { createEmptyVirtualRange, createRafScheduler } from '@zeus-web/virtual'
import {
  applyDataGridColumnWidths,
  areDataGridActiveCellsEqual,
  createDataGridActiveCell,
  createDataGridColumnVirtualizer,
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
  getVisibleDataGridColumns,
  moveDataGridActiveCell,
  normalizeDataGridColumns,
  resetDataGridColumnWidths,
  resizeDataGridColumn,
  resizeDataGridColumnByDelta,
  shouldEmitDataGridViewportResize,
  shouldUpdateDataGridColumnVirtualSnapshot,
  shouldUpdateDataGridVirtualSnapshot,
  sortDataGridRows,
} from '../core'

export interface DataGridProps {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  rowHeight?: number
  overscan?: number
  overscanColumns?: number
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
  diagnostics?: DataGridDiagnostics
}

export interface DataGridElement extends HTMLElement {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  rowHeight?: number
  overscan?: number
  overscanColumns?: number
  virtual?: boolean
  selectionMode?: 'none' | 'single' | 'multiple'
  selectedKeys?: DataGridRowKey[]
  sortColumn?: string
  sortDirection?: DataGridSortDirection
  resizable?: boolean
  keyboardNavigation?: boolean
  activeRowKey?: DataGridRowKey
  activeColumnId?: string
  diagnostics?: DataGridDiagnostics
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
  getColumnRange: () => DataGridColumnVirtualRange
  getColumnItems: () => DataGridColumnVirtualItem[]
  getTotalColumnSize: () => number
  scrollToIndex: (index: number, align?: VirtualScrollAlign) => void
  scrollToOffset: (offset: number) => void
  scrollToColumn: (index: number, align?: VirtualScrollAlign) => void
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

interface RenderedDataGridVirtualItem extends DataGridVirtualItem {
  data: DataGridRow
}

interface DataGridSnapshotCache<T> {
  snapshot: T
  modelVersion: number
  scrollOffset: number
  viewportSize: number
}

interface PendingDataGridRangeUpdate {
  nativeEvent?: Event
  source: DataGridCommitSource
  handlerStartTime?: number
  handlerEndTime?: number
  measureViewportMetrics: boolean
  preservePendingNodeChurn: boolean
}

interface FocusedDataGridHeaderTarget {
  columnId: string
  kind: 'header-cell' | 'resize-handle'
}

interface PendingDataGridDiagnosticsCommit {
  observer: NonNullable<DataGridDiagnostics['onCommit']>
  source: DataGridCommitSource
  inputTime: number
  handlerStartTime: number
  handlerEndTime: number
  rangeStartTime: number
  rangeCalculatedTime: number
  commitStartTime: number
  layoutReadIntervals: Array<readonly [number, number]>
  firstRowIndex: number
  lastRowIndex: number
  firstColumnIndex: number
  lastColumnIndex: number
}

const FALLBACK_COLUMN_VIEWPORT_SIZE = 640

function getDataGridCommitPriority(source: DataGridCommitSource): number {
  return source === 'mount' || source === 'resize' ? 1 : 0
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

function resolveColumnOverscan(props: DataGridProps): number {
  const value = props.overscanColumns === undefined ? 2 : props.overscanColumns
  if (!Number.isFinite(value) || value < 0) return 2
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

function getColumnScrollOffset(viewport: HTMLElement | undefined): number {
  return viewport ? viewport.scrollLeft : 0
}

function getViewportClientHeight(viewport: HTMLElement | undefined): number {
  return viewport?.clientHeight ?? 0
}

function getViewportClientWidth(viewport: HTMLElement | undefined): number {
  return viewport ? viewport.clientWidth : 0
}

function getDiagnosticTime(): number {
  return typeof globalThis.performance === 'undefined'
    ? Date.now()
    : globalThis.performance.now()
}

function collectDiagnosticNodeTree(node: Node, nodes: Set<Node>): void {
  nodes.add(node)

  for (let index = 0; index < node.childNodes.length; index += 1) {
    collectDiagnosticNodeTree(node.childNodes[index], nodes)
  }
}

function collectDiagnosticNodes(source: NodeList, nodes: Set<Node>): void {
  for (let index = 0; index < source.length; index += 1) {
    collectDiagnosticNodeTree(source[index], nodes)
  }
}

function setScrollOffset(
  viewport: HTMLElement | undefined,
  offset: number,
): void {
  if (!viewport) return
  viewport.scrollTop = Math.max(0, offset)
}

function setColumnScrollOffset(
  viewport: HTMLElement | undefined,
  offset: number,
): void {
  if (!viewport) return
  viewport.scrollLeft = Math.max(0, offset)
}

function cloneEmptySnapshot(): DataGridVirtualSnapshot {
  return {
    range: createEmptyVirtualRange(),
    items: [],
    totalSize: 0,
  }
}

function cloneEmptyColumnSnapshot(): DataGridColumnVirtualSnapshot {
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
  let diagnosticsMutationObserver: MutationObserver | undefined
  let pendingCreatedNodes: Set<Node> | undefined
  let pendingRemovedNodes: Set<Node> | undefined
  let pendingDiagnosticsCommit: PendingDataGridDiagnosticsCommit | undefined
  let diagnosticsCommitFinalizeScheduled = false
  let hasCompletedMountCommit = false
  let modelBuildSequence = 0
  let commitTransactionId = 0
  let controlledPropsReady = false
  let observedRowsProp: DataGridRowData[] | undefined
  let observedColumnsProp: DataGridColumn[] | undefined
  let pendingRangeUpdate: PendingDataGridRangeUpdate | undefined
  let hasRowMeasurementOverrides = false
  let poolRowsForCurrentReconciliation = false
  let poolHeaderColumnsForCurrentReconciliation = false
  let poolBodyColumnsForCurrentReconciliation = false
  let preserveFocusedBodyDomPoolForCurrentRange = false
  let disableRowPoolingForCurrentRange = false
  let disableHeaderColumnPoolingForCurrentRange = false
  let disableBodyColumnPoolingForCurrentRange = false

  let rowsSource = resolveRows(props)
  let columnsSource = resolveColumns(props)

  const initialDiagnostics = props.diagnostics
  const initialModelBuildObserver =
    initialDiagnostics && initialDiagnostics.onModelBuild
  const initialModelBuildStart = initialModelBuildObserver
    ? getDiagnosticTime()
    : 0
  let baseColumns = normalizeDataGridColumns(columnsSource)
  let defaultColumnWidths = createDataGridColumnWidthState(baseColumns)
  let columnWidths = createDataGridColumnWidthState(baseColumns)
  let columns = applyDataGridColumnWidths(baseColumns, columnWidths)
  let visibleColumns = getVisibleDataGridColumns(columns)
  let rows = createDataGridRows(rowsSource)
  let sort: DataGridSortState | undefined = createDataGridControlledSortState(
    props.sortColumn,
    props.sortDirection,
  )
  let visibleRows = sort ? sortDataGridRows(rows, columns, sort) : rows
  const selection = createDataGridSelectionModel(
    resolveSelectionMode(props.selectionMode),
    props.selectedKeys ?? [],
  )
  let virtualizer = createDataGridRowVirtualizer({
    rows: visibleRows,
    rowHeight: resolveRowHeight(props),
    overscan: resolveOverscan(props),
  })
  let columnVirtualizer = createDataGridColumnVirtualizer({
    columns: visibleColumns,
    overscan: resolveColumnOverscan(props),
  })
  if (initialModelBuildObserver) {
    modelBuildSequence += 1
    initialModelBuildObserver({
      sequence: modelBuildSequence,
      modelVersion: 0,
      startTime: initialModelBuildStart,
      endTime: getDiagnosticTime(),
      rowCount: rows.length,
      columnCount: columns.length,
      visibleColumnCount: visibleColumns.length,
      sortActive: sort !== undefined,
      rowModelReused: visibleRows === rows,
    })
  }
  let currentSnapshot = cloneEmptySnapshot()
  let currentColumnSnapshot = cloneEmptyColumnSnapshot()
  let rowSnapshotCache:
    | DataGridSnapshotCache<DataGridVirtualSnapshot>
    | undefined
  let columnSnapshotCache:
    | DataGridSnapshotCache<DataGridColumnVirtualSnapshot>
    | undefined
  let viewportClientHeight = 0
  let viewportClientWidth = 0
  const [renderVersion, setRenderVersion] = createSignal(0)
  let activeCell = createInitialDataGridActiveCell({
    rows: visibleRows,
    columns: visibleColumns,
    rowKey: props.activeRowKey,
    columnId: props.activeColumnId,
  })
  const [activeCellRenderVersion, setActiveCellRenderVersion] = createSignal(0)
  let shouldSyncActiveCellFromProps = false
  let modelVersion = 0
  const [rowRenderVersion, setRowRenderVersion] = createSignal(0)
  const [rowLayoutRenderVersion, setRowLayoutRenderVersion] = createSignal(0)
  const [columnRenderVersion, setColumnRenderVersion] = createSignal(0)
  const [columnRangeRenderVersion, setColumnRangeRenderVersion] =
    createSignal(0)
  let shouldRefreshRowsForRender = false
  let shouldRefreshRowLayoutForRender = false
  let shouldRefreshColumnsForRender = false
  let builtModelVersion = modelVersion
  const scheduler = createRafScheduler()
  const focusScheduler = createRafScheduler()

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
    overscanColumns: resolveColumnOverscan(props),
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
    overscanColumns: resolveColumnOverscan(props),
    virtual: resolveVirtual(props),
    selectionMode: resolveSelectionMode(props.selectionMode),
    resizable: resolveResizable(props),
    keyboardNavigation: resolveKeyboardNavigation(props),
  })

  const invalidateRowSnapshotCache = (): void => {
    rowSnapshotCache = undefined
  }

  const invalidateColumnSnapshotCache = (): void => {
    columnSnapshotCache = undefined
  }

  const invalidateSnapshotCaches = (): void => {
    invalidateRowSnapshotCache()
    invalidateColumnSnapshotCache()
  }

  const measureViewport = (
    clientHeight: number = getViewportClientHeight(viewport),
    clientWidth: number = getViewportClientWidth(viewport),
  ): DataGridViewportMeasurement => {
    const previousClientHeight = viewportClientHeight
    const previousClientWidth = viewportClientWidth
    const previousViewportSize = viewportMeasurement.size

    viewportClientHeight = clientHeight
    viewportClientWidth = clientWidth

    const nextMeasurement = viewportMeasure.measure(
      clientHeight,
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

    if (
      previousClientHeight !== clientHeight ||
      previousViewportSize !== nextMeasurement.size
    ) {
      rowSnapshotCache = undefined
    }

    if (previousClientWidth !== clientWidth) {
      columnSnapshotCache = undefined
    }

    return viewportMeasurement
  }

  const getResolvedViewportSize = (): number => viewportMeasurement.size

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

  const isActiveCellElementFocused = (): boolean => {
    if (!activeCell) return false

    const cell = queryCell(activeCell.rowKey, activeCell.columnId)

    return cell !== null && cell.ownerDocument.activeElement === cell
  }

  const hasFocusedBodyDescendant = (): boolean => {
    const currentViewport = viewport
    const activeElement = currentViewport?.ownerDocument.activeElement

    return Boolean(
      currentViewport &&
      activeElement &&
      currentViewport.contains(activeElement) &&
      activeElement.closest('[data-slot="data-grid-body"]'),
    )
  }

  const getFocusedHeaderTarget = ():
    | FocusedDataGridHeaderTarget
    | undefined => {
    const currentViewport = viewport
    const activeElement = currentViewport?.ownerDocument.activeElement

    if (
      !currentViewport ||
      !activeElement ||
      !currentViewport.contains(activeElement)
    ) {
      return undefined
    }

    const headerCell = activeElement.closest<HTMLElement>(
      '[data-slot="data-grid-header-cell"]',
    )

    if (!headerCell) return undefined

    const columnId = headerCell.getAttribute('data-column-id')

    if (columnId === null) return undefined

    return {
      columnId,
      kind:
        activeElement.getAttribute('data-slot') === 'data-grid-resize-handle'
          ? 'resize-handle'
          : 'header-cell',
    }
  }

  const focusHeaderTarget = (target: FocusedDataGridHeaderTarget): void => {
    const headerCell = ctx.host.querySelector<HTMLElement>(
      `[data-slot="data-grid-header-cell"][data-column-id="${escapeDataGridSelectorValue(
        target.columnId,
      )}"]`,
    )
    const focusTarget =
      target.kind === 'resize-handle'
        ? headerCell?.querySelector<HTMLElement>(
            '[data-slot="data-grid-resize-handle"]',
          )
        : headerCell

    focusTarget?.focus()
  }

  const scheduleFocusActiveCellElement = (): void => {
    focusScheduler.schedule(() => {
      focusActiveCellElement()
    })
  }

  const scheduleFocusHeaderTarget = (
    target: FocusedDataGridHeaderTarget,
  ): void => {
    focusScheduler.schedule(() => {
      focusHeaderTarget(target)
    })
  }

  const syncControlledSources = (): void => {
    const changes = controlledState.update(readControlledStateSources())

    if (!changes.changed) return

    rowsSource = resolveRows(props)
    columnsSource = resolveColumns(props)

    if (changes.rowsChanged) {
      shouldRefreshRowsForRender = true
    }

    if (
      changes.rowsChanged ||
      changes.reasons.includes('rowHeight') ||
      changes.reasons.includes('virtual')
    ) {
      shouldRefreshRowLayoutForRender = true
    }

    if (changes.columnsChanged) {
      shouldRefreshColumnsForRender = true
      baseColumns = normalizeDataGridColumns(columnsSource)
      defaultColumnWidths = createDataGridColumnWidthState(baseColumns)
      columnWidths = createDataGridColumnWidthState(baseColumns)
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

  const rebuildModels = (): void => {
    syncControlledSources()

    if (builtModelVersion === modelVersion) return

    const diagnostics = props.diagnostics
    const modelBuildObserver = diagnostics && diagnostics.onModelBuild
    const modelBuildStart = modelBuildObserver ? getDiagnosticTime() : 0

    const shouldRestoreActiveCellFocus =
      (shouldRefreshRowsForRender || shouldRefreshColumnsForRender) &&
      isActiveCellElementFocused()

    baseColumns = normalizeDataGridColumns(columnsSource)
    columns = applyDataGridColumnWidths(baseColumns, columnWidths)
    visibleColumns = getVisibleDataGridColumns(columns)
    rows = createDataGridRows(rowsSource)
    selection.setMode(resolveSelectionMode(props.selectionMode))

    selection.setKeys(props.selectedKeys ?? [])

    visibleRows = sort ? sortDataGridRows(rows, columns, sort) : rows
    virtualizer = createDataGridRowVirtualizer({
      rows: visibleRows,
      rowHeight: resolveRowHeight(props),
      overscan: resolveOverscan(props),
    })
    hasRowMeasurementOverrides = false
    columnVirtualizer = createDataGridColumnVirtualizer({
      columns: visibleColumns,
      overscan: resolveColumnOverscan(props),
    })

    const nextActiveCell = createInitialDataGridActiveCell({
      rows: visibleRows,
      columns: visibleColumns,
      rowKey: shouldSyncActiveCellFromProps
        ? props.activeRowKey
        : (activeCell?.rowKey ?? props.activeRowKey),
      columnId: shouldSyncActiveCellFromProps
        ? props.activeColumnId
        : (activeCell?.columnId ?? props.activeColumnId),
    })

    if (!areDataGridActiveCellsEqual(activeCell, nextActiveCell)) {
      activeCell = nextActiveCell
      setActiveCellRenderVersion(value => value + 1)
    } else {
      activeCell = nextActiveCell
    }

    shouldSyncActiveCellFromProps = false
    currentSnapshot = cloneEmptySnapshot()
    currentColumnSnapshot = cloneEmptyColumnSnapshot()
    invalidateSnapshotCaches()
    builtModelVersion = modelVersion

    if (viewportClientHeight <= 0) {
      measureViewport(viewportClientHeight, viewportClientWidth)
    }

    if (modelBuildObserver) {
      modelBuildSequence += 1
      modelBuildObserver({
        sequence: modelBuildSequence,
        modelVersion: builtModelVersion,
        startTime: modelBuildStart,
        endTime: getDiagnosticTime(),
        rowCount: rows.length,
        columnCount: columns.length,
        visibleColumnCount: visibleColumns.length,
        sortActive: sort !== undefined,
        rowModelReused: visibleRows === rows,
      })
    }

    if (shouldRefreshRowsForRender) {
      shouldRefreshRowsForRender = false
      setRowRenderVersion(value => value + 1)
    }

    if (shouldRefreshRowLayoutForRender) {
      shouldRefreshRowLayoutForRender = false
      setRowLayoutRenderVersion(value => value + 1)
    }

    if (shouldRefreshColumnsForRender) {
      shouldRefreshColumnsForRender = false
      setColumnRenderVersion(value => value + 1)
    }

    if (shouldRestoreActiveCellFocus) {
      scheduleFocusActiveCellElement()
    }
  }

  const emitSnapshotIfChanged = (
    nextSnapshot: DataGridVirtualSnapshot,
    scrollOffset: number,
    viewportSize: number,
  ): void => {
    rowSnapshotCache = {
      snapshot: nextSnapshot,
      modelVersion,
      scrollOffset,
      viewportSize,
    }

    if (!shouldUpdateDataGridVirtualSnapshot(currentSnapshot, nextSnapshot)) {
      return
    }

    currentSnapshot = nextSnapshot
    setRenderVersion(value => value + 1)

    ctx.emit.rangeChange({
      range: currentSnapshot.range,
      items: currentSnapshot.items,
      scrollOffset,
      viewportSize,
      totalSize: currentSnapshot.totalSize,
    })
  }

  const updateColumnSnapshotIfChanged = (
    nextSnapshot: DataGridColumnVirtualSnapshot,
    scrollOffset: number,
    viewportSize: number,
  ): void => {
    columnSnapshotCache = {
      snapshot: nextSnapshot,
      modelVersion,
      scrollOffset,
      viewportSize,
    }

    if (
      !shouldUpdateDataGridColumnVirtualSnapshot(
        currentColumnSnapshot,
        nextSnapshot,
      )
    ) {
      return
    }

    currentColumnSnapshot = nextSnapshot
    setColumnRangeRenderVersion(value => value + 1)
  }

  const getSnapshotFromModels = (
    scrollOffset: number,
    viewportSize: number,
  ): DataGridVirtualSnapshot => {
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

    return virtualizer.getSnapshot(scrollOffset, viewportSize)
  }

  const getSnapshot = (): DataGridVirtualSnapshot => {
    rebuildModels()

    const scrollOffset = getScrollOffset(viewport)
    const viewportSize = getResolvedViewportSize()

    if (
      rowSnapshotCache?.modelVersion === modelVersion &&
      rowSnapshotCache.scrollOffset === scrollOffset &&
      rowSnapshotCache.viewportSize === viewportSize
    ) {
      return rowSnapshotCache.snapshot
    }

    const snapshot = getSnapshotFromModels(scrollOffset, viewportSize)

    rowSnapshotCache = {
      snapshot,
      modelVersion,
      scrollOffset,
      viewportSize,
    }

    return snapshot
  }

  const getResolvedColumnViewportSize = (
    clientWidth: number = viewportClientWidth,
  ): number => {
    return clientWidth > 0
      ? clientWidth
      : Math.min(
          FALLBACK_COLUMN_VIEWPORT_SIZE,
          columnVirtualizer.getTotalSize(),
        )
  }

  const getColumnSnapshotFromModels = (
    scrollOffset: number,
    viewportSize: number,
  ): DataGridColumnVirtualSnapshot => {
    if (!props.virtual) {
      const totalSize = columnVirtualizer.getTotalSize()

      return {
        range: {
          start: 0,
          end: visibleColumns.length - 1,
          overscanStart: 0,
          overscanEnd: visibleColumns.length - 1,
        },
        items: visibleColumns.map((column, index) => {
          const start = columnVirtualizer.getOffsetForIndex(index)

          return {
            index,
            key: column.id,
            start,
            size: column.width,
            end: start + column.width,
            data: column,
          }
        }),
        totalSize,
      }
    }

    return columnVirtualizer.getSnapshot(scrollOffset, viewportSize)
  }

  const getColumnSnapshot = (): DataGridColumnVirtualSnapshot => {
    rebuildModels()

    const scrollOffset = getColumnScrollOffset(viewport)
    const viewportSize = getResolvedColumnViewportSize()

    if (
      columnSnapshotCache?.modelVersion === modelVersion &&
      columnSnapshotCache.scrollOffset === scrollOffset &&
      columnSnapshotCache.viewportSize === viewportSize
    ) {
      return columnSnapshotCache.snapshot
    }

    const snapshot = getColumnSnapshotFromModels(scrollOffset, viewportSize)

    columnSnapshotCache = {
      snapshot,
      modelVersion,
      scrollOffset,
      viewportSize,
    }

    return snapshot
  }

  const getActiveDescendantForRender = (): string | undefined => {
    void activeCellRenderVersion()
    void renderVersion()
    void rowRenderVersion()
    void columnRangeRenderVersion()
    void columnRenderVersion()

    rebuildModels()

    const currentActiveCell = activeCell
    if (!currentActiveCell) return undefined

    const rowSnapshot = rowSnapshotCache?.snapshot ?? getSnapshot()
    const columnSnapshot = columnSnapshotCache?.snapshot ?? getColumnSnapshot()
    const hasRenderedRow = rowSnapshot.items.some(
      item => item.index === currentActiveCell.rowIndex,
    )
    const hasRenderedColumn = columnSnapshot.items.some(
      item => item.index === currentActiveCell.columnIndex,
    )

    if (!hasRenderedRow || !hasRenderedColumn) return undefined

    return getDataGridActiveDescendant(
      currentActiveCell,
      getDataGridActiveCellId,
    )
  }

  const isActiveCellForRender = (
    rowKey: DataGridRowKey,
    columnId: string,
  ): boolean => {
    void activeCellRenderVersion()

    return Boolean(
      activeCell &&
      activeCell.rowKey === rowKey &&
      activeCell.columnId === columnId,
    )
  }

  const recordDiagnosticsMutations = (
    records: ReadonlyArray<MutationRecord>,
  ): void => {
    if (!pendingCreatedNodes || !pendingRemovedNodes) return

    for (const record of records) {
      collectDiagnosticNodes(record.addedNodes, pendingCreatedNodes)
      collectDiagnosticNodes(record.removedNodes, pendingRemovedNodes)
    }
  }

  const ensureDiagnosticsMutationObserver = (): void => {
    const diagnostics = props.diagnostics
    const shouldObserve = Boolean(
      diagnostics &&
      diagnostics.onCommit &&
      typeof MutationObserver !== 'undefined',
    )

    if (!shouldObserve || !viewport) {
      if (diagnosticsMutationObserver) {
        diagnosticsMutationObserver.disconnect()
        diagnosticsMutationObserver = undefined
      }

      pendingCreatedNodes = undefined
      pendingRemovedNodes = undefined
      return
    }

    if (diagnosticsMutationObserver) return

    const header = viewport.querySelector<HTMLElement>(
      '[data-slot="data-grid-header"]',
    )
    const body = viewport.querySelector<HTMLElement>(
      '[data-slot="data-grid-body"]',
    )

    if (!header || !body) {
      return
    }

    const createdNodes = new Set<Node>()
    const removedNodes = new Set<Node>()
    const observer = new MutationObserver(records => {
      recordDiagnosticsMutations(records)
    })
    pendingCreatedNodes = createdNodes
    pendingRemovedNodes = removedNodes
    diagnosticsMutationObserver = observer

    observer.observe(header, {
      childList: true,
      subtree: true,
    })
    observer.observe(body, {
      childList: true,
      subtree: true,
    })

    if (!hasCompletedMountCommit) {
      collectDiagnosticNodeTree(header, createdNodes)
      collectDiagnosticNodeTree(body, createdNodes)
    }
  }

  const prepareDiagnosticsNodeChurn = (preservePending: boolean): void => {
    if (!diagnosticsMutationObserver) return

    const records = diagnosticsMutationObserver.takeRecords()

    if (preservePending) {
      recordDiagnosticsMutations(records)
      return
    }

    if (pendingCreatedNodes) pendingCreatedNodes.clear()
    if (pendingRemovedNodes) pendingRemovedNodes.clear()
  }

  const consumeDiagnosticsNodeChurn = (): {
    createdNodeCount: number
    removedNodeCount: number
  } => {
    if (diagnosticsMutationObserver) {
      recordDiagnosticsMutations(diagnosticsMutationObserver.takeRecords())
    }

    const result = {
      createdNodeCount: pendingCreatedNodes ? pendingCreatedNodes.size : 0,
      removedNodeCount: pendingRemovedNodes ? pendingRemovedNodes.size : 0,
    }

    if (pendingCreatedNodes) pendingCreatedNodes.clear()
    if (pendingRemovedNodes) pendingRemovedNodes.clear()

    return result
  }

  const startDiagnosticsHandler = (): number | undefined => {
    const diagnostics = props.diagnostics
    if (!diagnostics || !diagnostics.onCommit) return undefined

    return getDiagnosticTime()
  }

  const mergeDiagnosticsCommits = (
    current: PendingDataGridDiagnosticsCommit,
    next: PendingDataGridDiagnosticsCommit,
  ): PendingDataGridDiagnosticsCommit => {
    return {
      observer: current.observer,
      source: current.source,
      inputTime: current.inputTime,
      handlerStartTime: current.handlerStartTime,
      handlerEndTime: current.handlerEndTime,
      rangeStartTime: current.rangeStartTime,
      rangeCalculatedTime: next.rangeCalculatedTime,
      commitStartTime: next.commitStartTime,
      layoutReadIntervals: current.layoutReadIntervals.concat(
        next.layoutReadIntervals,
      ),
      firstRowIndex: next.firstRowIndex,
      lastRowIndex: next.lastRowIndex,
      firstColumnIndex: next.firstColumnIndex,
      lastColumnIndex: next.lastColumnIndex,
    }
  }

  const finalizeDiagnosticsCommit = (
    commit: PendingDataGridDiagnosticsCommit,
  ): void => {
    const nodeChurn = consumeDiagnosticsNodeChurn()
    commitTransactionId += 1
    commit.observer({
      transactionId: commitTransactionId,
      source: commit.source,
      inputTime: commit.inputTime,
      handlerStartTime: commit.handlerStartTime,
      rangeStartTime: commit.rangeStartTime,
      rangeCalculatedTime: commit.rangeCalculatedTime,
      commitStartTime: commit.commitStartTime,
      commitEndTime: getDiagnosticTime(),
      handlerEndTime: commit.handlerEndTime,
      layoutReadIntervals: commit.layoutReadIntervals,
      firstRowIndex: commit.firstRowIndex,
      lastRowIndex: commit.lastRowIndex,
      firstColumnIndex: commit.firstColumnIndex,
      lastColumnIndex: commit.lastColumnIndex,
      createdNodeCount: nodeChurn.createdNodeCount,
      removedNodeCount: nodeChurn.removedNodeCount,
    })
  }

  const scheduleDiagnosticsCommitFinalize = (
    commit: PendingDataGridDiagnosticsCommit,
  ): void => {
    pendingDiagnosticsCommit = pendingDiagnosticsCommit
      ? mergeDiagnosticsCommits(pendingDiagnosticsCommit, commit)
      : commit

    if (diagnosticsCommitFinalizeScheduled) return

    diagnosticsCommitFinalizeScheduled = true
    queueMicrotask(() => {
      diagnosticsCommitFinalizeScheduled = false

      const pendingCommit = pendingDiagnosticsCommit
      pendingDiagnosticsCommit = undefined

      if (pendingCommit) finalizeDiagnosticsCommit(pendingCommit)
    })
  }

  const updateRange = (
    nativeEvent?: Event,
    source: DataGridCommitSource = 'api',
    scheduledHandlerStartTime?: number,
    scheduledHandlerEndTime?: number,
    measureViewportMetrics = source !== 'scroll',
    preservePendingNodeChurn = source === 'mount' && !hasCompletedMountCommit,
    deferCommitDiagnostics = false,
  ): void => {
    const hasFocusedBodyForCurrentRange = hasFocusedBodyDescendant()
    const shouldRestoreFocusAfterPoolExit =
      preserveFocusedBodyDomPoolForCurrentRange && hasFocusedBodyForCurrentRange
    const focusedHeaderTarget = getFocusedHeaderTarget()
    const shouldRestoreHeaderFocusAfterPoolExit = Boolean(
      poolHeaderColumnsForCurrentReconciliation && focusedHeaderTarget,
    )

    disableRowPoolingForCurrentRange = hasFocusedBodyForCurrentRange
    disableHeaderColumnPoolingForCurrentRange =
      focusedHeaderTarget !== undefined
    disableBodyColumnPoolingForCurrentRange = hasFocusedBodyForCurrentRange

    preserveFocusedBodyDomPoolForCurrentRange = false

    if (shouldRestoreFocusAfterPoolExit) {
      scheduleFocusActiveCellElement()
    }
    if (focusedHeaderTarget && shouldRestoreHeaderFocusAfterPoolExit) {
      scheduleFocusHeaderTarget(focusedHeaderTarget)
    }

    const diagnostics = props.diagnostics
    const commitObserver = diagnostics && diagnostics.onCommit
    const directHandlerStartTime =
      commitObserver && scheduledHandlerStartTime === undefined
        ? getDiagnosticTime()
        : 0
    const inputTime = scheduledHandlerStartTime ?? directHandlerStartTime
    const handlerStartTime = scheduledHandlerStartTime ?? directHandlerStartTime
    const handlerEndTime =
      scheduledHandlerEndTime !== undefined
        ? scheduledHandlerEndTime
        : commitObserver
          ? getDiagnosticTime()
          : 0
    const rangeStartTime = commitObserver ? getDiagnosticTime() : 0

    if (commitObserver || diagnosticsMutationObserver) {
      ensureDiagnosticsMutationObserver()
    }
    if (commitObserver) {
      prepareDiagnosticsNodeChurn(
        preservePendingNodeChurn || pendingDiagnosticsCommit !== undefined,
      )
    }
    rebuildModels()

    const layoutReadStartTime = commitObserver ? getDiagnosticTime() : 0
    const scrollOffset = getScrollOffset(viewport)
    const columnScrollOffset = getColumnScrollOffset(viewport)
    const clientHeight = measureViewportMetrics
      ? getViewportClientHeight(viewport)
      : viewportClientHeight
    const clientWidth = measureViewportMetrics
      ? getViewportClientWidth(viewport)
      : viewportClientWidth
    const layoutReadEndTime = commitObserver ? getDiagnosticTime() : 0
    const viewportSize = measureViewportMetrics
      ? measureViewport(clientHeight, clientWidth).size
      : getResolvedViewportSize()
    const columnViewportSize = getResolvedColumnViewportSize(clientWidth)
    const nextSnapshot = getSnapshot()
    const nextColumnSnapshot = getColumnSnapshot()
    const rangeCalculatedTime = commitObserver ? getDiagnosticTime() : 0
    const commitStartTime = commitObserver ? getDiagnosticTime() : 0

    batch(() => {
      emitSnapshotIfChanged(nextSnapshot, scrollOffset, viewportSize)
      updateColumnSnapshotIfChanged(
        nextColumnSnapshot,
        columnScrollOffset,
        columnViewportSize,
      )
    })
    if (nativeEvent) {
      ctx.emit.scrollOffsetChange({
        offset: scrollOffset,
        nativeEvent,
      })
    }

    if (source === 'mount') hasCompletedMountCommit = true
    if (!commitObserver) return

    const diagnosticsCommit: PendingDataGridDiagnosticsCommit = {
      observer: commitObserver,
      source,
      inputTime,
      handlerStartTime,
      handlerEndTime,
      rangeStartTime,
      rangeCalculatedTime,
      commitStartTime,
      layoutReadIntervals: [[layoutReadStartTime, layoutReadEndTime]],
      firstRowIndex: nextSnapshot.range.start,
      lastRowIndex: nextSnapshot.range.end,
      firstColumnIndex: nextColumnSnapshot.range.start,
      lastColumnIndex: nextColumnSnapshot.range.end,
    }

    if (pendingDiagnosticsCommit || deferCommitDiagnostics) {
      scheduleDiagnosticsCommitFinalize(diagnosticsCommit)
      return
    }

    finalizeDiagnosticsCommit(diagnosticsCommit)
  }

  const scheduleUpdateRange = (
    nativeEvent?: Event,
    source: DataGridCommitSource = nativeEvent ? 'scroll' : 'api',
    scheduledHandlerStartTime?: number,
    preservePendingNodeChurn = source === 'mount' && !hasCompletedMountCommit,
  ): void => {
    const handlerStartTime =
      scheduledHandlerStartTime ?? startDiagnosticsHandler()
    const handlerEndTime =
      handlerStartTime === undefined ? undefined : getDiagnosticTime()
    const nextUpdate: PendingDataGridRangeUpdate = {
      nativeEvent,
      source,
      handlerStartTime,
      handlerEndTime,
      measureViewportMetrics: source === 'mount' || source === 'resize',
      preservePendingNodeChurn,
    }
    const previousUpdate = pendingRangeUpdate

    if (!previousUpdate) {
      pendingRangeUpdate = nextUpdate
    } else {
      const shouldReplaceTiming =
        getDataGridCommitPriority(nextUpdate.source) >=
        getDataGridCommitPriority(previousUpdate.source)

      pendingRangeUpdate = {
        nativeEvent: nextUpdate.nativeEvent ?? previousUpdate.nativeEvent,
        source: shouldReplaceTiming ? nextUpdate.source : previousUpdate.source,
        handlerStartTime: shouldReplaceTiming
          ? nextUpdate.handlerStartTime
          : previousUpdate.handlerStartTime,
        handlerEndTime: shouldReplaceTiming
          ? nextUpdate.handlerEndTime
          : previousUpdate.handlerEndTime,
        measureViewportMetrics:
          previousUpdate.measureViewportMetrics ||
          nextUpdate.measureViewportMetrics,
        preservePendingNodeChurn:
          previousUpdate.preservePendingNodeChurn ||
          nextUpdate.preservePendingNodeChurn,
      }
    }

    scheduler.schedule(() => {
      const update = pendingRangeUpdate
      pendingRangeUpdate = undefined

      if (!update) return

      updateRange(
        update.nativeEvent,
        update.source,
        update.handlerStartTime,
        update.handlerEndTime,
        update.measureViewportMetrics,
        update.preservePendingNodeChurn,
      )
    })
  }

  const beginDiagnosticsNodeChurn = (): boolean => {
    if (!props.diagnostics?.onCommit) return false

    ensureDiagnosticsMutationObserver()
    if (!pendingDiagnosticsCommit) {
      prepareDiagnosticsNodeChurn(false)
    }
    return true
  }

  createEffect(() => {
    const nextRowsProp = props.rows
    const nextColumnsProp = props.columns

    if (!controlledPropsReady) {
      observedRowsProp = nextRowsProp
      observedColumnsProp = nextColumnsProp
      controlledPropsReady = true
      return
    }

    const rowsChanged = nextRowsProp !== observedRowsProp
    const columnsChanged = nextColumnsProp !== observedColumnsProp

    observedRowsProp = nextRowsProp
    observedColumnsProp = nextColumnsProp

    if (!rowsChanged && !columnsChanged) return

    scheduleUpdateRange(undefined, 'data', undefined, true)
  })

  const scrollToColumnIndex = (
    index: number,
    align: VirtualScrollAlign = 'start',
  ): void => {
    rebuildModels()

    if (align !== 'start') {
      measureViewport()
    }

    const offset = columnVirtualizer.getOffsetForIndex(
      index,
      align,
      getResolvedColumnViewportSize(),
    )

    setColumnScrollOffset(viewport, offset)
    updateRange()
  }

  const connectViewportObserver = (element: HTMLElement): void => {
    viewportResizeObserver?.disconnect()

    if (typeof ResizeObserver === 'undefined') return

    viewportResizeObserver = new ResizeObserver(() => {
      const handlerStartTime = startDiagnosticsHandler()
      scheduleUpdateRange(undefined, 'resize', handlerStartTime)
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
    batch(() => {
      props.selectedKeys = selection.getState().keys
      commitControlledState()
      modelVersion += 1
    })
  }

  const syncSortPropsFromModel = (): void => {
    batch(() => {
      props.sortColumn = sort ? sort.columnId : undefined
      props.sortDirection = sort ? sort.direction : undefined
      commitControlledState()
      modelVersion += 1
    })
  }

  const syncActiveCellPropsFromModel = (): void => {
    batch(() => {
      props.activeRowKey = activeCell ? activeCell.rowKey : undefined
      props.activeColumnId = activeCell ? activeCell.columnId : undefined
      commitControlledState()
    })
  }

  const emitActiveCell = (
    nextActiveCell: DataGridActiveCell | undefined,
    nativeEvent?: Event,
  ): void => {
    if (areDataGridActiveCellsEqual(activeCell, nextActiveCell)) return

    const previousActiveCell = activeCell
    activeCell = nextActiveCell
    setActiveCellRenderVersion(value => value + 1)
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
      scrollToColumnIndex(nextActiveCell.columnIndex, 'center')
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
      scrollToColumnIndex(nextActiveCell.columnIndex, 'center')
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
    updateRange()

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
    scheduleUpdateRange()

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
    visibleRows = sort ? sortDataGridRows(rows, columns, sort) : rows
    virtualizer = createDataGridRowVirtualizer({
      rows: visibleRows,
      rowHeight: resolveRowHeight(props),
      overscan: resolveOverscan(props),
    })
    hasRowMeasurementOverrides = false
    invalidateSnapshotCaches()
    currentSnapshot = cloneEmptySnapshot()

    ctx.emit.sortChange({
      sort,
      column,
      nativeEvent,
    })

    updateRange(undefined, 'data')
  }

  ctx.expose({
    setRows(nextRows: DataGridRowData[]): void {
      observedRowsProp = nextRows
      const preservePendingNodeChurn = beginDiagnosticsNodeChurn()
      batch(() => {
        props.rows = nextRows
        rowsSource = nextRows
        modelVersion += 1
        shouldRefreshRowsForRender = true
        syncHostProps()
        commitControlledState()
      })

      updateRange(
        undefined,
        'data',
        undefined,
        undefined,
        true,
        preservePendingNodeChurn,
        true,
      )
    },

    setColumns(nextColumns: DataGridColumn[]): void {
      observedColumnsProp = nextColumns
      const preservePendingNodeChurn = beginDiagnosticsNodeChurn()
      batch(() => {
        props.columns = nextColumns
        columnsSource = nextColumns
        baseColumns = normalizeDataGridColumns(nextColumns)
        defaultColumnWidths = createDataGridColumnWidthState(baseColumns)
        columnWidths = createDataGridColumnWidthState(baseColumns)
        modelVersion += 1
        shouldRefreshColumnsForRender = true
        syncHostProps()
        commitControlledState()
      })

      updateRange(
        undefined,
        'data',
        undefined,
        undefined,
        true,
        preservePendingNodeChurn,
        true,
      )
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
      visibleRows = sort ? sortDataGridRows(rows, columns, sort) : rows
      invalidateSnapshotCaches()
      currentSnapshot = cloneEmptySnapshot()

      ctx.emit.sortChange({
        sort,
      })

      updateRange(undefined, 'data')
    },

    getSort(): DataGridSortState | undefined {
      rebuildModels()
      return sort ? { ...sort } : undefined
    },

    getRange(): DataGridVirtualRange {
      return getSnapshot().range
    },

    getItems(): DataGridVirtualItem[] {
      return getSnapshot().items
    },

    getTotalSize(): number {
      rebuildModels()

      return props.virtual
        ? virtualizer.getTotalSize()
        : visibleRows.length * resolveRowHeight(props)
    },

    getColumnRange(): DataGridColumnVirtualRange {
      const snapshot = getColumnSnapshot()
      currentColumnSnapshot = snapshot
      return snapshot.range
    },

    getColumnItems(): DataGridColumnVirtualItem[] {
      const snapshot = getColumnSnapshot()
      currentColumnSnapshot = snapshot
      return snapshot.items
    },

    getTotalColumnSize(): number {
      rebuildModels()
      return columnVirtualizer.getTotalSize()
    },

    scrollToIndex(index: number, align: VirtualScrollAlign = 'start'): void {
      rebuildModels()

      if (align !== 'start') {
        measureViewport()
      }

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

    scrollToColumn(index: number, align: VirtualScrollAlign = 'start'): void {
      scrollToColumnIndex(index, align)
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
        hasRowMeasurementOverrides = true
        invalidateRowSnapshotCache()
        setRowLayoutRenderVersion(value => value + 1)
      }

      updateRange()
    },

    resetMeasurements(): void {
      rebuildModels()
      virtualizer.resetMeasurements()
      hasRowMeasurementOverrides = false
      invalidateRowSnapshotCache()
      setRowLayoutRenderVersion(value => value + 1)
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
      const columnIndex = visibleColumns.findIndex(
        column => column.id === columnId,
      )

      if (rowIndex >= 0) {
        ctx.host.scrollToIndex(rowIndex, 'center')
      }

      if (columnIndex >= 0) {
        scrollToColumnIndex(columnIndex, 'center')
      }

      setActiveCellByKey(rowKey, columnId)
      scheduleFocusActiveCellElement()
    },

    focusActiveCell(): void {
      rebuildModels()

      if (!activeCell) return

      ctx.host.scrollToIndex(activeCell.rowIndex, 'center')
      scrollToColumnIndex(activeCell.columnIndex, 'center')
      scheduleFocusActiveCellElement()
    },

    refreshViewport(): void {
      updateRange(undefined, 'api', undefined, undefined, true)
    },
  })

  const getBodyRows = (): DataGridVirtualItem[] => {
    return getSnapshot().items
  }

  const shouldPoolRowsForCurrentViewport = (): boolean => {
    return (
      resolveVirtual(props) &&
      !hasRowMeasurementOverrides &&
      !disableRowPoolingForCurrentRange
    )
  }

  const shouldPoolHeaderColumnsForCurrentViewport = (): boolean => {
    return resolveVirtual(props) && !disableHeaderColumnPoolingForCurrentRange
  }

  const shouldPoolBodyColumnsForCurrentViewport = (): boolean => {
    return resolveVirtual(props) && !disableBodyColumnPoolingForCurrentRange
  }

  const getBodyRowsForRender = (): RenderedDataGridVirtualItem[] => {
    void renderVersion()
    void rowRenderVersion()

    const shouldPoolRows = shouldPoolRowsForCurrentViewport()
    const shouldRestoreFocus =
      poolRowsForCurrentReconciliation &&
      !shouldPoolRows &&
      hasFocusedBodyDescendant()

    poolRowsForCurrentReconciliation = shouldPoolRows

    if (shouldRestoreFocus) {
      scheduleFocusActiveCellElement()
    }

    return getBodyRows() as RenderedDataGridVirtualItem[]
  }

  const getBodyRowReconciliationKey = (
    item: RenderedDataGridVirtualItem,
    index: number,
  ): string => {
    return poolRowsForCurrentReconciliation
      ? `viewport-row-slot:${index}`
      : `data-row:${rowRenderVersion()}:${item.key}`
  }

  const getVisibleColumnsForRender = (): DataGridColumnVirtualItem[] => {
    void columnRangeRenderVersion()
    void columnRenderVersion()

    return (columnSnapshotCache?.snapshot ?? getColumnSnapshot()).items
  }

  const getHeaderColumnsForRender = (): DataGridColumnVirtualItem[] => {
    poolHeaderColumnsForCurrentReconciliation =
      shouldPoolHeaderColumnsForCurrentViewport()

    return getVisibleColumnsForRender()
  }

  const getBodyColumnsForRender = (): DataGridColumnVirtualItem[] => {
    poolBodyColumnsForCurrentReconciliation =
      shouldPoolBodyColumnsForCurrentViewport()

    return getVisibleColumnsForRender()
  }

  const getHeaderColumnReconciliationKey = (
    item: DataGridColumnVirtualItem,
    index: number,
  ): string => {
    return poolHeaderColumnsForCurrentReconciliation
      ? `viewport-header-slot:${index}`
      : `data-header:${columnRenderVersion()}:${item.key}`
  }

  const getBodyColumnReconciliationKey = (
    item: DataGridColumnVirtualItem,
    index: number,
  ): string => {
    return poolBodyColumnsForCurrentReconciliation
      ? `viewport-cell-slot:${index}`
      : `data-cell:${columnRenderVersion()}:${item.key}`
  }

  const getSpacerStyle = (): Record<string, string> => {
    void rowLayoutRenderVersion()
    void columnRangeRenderVersion()

    if (!props.virtual) return { display: 'none' }

    return {
      height: `${virtualizer.getTotalSize()}px`,
      width: `${columnVirtualizer.getTotalSize()}px`,
      pointerEvents: 'none',
    }
  }

  const getGridTemplateColumns = (): string => {
    const items = getVisibleColumnsForRender()
    if (items.length === 0) return ''

    const tracks: string[] = []

    if (items[0].start > 0) {
      tracks.push(`${items[0].start}px`)
    }

    for (const item of items) {
      tracks.push(`${item.size}px`)
    }

    return tracks.join(' ')
  }

  const getGridColumnStart = (item: DataGridColumnVirtualItem): string => {
    void columnRangeRenderVersion()

    const firstItem = (columnSnapshotCache?.snapshot ?? getColumnSnapshot())
      .items[0]
    if (!firstItem) return '1'

    const leadingTrackCount = firstItem.start > 0 ? 1 : 0
    return String(item.index - firstItem.index + leadingTrackCount + 1)
  }

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
        aria-activedescendant={() => getActiveDescendantForRender()}
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
            if (initialDiagnostics && initialDiagnostics.onCommit) {
              ensureDiagnosticsMutationObserver()
            }
            scheduleUpdateRange(undefined, 'mount')
            return
          }

          viewportResizeObserver?.disconnect()
          viewportResizeObserver = undefined
          if (diagnosticsMutationObserver) {
            diagnosticsMutationObserver.disconnect()
            diagnosticsMutationObserver = undefined
          }
          pendingCreatedNodes = undefined
          pendingRemovedNodes = undefined
          pendingDiagnosticsCommit = undefined
          scheduler.cancel()
          pendingRangeUpdate = undefined
          focusScheduler.cancel()

          if (viewport) {
            viewport.removeEventListener('scroll', scheduleUpdateRange)
          }

          viewport = undefined
          viewportClientHeight = 0
          viewportClientWidth = 0
          invalidateSnapshotCaches()
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
            width: `${columnVirtualizer.getTotalSize()}px`,
          })}
        >
          <For
            each={getHeaderColumnsForRender()}
            by={getHeaderColumnReconciliationKey}
          >
            {item => (
              <div
                key={item.data.id}
                part="header-cell"
                data-slot="data-grid-header-cell"
                data-column-id={item.data.id}
                data-sortable={() => (item.data.sortable ? '' : undefined)}
                data-resizable={() =>
                  props.resizable && item.data.resizable ? '' : undefined
                }
                data-sort-direction={() =>
                  sort?.columnId === item.data.id ? sort.direction : undefined
                }
                role="columnheader"
                aria-colindex={() =>
                  String(getDataGridColumnAriaIndex(item.index))
                }
                aria-sort={() => getDataGridAriaSort(item.data, sort)}
                tabindex={0}
                style={() => ({
                  gridColumnStart: getGridColumnStart(item),
                })}
                onClick={(nativeEvent: Event) => {
                  applySort(item.data.id, undefined, nativeEvent)
                }}
                onKeyDown={(nativeEvent: KeyboardEvent) => {
                  if (
                    item.data.sortable &&
                    (nativeEvent.key === 'Enter' || nativeEvent.key === ' ')
                  ) {
                    applySort(item.data.id, undefined, nativeEvent)
                  }
                }}
              >
                <span part="header-label" data-slot="data-grid-header-label">
                  {item.data.header}
                </span>

                <span
                  part="resize-handle"
                  data-slot="data-grid-resize-handle"
                  role="separator"
                  aria-label={() => getDataGridResizeHandleAriaLabel(item.data)}
                  aria-orientation="vertical"
                  aria-valuenow={() => {
                    void columnRangeRenderVersion()

                    const currentColumn = getDataGridColumnById(
                      columns,
                      item.data.id,
                    )

                    return String(
                      currentColumn ? currentColumn.width : item.data.width,
                    )
                  }}
                  aria-valuemin={() => String(item.data.minWidth)}
                  aria-valuemax={() => String(item.data.maxWidth)}
                  tabindex={() =>
                    props.resizable && item.data.resizable ? 0 : undefined
                  }
                  hidden={() => !(props.resizable && item.data.resizable)}
                  onPointerDown={(nativeEvent: PointerEvent) => {
                    let currentColumn = getDataGridColumnById(
                      columns,
                      item.data.id,
                    )

                    if (!currentColumn) currentColumn = item.data

                    startResize(currentColumn, nativeEvent)
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
                    const currentColumn = getDataGridColumnById(
                      columns,
                      item.data.id,
                    )

                    if (
                      !props.resizable ||
                      !currentColumn ||
                      !currentColumn.resizable
                    ) {
                      return
                    }

                    if (nativeEvent.key === 'ArrowLeft') {
                      nativeEvent.preventDefault()
                      applyColumnResize(
                        currentColumn.id,
                        currentColumn.width - 16,
                        nativeEvent,
                      )
                    }

                    if (nativeEvent.key === 'ArrowRight') {
                      nativeEvent.preventDefault()
                      applyColumnResize(
                        currentColumn.id,
                        currentColumn.width + 16,
                        nativeEvent,
                      )
                    }

                    if (nativeEvent.key === 'Home') {
                      nativeEvent.preventDefault()
                      applyColumnResize(
                        currentColumn.id,
                        currentColumn.minWidth,
                        nativeEvent,
                      )
                    }

                    if (nativeEvent.key === 'End') {
                      nativeEvent.preventDefault()
                      applyColumnResize(
                        currentColumn.id,
                        currentColumn.maxWidth,
                        nativeEvent,
                      )
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
          <For each={getBodyRowsForRender()} by={getBodyRowReconciliationKey}>
            {rowItem => (
              <div
                key={rowItem.key}
                part="row"
                data-slot="data-grid-row"
                data-row-key={rowItem.data.key}
                data-row-index={() => String(rowItem.data.index)}
                data-selected={() =>
                  selection.isSelected(rowItem.data.key) ? '' : undefined
                }
                role="row"
                aria-rowindex={() =>
                  String(getDataGridDataRowAriaIndex(rowItem.data.index))
                }
                aria-selected={() =>
                  getDataGridAriaSelected(
                    resolveSelectionMode(props.selectionMode),
                    selection.isSelected(rowItem.data.key),
                  )
                }
                style={() => ({
                  display: 'grid',
                  gridTemplateColumns: getGridTemplateColumns(),
                  width: `${columnVirtualizer.getTotalSize()}px`,
                  transform: props.virtual
                    ? `translateY(${rowItem.start}px)`
                    : undefined,
                })}
                onClick={(nativeEvent: Event) => {
                  if (resolveSelectionMode(props.selectionMode) !== 'none') {
                    selection.toggle(rowItem.data.key)
                    syncSelectionPropsFromModel()
                    emitSelection(rowItem.data.key, nativeEvent)
                  }

                  emitRowAction('click', rowItem.data, nativeEvent)
                }}
                onDblClick={(nativeEvent: Event) => {
                  emitRowAction('dblclick', rowItem.data, nativeEvent)
                }}
                onKeyDown={(nativeEvent: KeyboardEvent) => {
                  emitRowAction('keydown', rowItem.data, nativeEvent)
                }}
              >
                <For
                  each={getBodyColumnsForRender()}
                  by={getBodyColumnReconciliationKey}
                >
                  {columnItem => (
                    <div
                      key={columnItem.data.id}
                      id={
                        getDataGridActiveCellId({
                          rowIndex: rowItem.data.index,
                          rowKey: rowItem.data.key,
                          columnId: columnItem.data.id,
                          columnIndex: columnItem.index,
                        }) ?? undefined
                      }
                      part="cell"
                      data-slot="data-grid-cell"
                      data-column-id={columnItem.data.id}
                      data-row-key={rowItem.data.key}
                      data-align={columnItem.data.align}
                      data-active={() =>
                        isActiveCellForRender(
                          rowItem.data.key,
                          columnItem.data.id,
                        )
                          ? ''
                          : undefined
                      }
                      role="gridcell"
                      style={() => ({
                        gridColumnStart: getGridColumnStart(columnItem),
                      })}
                      aria-colindex={() =>
                        String(getDataGridColumnAriaIndex(columnItem.index))
                      }
                      aria-selected={() =>
                        getDataGridAriaSelected(
                          resolveSelectionMode(props.selectionMode),
                          selection.isSelected(rowItem.data.key),
                        )
                      }
                      tabindex={() =>
                        getDataGridCellTabIndex(
                          props.keyboardNavigation !== false,
                          isActiveCellForRender(
                            rowItem.data.key,
                            columnItem.data.id,
                          ),
                        )
                      }
                      onFocus={(nativeEvent: FocusEvent) => {
                        preserveFocusedBodyDomPoolForCurrentRange =
                          poolRowsForCurrentReconciliation &&
                          poolBodyColumnsForCurrentReconciliation
                        setActiveCellByKey(
                          rowItem.data.key,
                          columnItem.data.id,
                          nativeEvent,
                        )
                      }}
                      onClick={(nativeEvent: Event) => {
                        setActiveCellByKey(
                          rowItem.data.key,
                          columnItem.data.id,
                          nativeEvent,
                        )
                        emitCellAction(
                          'click',
                          rowItem.data,
                          columnItem.data,
                          nativeEvent,
                        )
                      }}
                      onDblClick={(nativeEvent: Event) => {
                        emitCellAction(
                          'dblclick',
                          rowItem.data,
                          columnItem.data,
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
                            rowItem.data.key,
                            columnItem.data.id,
                            nativeEvent.key,
                            nativeEvent,
                          )
                        }

                        emitCellAction(
                          'keydown',
                          rowItem.data,
                          columnItem.data,
                          nativeEvent,
                        )
                      }}
                    >
                      {String(
                        getDataGridCellValue(
                          rowItem.data,
                          columnItem.data.field,
                        ) ?? '',
                      )}
                    </div>
                  )}
                </For>
              </div>
            )}
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
      rows: {
        type: Array,
        reactivity: 'shallow',
      },
      columns: {
        type: Array,
        reactivity: 'shallow',
      },
      rowHeight: prop(Number, {
        attr: 'row-height',
        default: 40,
      }),
      overscan: prop(Number, {
        default: 4,
      }),
      overscanColumns: prop(Number, {
        attr: 'overscan-columns',
        default: 2,
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
      diagnostics: prop<DataGridDiagnostics>(Object, {
        attr: false,
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
        'Headless data grid advanced component with controlled state, two-axis virtualization, column resizing, keyboard navigation, selection and sorting.',
    },
  },
  setup,
)
