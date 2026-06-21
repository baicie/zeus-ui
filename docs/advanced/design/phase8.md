# Phase 8：Data Grid Controlled State Hardening + Behavior Tests

## 目标

Phase 8 不是继续扩展 DataGrid 功能，而是修正并加固 DataGrid 受控状态同步能力。

重点状态：

1. `rows`
2. `columns`
3. `selectedKeys`
4. `sortColumn`
5. `sortDirection`
6. `activeRowKey`
7. `activeColumnId`
8. `rowHeight`
9. `overscan`
10. `virtual`
11. `selectionMode`
12. `resizable`
13. `keyboardNavigation`

## 背景

Phase 5 到 Phase 7 已经实现：

1. row virtualization
2. selection
3. sort
4. column resize
5. keyboard navigation
6. active cell

但原先状态同步仍有问题：

1. rows/columns 曾经只通过 length 判断。
2. selectedKeys 只初始化一次，后续受控更新不稳。
3. sortColumn/sortDirection 外部变化没有可靠同步内部 sort。
4. activeRowKey/activeColumnId 外部变化没有可靠同步 active cell。
5. resetColumnWidths 没有明确区分默认宽度与当前宽度。
6. analyzer 测试曾允许 `unknown` 返回类型，导致契约变弱。

## 范围

新增：

```txt
packages/advanced/data-grid/src/core/controlled-state-model.ts
packages/advanced/data-grid/__tests__/controlled-state-model.spec.ts
packages/advanced/data-grid/__tests__/data-grid-behavior-contract.spec.ts
docs/advanced/design/phase8.md
```

修改：

```txt
packages/advanced/data-grid/package.json
packages/advanced/data-grid/src/core/index.ts
packages/advanced/data-grid/src/components/data-grid.tsx
packages/advanced/data-grid/__tests__/data-grid.spec.ts
```

## 非目标

本阶段不做：

1. 不做列虚拟。
2. 不做过滤器。
3. 不做编辑器。
4. 不做树表。
5. 不做分组。
6. 不做服务端数据源。
7. 不改 registry product layer。

## 设计

新增 `controlled-state-model.ts`，统一比较受控输入源。

它不比较 rows/columns 长度，而是比较引用和值：

```txt
rows reference
columns reference
selectedKeys reference
sortColumn / sortDirection
activeRowKey / activeColumnId
rowHeight / overscan / virtual
selectionMode
resizable / keyboardNavigation
```

当变化发生时，返回精确 flags：

```txt
rowsChanged
columnsChanged
selectedKeysChanged
sortChanged
activeCellChanged
layoutChanged
selectionModeChanged
interactionChanged
```

组件根据 flags 决定同步：

```txt
columnsChanged -> 重建 baseColumns 和 defaultColumnWidths
selectedKeysChanged -> selection.setKeys(props.selectedKeys)
sortChanged -> createDataGridControlledSortState(...)
activeCellChanged -> shouldSyncActiveCellFromProps = true
```

内部状态变更后，需要同步回 props 并 commit controller：

```txt
syncSelectionPropsFromModel()
syncSortPropsFromModel()
syncActiveCellPropsFromModel()
commitControlledState()
```

## 测试

新增两类测试：

1. `controlled-state-model.spec.ts`

   - 测纯 core 状态比较。

2. `data-grid-behavior-contract.spec.ts`

   - 测组件源码行为契约，防止受控同步退化。

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
