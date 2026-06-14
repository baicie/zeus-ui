# Phase 6：Data Grid Product Layer

## 目标

Phase 6 将 `@zeus-web/data-grid` 接入 Zeus Web 产品化层，使它可以被 registry、CLI、AI metadata 和用户项目模板消费。

本阶段不扩展 DataGrid core，只补产品层。

## 范围

本阶段新增：

```txt
packages/registry/templates/native/data-grid.ts
packages/registry/templates/react/data-grid.tsx
packages/registry/templates/vue/data-grid.vue
packages/ai/__tests__/data-grid-ai-metadata.spec.ts
scripts/checks/contract/check-data-grid-product-contract.ts
scripts/checks/contract/__tests__/check-data-grid-product-contract.spec.ts
docs/advanced/design/phase6.md
```

本阶段修改：

```txt
package.json
packages/registry/registry.json
packages/registry/package.json
packages/registry/__tests__/registry-package.spec.ts
packages/ai/src/types.ts
packages/ai/src/metadata.ts
```

## 非目标

本阶段不做：

1. 不改 `@zeus-web/data-grid` core。
2. 不做列虚拟。
3. 不做单元格编辑。
4. 不做过滤器。
5. 不做树表。
6. 不做服务端数据源。
7. 不接远程 API。
8. 不引入 AG Grid 依赖。

## Registry

新增 registry item：

```txt
data-grid
```

支持：

```txt
native
react
vue
```

目标文件：

```txt
components/data-grid.ts
components/ui/data-grid.tsx
components/ui/data-grid.vue
```

## AI Metadata

`data-grid` 作为 advanced component 加入 `advancedComponents`，描述：

1. 适用场景。
2. 不适用场景。
3. 事件。
4. 方法。
5. prompt hints。
6. React registry 示例。
7. Native Web Component 示例。

## Contract

新增：

```txt
pnpm check:data-grid-product-contract
```

该检查确保：

1. registry 中存在 data-grid。
2. registry package exports 暴露 data-grid templates。
3. native/react/vue templates 存在。
4. native template 是真实源码，不是 `String.raw`。
5. AI metadata 存在 data-grid。
6. 不包含 provider 请求逻辑。
7. 不包含 AG Grid 依赖。

## 验收

```bash
pnpm --filter @zeus-web/registry test
pnpm --filter @zeus-web/ai test
pnpm check:data-grid-product-contract
pnpm check:product-contract
pnpm test-unit
```
