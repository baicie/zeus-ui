# Phase 7：Data Grid Column Resize + Keyboard Navigation

## 目标

Phase 7 在 `@zeus-web/data-grid` Lite 的基础上补齐两个关键交互能力：

1. Column Resize。
2. Keyboard Navigation。

本阶段仍保持 headless-first，不引入过滤器、编辑器、树表、分组、固定列或服务端数据源。

## 范围

新增：

```txt
packages/advanced/data-grid/src/core/column-resize-model.ts
packages/advanced/data-grid/src/core/navigation-model.ts
packages/advanced/data-grid/__tests__/column-resize-model.spec.ts
packages/advanced/data-grid/__tests__/navigation-model.spec.ts
docs/advanced/design/phase7.md
```

修改：

```txt
packages/advanced/data-grid/package.json
packages/advanced/data-grid/src/types.ts
packages/advanced/data-grid/src/core/index.ts
packages/advanced/data-grid/src/core/column-model.ts
packages/advanced/data-grid/src/components/data-grid.tsx
packages/advanced/data-grid/__tests__/column-model.spec.ts
packages/advanced/data-grid/__tests__/data-grid.spec.ts
```

## 非目标

本阶段不做：

1. 列虚拟。
2. 单元格编辑。
3. 过滤器。
4. 树表。
5. 分组。
6. 固定列。
7. 服务端数据源。
8. registry product layer 改造。

## Column Resize

### Props

```txt
resizable?: boolean
```

### Events

```txt
column-resize-start
column-resize
column-resize-end
```

### Methods

```txt
resizeColumn(columnId: string, width: number): void
resetColumnWidths(): void
getColumnWidths(): Record<string, number>
```

### Keyboard

Resize handle 支持：

```txt
ArrowLeft  -16px
ArrowRight +16px
Home       minWidth
End        maxWidth
```

## Keyboard Navigation

### Props

```txt
keyboard-navigation?: boolean
active-row-key?: string
active-column-id?: string
```

### Events

```txt
active-cell-change
```

### Methods

```txt
setActiveCell(rowKey: string, columnId: string): void
getActiveCell(): DataGridActiveCell | undefined
moveActiveCell(key: DataGridNavigationKey): void
```

### Keys

```txt
ArrowUp
ArrowDown
ArrowLeft
ArrowRight
Home
End
PageUp
PageDown
```

## Accessibility

`zw-data-grid` 使用：

```txt
role="grid"
aria-activedescendant
role="row"
role="gridcell"
role="separator"
```

当前 active cell 的 cell 节点拥有：

```txt
data-active
tabindex=0
```

其他 cell：

```txt
tabindex=-1
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
