下面给出 **Phase 10：Data Grid Runtime Hardening + Accessibility** 的详细设计与完整代码，包含完整单元测试与 e2e/runtime 测试。

当前 `zw-data-grid` 已经有 controlled state、selection、sort、column resize、keyboard navigation、active cell 等能力；`DataGridElement` 方法目前到 `moveActiveCell` 为止，还没有 `focusCell / focusActiveCell / refreshViewport` 这类 runtime hardening 方法。 当前 viewport size 也只是直接读 `clientHeight`，在 jsdom、隐藏容器、首屏未布局时会得到 `0`。 当前 render 已经有 `role="grid"` 与 `aria-activedescendant`，但 header/cell/row 缺少 `aria-sort`、`aria-rowindex`、`aria-colindex`、`aria-selected` 等更完整的 grid a11y 信息。

---

# 1. Phase 10 目标

```txt
Phase 10: Data Grid Runtime Hardening + Accessibility

目标:
  1. 增加 viewport size fallback，避免 clientHeight=0 时虚拟列表空白
  2. 增加 ResizeObserver runtime 接入，viewport 尺寸变化后自动刷新 range
  3. 增加 refreshViewport() 方法
  4. 增加 focusCell(rowKey, columnId) 方法
  5. 增加 focusActiveCell() 方法
  6. 增加 aria-sort / aria-rowindex / aria-colindex / aria-selected
  7. 增加 aria-multiselectable
  8. 增加 resize handle aria-label
  9. 增加 viewport-resize 事件
  10. 补齐 core 单测、组件 contract 测试、runtime e2e 测试
```

---

# 2. 本阶段文件清单

```txt
修改:
  packages/advanced/data-grid/package.json
  packages/advanced/data-grid/src/types.ts
  packages/advanced/data-grid/src/core/index.ts
  packages/advanced/data-grid/src/components/data-grid.tsx
  packages/advanced/data-grid/__tests__/data-grid.spec.ts

新增:
  packages/advanced/data-grid/src/core/accessibility-model.ts
  packages/advanced/data-grid/src/core/viewport-measure-model.ts
  packages/advanced/data-grid/__tests__/accessibility-model.spec.ts
  packages/advanced/data-grid/__tests__/viewport-measure-model.spec.ts
  e2e/advanced/data-grid/data-grid-accessibility-runtime.spec.ts
  docs/advanced/design/phase10.md
```

---

# 3. 修改 `packages/advanced/data-grid/package.json`

```json
{
  "name": "@zeus-web/data-grid",
  "type": "module",
  "version": "0.0.0",
  "description": "Headless data grid advanced component for Zeus Web.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/baicie/zeus-ui.git",
    "directory": "packages/advanced/data-grid"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "sideEffects": ["./dist/wc/index.js", "./dist/wc/*.js", "./dist/**/*.css"],
  "exports": {
    ".": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc/auto": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/auto.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js"
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue/index.js"
    },
    "./vue/global": {
      "types": "./dist/vue/global.d.ts"
    },
    "./custom-elements.json": {
      "default": "./dist/custom-elements.json"
    },
    "./zeus.components.json": {
      "default": "./dist/zeus.components.json"
    }
  },
  "files": ["dist"],
  "scripts": {
    "dev": "rolldown -c ../../../rolldown.config.ts --watch",
    "build": "rimraf dist && rolldown -c ../../../rolldown.config.ts",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "pnpm test:unit && pnpm test:e2e",
    "test:unit": "vitest --root ../../.. --project unit packages/advanced/data-grid/__tests__/accessibility-model.spec.ts packages/advanced/data-grid/__tests__/viewport-measure-model.spec.ts packages/advanced/data-grid/__tests__/column-model.spec.ts packages/advanced/data-grid/__tests__/column-resize-model.spec.ts packages/advanced/data-grid/__tests__/controlled-state-model.spec.ts packages/advanced/data-grid/__tests__/row-model.spec.ts packages/advanced/data-grid/__tests__/selection-model.spec.ts packages/advanced/data-grid/__tests__/sort-model.spec.ts packages/advanced/data-grid/__tests__/grid-virtualizer.spec.ts packages/advanced/data-grid/__tests__/navigation-model.spec.ts packages/advanced/data-grid/__tests__/data-grid.spec.ts packages/advanced/data-grid/__tests__/data-grid-behavior-contract.spec.ts",
    "test:e2e": "vitest --root ../../.. --project e2e e2e/advanced/data-grid/data-grid-runtime.spec.ts e2e/advanced/data-grid/data-grid-accessibility-runtime.spec.ts"
  },
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.5 <0.2.0",
    "react": ">=18 || >=19",
    "vue": ">=3"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    },
    "vue": {
      "optional": true
    }
  },
  "dependencies": {
    "@zeus-js/runtime-dom": "0.1.0-beta.5",
    "@zeus-js/web-c-runtime": "0.2.0",
    "@zeus-web/virtual": "workspace:*",
    "@zeus-web/zeus-compat": "workspace:*"
  }
}
```

---

# 4. 修改 `packages/advanced/data-grid/src/types.ts`

替换完整文件：

```ts
import type { VirtualItem, VirtualRange } from '@zeus-web/virtual'

export type DataGridRowKey = string

export type DataGridCellValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date

export type DataGridRowData = Record<string, unknown>

export type DataGridColumnAlign = 'start' | 'center' | 'end'

export type DataGridSortDirection = 'asc' | 'desc'

export type DataGridSelectionMode = 'none' | 'single' | 'multiple'

export type DataGridNavigationKey =
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown'

export type DataGridAriaSort = 'ascending' | 'descending' | 'none'

export type DataGridViewportSizeSource = 'client' | 'fallback'

export interface DataGridColumn {
  id: string
  header?: string
  field?: string
  width?: number
  minWidth?: number
  maxWidth?: number
  align?: DataGridColumnAlign
  sortable?: boolean
  hidden?: boolean
  resizable?: boolean
}

export interface NormalizedDataGridColumn {
  id: string
  header: string
  field: string
  width: number
  minWidth: number
  maxWidth: number
  align: DataGridColumnAlign
  sortable: boolean
  hidden: boolean
  resizable: boolean
}

export interface DataGridRow {
  key: DataGridRowKey
  index: number
  data: DataGridRowData
}

export interface DataGridSortState {
  columnId: string
  direction: DataGridSortDirection
}

export interface DataGridSelectionState {
  mode: DataGridSelectionMode
  keys: DataGridRowKey[]
}

export type DataGridVirtualRange = VirtualRange

export type DataGridVirtualItem = VirtualItem<DataGridRow>

export interface DataGridVirtualSnapshot {
  range: DataGridVirtualRange
  items: DataGridVirtualItem[]
  totalSize: number
}

export interface DataGridActiveCell {
  rowIndex: number
  rowKey: DataGridRowKey
  columnId: string
  columnIndex: number
}

export interface DataGridCellContext {
  row: DataGridRow
  column: NormalizedDataGridColumn
  value: unknown
}

export interface DataGridViewportMeasurement {
  size: number
  source: DataGridViewportSizeSource
}

export interface DataGridRangeChangeDetail {
  range: DataGridVirtualRange
  items: DataGridVirtualItem[]
  scrollOffset: number
  viewportSize: number
  totalSize: number
}

export interface DataGridScrollOffsetChangeDetail {
  offset: number
  nativeEvent: Event
}

export interface DataGridViewportResizeDetail {
  viewportSize: number
  source: DataGridViewportSizeSource
  previousViewportSize: number
}

export interface DataGridSelectionChangeDetail {
  selection: DataGridSelectionState
  row?: DataGridRow
  nativeEvent?: Event
}

export interface DataGridSortChangeDetail {
  sort: DataGridSortState | undefined
  column?: NormalizedDataGridColumn
  nativeEvent?: Event
}

export interface DataGridColumnResizeStartDetail {
  column: NormalizedDataGridColumn
  width: number
  nativeEvent?: Event
}

export interface DataGridColumnResizeDetail {
  column: NormalizedDataGridColumn
  width: number
  previousWidth: number
  nativeEvent?: Event
}

export interface DataGridColumnResizeEndDetail {
  column: NormalizedDataGridColumn
  width: number
  nativeEvent?: Event
}

export interface DataGridActiveCellChangeDetail {
  activeCell: DataGridActiveCell | undefined
  previousActiveCell: DataGridActiveCell | undefined
  nativeEvent?: Event
}

export interface DataGridRowActionDetail {
  action: 'click' | 'dblclick' | 'keydown'
  row: DataGridRow
  nativeEvent: Event
}

export interface DataGridCellActionDetail {
  action: 'click' | 'dblclick' | 'keydown'
  cell: DataGridCellContext
  nativeEvent: Event
}

export type { DataGridProps, DataGridElement } from './components/data-grid'

export type { VirtualScrollAlign } from '@zeus-web/virtual'
```

---

# 5. 新增 `packages/advanced/data-grid/src/core/accessibility-model.ts`

```ts
import type {
  DataGridActiveCell,
  DataGridAriaSort,
  DataGridSelectionMode,
  DataGridSortState,
  NormalizedDataGridColumn,
} from '../types'

export function getDataGridAriaSort(
  column: NormalizedDataGridColumn,
  sort: DataGridSortState | undefined,
): DataGridAriaSort | undefined {
  if (!column.sortable) return undefined
  if (!sort || sort.columnId !== column.id) return 'none'

  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

export function getDataGridHeaderRowAriaIndex(): number {
  return 1
}

export function getDataGridDataRowAriaIndex(rowIndex: number): number {
  return rowIndex + 2
}

export function getDataGridColumnAriaIndex(columnIndex: number): number {
  return columnIndex + 1
}

export function getDataGridAriaMultiSelectable(
  selectionMode: DataGridSelectionMode,
): 'true' | undefined {
  return selectionMode === 'multiple' ? 'true' : undefined
}

export function getDataGridAriaSelected(
  selectionMode: DataGridSelectionMode,
  selected: boolean,
): 'true' | 'false' | undefined {
  if (selectionMode === 'none') return undefined
  return selected ? 'true' : 'false'
}

export function getDataGridCellTabIndex(
  keyboardNavigation: boolean,
  active: boolean,
): 0 | -1 | undefined {
  if (!keyboardNavigation) return undefined
  return active ? 0 : -1
}

export function getDataGridResizeHandleAriaLabel(
  column: NormalizedDataGridColumn,
): string {
  return `Resize ${column.header || column.id} column`
}

export function getDataGridActiveDescendant(
  activeCell: DataGridActiveCell | undefined,
  getId: (activeCell: DataGridActiveCell) => string | undefined,
): string | undefined {
  if (!activeCell) return undefined
  return getId(activeCell)
}
```

---

# 6. 新增 `packages/advanced/data-grid/src/core/viewport-measure-model.ts`

```ts
import type { DataGridViewportMeasurement } from '../types'

export interface ResolveDataGridViewportSizeOptions {
  clientHeight: number
  rowHeight: number
  rowCount: number
  fallbackRowCount?: number
}

export interface DataGridViewportMeasureController {
  getMeasurement: () => DataGridViewportMeasurement
  measure: (
    clientHeight: number,
    rowHeight: number,
    rowCount: number,
  ) => DataGridViewportMeasurement
}

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.floor(value)
}

export function resolveDataGridViewportMeasurement(
  options: ResolveDataGridViewportSizeOptions,
): DataGridViewportMeasurement {
  const rowHeight = normalizePositiveInteger(options.rowHeight, 40)
  const rowCount = Math.max(0, Math.floor(options.rowCount))
  const fallbackRowCount = normalizePositiveInteger(
    options.fallbackRowCount ?? 10,
    10,
  )
  const clientHeight = Math.floor(options.clientHeight)

  if (Number.isFinite(clientHeight) && clientHeight > 0) {
    return {
      size: clientHeight,
      source: 'client',
    }
  }

  return {
    size: rowHeight * Math.max(1, Math.min(rowCount || 1, fallbackRowCount)),
    source: 'fallback',
  }
}

export function shouldEmitDataGridViewportResize(
  current: DataGridViewportMeasurement,
  next: DataGridViewportMeasurement,
): boolean {
  return current.size !== next.size || current.source !== next.source
}

export function createDataGridViewportMeasureController(
  initial: DataGridViewportMeasurement = {
    size: 40,
    source: 'fallback',
  },
): DataGridViewportMeasureController {
  let measurement = initial

  return {
    getMeasurement(): DataGridViewportMeasurement {
      return measurement
    },

    measure(
      clientHeight: number,
      rowHeight: number,
      rowCount: number,
    ): DataGridViewportMeasurement {
      measurement = resolveDataGridViewportMeasurement({
        clientHeight,
        rowHeight,
        rowCount,
      })

      return measurement
    },
  }
}
```

---

# 7. 修改 `packages/advanced/data-grid/src/core/index.ts`

```ts
export * from './accessibility-model'
export * from './column-model'
export * from './column-resize-model'
export * from './controlled-state-model'
export * from './grid-virtualizer'
export * from './navigation-model'
export * from './row-model'
export * from './selection-model'
export * from './sort-model'
export * from './viewport-measure-model'
```

---

# 8. 修改 `packages/advanced/data-grid/src/components/data-grid.tsx`

`data-grid.tsx` 很大，不建议再整文件替换。下面是最小完整 patch，按块替换即可。

## 8.1 增加类型导入

在 types import 里加入：

```ts
DataGridViewportMeasurement,
DataGridViewportResizeDetail,
```

也就是这段：

```ts
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
```

## 8.2 增加 core 导入

在 `../core` import 里加入：

```ts
createDataGridViewportMeasureController,
getDataGridActiveDescendant,
getDataGridAriaMultiSelectable,
getDataGridAriaSelected,
getDataGridAriaSort,
getDataGridCellTabIndex,
getDataGridColumnAriaIndex,
getDataGridDataRowAriaIndex,
getDataGridHeaderRowAriaIndex,
getDataGridResizeHandleAriaLabel,
shouldEmitDataGridViewportResize,
```

完整导入块建议改成：

```ts
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
```

## 8.3 修改 `DataGridElement`

在 `moveActiveCell` 后追加：

```ts
  focusCell: (rowKey: DataGridRowKey, columnId: string) => void
  focusActiveCell: () => void
  refreshViewport: () => void
```

即：

```ts
  getActiveCell: () => DataGridActiveCell | undefined
  moveActiveCell: (key: DataGridNavigationKey, nativeEvent?: Event) => void
  focusCell: (rowKey: DataGridRowKey, columnId: string) => void
  focusActiveCell: () => void
  refreshViewport: () => void
}
```

## 8.4 修改 `DataGridEmits`

追加：

```ts
viewportResize: EventDefinition<DataGridViewportResizeDetail>
```

完整相关片段：

```ts
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
```

## 8.5 替换 viewport size helpers

把当前：

```ts
function getViewportSize(viewport: HTMLElement | undefined): number {
  return viewport?.clientHeight ?? 0
}
```

替换为：

```ts
function getViewportClientHeight(viewport: HTMLElement | undefined): number {
  return viewport?.clientHeight ?? 0
}
```

## 8.6 增加 selector escape helper

放到 `isNavigationKey()` 后面：

```ts
function escapeDataGridSelectorValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
```

## 8.7 增加 viewport measure state

在 setup 状态区：

```ts
let viewport: HTMLElement | undefined
let resizeSession: ResizeSession | undefined
```

替换为：

```ts
let viewport: HTMLElement | undefined
let viewportResizeObserver: ResizeObserver | undefined
let resizeSession: ResizeSession | undefined
```

在 `const scheduler = createRafScheduler()` 后追加：

```ts
const viewportMeasure = createDataGridViewportMeasureController()
let viewportMeasurement: DataGridViewportMeasurement = viewportMeasure.measure(
  0,
  resolveRowHeight(props),
  visibleRows.length,
)
```

## 8.8 新增 viewport measure / focus 方法

放在 `readControlledStateSources()` 后面：

```ts
const measureViewport = (): DataGridViewportMeasurement => {
  const previousViewportSize = viewportMeasurement.size
  const nextMeasurement = viewportMeasure.measure(
    getViewportClientHeight(viewport),
    resolveRowHeight(props),
    visibleRows.length,
  )

  if (shouldEmitDataGridViewportResize(viewportMeasurement, nextMeasurement)) {
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

const connectViewportObserver = (element: HTMLElement): void => {
  viewportResizeObserver?.disconnect()

  if (typeof ResizeObserver === 'undefined') return

  viewportResizeObserver = new ResizeObserver(() => {
    measureViewport()
    scheduleUpdateRange()
  })
  viewportResizeObserver.observe(element)
}
```

## 8.9 替换所有 `getViewportSize(viewport)`

把所有：

```ts
getViewportSize(viewport)
```

替换成：

```ts
getResolvedViewportSize()
```

包括：

```ts
virtualizer.getSnapshot(getScrollOffset(viewport), getResolvedViewportSize())
```

```ts
const viewportSize = getResolvedViewportSize()
```

```ts
Math.floor(getResolvedViewportSize() / resolveRowHeight(props))
```

```ts
virtualizer.getOffsetForIndex(index, align, getResolvedViewportSize())
```

## 8.10 修改 `updateRange()`

确保先 measure：

```ts
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
```

## 8.11 修改 `emitActiveCell()`

在 `ctx.emit.activeCellChange(...)` 后追加聚焦：

```ts
focusActiveCellElement()
```

完整：

```ts
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

  focusActiveCellElement()
}
```

## 8.12 在 `ctx.expose` 里新增方法

在 `moveActiveCell(...)` 后追加：

```ts
    focusCell(rowKey: DataGridRowKey, columnId: string): void {
      setActiveCellByKey(rowKey, columnId)
      focusCellElement(rowKey, columnId)
    },

    focusActiveCell(): void {
      rebuildModels()
      focusActiveCellElement()
    },

    refreshViewport(): void {
      measureViewport()
      updateRange()
    },
```

## 8.13 修改 viewport render

当前 viewport：

```tsx
aria-activedescendant={() => getDataGridActiveCellId(activeCell)}
```

替换为：

```tsx
aria-activedescendant={() =>
  getDataGridActiveDescendant(activeCell, getDataGridActiveCellId)
}
aria-multiselectable={() =>
  getDataGridAriaMultiSelectable(resolveSelectionMode(props.selectionMode))
}
```

完整片段：

```tsx
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
    getDataGridAriaMultiSelectable(resolveSelectionMode(props.selectionMode))
  }
  onScroll={(nativeEvent: Event) => {
    scheduleUpdateRange(nativeEvent)
  }}
  ref={(element: HTMLElement | null) => {
    if (element) {
      viewport = element
      connectViewportObserver(element)
      measureViewport()
      scheduleUpdateRange()
    }
  }}
>
```

## 8.14 修改 header row

增加：

```tsx
aria-rowindex={() => String(getDataGridHeaderRowAriaIndex())}
```

完整：

```tsx
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
```

## 8.15 修改 header cell

在 `role="columnheader"` 附近增加：

```tsx
aria-colindex={() => String(getDataGridColumnAriaIndex(index))}
aria-sort={() => getDataGridAriaSort(column, sort)}
```

需要把 map 参数从：

```tsx
{visibleColumns.map(column => (
```

改成：

```tsx
{visibleColumns.map((column, index) => (
```

完整片段：

```tsx
{visibleColumns.map((column, index) => (
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
```

## 8.16 修改 resize handle

增加 `aria-label`：

```tsx
aria-label={() => getDataGridResizeHandleAriaLabel(column)}
```

完整相关片段：

```tsx
<span
  part="resize-handle"
  data-slot="data-grid-resize-handle"
  role="separator"
  aria-label={() => getDataGridResizeHandleAriaLabel(column)}
  aria-orientation="vertical"
  aria-valuenow={() => String(column.width)}
  aria-valuemin={() => String(column.minWidth)}
  aria-valuemax={() => String(column.maxWidth)}
```

## 8.17 修改 row render

在 row 上增加：

```tsx
aria-rowindex={() => String(getDataGridDataRowAriaIndex(row.index))}
aria-selected={() =>
  getDataGridAriaSelected(
    resolveSelectionMode(props.selectionMode),
    selection.isSelected(row.key),
  )
}
```

完整片段：

```tsx
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
  aria-rowindex={() => String(getDataGridDataRowAriaIndex(row.index))}
  aria-selected={() =>
    getDataGridAriaSelected(
      resolveSelectionMode(props.selectionMode),
      selection.isSelected(row.key),
    )
  }
```

## 8.18 修改 cell render

把 `visibleColumns.map(column => { ... })` 保持当前的 columnIndex 计算也可以，但建议改为更直接：

```tsx
{visibleColumns.map((column, columnIndex) => {
```

然后移除内部 `findIndex`。

在 cell 上增加：

```tsx
aria-colindex={() => String(getDataGridColumnAriaIndex(columnIndex))}
aria-selected={() =>
  getDataGridAriaSelected(
    resolveSelectionMode(props.selectionMode),
    selection.isSelected(row.key),
  )
}
onFocus={(nativeEvent: FocusEvent) => {
  setActiveCellByKey(row.key, column.id, nativeEvent)
}}
```

`tabindex` 改为 helper：

```tsx
tabindex={() =>
  getDataGridCellTabIndex(
    props.keyboardNavigation !== false,
    isActive,
  )
}
```

完整相关片段：

```tsx
{visibleColumns.map((column, columnIndex) => {
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
      aria-colindex={() => String(getDataGridColumnAriaIndex(columnIndex))}
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
        setActiveCellByKey(row.key, column.id, nativeEvent)
      }}
      onClick={(nativeEvent: Event) => {
        setActiveCellByKey(row.key, column.id, nativeEvent)
        emitCellAction('click', row, column, nativeEvent)
      }}
```

## 8.19 修改 emits

在 `emits` 中追加：

```ts
viewportResize: event<DataGridViewportResizeDetail>(),
```

完整：

```ts
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
```

---

# 9. 新增 `packages/advanced/data-grid/__tests__/accessibility-model.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import type { NormalizedDataGridColumn } from '../src'

import {
  getDataGridActiveDescendant,
  getDataGridAriaMultiSelectable,
  getDataGridAriaSelected,
  getDataGridAriaSort,
  getDataGridCellTabIndex,
  getDataGridColumnAriaIndex,
  getDataGridDataRowAriaIndex,
  getDataGridHeaderRowAriaIndex,
  getDataGridResizeHandleAriaLabel,
} from '../src/core'

const sortableColumn: NormalizedDataGridColumn = {
  id: 'name',
  header: 'Name',
  field: 'name',
  width: 160,
  minWidth: 48,
  maxWidth: 1000,
  align: 'start',
  sortable: true,
  hidden: false,
  resizable: true,
}

const plainColumn: NormalizedDataGridColumn = {
  ...sortableColumn,
  id: 'role',
  header: 'Role',
  sortable: false,
}

describe('accessibility model', () => {
  it('resolves aria-sort for sortable columns', () => {
    expect(getDataGridAriaSort(sortableColumn, undefined)).toBe('none')

    expect(
      getDataGridAriaSort(sortableColumn, {
        columnId: 'name',
        direction: 'asc',
      }),
    ).toBe('ascending')

    expect(
      getDataGridAriaSort(sortableColumn, {
        columnId: 'name',
        direction: 'desc',
      }),
    ).toBe('descending')

    expect(getDataGridAriaSort(plainColumn, undefined)).toBeUndefined()
  })

  it('resolves row and column aria indexes', () => {
    expect(getDataGridHeaderRowAriaIndex()).toBe(1)
    expect(getDataGridDataRowAriaIndex(0)).toBe(2)
    expect(getDataGridDataRowAriaIndex(3)).toBe(5)
    expect(getDataGridColumnAriaIndex(0)).toBe(1)
    expect(getDataGridColumnAriaIndex(2)).toBe(3)
  })

  it('resolves selection aria state', () => {
    expect(getDataGridAriaMultiSelectable('none')).toBeUndefined()
    expect(getDataGridAriaMultiSelectable('single')).toBeUndefined()
    expect(getDataGridAriaMultiSelectable('multiple')).toBe('true')

    expect(getDataGridAriaSelected('none', true)).toBeUndefined()
    expect(getDataGridAriaSelected('single', true)).toBe('true')
    expect(getDataGridAriaSelected('single', false)).toBe('false')
    expect(getDataGridAriaSelected('multiple', true)).toBe('true')
  })

  it('resolves cell tabindex', () => {
    expect(getDataGridCellTabIndex(false, true)).toBeUndefined()
    expect(getDataGridCellTabIndex(true, true)).toBe(0)
    expect(getDataGridCellTabIndex(true, false)).toBe(-1)
  })

  it('resolves resize handle label', () => {
    expect(getDataGridResizeHandleAriaLabel(sortableColumn)).toBe(
      'Resize Name column',
    )
  })

  it('resolves active descendant', () => {
    expect(
      getDataGridActiveDescendant(
        {
          rowIndex: 0,
          rowKey: 'u1',
          columnId: 'name',
          columnIndex: 0,
        },
        activeCell => `cell-${activeCell.rowKey}-${activeCell.columnId}`,
      ),
    ).toBe('cell-u1-name')

    expect(
      getDataGridActiveDescendant(undefined, () => 'unused'),
    ).toBeUndefined()
  })
})
```

---

# 10. 新增 `packages/advanced/data-grid/__tests__/viewport-measure-model.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import {
  createDataGridViewportMeasureController,
  resolveDataGridViewportMeasurement,
  shouldEmitDataGridViewportResize,
} from '../src/core'

describe('viewport measure model', () => {
  it('uses client height when available', () => {
    expect(
      resolveDataGridViewportMeasurement({
        clientHeight: 240,
        rowHeight: 40,
        rowCount: 100,
      }),
    ).toEqual({
      size: 240,
      source: 'client',
    })
  })

  it('falls back to visible row estimate when client height is zero', () => {
    expect(
      resolveDataGridViewportMeasurement({
        clientHeight: 0,
        rowHeight: 40,
        rowCount: 100,
      }),
    ).toEqual({
      size: 400,
      source: 'fallback',
    })
  })

  it('caps fallback by row count', () => {
    expect(
      resolveDataGridViewportMeasurement({
        clientHeight: 0,
        rowHeight: 40,
        rowCount: 3,
      }),
    ).toEqual({
      size: 120,
      source: 'fallback',
    })
  })

  it('keeps at least one row fallback for empty data', () => {
    expect(
      resolveDataGridViewportMeasurement({
        clientHeight: 0,
        rowHeight: 40,
        rowCount: 0,
      }),
    ).toEqual({
      size: 40,
      source: 'fallback',
    })
  })

  it('detects viewport resize changes', () => {
    expect(
      shouldEmitDataGridViewportResize(
        {
          size: 40,
          source: 'fallback',
        },
        {
          size: 80,
          source: 'fallback',
        },
      ),
    ).toBe(true)

    expect(
      shouldEmitDataGridViewportResize(
        {
          size: 80,
          source: 'fallback',
        },
        {
          size: 80,
          source: 'client',
        },
      ),
    ).toBe(true)

    expect(
      shouldEmitDataGridViewportResize(
        {
          size: 80,
          source: 'client',
        },
        {
          size: 80,
          source: 'client',
        },
      ),
    ).toBe(false)
  })

  it('tracks latest measurement in controller', () => {
    const controller = createDataGridViewportMeasureController()

    expect(controller.measure(0, 40, 2)).toEqual({
      size: 80,
      source: 'fallback',
    })

    expect(controller.measure(240, 40, 2)).toEqual({
      size: 240,
      source: 'client',
    })

    expect(controller.getMeasurement()).toEqual({
      size: 240,
      source: 'client',
    })
  })
})
```

---

# 11. 修改 `packages/advanced/data-grid/__tests__/data-grid.spec.ts`

在 `events` 断言中追加：

```ts
viewportResize: {
  name: 'viewport-resize',
  reactName: 'onViewportResize',
},
```

在 `methods` 断言中追加：

```ts
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
```

新增下面三个测试：

```ts
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
```

---

# 12. 新增 `e2e/advanced/data-grid/data-grid-accessibility-runtime.spec.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  DataGridActiveCellChangeDetail,
  DataGridRangeChangeDetail,
} from './data-grid-runtime-harness'

import {
  cleanupDataGridFixtures,
  collectEvents,
  getCell,
  getHeaderCell,
  getViewport,
  mountDataGrid,
  nextFrame,
  runtimeColumns,
  runtimeRows,
  setElementClientHeight,
} from './data-grid-runtime-harness'

describe('zw-data-grid accessibility runtime', () => {
  afterEach(() => {
    cleanupDataGridFixtures()
    vi.restoreAllMocks()
  })

  it('renders grid aria metadata', async () => {
    const grid = await mountDataGrid({
      selectionMode: 'multiple',
      selectedKeys: ['u1'],
      activeRowKey: 'u1',
      activeColumnId: 'name',
    })
    const viewport = getViewport(grid)

    expect(viewport.getAttribute('role')).toBe('grid')
    expect(viewport.getAttribute('aria-rowcount')).toBe('4')
    expect(viewport.getAttribute('aria-colcount')).toBe('3')
    expect(viewport.getAttribute('aria-multiselectable')).toBe('true')
    expect(viewport.getAttribute('aria-activedescendant')).toBe(
      'zg-cell-u1-name',
    )
  })

  it('renders header aria-sort and aria-colindex', async () => {
    const grid = await mountDataGrid({
      sortColumn: 'age',
      sortDirection: 'desc',
    })

    expect(getHeaderCell(grid, 'name').getAttribute('aria-sort')).toBe('none')
    expect(getHeaderCell(grid, 'age').getAttribute('aria-sort')).toBe(
      'descending',
    )
    expect(getHeaderCell(grid, 'name').getAttribute('aria-colindex')).toBe('1')
    expect(getHeaderCell(grid, 'age').getAttribute('aria-colindex')).toBe('2')
  })

  it('renders row and cell aria indexes and selected state', async () => {
    const grid = await mountDataGrid({
      selectionMode: 'multiple',
      selectedKeys: ['u2'],
    })

    const row = grid.querySelector<HTMLElement>(
      '[data-slot="data-grid-row"][data-row-key="u2"]',
    )

    expect(row?.getAttribute('aria-rowindex')).toBe('3')
    expect(row?.getAttribute('aria-selected')).toBe('true')

    const cell = getCell(grid, 'u2', 'age')

    expect(cell.getAttribute('aria-colindex')).toBe('2')
    expect(cell.getAttribute('aria-selected')).toBe('true')
  })

  it('renders resize handle label and value metadata', async () => {
    const grid = await mountDataGrid({
      columns: runtimeColumns,
      resizable: true,
    })

    const handle = getHeaderCell(grid, 'name').querySelector<HTMLElement>(
      '[data-slot="data-grid-resize-handle"]',
    )

    expect(handle?.getAttribute('role')).toBe('separator')
    expect(handle?.getAttribute('aria-label')).toBe('Resize Name column')
    expect(handle?.getAttribute('aria-valuenow')).toBe('180')
    expect(handle?.getAttribute('aria-valuemin')).toBe('80')
    expect(handle?.getAttribute('aria-valuemax')).toBe('260')
  })

  it('focusCell updates active cell and moves DOM focus', async () => {
    const grid = await mountDataGrid({
      activeRowKey: 'u1',
      activeColumnId: 'name',
    })
    const collector = collectEvents<DataGridActiveCellChangeDetail>(
      grid,
      'active-cell-change',
    )

    grid.focusCell('u2', 'age')

    await nextFrame()

    const active = grid.getActiveCell()
    const cell = getCell(grid, 'u2', 'age')

    expect(active).toMatchObject({
      rowKey: 'u2',
      columnId: 'age',
    })
    expect(document.activeElement).toBe(cell)
    expect(cell.getAttribute('data-active')).toBe('')
    expect(collector.events.at(-1)?.detail.activeCell).toMatchObject({
      rowKey: 'u2',
      columnId: 'age',
    })

    collector.dispose()
  })

  it('focusActiveCell moves DOM focus to the current active cell', async () => {
    const grid = await mountDataGrid({
      activeRowKey: 'u3',
      activeColumnId: 'role',
    })

    grid.focusActiveCell()

    await nextFrame()

    expect(document.activeElement).toBe(getCell(grid, 'u3', 'role'))
  })

  it('uses fallback viewport size when clientHeight is zero', async () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      id: `r${index}`,
      name: `Row ${index}`,
      age: index,
      role: 'Runtime',
    }))

    const grid = await mountDataGrid({
      rows,
      columns: runtimeColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 1,
    })
    const collector = collectEvents<DataGridRangeChangeDetail>(
      grid,
      'range-change',
    )

    grid.refreshViewport()

    await nextFrame()

    expect(grid.getRange()).toEqual({
      start: 0,
      end: 9,
      overscanStart: 0,
      overscanEnd: 10,
    })
    expect(grid.getItems().map(item => item.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
    expect(collector.events.at(-1)?.detail.viewportSize).toBe(400)

    collector.dispose()
  })

  it('emits viewport-resize when viewport size changes', async () => {
    const grid = await mountDataGrid({
      rows: runtimeRows,
      columns: runtimeColumns,
      virtual: true,
      rowHeight: 40,
    })
    const viewport = getViewport(grid)
    const collector = collectEvents(grid, 'viewport-resize')

    setElementClientHeight(viewport, 200)
    grid.refreshViewport()

    await nextFrame()

    expect(collector.events.at(-1)?.detail).toMatchObject({
      viewportSize: 200,
      source: 'client',
    })

    collector.dispose()
  })
})
```

---

# 13. 新增 `docs/advanced/design/phase10.md`

````md
# Phase 10：Data Grid Runtime Hardening + Accessibility

## 目标

Phase 10 不扩展 DataGrid 的业务功能，而是把已经存在的 runtime 能力做硬化：

1. viewport size fallback
2. ResizeObserver refresh
3. focus management
4. grid aria metadata
5. runtime accessibility tests

## 范围

新增：

```txt
packages/advanced/data-grid/src/core/accessibility-model.ts
packages/advanced/data-grid/src/core/viewport-measure-model.ts
packages/advanced/data-grid/__tests__/accessibility-model.spec.ts
packages/advanced/data-grid/__tests__/viewport-measure-model.spec.ts
e2e/advanced/data-grid/data-grid-accessibility-runtime.spec.ts
docs/advanced/design/phase10.md
```
````

修改：

```txt
packages/advanced/data-grid/package.json
packages/advanced/data-grid/src/types.ts
packages/advanced/data-grid/src/core/index.ts
packages/advanced/data-grid/src/components/data-grid.tsx
packages/advanced/data-grid/__tests__/data-grid.spec.ts
```

## 非目标

本阶段不做：

1. 不做列虚拟。
2. 不做编辑器。
3. 不做过滤器。
4. 不做树表。
5. 不做分组。
6. 不做服务端数据源。
7. 不改 registry product layer。
8. 不改 React/Vue wrapper。

## Runtime Hardening

### Viewport Fallback

之前 DataGrid 依赖 `viewport.clientHeight`。当 `clientHeight=0` 时，virtual range 可能为空。

Phase 10 增加 fallback：

```txt
fallbackViewportSize = rowHeight * min(rowCount, 10)
```

空数据至少保留一行高度：

```txt
fallbackViewportSize = rowHeight
```

### ResizeObserver

当 viewport 尺寸变化时：

```txt
measureViewport()
scheduleUpdateRange()
emit viewport-resize
```

### refreshViewport()

暴露方法：

```ts
refreshViewport(): void
```

用于测试、布局切换、隐藏容器显示后手动刷新。

## Focus Management

新增：

```ts
focusCell(rowKey: string, columnId: string): void
focusActiveCell(): void
```

行为：

1. `focusCell()` 会设置 active cell。
2. `focusCell()` 会把 DOM focus 移到目标 cell。
3. `focusActiveCell()` 会聚焦当前 active cell。
4. active cell 变化后会自动尝试聚焦目标 cell。

## Accessibility

新增：

```txt
aria-sort
aria-rowindex
aria-colindex
aria-selected
aria-multiselectable
aria-label on resize handle
```

Grid：

```txt
role="grid"
aria-rowcount
aria-colcount
aria-activedescendant
aria-multiselectable
```

Header：

```txt
role="row"
aria-rowindex="1"
role="columnheader"
aria-colindex
aria-sort
```

Rows：

```txt
role="row"
aria-rowindex = row.index + 2
aria-selected
```

Cells：

```txt
role="gridcell"
aria-colindex
aria-selected
tabindex
```

Resize handle：

```txt
role="separator"
aria-label="Resize {header} column"
aria-valuenow
aria-valuemin
aria-valuemax
```

## 测试

新增 core 测试：

```txt
accessibility-model.spec.ts
viewport-measure-model.spec.ts
```

新增 runtime e2e：

```txt
data-grid-accessibility-runtime.spec.ts
```

覆盖：

1. grid aria metadata
2. header aria-sort
3. row/cell aria index
4. selected state
5. resize handle aria label/value
6. focusCell
7. focusActiveCell
8. fallback viewport size
9. viewport-resize event

## 验收

```bash
pnpm --filter @zeus-web/data-grid check
pnpm --filter @zeus-web/data-grid test:unit
pnpm --filter @zeus-web/data-grid test:e2e
pnpm --filter @zeus-web/data-grid test
pnpm --filter @zeus-web/data-grid build

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm check:product-contract
```

````

---

# 14. 验收命令

```bash
pnpm --filter @zeus-web/data-grid check
pnpm --filter @zeus-web/data-grid test:unit
pnpm --filter @zeus-web/data-grid test:e2e
pnpm --filter @zeus-web/data-grid test
pnpm --filter @zeus-web/data-grid build

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm check:product-contract
pnpm release:plan
````

---

# 15. Phase 10 完成标准

```txt
必须满足:
  1. viewport clientHeight=0 时 virtual range 不为空
  2. ResizeObserver 变化会触发 range refresh
  3. refreshViewport() 可手动刷新 viewport measurement
  4. focusCell() 可设置 active cell 并聚焦 DOM cell
  5. focusActiveCell() 可聚焦当前 active cell
  6. header 有 aria-sort / aria-colindex
  7. row 有 aria-rowindex / aria-selected
  8. cell 有 aria-colindex / aria-selected
  9. grid 有 aria-multiselectable
  10. resize handle 有 aria-label / aria-valuenow / aria-valuemin / aria-valuemax
  11. core tests + runtime e2e 全部通过
```

---

# 16. 下一阶段建议

Phase 11 建议回到你最初路线里的 **RevoGrid Adapter / Interop Validation**：

```txt
Phase 11: RevoGrid Adapter / Interop Validation

目标:
  1. 新增 @zeus-web/revogrid-adapter
  2. 用同一套 DataGrid column/row 数据结构映射到 RevoGrid
  3. 验证 Zeus DataGrid Lite 与 RevoGrid 的功能边界
  4. 形成“轻量自研 DataGrid + 重型 Adapter”的路线
  5. 不把自研 DataGrid 做成 AG Grid
```

这样能回到你原始 advanced roadmap：DataGrid 做轻量基础能力，复杂表格通过 adapter 验证，不继续无限扩自研表格。
