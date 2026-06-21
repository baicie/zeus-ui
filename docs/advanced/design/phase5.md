# Phase 5：Data Grid Lite

## 目标

Phase 5 新增 `@zeus-web/data-grid`，提供一个 headless-first 的轻量 DataGrid advanced 包。

本阶段重点验证 `@zeus-web/virtual` 不只服务 Chat，也能作为 DataGrid 的 row virtualization 基础。

## 范围

新增：

```txt
packages/advanced/data-grid/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    core/
      index.ts
      column-model.ts
      row-model.ts
      selection-model.ts
      sort-model.ts
      grid-virtualizer.ts
    components/
      data-grid.tsx
  __tests__/
    column-model.spec.ts
    row-model.spec.ts
    selection-model.spec.ts
    sort-model.spec.ts
    grid-virtualizer.spec.ts
    data-grid.spec.ts
```

## 非目标

本阶段不做：

1. 列虚拟。
2. 固定列。
3. 单元格编辑器。
4. 过滤器。
5. 分组。
6. 树表。
7. 服务端数据源。
8. registry styled template。
9. `@zeus-web/ui/data-grid`。

## API

### Props

```txt
rows?: DataGridRowData[]
columns?: DataGridColumn[]
row-height?: number
overscan?: number
virtual?: boolean
selection-mode?: 'none' | 'single' | 'multiple'
selected-keys?: string[]
sort-column?: string
sort-direction?: 'asc' | 'desc'
aria-label?: string
```

### Events

```txt
range-change
scroll-offset-change
selection-change
sort-change
row-action
cell-action
```

### Methods

```txt
setRows()
setColumns()
getRows()
getColumns()
getVisibleRows()
getSelection()
setSelection()
clearSelection()
toggleRowSelection()
setSort()
clearSort()
getSort()
getRange()
getItems()
getTotalSize()
scrollToIndex()
scrollToOffset()
measure()
resetMeasurements()
```

## 验收

```bash
pnpm --filter @zeus-web/data-grid check
pnpm --filter @zeus-web/data-grid test
pnpm --filter @zeus-web/data-grid build

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm check:product-contract
```
