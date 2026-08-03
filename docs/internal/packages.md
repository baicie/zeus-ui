# Zeus 包公共 API

本文件是 Zeus 包公共 API 的唯一权威来源。当前先覆盖本次变更涉及的
`@zeus-web/data-grid`；尚未迁移到本文件的包继续保持现有发布出口，后续变更公共 API
时必须补充对应章节。

## 所有组件包共享契约

状态：`0.1.0-beta.2`，MVP 阶段，不承诺向后兼容。

本节适用于 `packages/primitives/*` 和 `packages/advanced/*` 的 25 个公开组件包。
每个组件包都必须提供以下入口：

- 包根入口
- `./wc`
- `./wc/auto`
- `./react`
- `./vue`
- `./vue/global`
- `./custom-elements.json`
- `./zeus.components.json`

React 和 Vue 生成入口会分别直接导入
`@zeus-js/output-react-wrapper/runtime` 与
`@zeus-js/output-vue-wrapper/runtime`。因此组件包必须把两个 wrapper 包声明为普通
`dependencies`；消费者只需安装目标 `@zeus-web/*` 组件包和实际使用的框架，不得被要求
手工安装 `@zeus-js/output-*` 实现包。

`react >=18 || >=19` 与 `vue >=3` 是 optional peer dependencies。只使用 Web Component
入口的消费者不需要安装 React 或 Vue。

具名 slot 会映射为 React wrapper prop。组件 prop 与非默认 slot 不得同名，否则生成的
React 类型会产生重复属性，wrapper runtime 也会截获本应传给自定义元素的数据 prop。
存在语义冲突时保留数据 prop，并为 slot 使用独立的 `*Content` 名称。

## `@zeus-web/data-grid`

状态：`0.1.0-beta.2`，MVP 阶段，不承诺向后兼容。

入口：

- `@zeus-web/data-grid`
- `@zeus-web/data-grid/wc`
- `@zeus-web/data-grid/wc/auto`
- `@zeus-web/data-grid/react`
- `@zeus-web/data-grid/vue`

Web Component 标签：`zw-data-grid`。

### 组件属性

| 属性                 | 类型                               | 默认值   | 说明                   |
| -------------------- | ---------------------------------- | -------- | ---------------------- |
| `rows`               | `DataGridRowData[]`                | `[]`     | 客户端行数据           |
| `columns`            | `DataGridColumn[]`                 | `[]`     | 列定义                 |
| `rowHeight`          | `number`                           | `40`     | 固定估算行高           |
| `overscan`           | `number`                           | `4`      | 行窗口前后额外渲染数量 |
| `overscanColumns`    | `number`                           | `2`      | 列窗口前后额外渲染数量 |
| `virtual`            | `boolean`                          | `false`  | 同时启用行、列虚拟化   |
| `selectionMode`      | `'none' \| 'single' \| 'multiple'` | `'none'` | 行选择模式             |
| `selectedKeys`       | `DataGridRowKey[]`                 | `[]`     | 受控选择键             |
| `sortColumn`         | `string`                           | -        | 受控排序列             |
| `sortDirection`      | `'asc' \| 'desc'`                  | -        | 受控排序方向           |
| `ariaLabel`          | `string`                           | -        | Grid 可访问名称        |
| `resizable`          | `boolean`                          | `false`  | 启用列宽调整           |
| `keyboardNavigation` | `boolean`                          | `true`   | 启用单元格键盘导航     |
| `activeRowKey`       | `DataGridRowKey`                   | -        | 受控活动行             |
| `activeColumnId`     | `string`                           | -        | 受控活动列             |

### 组件方法

行窗口方法：

```ts
getRange(): DataGridVirtualRange
getItems(): DataGridVirtualItem[]
getTotalSize(): number
scrollToIndex(index: number, align?: VirtualScrollAlign): void
scrollToOffset(offset: number): void
measure(index?: number, size?: number): void
resetMeasurements(): void
```

列窗口方法：

```ts
getColumnRange(): DataGridColumnVirtualRange
getColumnItems(): DataGridColumnVirtualItem[]
getTotalColumnSize(): number
scrollToColumn(index: number, align?: VirtualScrollAlign): void
```

数据、状态与交互方法：

```ts
setRows(rows: DataGridRowData[]): void
setColumns(columns: DataGridColumn[]): void
getRows(): DataGridRow[]
getColumns(): NormalizedDataGridColumn[]
getVisibleRows(): DataGridRow[]
getSelection(): DataGridSelectionState
setSelection(keys: DataGridRowKey[]): void
clearSelection(): void
toggleRowSelection(key: DataGridRowKey): void
setSort(columnId: string, direction?: DataGridSortDirection, nativeEvent?: Event): void
clearSort(): void
getSort(): DataGridSortState | undefined
resizeColumn(columnId: string, width: number, nativeEvent?: Event): void
resetColumnWidths(): void
getColumnWidths(): Record<string, number>
setActiveCell(rowKey: DataGridRowKey, columnId: string, nativeEvent?: Event): void
getActiveCell(): DataGridActiveCell | undefined
moveActiveCell(key: DataGridNavigationKey, nativeEvent?: Event): void
focusCell(rowKey: DataGridRowKey, columnId: string): void
focusActiveCell(): void
refreshViewport(): void
```

### 事件与插槽

事件：`range-change`、`scroll-offset-change`、`viewport-resize`、
`selection-change`、`sort-change`、`row-action`、`cell-action`、
`column-resize-start`、`column-resize`、`column-resize-end`、
`active-cell-change`。

`range-change` 保持原有纵向语义，只报告行窗口。横向窗口变化会触发重渲染，消费者通过
`getColumnRange()` 和 `getColumnItems()` 读取当前列窗口。

唯一公开插槽是 `empty`。

### 二维虚拟化契约

- `virtual=false` 时渲染全部行和全部可见列。
- `virtual=true` 时渲染行窗口与列窗口的笛卡尔积。
- 列偏移使用前缀宽度表与二分查找，范围查询为 `O(log n)`。
- 真实 `clientWidth` 不可用时使用 `640px` fallback，避免宽表首帧完整渲染。
- DOM 单元格数量受 viewport 与 overscan 控制，不随总行列数线性增长。
- `aria-colindex`、active cell 和键盘导航始终使用可见列集合中的真实索引。

### 列虚拟化内核

```ts
createDataGridColumnVirtualizer(options: {
  columns: NormalizedDataGridColumn[]
  overscan?: number
}): DataGridColumnVirtualizer

interface DataGridColumnVirtualizer {
  getSnapshot(scrollOffset: number, viewportSize: number): DataGridColumnVirtualSnapshot
  getRange(scrollOffset: number, viewportSize: number): DataGridColumnVirtualRange
  getItems(range: DataGridColumnVirtualRange): DataGridColumnVirtualItem[]
  getTotalSize(): number
  getOffsetForIndex(
    index: number,
    align?: VirtualScrollAlign,
    viewportSize?: number,
  ): number
}
```

相关公共类型：`DataGridColumnVirtualRange`、`DataGridColumnVirtualItem`、
`DataGridColumnVirtualSnapshot`、`DataGridColumnVirtualizerOptions`、
`DataGridColumnVirtualizer`。
