# Phase 9：Data Grid DOM Runtime Tests + Minimal E2E Harness

## 目标

Phase 9 不继续扩展 DataGrid 功能，而是补齐真实 custom element runtime 测试。

前面 Phase 5 到 Phase 8 已完成：

1. row virtualization
2. selection
3. sorting
4. column resize
5. keyboard navigation
6. controlled state model
7. analyzer/source contract tests

但这些测试大多是 core 或 source-level contract，缺少真实 DOM runtime 级测试。

Phase 9 目标是使用：

```txt
customElements.define()
document.createElement('zw-data-grid')
dispatchEvent()
addEventListener()
querySelector()
```

验证组件运行时行为。

## 范围

新增：

```txt
packages/advanced/data-grid/__tests__/e2e/data-grid-runtime-harness.ts
packages/advanced/data-grid/__tests__/e2e/data-grid-runtime.spec.ts
docs/advanced/design/phase9.md
```

修改：

```txt
vitest.config.ts
packages/advanced/data-grid/package.json
```

## 非目标

本阶段不做：

1. 不新增 DataGrid 功能。
2. 不做浏览器真实 Playwright。
3. 不做视觉回归。
4. 不做 registry product layer。
5. 不改 React/Vue wrappers。
6. 不做列虚拟、过滤器、编辑器、树表、分组。

## 测试策略

### unit

继续跑已有 core / analyzer / source contract：

```bash
pnpm --filter @zeus-web/data-grid test:unit
```

### e2e

新增 jsdom custom element runtime tests：

```bash
pnpm --filter @zeus-web/data-grid test:e2e
```

### package test

默认串行执行：

```bash
pnpm --filter @zeus-web/data-grid test
```

等价于：

```txt
test:unit && test:e2e
```

## Runtime 覆盖点

### 1. Mount

验证：

```txt
customElements.define('zw-data-grid', DataGrid)
document.createElement('zw-data-grid')
document.body.append(grid)
```

并检查 exposed methods。

### 2. rows / columns

验证同长度引用更新：

```txt
grid.rows = nextRows
grid.columns = nextColumns
```

不会被长度判断忽略。

### 3. selection

验证：

```txt
setSelection()
toggleRowSelection()
clearSelection()
selectedKeys -> undefined
selection-change
```

### 4. sort

验证：

```txt
setSort()
clearSort()
sortColumn/sortDirection controlled props
header click
sort-change
```

### 5. resize

验证：

```txt
resizeColumn()
resetColumnWidths()
column-resize
```

### 6. active cell

验证：

```txt
activeRowKey/activeColumnId
setActiveCell()
moveActiveCell()
active-cell-change
```

### 7. keyboard navigation

验证方向键不会产生中间 active cell：

```txt
ArrowRight from u1/name => u1/age
只触发一次 active-cell-change
```

### 8. virtual range

验证：

```txt
virtual=true
scrollToOffset()
getRange()
getItems()
range-change
```

## Vitest 配置

`e2e` project 需要 jsdom，并且 include advanced 包：

```txt
packages/advanced/*/__tests__/e2e/*.spec.ts
```

同时要给 `@zeus-js/zeus` 和 `@zeus-js/runtime-dom` 配 browser ESM alias，否则 runtime-dom 在 jsdom 下可能解析到不合适的入口。

另外 vitest 4.x 默认使用 oxc transformer，而 root tsconfig 把 `jsx` 设为 `preserve` — 必须在 vitest config 顶层加 `oxc: { jsx: { runtime: 'automatic', importSource: '@zeus-js/zeus' } }`，否则 `.tsx` 组件 source 会被原样透传到 vite import-analysis 报"invalid JS syntax"。

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
