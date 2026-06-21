下面给出 **Phase 11：RevoGrid Adapter / Interop Validation** 的详细设计与完整代码，包含完整单元测试。

Phase 11 的定位不是继续把 `@zeus-web/data-grid` 做成 AG Grid，而是走你最初路线里的 **轻量自研 DataGrid + 重型表格 Adapter**。当前 `@zeus-web/data-grid` 根入口已经导出组件、core 和全部类型，适合作为 adapter 的类型来源。 同时 advanced package contract 要求高级包必须有 `src/index.ts / src/types.ts / src/core / src/components`，并且必须导出 `. / ./wc / ./wc/auto / ./react / ./vue / ./vue/global / ./custom-elements.json / ./zeus.components.json`。 所以 Phase 11 会新增一个正式 advanced 包：`@zeus-web/revogrid-adapter`。

---

# 1. Phase 11 目标

```txt id="x57vky"
Phase 11: RevoGrid Adapter / Interop Validation

目标:
  1. 新增 @zeus-web/revogrid-adapter advanced 包
  2. 复用 @zeus-web/data-grid 的 DataGridColumn / DataGridRowData / DataGridSortState 类型
  3. 将 Zeus DataGrid column/row/sort/selection 映射为 RevoGrid-compatible shape
  4. 不直接依赖 @revolist/revogrid，避免版本和体积绑定
  5. 提供 zw-revogrid-adapter Web Component
  6. 暴露 getRevoColumns / getRevoSource / getRevoSort / getRevoSelection / refresh 等方法
  7. 提供 adapter-ready / adapter-change 事件
  8. 用单元测试验证 column / row / sort / selection / state 映射
  9. 用 analyzer/source contract 验证组件协议
```

---

# 2. 设计原则

```txt id="f4zq8h"
1. RevoGrid 是外部重型表格，不进入 Zeus DataGrid core
2. Adapter 只做数据结构桥接，不包装第三方实现细节
3. 不引入 @revolist/revogrid dependency / peerDependency
4. 只渲染 <revo-grid> 作为自定义元素目标
5. 如果用户项目安装并注册了 RevoGrid，adapter 会把 columns/source/sorting 等属性设置到该元素上
6. 如果用户没装 RevoGrid，adapter 仍可构建、测试、生成 wrapper，只是 <revo-grid> 不具备真实表格能力
```

这样能避免把自研 DataGrid 拖进“无限扩功能”的路线，同时为后续复杂表格验证留出口。

---

# 3. 文件清单

```txt id="s9lp23"
新增:
  packages/advanced/revogrid-adapter/package.json
  packages/advanced/revogrid-adapter/tsconfig.json
  packages/advanced/revogrid-adapter/src/index.ts
  packages/advanced/revogrid-adapter/src/types.ts
  packages/advanced/revogrid-adapter/src/core/index.ts
  packages/advanced/revogrid-adapter/src/core/column-map.ts
  packages/advanced/revogrid-adapter/src/core/row-map.ts
  packages/advanced/revogrid-adapter/src/core/sort-map.ts
  packages/advanced/revogrid-adapter/src/core/selection-map.ts
  packages/advanced/revogrid-adapter/src/core/adapter-state.ts
  packages/advanced/revogrid-adapter/src/components/revogrid-adapter.tsx

  packages/advanced/revogrid-adapter/__tests__/column-map.spec.ts
  packages/advanced/revogrid-adapter/__tests__/row-map.spec.ts
  packages/advanced/revogrid-adapter/__tests__/sort-map.spec.ts
  packages/advanced/revogrid-adapter/__tests__/selection-map.spec.ts
  packages/advanced/revogrid-adapter/__tests__/adapter-state.spec.ts
  packages/advanced/revogrid-adapter/__tests__/revogrid-adapter.spec.ts

  docs/advanced/design/phase11.md
```

不需要改 `pnpm-workspace.yaml`，因为 advanced contract 已要求 workspace 包含 `packages/advanced/*`。

---

# 4. 新增 `packages/advanced/revogrid-adapter/package.json`

```json id="xa1t22"
{
  "name": "@zeus-web/revogrid-adapter",
  "type": "module",
  "version": "0.0.0",
  "description": "RevoGrid-compatible adapter for Zeus Web DataGrid models.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/baicie/zeus-ui.git",
    "directory": "packages/advanced/revogrid-adapter"
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
    "test": "vitest --root ../../.. --project unit packages/advanced/revogrid-adapter/__tests__/column-map.spec.ts packages/advanced/revogrid-adapter/__tests__/row-map.spec.ts packages/advanced/revogrid-adapter/__tests__/sort-map.spec.ts packages/advanced/revogrid-adapter/__tests__/selection-map.spec.ts packages/advanced/revogrid-adapter/__tests__/adapter-state.spec.ts packages/advanced/revogrid-adapter/__tests__/revogrid-adapter.spec.ts"
  },
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.5 <0.2.0"
  },
  "dependencies": {
    "@zeus-js/runtime-dom": "0.1.0-beta.5",
    "@zeus-js/web-c-runtime": "0.2.0",
    "@zeus-web/data-grid": "workspace:*",
    "@zeus-web/zeus-compat": "workspace:*"
  }
}
```

---

# 5. 新增 `packages/advanced/revogrid-adapter/tsconfig.json`

```json id="j6e77f"
{
  "extends": "../../../scripts/config/tsconfig.zeus-jsx.json",
  "compilerOptions": {
    "rootDir": "../../",
    "baseUrl": "../../../"
  },
  "include": ["src"]
}
```

---

# 6. 新增 `packages/advanced/revogrid-adapter/src/types.ts`

```ts id="h90hzs"
import type {
  DataGridColumn,
  DataGridRowData,
  DataGridRowKey,
  DataGridSelectionMode,
  DataGridSortDirection,
  DataGridSortState,
} from '@zeus-web/data-grid'

export type {
  DataGridColumn,
  DataGridRowData,
  DataGridRowKey,
  DataGridSelectionMode,
  DataGridSortDirection,
  DataGridSortState,
}

export const ZEUS_REVO_ROW_KEY = '__zeusRowKey'
export const ZEUS_REVO_ROW_INDEX = '__zeusRowIndex'
export const ZEUS_REVO_COLUMN_ID = '__zeusColumnId'

export interface RevoGridCompatibleColumn {
  prop: string
  name: string
  size?: number
  minSize?: number
  maxSize?: number
  sortable?: boolean
  readonly?: boolean
  pin?: 'colPinStart' | 'colPinEnd'
  cellProperties?: Record<string, unknown>
  [ZEUS_REVO_COLUMN_ID]?: string
}

export interface RevoGridCompatibleSourceRow extends Record<string, unknown> {
  [ZEUS_REVO_ROW_KEY]: DataGridRowKey
  [ZEUS_REVO_ROW_INDEX]: number
}

export interface RevoGridCompatibleSort {
  prop: string
  order: DataGridSortDirection
  [ZEUS_REVO_COLUMN_ID]?: string
}

export interface RevoGridCompatibleSelection {
  mode: DataGridSelectionMode
  rowKeys: DataGridRowKey[]
  rowIndexes: number[]
}

export interface RevoGridAdapterColumnMapOptions {
  readonly?: boolean
  includeHidden?: boolean
}

export interface RevoGridAdapterRowMapOptions {
  getRowKey?: (row: DataGridRowData, index: number) => DataGridRowKey
}

export interface RevoGridAdapterStateOptions {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  selectedKeys?: DataGridRowKey[]
  selectionMode?: DataGridSelectionMode
  sortColumn?: string
  sortDirection?: DataGridSortDirection
  readonly?: boolean
  includeHiddenColumns?: boolean
  getRowKey?: (row: DataGridRowData, index: number) => DataGridRowKey
}

export interface RevoGridAdapterState {
  columns: RevoGridCompatibleColumn[]
  source: RevoGridCompatibleSourceRow[]
  sort: RevoGridCompatibleSort | undefined
  selection: RevoGridCompatibleSelection
}

export interface RevoGridElementLike extends HTMLElement {
  columns?: RevoGridCompatibleColumn[]
  source?: RevoGridCompatibleSourceRow[]
  sorting?: RevoGridCompatibleSort | undefined
  selectedRows?: number[]
  readonly?: boolean
  refresh?: () => void
}

export interface RevoGridAdapterReadyDetail {
  grid: RevoGridElementLike | undefined
  state: RevoGridAdapterState
}

export interface RevoGridAdapterChangeDetail {
  grid: RevoGridElementLike | undefined
  state: RevoGridAdapterState
}

export type RevoGridAdapterProps = RevoGridAdapterStateOptions & {
  ariaLabel?: string
}
```

---

# 7. 新增 `packages/advanced/revogrid-adapter/src/core/column-map.ts`

```ts id="cxriha"
import type {
  DataGridColumn,
  RevoGridAdapterColumnMapOptions,
  RevoGridCompatibleColumn,
} from '../types'

import { ZEUS_REVO_COLUMN_ID } from '../types'

function normalizeColumnWidth(value: number | undefined): number | undefined {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return undefined
  }

  return Math.floor(value)
}

export function getRevoGridColumnProp(column: DataGridColumn): string {
  return column.field || column.id
}

export function mapDataGridColumnToRevoGridColumn(
  column: DataGridColumn,
  options: RevoGridAdapterColumnMapOptions = {},
): RevoGridCompatibleColumn {
  const prop = getRevoGridColumnProp(column)

  return {
    prop,
    name: column.header ?? prop,
    size: normalizeColumnWidth(column.width),
    minSize: normalizeColumnWidth(column.minWidth),
    maxSize: normalizeColumnWidth(column.maxWidth),
    sortable: Boolean(column.sortable),
    readonly: options.readonly,
    cellProperties: {
      align: column.align ?? 'start',
      hidden: Boolean(column.hidden),
      resizable: column.resizable !== false,
    },
    [ZEUS_REVO_COLUMN_ID]: column.id,
  }
}

export function mapDataGridColumnsToRevoGridColumns(
  columns: DataGridColumn[] | undefined,
  options: RevoGridAdapterColumnMapOptions = {},
): RevoGridCompatibleColumn[] {
  return (columns ?? [])
    .filter(column => options.includeHidden || !column.hidden)
    .map(column => mapDataGridColumnToRevoGridColumn(column, options))
}

export function findRevoGridColumnByZeusColumnId(
  columns: RevoGridCompatibleColumn[],
  columnId: string,
): RevoGridCompatibleColumn | undefined {
  return columns.find(column => column[ZEUS_REVO_COLUMN_ID] === columnId)
}
```

---

# 8. 新增 `packages/advanced/revogrid-adapter/src/core/row-map.ts`

```ts id="4sb9se"
import type {
  DataGridRowData,
  DataGridRowKey,
  RevoGridAdapterRowMapOptions,
  RevoGridCompatibleSourceRow,
} from '../types'

import { ZEUS_REVO_ROW_INDEX, ZEUS_REVO_ROW_KEY } from '../types'

function defaultGetRowKey(row: DataGridRowData, index: number): DataGridRowKey {
  const value = row.id ?? row.key ?? index
  return String(value)
}

export function mapDataGridRowToRevoGridSourceRow(
  row: DataGridRowData,
  index: number,
  options: RevoGridAdapterRowMapOptions = {},
): RevoGridCompatibleSourceRow {
  const getRowKey = options.getRowKey ?? defaultGetRowKey

  return {
    ...row,
    [ZEUS_REVO_ROW_KEY]: getRowKey(row, index),
    [ZEUS_REVO_ROW_INDEX]: index,
  }
}

export function mapDataGridRowsToRevoGridSource(
  rows: DataGridRowData[] | undefined,
  options: RevoGridAdapterRowMapOptions = {},
): RevoGridCompatibleSourceRow[] {
  return (rows ?? []).map((row, index) =>
    mapDataGridRowToRevoGridSourceRow(row, index, options),
  )
}

export function getRevoGridRowKey(
  row: RevoGridCompatibleSourceRow,
): DataGridRowKey {
  return row[ZEUS_REVO_ROW_KEY]
}

export function getRevoGridRowIndex(row: RevoGridCompatibleSourceRow): number {
  return row[ZEUS_REVO_ROW_INDEX]
}
```

---

# 9. 新增 `packages/advanced/revogrid-adapter/src/core/sort-map.ts`

```ts id="f9sn18"
import type {
  DataGridSortDirection,
  DataGridSortState,
  RevoGridCompatibleColumn,
  RevoGridCompatibleSort,
} from '../types'

import { ZEUS_REVO_COLUMN_ID } from '../types'

import { findRevoGridColumnByZeusColumnId } from './column-map'

export function mapDataGridSortToRevoGridSort(
  sort: DataGridSortState | undefined,
  columns: RevoGridCompatibleColumn[],
): RevoGridCompatibleSort | undefined {
  if (!sort) return undefined

  const column = findRevoGridColumnByZeusColumnId(columns, sort.columnId)
  if (!column) return undefined

  return {
    prop: column.prop,
    order: sort.direction,
    [ZEUS_REVO_COLUMN_ID]: sort.columnId,
  }
}

export function mapDataGridSortPropsToRevoGridSort(
  sortColumn: string | undefined,
  sortDirection: DataGridSortDirection | undefined,
  columns: RevoGridCompatibleColumn[],
): RevoGridCompatibleSort | undefined {
  if (!sortColumn || !sortDirection) return undefined

  return mapDataGridSortToRevoGridSort(
    {
      columnId: sortColumn,
      direction: sortDirection,
    },
    columns,
  )
}
```

---

# 10. 新增 `packages/advanced/revogrid-adapter/src/core/selection-map.ts`

```ts id="p79t7h"
import type {
  DataGridRowKey,
  DataGridSelectionMode,
  RevoGridCompatibleSelection,
  RevoGridCompatibleSourceRow,
} from '../types'

import { ZEUS_REVO_ROW_KEY } from '../types'

export function mapDataGridSelectionToRevoGridSelection(
  selectedKeys: DataGridRowKey[] | undefined,
  rows: RevoGridCompatibleSourceRow[],
  mode: DataGridSelectionMode = 'none',
): RevoGridCompatibleSelection {
  const keySet = new Set(selectedKeys ?? [])
  const rowIndexes =
    mode === 'none'
      ? []
      : rows
          .filter(row => keySet.has(row[ZEUS_REVO_ROW_KEY]))
          .map(row => Number(row.__zeusRowIndex))

  return {
    mode,
    rowKeys:
      mode === 'none'
        ? []
        : rows
            .filter(row => keySet.has(row[ZEUS_REVO_ROW_KEY]))
            .map(row => row[ZEUS_REVO_ROW_KEY]),
    rowIndexes,
  }
}
```

---

# 11. 新增 `packages/advanced/revogrid-adapter/src/core/adapter-state.ts`

```ts id="qtzvp6"
import type {
  RevoGridAdapterState,
  RevoGridAdapterStateOptions,
} from '../types'

import { mapDataGridColumnsToRevoGridColumns } from './column-map'
import { mapDataGridRowsToRevoGridSource } from './row-map'
import { mapDataGridSelectionToRevoGridSelection } from './selection-map'
import { mapDataGridSortPropsToRevoGridSort } from './sort-map'

export function createRevoGridAdapterState(
  options: RevoGridAdapterStateOptions = {},
): RevoGridAdapterState {
  const columns = mapDataGridColumnsToRevoGridColumns(options.columns, {
    readonly: options.readonly,
    includeHidden: options.includeHiddenColumns,
  })
  const source = mapDataGridRowsToRevoGridSource(options.rows, {
    getRowKey: options.getRowKey,
  })
  const sort = mapDataGridSortPropsToRevoGridSort(
    options.sortColumn,
    options.sortDirection,
    columns,
  )
  const selection = mapDataGridSelectionToRevoGridSelection(
    options.selectedKeys,
    source,
    options.selectionMode,
  )

  return {
    columns,
    source,
    sort,
    selection,
  }
}
```

---

# 12. 新增 `packages/advanced/revogrid-adapter/src/core/index.ts`

```ts id="7p2pmc"
export * from './adapter-state'
export * from './column-map'
export * from './row-map'
export * from './selection-map'
export * from './sort-map'
```

---

# 13. 新增 `packages/advanced/revogrid-adapter/src/components/revogrid-adapter.tsx`

```tsx id="xd9bpc"
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'

import type {
  DataGridColumn,
  DataGridRowData,
  DataGridRowKey,
  DataGridSelectionMode,
  DataGridSortDirection,
  RevoGridAdapterChangeDetail,
  RevoGridAdapterProps,
  RevoGridAdapterReadyDetail,
  RevoGridAdapterState,
  RevoGridElementLike,
} from '../types'

import { defineElement, event, Host, prop } from '@zeus-js/zeus'

import { createRevoGridAdapterState } from '../core'

export interface RevoGridAdapterElement extends HTMLElement {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  selectedKeys?: DataGridRowKey[]
  selectionMode?: DataGridSelectionMode
  sortColumn?: string
  sortDirection?: DataGridSortDirection
  readonly?: boolean
  includeHiddenColumns?: boolean
  getRevoColumns: () => RevoGridAdapterState['columns']
  getRevoSource: () => RevoGridAdapterState['source']
  getRevoSort: () => RevoGridAdapterState['sort']
  getRevoSelection: () => RevoGridAdapterState['selection']
  getState: () => RevoGridAdapterState
  getGridElement: () => RevoGridElementLike | undefined
  setRows: (rows: DataGridRowData[]) => void
  setColumns: (columns: DataGridColumn[]) => void
  setSelection: (keys: DataGridRowKey[]) => void
  setSort: (columnId: string, direction?: DataGridSortDirection) => void
  clearSort: () => void
  refresh: () => void
}

interface RevoGridAdapterEmits extends Record<
  string,
  EventDefinition<unknown>
> {
  adapterReady: EventDefinition<RevoGridAdapterReadyDetail>
  adapterChange: EventDefinition<RevoGridAdapterChangeDetail>
}

function resolveRows(props: RevoGridAdapterProps): DataGridRowData[] {
  return Array.isArray(props.rows) ? props.rows : []
}

function resolveColumns(props: RevoGridAdapterProps): DataGridColumn[] {
  return Array.isArray(props.columns) ? props.columns : []
}

function resolveSelectionMode(
  value: DataGridSelectionMode | undefined,
): DataGridSelectionMode {
  return value ?? 'none'
}

function createState(props: RevoGridAdapterProps): RevoGridAdapterState {
  return createRevoGridAdapterState({
    rows: resolveRows(props),
    columns: resolveColumns(props),
    selectedKeys: props.selectedKeys,
    selectionMode: resolveSelectionMode(props.selectionMode),
    sortColumn: props.sortColumn,
    sortDirection: props.sortDirection,
    readonly: props.readonly,
    includeHiddenColumns: props.includeHiddenColumns,
    getRowKey: props.getRowKey,
  })
}

function setup(
  props: RevoGridAdapterProps,
  ctx: DefineElementContext<RevoGridAdapterElement, RevoGridAdapterEmits>,
) {
  let gridElement: RevoGridElementLike | undefined
  let state = createState(props)
  let readyEmitted = false

  const rebuildState = (): RevoGridAdapterState => {
    state = createState(props)
    return state
  }

  const applyStateToGrid = (): void => {
    rebuildState()

    if (gridElement) {
      gridElement.columns = state.columns
      gridElement.source = state.source
      gridElement.sorting = state.sort
      gridElement.selectedRows = state.selection.rowIndexes
      gridElement.readonly = Boolean(props.readonly)
      gridElement.refresh?.()
    }

    if (!readyEmitted) {
      readyEmitted = true

      ctx.emit.adapterReady({
        grid: gridElement,
        state,
      })
    }

    ctx.emit.adapterChange({
      grid: gridElement,
      state,
    })
  }

  const syncHostProps = (): void => {
    ctx.host.rows = resolveRows(props)
    ctx.host.columns = resolveColumns(props)
    ctx.host.selectedKeys = props.selectedKeys
    ctx.host.selectionMode = resolveSelectionMode(props.selectionMode)
    ctx.host.sortColumn = props.sortColumn
    ctx.host.sortDirection = props.sortDirection
    ctx.host.readonly = Boolean(props.readonly)
    ctx.host.includeHiddenColumns = Boolean(props.includeHiddenColumns)
  }

  ctx.expose({
    getRevoColumns() {
      rebuildState()
      return state.columns.map(column => ({ ...column }))
    },

    getRevoSource() {
      rebuildState()
      return state.source.map(row => ({ ...row }))
    },

    getRevoSort() {
      rebuildState()
      return state.sort ? { ...state.sort } : undefined
    },

    getRevoSelection() {
      rebuildState()
      return {
        ...state.selection,
        rowKeys: [...state.selection.rowKeys],
        rowIndexes: [...state.selection.rowIndexes],
      }
    },

    getState() {
      rebuildState()

      return {
        columns: state.columns.map(column => ({ ...column })),
        source: state.source.map(row => ({ ...row })),
        sort: state.sort ? { ...state.sort } : undefined,
        selection: {
          ...state.selection,
          rowKeys: [...state.selection.rowKeys],
          rowIndexes: [...state.selection.rowIndexes],
        },
      }
    },

    getGridElement() {
      return gridElement
    },

    setRows(rows: DataGridRowData[]) {
      props.rows = rows
      syncHostProps()
      applyStateToGrid()
    },

    setColumns(columns: DataGridColumn[]) {
      props.columns = columns
      syncHostProps()
      applyStateToGrid()
    },

    setSelection(keys: DataGridRowKey[]) {
      props.selectedKeys = keys
      syncHostProps()
      applyStateToGrid()
    },

    setSort(columnId: string, direction: DataGridSortDirection = 'asc') {
      props.sortColumn = columnId
      props.sortDirection = direction
      syncHostProps()
      applyStateToGrid()
    },

    clearSort() {
      props.sortColumn = undefined
      props.sortDirection = undefined
      syncHostProps()
      applyStateToGrid()
    },

    refresh() {
      applyStateToGrid()
    },
  })

  syncHostProps()

  return (
    <Host
      part="root"
      data-slot="revogrid-adapter-root"
      data-readonly={() => (props.readonly ? '' : undefined)}
      data-selection-mode={() => resolveSelectionMode(props.selectionMode)}
      data-row-count={() => String(resolveRows(props).length)}
      data-column-count={() => String(resolveColumns(props).length)}
    >
      <revo-grid
        part="grid"
        data-slot="revogrid-adapter-grid"
        aria-label={() => props.ariaLabel}
        ref={(element: RevoGridElementLike | null) => {
          if (element) {
            gridElement = element
            applyStateToGrid()
            return
          }

          gridElement = undefined
        }}
      />
    </Host>
  )
}

export const RevoGridAdapter = defineElement<
  RevoGridAdapterProps,
  RevoGridAdapterElement,
  RevoGridAdapterEmits
>(
  'zw-revogrid-adapter',
  {
    shadow: false,
    props: {
      rows: Array,
      columns: Array,
      selectedKeys: Array,
      selectionMode: prop(['none', 'single', 'multiple'], {
        attr: 'selection-mode',
        default: 'none',
        reflect: true,
      }),
      sortColumn: prop(String, {
        attr: 'sort-column',
      }),
      sortDirection: prop(['asc', 'desc'], {
        attr: 'sort-direction',
      }),
      readonly: prop(Boolean, {
        reflect: true,
      }),
      includeHiddenColumns: prop(Boolean, {
        attr: 'include-hidden-columns',
      }),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
    },
    emits: {
      adapterReady: event<RevoGridAdapterReadyDetail>(),
      adapterChange: event<RevoGridAdapterChangeDetail>(),
    },
    meta: {
      description:
        'RevoGrid-compatible adapter for Zeus Web DataGrid column, row, sorting and selection models.',
    },
  },
  setup,
)
```

---

# 14. 新增 `packages/advanced/revogrid-adapter/src/index.ts`

```ts id="ziw5vp"
export {
  RevoGridAdapter,
  type RevoGridAdapterElement,
} from './components/revogrid-adapter'

export * from './core'
export * from './types'
```

---

# 15. 新增单元测试

## 15.1 `packages/advanced/revogrid-adapter/__tests__/column-map.spec.ts`

```ts id="k83zi6"
import { describe, expect, it } from 'vitest'

import {
  findRevoGridColumnByZeusColumnId,
  getRevoGridColumnProp,
  mapDataGridColumnsToRevoGridColumns,
  mapDataGridColumnToRevoGridColumn,
  ZEUS_REVO_COLUMN_ID,
} from '../src'

describe('RevoGrid column map', () => {
  it('uses field as RevoGrid prop when available', () => {
    expect(
      getRevoGridColumnProp({
        id: 'name',
        field: 'user.name',
      }),
    ).toBe('user.name')
  })

  it('maps DataGrid column to RevoGrid-compatible column', () => {
    expect(
      mapDataGridColumnToRevoGridColumn(
        {
          id: 'name',
          header: 'Name',
          field: 'userName',
          width: 180,
          minWidth: 80,
          maxWidth: 260,
          sortable: true,
          align: 'center',
        },
        {
          readonly: true,
        },
      ),
    ).toEqual({
      prop: 'userName',
      name: 'Name',
      size: 180,
      minSize: 80,
      maxSize: 260,
      sortable: true,
      readonly: true,
      cellProperties: {
        align: 'center',
        hidden: false,
        resizable: true,
      },
      [ZEUS_REVO_COLUMN_ID]: 'name',
    })
  })

  it('filters hidden columns by default', () => {
    expect(
      mapDataGridColumnsToRevoGridColumns([
        {
          id: 'name',
        },
        {
          id: 'secret',
          hidden: true,
        },
      ]).map(column => column.prop),
    ).toEqual(['name'])
  })

  it('can include hidden columns explicitly', () => {
    expect(
      mapDataGridColumnsToRevoGridColumns(
        [
          {
            id: 'name',
          },
          {
            id: 'secret',
            hidden: true,
          },
        ],
        {
          includeHidden: true,
        },
      ).map(column => column.prop),
    ).toEqual(['name', 'secret'])
  })

  it('finds RevoGrid column by Zeus column id', () => {
    const columns = mapDataGridColumnsToRevoGridColumns([
      {
        id: 'name',
        field: 'userName',
      },
    ])

    expect(findRevoGridColumnByZeusColumnId(columns, 'name')).toMatchObject({
      prop: 'userName',
      [ZEUS_REVO_COLUMN_ID]: 'name',
    })
  })
})
```

---

## 15.2 `packages/advanced/revogrid-adapter/__tests__/row-map.spec.ts`

```ts id="31jgce"
import { describe, expect, it } from 'vitest'

import {
  getRevoGridRowIndex,
  getRevoGridRowKey,
  mapDataGridRowsToRevoGridSource,
  mapDataGridRowToRevoGridSourceRow,
  ZEUS_REVO_ROW_INDEX,
  ZEUS_REVO_ROW_KEY,
} from '../src'

describe('RevoGrid row map', () => {
  it('maps row metadata from id', () => {
    expect(
      mapDataGridRowToRevoGridSourceRow(
        {
          id: 'u1',
          name: 'Ada',
        },
        0,
      ),
    ).toEqual({
      id: 'u1',
      name: 'Ada',
      [ZEUS_REVO_ROW_KEY]: 'u1',
      [ZEUS_REVO_ROW_INDEX]: 0,
    })
  })

  it('uses custom row key getter', () => {
    expect(
      mapDataGridRowToRevoGridSourceRow(
        {
          uuid: 'x1',
          name: 'Ada',
        },
        2,
        {
          getRowKey: row => String(row.uuid),
        },
      ),
    ).toMatchObject({
      [ZEUS_REVO_ROW_KEY]: 'x1',
      [ZEUS_REVO_ROW_INDEX]: 2,
    })
  })

  it('falls back to index when no id or key exists', () => {
    expect(
      mapDataGridRowToRevoGridSourceRow(
        {
          name: 'No id',
        },
        3,
      ),
    ).toMatchObject({
      [ZEUS_REVO_ROW_KEY]: '3',
      [ZEUS_REVO_ROW_INDEX]: 3,
    })
  })

  it('maps rows to RevoGrid source', () => {
    expect(
      mapDataGridRowsToRevoGridSource([
        {
          id: 'u1',
          name: 'Ada',
        },
        {
          id: 'u2',
          name: 'Grace',
        },
      ]).map(row => getRevoGridRowKey(row)),
    ).toEqual(['u1', 'u2'])
  })

  it('reads row key and index helpers', () => {
    const row = mapDataGridRowToRevoGridSourceRow(
      {
        id: 'u1',
      },
      4,
    )

    expect(getRevoGridRowKey(row)).toBe('u1')
    expect(getRevoGridRowIndex(row)).toBe(4)
  })
})
```

---

## 15.3 `packages/advanced/revogrid-adapter/__tests__/sort-map.spec.ts`

```ts id="yh5wz8"
import { describe, expect, it } from 'vitest'

import {
  mapDataGridColumnsToRevoGridColumns,
  mapDataGridSortPropsToRevoGridSort,
  mapDataGridSortToRevoGridSort,
  ZEUS_REVO_COLUMN_ID,
} from '../src'

describe('RevoGrid sort map', () => {
  const columns = mapDataGridColumnsToRevoGridColumns([
    {
      id: 'name',
      field: 'userName',
      sortable: true,
    },
    {
      id: 'age',
      sortable: true,
    },
  ])

  it('maps DataGrid sort to RevoGrid sort', () => {
    expect(
      mapDataGridSortToRevoGridSort(
        {
          columnId: 'name',
          direction: 'asc',
        },
        columns,
      ),
    ).toEqual({
      prop: 'userName',
      order: 'asc',
      [ZEUS_REVO_COLUMN_ID]: 'name',
    })
  })

  it('maps sort props to RevoGrid sort', () => {
    expect(mapDataGridSortPropsToRevoGridSort('age', 'desc', columns)).toEqual({
      prop: 'age',
      order: 'desc',
      [ZEUS_REVO_COLUMN_ID]: 'age',
    })
  })

  it('returns undefined when sort column is missing', () => {
    expect(
      mapDataGridSortToRevoGridSort(
        {
          columnId: 'missing',
          direction: 'asc',
        },
        columns,
      ),
    ).toBeUndefined()
  })

  it('returns undefined when props are incomplete', () => {
    expect(
      mapDataGridSortPropsToRevoGridSort(undefined, 'asc', columns),
    ).toBeUndefined()
    expect(
      mapDataGridSortPropsToRevoGridSort('age', undefined, columns),
    ).toBeUndefined()
  })
})
```

---

## 15.4 `packages/advanced/revogrid-adapter/__tests__/selection-map.spec.ts`

```ts id="040psl"
import { describe, expect, it } from 'vitest'

import {
  mapDataGridRowsToRevoGridSource,
  mapDataGridSelectionToRevoGridSelection,
} from '../src'

describe('RevoGrid selection map', () => {
  const source = mapDataGridRowsToRevoGridSource([
    {
      id: 'u1',
      name: 'Ada',
    },
    {
      id: 'u2',
      name: 'Grace',
    },
    {
      id: 'u3',
      name: 'Alan',
    },
  ])

  it('maps multiple selection to row indexes', () => {
    expect(
      mapDataGridSelectionToRevoGridSelection(['u1', 'u3'], source, 'multiple'),
    ).toEqual({
      mode: 'multiple',
      rowKeys: ['u1', 'u3'],
      rowIndexes: [0, 2],
    })
  })

  it('maps single selection to row indexes', () => {
    expect(
      mapDataGridSelectionToRevoGridSelection(['u2'], source, 'single'),
    ).toEqual({
      mode: 'single',
      rowKeys: ['u2'],
      rowIndexes: [1],
    })
  })

  it('clears selection in none mode', () => {
    expect(
      mapDataGridSelectionToRevoGridSelection(['u2'], source, 'none'),
    ).toEqual({
      mode: 'none',
      rowKeys: [],
      rowIndexes: [],
    })
  })

  it('ignores missing selected keys', () => {
    expect(
      mapDataGridSelectionToRevoGridSelection(
        ['missing', 'u3'],
        source,
        'multiple',
      ),
    ).toEqual({
      mode: 'multiple',
      rowKeys: ['u3'],
      rowIndexes: [2],
    })
  })
})
```

---

## 15.5 `packages/advanced/revogrid-adapter/__tests__/adapter-state.spec.ts`

```ts id="r2n3ng"
import { describe, expect, it } from 'vitest'

import {
  createRevoGridAdapterState,
  ZEUS_REVO_COLUMN_ID,
  ZEUS_REVO_ROW_KEY,
} from '../src'

describe('RevoGrid adapter state', () => {
  it('creates full adapter state', () => {
    const state = createRevoGridAdapterState({
      columns: [
        {
          id: 'name',
          field: 'userName',
          width: 180,
          sortable: true,
        },
        {
          id: 'age',
          sortable: true,
        },
      ],
      rows: [
        {
          id: 'u1',
          userName: 'Ada',
          age: 30,
        },
        {
          id: 'u2',
          userName: 'Grace',
          age: 20,
        },
      ],
      selectedKeys: ['u2'],
      selectionMode: 'multiple',
      sortColumn: 'age',
      sortDirection: 'desc',
      readonly: true,
    })

    expect(state.columns).toEqual([
      expect.objectContaining({
        prop: 'userName',
        size: 180,
        readonly: true,
        [ZEUS_REVO_COLUMN_ID]: 'name',
      }),
      expect.objectContaining({
        prop: 'age',
        readonly: true,
        [ZEUS_REVO_COLUMN_ID]: 'age',
      }),
    ])

    expect(state.source).toEqual([
      expect.objectContaining({
        id: 'u1',
        userName: 'Ada',
        [ZEUS_REVO_ROW_KEY]: 'u1',
      }),
      expect.objectContaining({
        id: 'u2',
        userName: 'Grace',
        [ZEUS_REVO_ROW_KEY]: 'u2',
      }),
    ])

    expect(state.sort).toEqual({
      prop: 'age',
      order: 'desc',
      [ZEUS_REVO_COLUMN_ID]: 'age',
    })

    expect(state.selection).toEqual({
      mode: 'multiple',
      rowKeys: ['u2'],
      rowIndexes: [1],
    })
  })

  it('supports empty adapter state', () => {
    expect(createRevoGridAdapterState()).toEqual({
      columns: [],
      source: [],
      sort: undefined,
      selection: {
        mode: 'none',
        rowKeys: [],
        rowIndexes: [],
      },
    })
  })
})
```

---

## 15.6 `packages/advanced/revogrid-adapter/__tests__/revogrid-adapter.spec.ts`

```ts id="vvxy7e"
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const sourcePath = resolve(
  workspaceRoot,
  'packages/advanced/revogrid-adapter/src/components/revogrid-adapter.tsx',
)
const source = readFileSync(sourcePath, 'utf-8')

describe('revogrid-adapter component protocol', () => {
  it('infers props, events, methods and parts', () => {
    const result = analyzeFile({
      file: 'packages/advanced/revogrid-adapter/src/components/revogrid-adapter.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-revogrid-adapter',
      props: {
        selectionMode: {
          type: 'string',
          values: ['none', 'single', 'multiple'],
          default: 'none',
          reflect: true,
        },
        sortColumn: {
          type: 'string',
        },
        sortDirection: {
          type: 'string',
          values: ['asc', 'desc'],
        },
        readonly: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        includeHiddenColumns: {
          type: 'boolean',
          default: false,
        },
        ariaLabel: {
          type: 'string',
        },
      },
      events: {
        adapterReady: {
          name: 'adapter-ready',
          reactName: 'onAdapterReady',
        },
        adapterChange: {
          name: 'adapter-change',
          reactName: 'onAdapterChange',
        },
      },
      methods: {
        getRevoColumns: {
          name: 'getRevoColumns',
        },
        getRevoSource: {
          name: 'getRevoSource',
        },
        getRevoSort: {
          name: 'getRevoSort',
        },
        getRevoSelection: {
          name: 'getRevoSelection',
        },
        getState: {
          name: 'getState',
        },
        getGridElement: {
          name: 'getGridElement',
        },
        setRows: {
          name: 'setRows',
          returns: 'void',
        },
        setColumns: {
          name: 'setColumns',
          returns: 'void',
        },
        setSelection: {
          name: 'setSelection',
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
        refresh: {
          name: 'refresh',
          returns: 'void',
        },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining(['root', 'grid']),
    )
  })

  it('renders a RevoGrid-compatible custom element target', () => {
    expect(source).toContain('<revo-grid')
    expect(source).toContain('data-slot="revogrid-adapter-grid"')
    expect(source).toContain('applyStateToGrid')
    expect(source).toContain('gridElement.columns = state.columns')
    expect(source).toContain('gridElement.source = state.source')
    expect(source).toContain('gridElement.sorting = state.sort')
    expect(source).toContain(
      'gridElement.selectedRows = state.selection.rowIndexes',
    )
  })

  it('does not import RevoGrid implementation directly', () => {
    expect(source).not.toContain('@revolist/revogrid')
    expect(source).not.toContain('revogrid/loader')
    expect(source).not.toContain('defineCustomElements')
  })

  it('keeps adapter separate from DataGrid core implementation', () => {
    expect(source).not.toContain('createDataGridRowVirtualizer')
    expect(source).not.toContain('sortDataGridRows')
    expect(source).not.toContain('createDataGridSelectionModel')
  })
})
```

---

# 16. 新增 `docs/advanced/design/phase11.md`

````md id="yh4lna"
# Phase 11：RevoGrid Adapter / Interop Validation

## 目标

Phase 11 回到高级组件最初路线中的 RevoGrid Adapter。

DataGrid Lite 已经具备：

1. row virtualization
2. sort
3. selection
4. column resize
5. keyboard navigation
6. controlled state
7. accessibility hardening
8. runtime e2e tests

继续扩自研 DataGrid 会让它逐渐变成 AG Grid。Phase 11 改为建立 RevoGrid Adapter，用于验证复杂表格能力边界。

## 设计原则

1. `@zeus-web/data-grid` 继续保持 Lite。
2. `@zeus-web/revogrid-adapter` 负责把 DataGrid 数据结构映射到 RevoGrid-compatible shape。
3. 不直接依赖 `@revolist/revogrid`。
4. 不在 adapter 中注册 RevoGrid loader。
5. 用户项目如果安装并注册了 RevoGrid，则 `<revo-grid>` 会正常工作。
6. 用户项目未安装 RevoGrid 时，adapter 仍可构建、生成 wrapper、跑 contract tests。

## 包结构

```txt
packages/advanced/revogrid-adapter/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    core/
      index.ts
      adapter-state.ts
      column-map.ts
      row-map.ts
      selection-map.ts
      sort-map.ts
    components/
      revogrid-adapter.tsx
  __tests__/
    adapter-state.spec.ts
    column-map.spec.ts
    row-map.spec.ts
    selection-map.spec.ts
    sort-map.spec.ts
    revogrid-adapter.spec.ts
```
````

## 映射规则

### Column

DataGrid:

```ts
DataGridColumn
```

映射到：

```ts
RevoGridCompatibleColumn
```

规则：

```txt
id      -> __zeusColumnId
field   -> prop
header  -> name
width   -> size
minWidth -> minSize
maxWidth -> maxSize
sortable -> sortable
align/hidden/resizable -> cellProperties
```

### Row

DataGrid:

```ts
DataGridRowData
```

映射到：

```ts
RevoGridCompatibleSourceRow
```

额外注入：

```txt
__zeusRowKey
__zeusRowIndex
```

### Sort

DataGrid:

```ts
sortColumn + sortDirection
```

映射到：

```ts
{
  ;(prop, order, __zeusColumnId)
}
```

### Selection

DataGrid:

```ts
selectedKeys
```

映射到：

```ts
{
  ;(mode, rowKeys, rowIndexes)
}
```

## Web Component

新增：

```txt
zw-revogrid-adapter
```

内部渲染：

```html
<revo-grid></revo-grid>
```

### Props

```txt
rows
columns
selectedKeys
selectionMode
sortColumn
sortDirection
readonly
includeHiddenColumns
ariaLabel
```

### Events

```txt
adapter-ready
adapter-change
```

### Methods

```txt
getRevoColumns()
getRevoSource()
getRevoSort()
getRevoSelection()
getState()
getGridElement()
setRows(rows)
setColumns(columns)
setSelection(keys)
setSort(columnId, direction)
clearSort()
refresh()
```

## 非目标

本阶段不做：

1. 不引入 `@revolist/revogrid` dependency。
2. 不封装 RevoGrid 全量 API。
3. 不做 RevoGrid 主题系统。
4. 不做 RevoGrid 事件全集桥接。
5. 不把 RevoGrid 能力塞回 `@zeus-web/data-grid`。
6. 不做 AG Grid adapter。

## 验收

```bash
pnpm --filter @zeus-web/revogrid-adapter check
pnpm --filter @zeus-web/revogrid-adapter test
pnpm --filter @zeus-web/revogrid-adapter build

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm release:plan
```

````

---

# 17. 验收命令

```bash id="cp18v7"
pnpm --filter @zeus-web/revogrid-adapter check
pnpm --filter @zeus-web/revogrid-adapter test
pnpm --filter @zeus-web/revogrid-adapter build

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm check:product-contract
pnpm release:plan
````

---

# 18. Phase 11 完成标准

```txt id="k82krd"
必须满足:
  1. 新增 @zeus-web/revogrid-adapter advanced 包
  2. advanced contract 能识别并通过该包
  3. adapter 不直接依赖 @revolist/revogrid
  4. adapter 复用 @zeus-web/data-grid 类型
  5. column map 单测通过
  6. row map 单测通过
  7. sort map 单测通过
  8. selection map 单测通过
  9. adapter state 单测通过
  10. zw-revogrid-adapter analyzer 测试通过
  11. build output/exports 检查通过
```

---

# 19. 下一阶段建议

Phase 12 建议做 **RevoGrid Adapter Runtime Harness**：

```txt id="q0y4sm"
Phase 12: RevoGrid Adapter Runtime Harness

目标:
  1. 在 e2e 中注册 fake revo-grid custom element
  2. 验证 zw-revogrid-adapter 会把 columns/source/sorting/selectedRows 写入 fake revo-grid
  3. 验证 setRows/setColumns/setSort/setSelection/refresh 在 DOM runtime 中可用
  4. 验证 adapter-ready / adapter-change 事件
  5. 继续不引入真实 @revolist/revogrid
```

Phase 11 先完成映射与组件协议；Phase 12 再补 runtime harness，会更稳。
