import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type { VirtualScrollAlign } from '@zeus-web/virtual'

import type {
  DataGridRangeUpdateScheduler,
  DataGridRowCollection,
  DataGridRowModel,
} from '../core'
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
  DataGridCommitTiming,
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
import type { DataGridViewportController } from './viewport-controller'
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
  createDataGridRangeUpdateScheduler,
  createDataGridRowModel,
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
  materializeDataGridRows,
  moveDataGridActiveCell,
  normalizeDataGridColumns,
  resetDataGridColumnWidths,
  resizeDataGridColumn,
  resizeDataGridColumnByDelta,
  shouldEmitDataGridViewportResize,
  shouldUpdateDataGridColumnVirtualSnapshot,
  shouldUpdateDataGridVirtualSnapshot,
  sortDataGridRowCollection,
} from '../core'
import {
  createDataGridControlledStateTracker,
  DataGridControlledStateChange,
} from '../core/controlled-state-tracker'
import { createDataGridHostAdapter } from './host-adapter'
import { createDataGridViewportController } from './viewport-controller'

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

type DataGridSnapshotCache<T> = [
  snapshot: T,
  scrollOffset: number,
  layout?: string,
]

interface FocusedDataGridHeaderTarget {
  columnId: string
  kind: 'header-cell' | 'resize-handle'
}

interface FocusedDataGridViewportState {
  body: boolean
  header?: FocusedDataGridHeaderTarget
}

interface PendingDataGridCommitTiming extends DataGridCommitTiming {
  layoutReadIntervals: Array<readonly [number, number]>
}

interface PendingDataGridDiagnosticsCommit {
  observer: NonNullable<DataGridDiagnostics['onCommit']>
  renderToken: number
  /**
   * Captured at commit creation so a mid-flight diagnostics toggle cannot
   * reclassify an in-flight sample at finalize time.
   */
  measureChurn: boolean
  sample: PendingDataGridCommitTiming
}

const FALLBACK_COLUMN_VIEWPORT_SIZE = 640

function resolveSource<T>(source: T[] | undefined, fallback: T[]): T[] {
  return Array.isArray(source) ? source : fallback
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

function getDiagnosticTime(): number {
  return typeof globalThis.performance === 'undefined'
    ? Date.now()
    : globalThis.performance.now()
}

function shouldMeasureDiagnosticsNodeChurn(
  diagnostics: DataGridDiagnostics | undefined,
): boolean {
  return Boolean(
    diagnostics &&
    diagnostics.onCommit &&
    diagnostics.measureNodeChurn !== false,
  )
}

function getDiagnosticInputTime(event: Event | undefined): number | undefined {
  return event && event.timeStamp
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

function cloneEmptySnapshot<
  T extends DataGridVirtualSnapshot | DataGridColumnVirtualSnapshot,
>(): T {
  return {
    range: createEmptyVirtualRange(),
    items: [],
    totalSize: 0,
  } as unknown as T
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

function createColumnIndexById(
  columns: NormalizedDataGridColumn[],
): ReadonlyMap<string, number> {
  const indexById = new Map<string, number>()

  for (let index = columns.length - 1; index >= 0; index -= 1) {
    indexById.set(columns[index].id, index)
  }

  return indexById
}

function escapeDataGridSelectorValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function setup(
  props: DataGridProps,
  ctx: DefineElementContext<DataGridElement, DataGridEmits>,
) {
  let viewport: HTMLElement | undefined
  let viewportController: DataGridViewportController
  // The scroll hot path needs the focused viewport state on every commit, and
  // deriving it walks the active element with closest(). Caching that derived
  // state keeps the walk off the hot path, but the cache must never outlive the
  // element it was derived from: DOM pooling recycles header cells without
  // firing a focus event, so a header cell can lose focus while remaining in the
  // cache. Comparing document.activeElement against the cached element by
  // identity detects that in O(1) without touching layout.
  let cachedFocusedViewportState: FocusedDataGridViewportState | undefined
  let cachedFocusedViewportSource: Element | null = null
  let canReuseUnfocusedViewportState = false
  let focusedViewportStateListenerAttached = false
  let resizeSession: ResizeSession | undefined
  let diagnosticsMutationObserver: MutationObserver | undefined
  let pendingCreatedNodes: Set<Node> | undefined
  let pendingRemovedNodes: Set<Node> | undefined
  let pendingDiagnosticsCommit: PendingDataGridDiagnosticsCommit | undefined
  let diagnosticsCommitFinalizeScheduled = false
  let diagnosticsRenderToken = 0
  let completedDiagnosticsRenderToken = 0
  let hasCompletedMountCommit = false
  let modelBuildSequence = 0
  let commitTransactionId = 0
  let controlledPropsReady = false
  let hasRowMeasurementOverrides = false
  let poolRowsForCurrentReconciliation = false
  let poolHeaderColumnsForCurrentReconciliation = false
  let poolBodyColumnsForCurrentReconciliation = false
  let preserveFocusedBodyDomPoolForCurrentRange = false
  let disableRowPoolingForCurrentRange = false
  let disableHeaderColumnPoolingForCurrentRange = false
  let disableBodyColumnPoolingForCurrentRange = false
  let preserveScheduledHeaderFocusForDataRebuild = false

  const fallbackRows: DataGridRowData[] = []
  const fallbackColumns: DataGridColumn[] = []
  let rowsSource = resolveSource(props.rows, fallbackRows)
  let columnsSource = resolveSource(props.columns, fallbackColumns)

  const initialDiagnostics = props.diagnostics
  let observedDiagnostics = initialDiagnostics
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
  let columnIndexById = createColumnIndexById(visibleColumns)
  let rows: DataGridRowModel = createDataGridRowModel(rowsSource)
  let sort: DataGridSortState | undefined = createDataGridControlledSortState(
    props.sortColumn,
    props.sortDirection,
  )
  let visibleRows: DataGridRowCollection = sort
    ? sortDataGridRowCollection(rows, columns, sort)
    : rows
  const selection = createDataGridSelectionModel(
    resolveSelectionMode(props.selectionMode),
    props.selectedKeys ?? [],
  )
  let virtualizer = createDataGridRowVirtualizer({
    rows: visibleRows,
    rowHeight: resolveRowHeight(props),
    overscan: resolveOverscan(props),
    fixed: true,
  })
  let columnVirtualizer = createDataGridColumnVirtualizer({
    columns: visibleColumns,
    overscan: resolveColumnOverscan(props),
  })
  const emitModelBuild = (
    observer: DataGridDiagnostics['onModelBuild'],
    startTime: number,
    version: number,
    eagerRowWrapperAllocationCount: number,
  ): void => {
    if (!observer) return

    modelBuildSequence += 1
    observer({
      sequence: modelBuildSequence,
      modelVersion: version,
      startTime,
      endTime: getDiagnosticTime(),
      rowCount: rows.length,
      columnCount: columns.length,
      visibleColumnCount: visibleColumns.length,
      sortActive: sort !== undefined,
      rowModelReused: visibleRows === rows,
      rowIndexEntryCount: rows.length,
      eagerRowWrapperAllocationCount,
    })
  }
  emitModelBuild(
    initialModelBuildObserver,
    initialModelBuildStart,
    0,
    rows.wrapperCount,
  )
  let currentSnapshot = cloneEmptySnapshot<DataGridVirtualSnapshot>()
  let currentColumnSnapshot =
    cloneEmptySnapshot<DataGridColumnVirtualSnapshot>()
  let rowSnapshotCache:
    | DataGridSnapshotCache<DataGridVirtualSnapshot>
    | undefined
  let columnSnapshotCache:
    | DataGridSnapshotCache<DataGridColumnVirtualSnapshot>
    | undefined
  let viewportClientHeight = 0
  let viewportClientWidth = 0
  const [renderVersion, setRenderVersion] = createSignal(0)
  const [selectionRenderVersion, setSelectionRenderVersion] = createSignal(0)
  let activeCell = createInitialDataGridActiveCell({
    rows: visibleRows,
    columns: visibleColumns,
    rowKey: props.activeRowKey,
    columnId: props.activeColumnId,
    columnIndexById,
  })
  const [activeCellRenderVersion, setActiveCellRenderVersion] = createSignal(0)
  let shouldSyncActiveCellFromProps = false
  let modelVersion = 0
  let pendingControlledSortClear = false
  let rowsSourceDirty = false
  let columnsSourceDirty = false
  let rowVirtualizerDirty = false
  let columnVirtualizerDirty = false
  let activeCellDirty = false
  const [rowRenderVersion, setRowRenderVersion] = createSignal(0)
  const [rowLayoutRenderVersion, setRowLayoutRenderVersion] = createSignal(0)
  const [columnRenderVersion, setColumnRenderVersion] = createSignal(0)
  const [columnRangeRenderVersion, setColumnRangeRenderVersion] =
    createSignal(0)
  let shouldRefreshRowsForRender = false
  let shouldRefreshRowLayoutForRender = false
  let shouldRefreshColumnsForRender = false
  let builtModelVersion = modelVersion
  const focusScheduler = createRafScheduler()
  const headerFocusScheduler = createRafScheduler()

  const viewportMeasure = createDataGridViewportMeasureController()
  let viewportMeasurement: DataGridViewportMeasurement =
    viewportMeasure.measure(0, resolveRowHeight(props), visibleRows.length)

  const controlledState = createDataGridControlledStateTracker({
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
    rows: resolveSource(props.rows, fallbackRows),
    columns: resolveSource(props.columns, fallbackColumns),
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

  const rebuildColumnVirtualizer = (): void => {
    columnVirtualizer = createDataGridColumnVirtualizer({
      columns: visibleColumns,
      overscan: resolveColumnOverscan(props),
    })
    currentColumnSnapshot = cloneEmptySnapshot<DataGridColumnVirtualSnapshot>()
    invalidateColumnSnapshotCache()
  }

  const rebuildRowVirtualizer = (): void => {
    virtualizer = createDataGridRowVirtualizer({
      rows: visibleRows,
      rowHeight: resolveRowHeight(props),
      overscan: resolveOverscan(props),
      fixed: true,
    })
    hasRowMeasurementOverrides = false
    currentSnapshot = cloneEmptySnapshot<DataGridVirtualSnapshot>()
    invalidateRowSnapshotCache()
  }

  const measureViewport = (
    clientHeight?: number,
    clientWidth?: number,
  ): DataGridViewportMeasurement => {
    let resolvedClientHeight: number
    let resolvedClientWidth: number

    if (clientHeight === undefined || clientWidth === undefined) {
      const clientSize = viewportController.getClientSize()
      resolvedClientHeight =
        clientHeight === undefined ? clientSize.height : clientHeight
      resolvedClientWidth =
        clientWidth === undefined ? clientSize.width : clientWidth
    } else {
      resolvedClientHeight = clientHeight
      resolvedClientWidth = clientWidth
    }

    const previousClientHeight = viewportClientHeight
    const previousClientWidth = viewportClientWidth
    const previousViewportSize = viewportMeasurement.size

    viewportClientHeight = resolvedClientHeight
    viewportClientWidth = resolvedClientWidth

    const nextMeasurement = viewportMeasure.measure(
      resolvedClientHeight,
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
      previousClientHeight !== resolvedClientHeight ||
      previousViewportSize !== nextMeasurement.size
    ) {
      invalidateRowSnapshotCache()
    }

    if (previousClientWidth !== resolvedClientWidth) {
      invalidateColumnSnapshotCache()
    }

    return viewportMeasurement
  }

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

  const readFocusedViewportState = (): FocusedDataGridViewportState => {
    const currentViewport = viewport
    const activeElement = currentViewport?.ownerDocument.activeElement

    if (
      !currentViewport ||
      !activeElement ||
      !currentViewport.contains(activeElement)
    ) {
      return { body: false }
    }

    const body = Boolean(activeElement.closest('[data-slot="data-grid-body"]'))
    const headerCell = activeElement.closest<HTMLElement>(
      '[data-slot="data-grid-header-cell"]',
    )

    if (!headerCell) return { body }

    const columnId = headerCell.getAttribute('data-column-id')

    if (columnId === null) return { body }

    return {
      body,
      header: {
        columnId,
        kind:
          activeElement.getAttribute('data-slot') === 'data-grid-resize-handle'
            ? 'resize-handle'
            : 'header-cell',
      },
    }
  }

  const invalidateFocusedViewportState = (): void => {
    cachedFocusedViewportState = undefined
    cachedFocusedViewportSource = null
    canReuseUnfocusedViewportState = false
  }

  const ensureFocusedViewportStateListener = (): void => {
    const ownerDocument = viewport?.ownerDocument
    if (!ownerDocument) return
    if (focusedViewportStateListenerAttached) return
    ownerDocument.addEventListener(
      'focusin',
      invalidateFocusedViewportState,
      true,
    )
    ownerDocument.addEventListener(
      'focusout',
      invalidateFocusedViewportState,
      true,
    )
    focusedViewportStateListenerAttached = true
  }

  const getFocusedViewportState = (): FocusedDataGridViewportState => {
    ensureFocusedViewportStateListener()

    // Focus events invalidate this state. While the grid has no focused
    // descendant, avoid reading document.activeElement for every scroll commit.
    if (canReuseUnfocusedViewportState && cachedFocusedViewportState) {
      return cachedFocusedViewportState
    }

    const activeElement = viewport?.ownerDocument.activeElement ?? null
    const cachedHeader = cachedFocusedViewportState?.header
    if (
      cachedFocusedViewportState !== undefined &&
      cachedFocusedViewportSource === activeElement
    ) {
      if (
        activeElement === null ||
        !cachedHeader ||
        (viewport?.contains(activeElement) === true &&
          activeElement
            .closest<HTMLElement>('[data-slot="data-grid-header-cell"]')
            ?.getAttribute('data-column-id') === cachedHeader.columnId)
      ) {
        return cachedFocusedViewportState
      }
    }

    const state = readFocusedViewportState()
    cachedFocusedViewportSource = activeElement
    cachedFocusedViewportState = state
    canReuseUnfocusedViewportState = !state.body && state.header === undefined
    return state
  }

  const hasFocusedBodyDescendant = (): boolean => {
    return getFocusedViewportState().body
  }

  const getFocusedHeaderTarget = (): FocusedDataGridHeaderTarget | undefined =>
    getFocusedViewportState().header

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
    preserveForDataRebuild = false,
  ): void => {
    const ownerDocument = viewport?.ownerDocument
    const scheduledActiveElement = ownerDocument?.activeElement
    preserveScheduledHeaderFocusForDataRebuild = preserveForDataRebuild

    headerFocusScheduler.schedule(() => {
      preserveScheduledHeaderFocusForDataRebuild = false
      const activeElement = ownerDocument?.activeElement

      if (
        activeElement &&
        activeElement !== ownerDocument?.body &&
        activeElement !== scheduledActiveElement
      ) {
        return
      }

      focusHeaderTarget(target)
    })
  }

  const syncControlledSources = (): boolean => {
    const changes = controlledState.update(readControlledStateSources())

    if (!changes) return false

    if (changes & DataGridControlledStateChange.Rows) {
      rowsSource = resolveSource(props.rows, fallbackRows)
      rowsSourceDirty = true
      rowVirtualizerDirty = true
      activeCellDirty = true
      shouldRefreshRowsForRender = true
    }

    if (
      changes &
      (DataGridControlledStateChange.Rows |
        DataGridControlledStateChange.RowHeight |
        DataGridControlledStateChange.Virtual)
    ) {
      shouldRefreshRowLayoutForRender = true
    }

    if (changes & DataGridControlledStateChange.Columns) {
      columnsSource = resolveSource(props.columns, fallbackColumns)
      columnsSourceDirty = true
      columnVirtualizerDirty = true
      activeCellDirty = true
      shouldRefreshColumnsForRender = true
    }

    if (changes & DataGridControlledStateChange.SelectedKeys) {
      if (props.selectedKeys !== undefined) {
        selection.setKeys(props.selectedKeys)
        setSelectionRenderVersion(value => value + 1)
      }
    }

    if (changes & DataGridControlledStateChange.SelectionMode) {
      selection.setMode(resolveSelectionMode(props.selectionMode))
      setSelectionRenderVersion(value => value + 1)
    }

    if (changes & DataGridControlledStateChange.Sort) {
      if (props.sortColumn !== undefined || props.sortDirection !== undefined) {
        sort = createDataGridControlledSortState(
          props.sortColumn,
          props.sortDirection,
        )
        pendingControlledSortClear = false
        rowVirtualizerDirty = true
        activeCellDirty = true
      } else if (pendingControlledSortClear) {
        sort = undefined
        pendingControlledSortClear = false
        rowVirtualizerDirty = true
        activeCellDirty = true
      }
    }

    if (changes & DataGridControlledStateChange.Columns && sort !== undefined) {
      rowVirtualizerDirty = true
    }

    if (changes & DataGridControlledStateChange.ActiveCell) {
      const isActiveCellControlled =
        props.activeRowKey !== undefined || props.activeColumnId !== undefined

      shouldSyncActiveCellFromProps = isActiveCellControlled
      activeCellDirty = true
    }

    if (
      changes &
      (DataGridControlledStateChange.RowHeight |
        DataGridControlledStateChange.Overscan)
    ) {
      rowVirtualizerDirty = true
    }

    if (changes & DataGridControlledStateChange.OverscanColumns) {
      columnVirtualizerDirty = true
    }

    if (changes & DataGridControlledStateChange.Virtual) {
      rowVirtualizerDirty = true
      columnVirtualizerDirty = true
    }

    if (
      changes &
      (DataGridControlledStateChange.Rows |
        DataGridControlledStateChange.Columns |
        DataGridControlledStateChange.Sort |
        DataGridControlledStateChange.ActiveCell |
        DataGridControlledStateChange.RowHeight |
        DataGridControlledStateChange.Overscan |
        DataGridControlledStateChange.OverscanColumns |
        DataGridControlledStateChange.Virtual)
    ) {
      modelVersion += 1
    }

    return true
  }

  const rebuildModels = (): void => {
    const hasModelWork =
      rowsSourceDirty ||
      columnsSourceDirty ||
      rowVirtualizerDirty ||
      columnVirtualizerDirty ||
      activeCellDirty

    if (!hasModelWork) return

    const diagnostics = props.diagnostics
    const modelBuildObserver = diagnostics && diagnostics.onModelBuild
    const modelBuildStart = modelBuildObserver ? getDiagnosticTime() : 0

    const shouldRestoreActiveCellFocus =
      (shouldRefreshRowsForRender || shouldRefreshColumnsForRender) &&
      isActiveCellElementFocused()
    const focusedHeaderTarget = shouldRefreshColumnsForRender
      ? getFocusedHeaderTarget()
      : undefined
    let eagerRowWrapperAllocationCount = 0

    if (columnsSourceDirty) {
      baseColumns = normalizeDataGridColumns(columnsSource)
      defaultColumnWidths = createDataGridColumnWidthState(baseColumns)
      columnWidths = createDataGridColumnWidthState(baseColumns)
      columns = applyDataGridColumnWidths(baseColumns, columnWidths)
      visibleColumns = getVisibleDataGridColumns(columns)
      columnIndexById = createColumnIndexById(visibleColumns)
      columnsSourceDirty = false
    }

    if (rowsSourceDirty) {
      rows = createDataGridRowModel(rowsSource)
      rowsSourceDirty = false
      eagerRowWrapperAllocationCount = rows.wrapperCount
    }

    if (rowVirtualizerDirty) {
      visibleRows = sort ? sortDataGridRowCollection(rows, columns, sort) : rows
      rebuildRowVirtualizer()
      rowVirtualizerDirty = false
    }

    if (columnVirtualizerDirty) {
      rebuildColumnVirtualizer()
      columnVirtualizerDirty = false
    }

    if (activeCellDirty) {
      const nextActiveCell = createInitialDataGridActiveCell({
        rows: visibleRows,
        columns: visibleColumns,
        rowKey: shouldSyncActiveCellFromProps
          ? props.activeRowKey
          : (activeCell?.rowKey ?? props.activeRowKey),
        columnId: shouldSyncActiveCellFromProps
          ? props.activeColumnId
          : (activeCell?.columnId ?? props.activeColumnId),
        columnIndexById,
      })

      if (!areDataGridActiveCellsEqual(activeCell, nextActiveCell)) {
        activeCell = nextActiveCell
        setActiveCellRenderVersion(value => value + 1)
      } else {
        activeCell = nextActiveCell
      }

      shouldSyncActiveCellFromProps = false
      activeCellDirty = false
    }

    builtModelVersion = modelVersion

    if (viewportClientHeight <= 0) {
      measureViewport(viewportClientHeight, viewportClientWidth)
    }

    emitModelBuild(
      modelBuildObserver,
      modelBuildStart,
      builtModelVersion,
      eagerRowWrapperAllocationCount,
    )

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

    if (focusedHeaderTarget) {
      scheduleFocusHeaderTarget(focusedHeaderTarget, true)
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
  ): void => {
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
        items: Array.from({ length: visibleRows.length }, (_, index) => {
          const row = visibleRows.getRow(index)!

          return {
            index,
            key: row.key,
            start: index * rowHeight,
            size: rowHeight,
            end: (index + 1) * rowHeight,
            data: row,
          }
        }),
        totalSize: total,
      }
    }

    return virtualizer.getSnapshot(scrollOffset, viewportSize)
  }

  const getSnapshot = (
    scrollOffset = getScrollOffset(viewport),
    modelsReady = false,
  ): DataGridVirtualSnapshot => {
    if (!modelsReady) rebuildModels()

    if (rowSnapshotCache?.[1] === scrollOffset) {
      return rowSnapshotCache[0]
    }

    const snapshot = getSnapshotFromModels(
      scrollOffset,
      viewportMeasurement.size,
    )

    rowSnapshotCache = [snapshot, scrollOffset]

    return snapshot
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

  const getColumnSnapshot = (
    scrollOffset = getColumnScrollOffset(viewport),
    modelsReady = false,
  ): DataGridColumnVirtualSnapshot => {
    if (!modelsReady) rebuildModels()

    if (columnSnapshotCache?.[1] === scrollOffset) {
      return columnSnapshotCache[0]
    }

    const snapshot = getColumnSnapshotFromModels(
      scrollOffset,
      viewportClientWidth ||
        Math.min(
          FALLBACK_COLUMN_VIEWPORT_SIZE,
          columnVirtualizer.getTotalSize(),
        ),
    )

    const first = snapshot.items[0]
    columnSnapshotCache = [
      snapshot,
      scrollOffset,
      // eslint-disable-next-line prefer-template
      (first?.start ? first.start + 'px ' : '') +
        // eslint-disable-next-line prefer-template
        snapshot.items.map(({ size }) => size + 'px').join(' '),
    ]

    return snapshot
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
      shouldMeasureDiagnosticsNodeChurn(diagnostics) &&
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

  const consumeDiagnosticsNodeChurn = (
    sample: PendingDataGridCommitTiming,
  ): void => {
    if (diagnosticsMutationObserver) {
      recordDiagnosticsMutations(diagnosticsMutationObserver.takeRecords())
    }

    sample.createdNodeCount = pendingCreatedNodes ? pendingCreatedNodes.size : 0
    sample.removedNodeCount = pendingRemovedNodes ? pendingRemovedNodes.size : 0

    if (pendingCreatedNodes) pendingCreatedNodes.clear()
    if (pendingRemovedNodes) pendingRemovedNodes.clear()
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
    const currentSample = current.sample
    const nextSample = next.sample
    current.renderToken = next.renderToken
    currentSample.rangeCalculatedTime = nextSample.rangeCalculatedTime
    currentSample.commitStartTime = nextSample.commitStartTime
    currentSample.signalPublishStartTime = nextSample.signalPublishStartTime
    currentSample.signalPublishEndTime = nextSample.signalPublishEndTime
    currentSample.layoutReadIntervals.push(nextSample.layoutReadIntervals[0])
    currentSample.firstRowIndex = nextSample.firstRowIndex
    currentSample.lastRowIndex = nextSample.lastRowIndex
    currentSample.firstColumnIndex = nextSample.firstColumnIndex
    currentSample.lastColumnIndex = nextSample.lastColumnIndex
    currentSample.rowWrapperAllocationCount +=
      nextSample.rowWrapperAllocationCount
    return current
  }

  const finalizeDiagnosticsCommit = (
    commit: PendingDataGridDiagnosticsCommit,
  ): void => {
    const sample = commit.sample
    sample.transactionId = ++commitTransactionId
    sample.commitEndTime = getDiagnosticTime()
    sample.diagnosticsEndTime = sample.commitEndTime
    if (commit.measureChurn) {
      consumeDiagnosticsNodeChurn(sample)
      sample.diagnosticsEndTime = getDiagnosticTime()
    }
    commit.observer(sample)
  }

  const finalizeCompletedPendingDiagnosticsCommit = (): void => {
    const pendingCommit = pendingDiagnosticsCommit

    if (
      !pendingCommit ||
      completedDiagnosticsRenderToken < pendingCommit.renderToken
    ) {
      return
    }

    pendingDiagnosticsCommit = undefined
    finalizeDiagnosticsCommit(pendingCommit)
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
    scrollEvent?: Event,
    source: DataGridCommitSource = 'api',
    scheduledHandlerStartTime?: number,
    scheduledHandlerEndTime?: number,
    measureViewportMetrics = source !== 'scroll',
    preservePendingNodeChurn = source === 'mount' && !hasCompletedMountCommit,
    deferCommitDiagnostics = false,
    diagnosticInput?: Event | number | null,
  ): void => {
    finalizeCompletedPendingDiagnosticsCommit()

    const focusedViewportState = getFocusedViewportState()
    const hasFocusedBodyForCurrentRange = focusedViewportState.body
    const shouldRestoreFocusAfterPoolExit =
      preserveFocusedBodyDomPoolForCurrentRange && hasFocusedBodyForCurrentRange
    const focusedHeaderTarget = focusedViewportState.header
    const shouldRestoreHeaderFocusAfterPoolExit = Boolean(
      poolHeaderColumnsForCurrentReconciliation && focusedHeaderTarget,
    )

    if (!focusedHeaderTarget && !preserveScheduledHeaderFocusForDataRebuild) {
      headerFocusScheduler.cancel()
    }

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
    const inputTime =
      diagnosticInput === null
        ? undefined
        : typeof diagnosticInput === 'number'
          ? diagnosticInput
          : commitObserver
            ? getDiagnosticInputTime(diagnosticInput ?? scrollEvent)
            : undefined
    const handlerStartTime =
      scheduledHandlerStartTime !== undefined
        ? scheduledHandlerStartTime
        : directHandlerStartTime
    const handlerEndTime =
      scheduledHandlerEndTime !== undefined
        ? scheduledHandlerEndTime
        : commitObserver
          ? getDiagnosticTime()
          : 0
    const rangeStartTime = commitObserver ? getDiagnosticTime() : 0
    const renderToken = commitObserver ? diagnosticsRenderToken + 1 : 0
    const diagnosticsRowModel = rows
    const rowWrapperAllocationStart = commitObserver
      ? source === 'mount' && !hasCompletedMountCommit
        ? 0
        : rows.wrapperCount
      : 0

    if (commitObserver) {
      diagnosticsRenderToken = renderToken
    }

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
    let clientHeight = viewportClientHeight
    let clientWidth = viewportClientWidth
    if (measureViewportMetrics) {
      const clientSize = viewportController.getClientSize()
      clientHeight = clientSize.height
      clientWidth = clientSize.width
    }
    const layoutReadEndTime = commitObserver ? getDiagnosticTime() : 0
    const viewportSize = measureViewportMetrics
      ? measureViewport(clientHeight, clientWidth).size
      : viewportMeasurement.size
    const columnScrollOffset = scrollEvent
      ? getColumnScrollOffset(viewport)
      : undefined
    const nextColumnSnapshot =
      scrollEvent && columnSnapshotCache?.[1] === columnScrollOffset
        ? currentColumnSnapshot
        : getColumnSnapshot(columnScrollOffset, true)
    const nextSnapshot = getSnapshot(scrollOffset, true)
    const rangeCalculatedTime = commitObserver ? getDiagnosticTime() : 0
    const commitStartTime = commitObserver ? getDiagnosticTime() : 0
    const signalPublishStartTime = commitObserver ? getDiagnosticTime() : 0

    batch(() => {
      emitSnapshotIfChanged(nextSnapshot, scrollOffset, viewportSize)
      updateColumnSnapshotIfChanged(nextColumnSnapshot)
    })
    const signalPublishEndTime = commitObserver ? getDiagnosticTime() : 0
    if (source === 'data') {
      if (hasFocusedBodyForCurrentRange) focusScheduler.flush()
      if (focusedHeaderTarget) headerFocusScheduler.flush()
    }
    if (scrollEvent) {
      ctx.emit.scrollOffsetChange({
        offset: scrollOffset,
        nativeEvent: scrollEvent,
      })
    }

    if (source === 'mount') hasCompletedMountCommit = true
    if (!commitObserver) return

    const diagnosticsCommit: PendingDataGridDiagnosticsCommit = {
      observer: commitObserver,
      renderToken,
      measureChurn: shouldMeasureDiagnosticsNodeChurn(props.diagnostics),
      sample: {
        transactionId: 0,
        source,
        inputTime,
        handlerStartTime,
        handlerEndTime,
        rangeStartTime,
        rangeCalculatedTime,
        commitStartTime,
        signalPublishStartTime,
        signalPublishEndTime,
        commitEndTime: 0,
        diagnosticsEndTime: 0,
        layoutReadIntervals: [[layoutReadStartTime, layoutReadEndTime]],
        firstRowIndex: nextSnapshot.range.start,
        lastRowIndex: nextSnapshot.range.end,
        firstColumnIndex: nextColumnSnapshot.range.start,
        lastColumnIndex: nextColumnSnapshot.range.end,
        createdNodeCount: 0,
        removedNodeCount: 0,
        rowWrapperAllocationCount:
          rows.wrapperCount -
          (rows === diagnosticsRowModel ? rowWrapperAllocationStart : 0),
      },
    }

    if (pendingDiagnosticsCommit || deferCommitDiagnostics) {
      scheduleDiagnosticsCommitFinalize(diagnosticsCommit)
      return
    }

    finalizeDiagnosticsCommit(diagnosticsCommit)
  }

  // The host supplies the DOM commit; coalescing and frame scheduling live in
  // the DOM-free core scheduler.
  const scheduler: DataGridRangeUpdateScheduler<Event> =
    createDataGridRangeUpdateScheduler<Event>({
      commit: update =>
        updateRange(
          update.event,
          update.source,
          update.handlerStartTime,
          update.handlerEndTime,
          update.measure,
          update.preserve,
          false,
          update.inputTime,
        ),
    })

  const scheduleUpdateRange = (
    inputEvent?: Event,
    source: DataGridCommitSource = inputEvent ? 'scroll' : 'api',
    scheduledHandlerStartTime?: number,
    preservePendingNodeChurn = source === 'mount' && !hasCompletedMountCommit,
  ): void => {
    const handlerStartTime =
      scheduledHandlerStartTime !== undefined
        ? scheduledHandlerStartTime
        : startDiagnosticsHandler()
    const handlerEndTime =
      handlerStartTime === undefined ? undefined : getDiagnosticTime()
    const inputTime =
      handlerStartTime === undefined
        ? undefined
        : (getDiagnosticInputTime(inputEvent) ?? null)

    // Native scroll events are already synchronous. When no deferred update is
    // pending, keep the hot path allocation-free and skip scheduler probing.
    if (source === 'scroll' && !scheduler.hasPending()) {
      updateRange(
        inputEvent,
        source,
        handlerStartTime,
        handlerEndTime,
        false,
        preservePendingNodeChurn,
        false,
        inputTime,
      )
      return
    }

    const nextUpdate = {
      event: source === 'scroll' ? inputEvent : undefined,
      source,
      inputTime,
      handlerStartTime,
      handlerEndTime,
      measure: source === 'mount' || source === 'resize',
      preserve: preservePendingNodeChurn,
    }
    scheduler.schedule(nextUpdate)
    if (source === 'scroll') scheduler.flush()
  }

  viewportController = createDataGridViewportController({
    onResize: () => {
      const handlerStartTime = startDiagnosticsHandler()
      scheduleUpdateRange(undefined, 'resize', handlerStartTime)
    },
  })

  const hostAdapter = createDataGridHostAdapter({
    viewportController,
    scheduler,
  })

  const beginDiagnosticsNodeChurn = (): boolean => {
    finalizeCompletedPendingDiagnosticsCommit()
    if (!shouldMeasureDiagnosticsNodeChurn(props.diagnostics)) return false

    ensureDiagnosticsMutationObserver()
    if (!pendingDiagnosticsCommit) {
      prepareDiagnosticsNodeChurn(false)
    }
    return true
  }

  createEffect(() => {
    const controlledSourcesChanged = syncControlledSources()

    if (!controlledPropsReady) {
      controlledPropsReady = true
      return
    }

    if (!controlledSourcesChanged) return

    scheduleUpdateRange(undefined, 'data', undefined, true)
  })

  createEffect(() => {
    const diagnostics = props.diagnostics
    if (diagnostics === observedDiagnostics) return

    observedDiagnostics = diagnostics
    pendingDiagnosticsCommit = undefined
    scheduler.clearDiagnosticTiming()
    if (pendingCreatedNodes) pendingCreatedNodes.clear()
    if (pendingRemovedNodes) pendingRemovedNodes.clear()
    ensureDiagnosticsMutationObserver()
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
      viewportClientWidth ||
        Math.min(
          FALLBACK_COLUMN_VIEWPORT_SIZE,
          columnVirtualizer.getTotalSize(),
        ),
    )

    setColumnScrollOffset(viewport, offset)
    updateRange()
  }

  const commitControlledState = (
    nextSources: Parameters<typeof controlledState.commit>[0],
  ): void => {
    controlledState.commit(nextSources)
  }

  const syncHostProps = (): void => {
    ctx.host.rows = resolveSource(props.rows, fallbackRows)
    ctx.host.columns = resolveSource(props.columns, fallbackColumns)
  }

  const emitSelection = (
    key: DataGridRowKey | undefined,
    nativeEvent?: Event,
    state: DataGridSelectionState = selection.getState(),
  ): void => {
    const row = key ? getDataGridRowByKey(rows, key) : undefined

    ctx.emit.selectionChange({
      selection: state,
      row,
      nativeEvent,
    })
  }

  const isSelectionControlled = (): boolean => props.selectedKeys !== undefined

  const isSortControlled = (): boolean =>
    props.sortColumn !== undefined || props.sortDirection !== undefined

  const isActiveCellControlled = (): boolean =>
    props.activeRowKey !== undefined || props.activeColumnId !== undefined

  const previewSelection = (
    update: (model: ReturnType<typeof createDataGridSelectionModel>) => void,
  ): DataGridSelectionState => {
    const preview = createDataGridSelectionModel(
      resolveSelectionMode(props.selectionMode),
      props.selectedKeys ?? selection.getState().keys,
    )
    update(preview)
    return preview.getState()
  }

  const applySelection = (
    update: (model: ReturnType<typeof createDataGridSelectionModel>) => void,
    key: DataGridRowKey | undefined,
    nativeEvent?: Event,
  ): void => {
    if (isSelectionControlled()) {
      emitSelection(key, nativeEvent, previewSelection(update))
      return
    }

    update(selection)
    setSelectionRenderVersion(value => value + 1)
    emitSelection(key, nativeEvent)
  }

  const emitActiveCell = (
    nextActiveCell: DataGridActiveCell | undefined,
    nativeEvent?: Event,
  ): void => {
    if (areDataGridActiveCellsEqual(activeCell, nextActiveCell)) return

    const previousActiveCell = activeCell
    if (isActiveCellControlled()) {
      ctx.emit.activeCellChange({
        activeCell: nextActiveCell,
        previousActiveCell,
        nativeEvent,
      })
      return
    }

    activeCell = nextActiveCell
    setActiveCellRenderVersion(value => value + 1)

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

    const rowIndex = visibleRows.getIndexByKey(rowKey)
    const columnIndex = columnIndexById.get(columnId)

    if (rowIndex === undefined || columnIndex === undefined) return

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
        Math.floor(viewportMeasurement.size / resolveRowHeight(props)),
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

    const rowIndex = visibleRows.getIndexByKey(rowKey)
    const columnIndex = columnIndexById.get(columnId)

    if (rowIndex === undefined || columnIndex === undefined) return

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
        Math.floor(viewportMeasurement.size / resolveRowHeight(props)),
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
    const handlerStartTime = startDiagnosticsHandler()
    rebuildModels()

    const result = resizeDataGridColumn(columns, columnId, width, columnWidths)
    if (!result.column || result.width === undefined) return

    columnWidths = result.widths
    columns = result.columns
    visibleColumns = getVisibleDataGridColumns(columns)
    modelVersion += 1
    columnVirtualizerDirty = true
    updateRange(
      undefined,
      'data',
      handlerStartTime,
      handlerStartTime === undefined ? undefined : getDiagnosticTime(),
      true,
      false,
      false,
      nativeEvent,
    )

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
    const handlerStartTime = startDiagnosticsHandler()

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
    columnVirtualizerDirty = true
    scheduleUpdateRange(nativeEvent, 'data', handlerStartTime)

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
    const handlerStartTime = startDiagnosticsHandler()
    rebuildModels()

    const column = getDataGridColumnById(columns, columnId)
    if (!column || !column.sortable) return

    const currentSort = isSortControlled()
      ? createDataGridControlledSortState(props.sortColumn, props.sortDirection)
      : sort
    const nextSort = createNextDataGridSortState(
      currentSort,
      columnId,
      direction,
    )
    if (isSortControlled()) {
      pendingControlledSortClear = false
      ctx.emit.sortChange({
        sort: nextSort,
        column,
        nativeEvent,
      })
      return
    }

    sort = nextSort
    modelVersion += 1
    rowVirtualizerDirty = true
    activeCellDirty = true

    ctx.emit.sortChange({
      sort,
      column,
      nativeEvent,
    })

    updateRange(
      undefined,
      'data',
      handlerStartTime,
      handlerStartTime === undefined ? undefined : getDiagnosticTime(),
      true,
      false,
      false,
      nativeEvent,
    )
  }

  ctx.expose({
    setRows(nextRows: DataGridRowData[]): void {
      const preservePendingNodeChurn = beginDiagnosticsNodeChurn()
      batch(() => {
        props.rows = nextRows
        rowsSource = nextRows
        modelVersion += 1
        rowsSourceDirty = true
        rowVirtualizerDirty = true
        activeCellDirty = true
        shouldRefreshRowsForRender = true
        shouldRefreshRowLayoutForRender = true
        syncHostProps()
        commitControlledState({ rows: nextRows })
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
      const preservePendingNodeChurn = beginDiagnosticsNodeChurn()
      batch(() => {
        props.columns = nextColumns
        columnsSource = nextColumns
        modelVersion += 1
        columnsSourceDirty = true
        columnVirtualizerDirty = true
        activeCellDirty = true
        if (sort !== undefined) rowVirtualizerDirty = true
        shouldRefreshColumnsForRender = true
        syncHostProps()
        commitControlledState({ columns: nextColumns })
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
      return materializeDataGridRows(rows)
    },

    getColumns(): NormalizedDataGridColumn[] {
      rebuildModels()
      return columns.map(column => Object.assign({}, column))
    },

    getVisibleRows(): DataGridRow[] {
      rebuildModels()
      return materializeDataGridRows(visibleRows)
    },

    getSelection(): DataGridSelectionState {
      rebuildModels()
      return selection.getState()
    },

    setSelection(keys: DataGridRowKey[]): void {
      applySelection(model => model.setKeys(keys), undefined)
    },

    clearSelection(): void {
      applySelection(model => model.clear(), undefined)
    },

    toggleRowSelection(key: DataGridRowKey): void {
      applySelection(model => model.toggle(key), key)
    },

    setSort(
      columnId: string,
      direction?: DataGridSortDirection,
      nativeEvent?: Event,
    ): void {
      applySort(columnId, direction, nativeEvent)
    },

    clearSort(): void {
      if (isSortControlled()) {
        pendingControlledSortClear = true
        ctx.emit.sortChange({ sort: undefined })
        return
      }

      sort = undefined
      modelVersion += 1
      rowVirtualizerDirty = true
      activeCellDirty = true

      ctx.emit.sortChange({
        sort,
      })

      updateRange(undefined, 'data')
    },

    getSort(): DataGridSortState | undefined {
      rebuildModels()
      return sort ? Object.assign({}, sort) : undefined
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
        ? virtualizer.getOffsetForIndex(index, align, viewportMeasurement.size)
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
      columnVirtualizerDirty = true
      updateRange()
    },

    getColumnWidths(): Record<string, number> {
      rebuildModels()
      return Object.assign({}, columnWidths)
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
      return activeCell ? Object.assign({}, activeCell) : undefined
    },

    moveActiveCell(key: DataGridNavigationKey, nativeEvent?: Event): void {
      moveActiveCellByKey(key, nativeEvent)
    },

    focusCell(rowKey: DataGridRowKey, columnId: string): void {
      rebuildModels()

      const rowIndex = visibleRows.getIndexByKey(rowKey)
      const columnIndex = columnIndexById.get(columnId)

      if (rowIndex !== undefined) {
        ctx.host.scrollToIndex(rowIndex, 'center')
      }

      if (columnIndex !== undefined) {
        scrollToColumnIndex(columnIndex, 'center')
      }

      setActiveCellByKey(rowKey, columnId)
      if (isActiveCellControlled()) {
        focusCellElement(rowKey, columnId)
      } else {
        scheduleFocusActiveCellElement()
      }
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

  const isRowSelectedForRender = (rowKey: DataGridRowKey): boolean => {
    void selectionRenderVersion()
    return selection.isSelected(rowKey)
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
    completedDiagnosticsRenderToken = diagnosticsRenderToken
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
  ): string | number => {
    return poolRowsForCurrentReconciliation
      ? index
      : `r:${rowRenderVersion()}:${item.key}`
  }

  const getVisibleColumnsForRender = (): DataGridColumnVirtualItem[] => {
    void columnRangeRenderVersion()
    void columnRenderVersion()

    return currentColumnSnapshot.items
  }

  const getHeaderColumnsForRender = (): DataGridColumnVirtualItem[] => {
    completedDiagnosticsRenderToken = diagnosticsRenderToken
    poolHeaderColumnsForCurrentReconciliation =
      shouldPoolHeaderColumnsForCurrentViewport()

    return getVisibleColumnsForRender()
  }

  const getBodyColumnsForRender = (): DataGridColumnVirtualItem[] => {
    completedDiagnosticsRenderToken = diagnosticsRenderToken
    poolBodyColumnsForCurrentReconciliation =
      shouldPoolBodyColumnsForCurrentViewport()

    return getVisibleColumnsForRender()
  }

  const getHeaderColumnReconciliationKey = (
    item: DataGridColumnVirtualItem,
    index: number,
  ): string | number => {
    return poolHeaderColumnsForCurrentReconciliation
      ? index
      : `h:${columnRenderVersion()}:${item.key}`
  }

  const getBodyColumnReconciliationKey = (
    item: DataGridColumnVirtualItem,
    index: number,
  ): string | number => {
    return poolBodyColumnsForCurrentReconciliation
      ? index
      : `c:${columnRenderVersion()}:${item.key}`
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

    const columnSnapshot = columnSnapshotCache?.[0] ?? getColumnSnapshot()
    const rowSnapshot = rowSnapshotCache?.[0] ?? getSnapshot()
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
    void columnRangeRenderVersion()
    return columnSnapshotCache?.[2] || ''
  }

  const getGridColumnStart = (item: DataGridColumnVirtualItem): string => {
    const firstItem = currentColumnSnapshot.items[0]
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
      data-row-count={() =>
        String(resolveSource(props.rows, fallbackRows).length)
      }
      data-column-count={() =>
        String(resolveSource(props.columns, fallbackColumns).length)
      }
      data-total-size={() => String(virtualizer.getTotalSize())}
    >
      <div
        part="viewport"
        data-slot="data-grid-viewport"
        role="grid"
        aria-label={() => props.ariaLabel}
        aria-rowcount={() =>
          String(resolveSource(props.rows, fallbackRows).length + 1)
        }
        aria-colcount={() => {
          void columnRangeRenderVersion()
          void columnRenderVersion()
          return String(visibleColumns.length)
        }}
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
            invalidateFocusedViewportState()
            element.addEventListener('scroll', scheduleUpdateRange, {
              passive: true,
            })
            hostAdapter.connect(element)
            ensureDiagnosticsMutationObserver()
            scheduleUpdateRange(undefined, 'mount')
            return
          }

          if (focusedViewportStateListenerAttached && viewport?.ownerDocument) {
            const ownerDocument = viewport.ownerDocument
            ownerDocument.removeEventListener(
              'focusin',
              invalidateFocusedViewportState,
              true,
            )
            ownerDocument.removeEventListener(
              'focusout',
              invalidateFocusedViewportState,
              true,
            )
          }
          focusedViewportStateListenerAttached = false
          invalidateFocusedViewportState()
          hostAdapter.disconnect()
          if (diagnosticsMutationObserver) {
            diagnosticsMutationObserver.disconnect()
            diagnosticsMutationObserver = undefined
          }
          pendingCreatedNodes = undefined
          pendingRemovedNodes = undefined
          pendingDiagnosticsCommit = undefined
          focusScheduler.cancel()
          headerFocusScheduler.cancel()
          preserveScheduledHeaderFocusForDataRebuild = false

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
          aria-rowindex={
            /* @once */ () => String(getDataGridHeaderRowAriaIndex())
          }
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
                // @ts-expect-error Static HTML tabindex values serialize as strings.
                tabindex="0"
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
                part="row"
                data-slot="data-grid-row"
                data-row-key={rowItem.data.key}
                data-row-index={() => String(rowItem.data.index)}
                data-selected={() =>
                  isRowSelectedForRender(rowItem.data.key) ? '' : undefined
                }
                role="row"
                aria-rowindex={() =>
                  String(getDataGridDataRowAriaIndex(rowItem.data.index))
                }
                aria-selected={() =>
                  getDataGridAriaSelected(
                    resolveSelectionMode(props.selectionMode),
                    isRowSelectedForRender(rowItem.data.key),
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
                    applySelection(
                      model => model.toggle(rowItem.data.key),
                      rowItem.data.key,
                      nativeEvent,
                    )
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
                          isRowSelectedForRender(rowItem.data.key),
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
                          poolRowsForCurrentReconciliation ||
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
      selectedKeys: {
        type: Array,
        reactivity: 'shallow',
      },
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
      diagnostics: {
        type: Object,
        attr: false,
        reactivity: 'shallow',
      },
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
