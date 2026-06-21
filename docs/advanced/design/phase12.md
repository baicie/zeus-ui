# Phase 12：RevoGrid Adapter Runtime Harness

## 目标

Phase 12 为 `@zeus-web/revogrid-adapter` 增加 DOM runtime 测试。

Phase 11 已完成 core mapping 与 component protocol。Phase 12 验证真实 custom element 挂载行为：

1. `zw-revogrid-adapter` 可以注册并挂载。
2. 内部 `<revo-grid>` 可以接收 adapter state。
3. 不依赖真实 `@revolist/revogrid`。
4. 使用 fake `<revo-grid>` 验证属性写入。

## 测试范围

新增：

```txt
e2e/advanced/revogrid-adapter/revogrid-adapter-runtime-harness.ts
e2e/advanced/revogrid-adapter/revogrid-adapter-runtime.spec.ts
```

修改：

```txt
packages/advanced/revogrid-adapter/package.json
```

## Fake RevoGrid

测试中注册：

```txt
customElements.define('revo-grid', FakeRevoGrid)
```

FakeRevoGrid 支持：

```txt
columns
source
sorting
selectedRows
readonly
refresh()
```

## 覆盖点

1. mount
2. columns/source 写入
3. sorting 写入
4. selectedRows 写入
5. readonly 写入
6. refresh 调用
7. adapter-ready
8. adapter-change
9. getRevoColumns / getRevoSource / getRevoSort / getRevoSelection / getState
10. setRows / setColumns / setSelection / setSort / clearSort / refresh
11. custom getRowKey
12. hidden columns filter
13. 不引入真实 RevoGrid

## 验收

```bash
pnpm --filter @zeus-web/revogrid-adapter check
pnpm --filter @zeus-web/revogrid-adapter test:unit
pnpm --filter @zeus-web/revogrid-adapter test:e2e
pnpm --filter @zeus-web/revogrid-adapter test
pnpm --filter @zeus-web/revogrid-adapter build
```
