# Phase 13：RevoGrid Adapter Product Layer

## 目标

Phase 13 将 `@zeus-web/revogrid-adapter` 接入产品层：

1. registry manifest
2. native / react / vue templates
3. registry package exports
4. registry tests
5. AI metadata
6. product contract

## Registry

新增 registry item：

```txt
revogrid-adapter
```

三端模板：

```txt
templates/native/revogrid-adapter.ts
templates/react/revogrid-adapter.tsx
templates/vue/revogrid-adapter.vue
```

## 设计原则

1. 模板只依赖 `@zeus-web/revogrid-adapter`。
2. 模板不导入真实 `@revolist/revogrid`。
3. 模板不注册 RevoGrid loader。
4. 用户项目自行安装并注册 RevoGrid。
5. 模板不包含 fetch / API key / provider 逻辑。
6. React/Vue 模板从 wrapper 入口导入组件，从根入口导入类型。

## AI Metadata

新增 advanced component：

```txt
revogrid-adapter
```

AI rules 必须明确：

1. 适合已注册 `<revo-grid>` 的项目。
2. 简单表格继续用 `data-grid`。
3. 不要把 RevoGrid 实现依赖写进生成模板。
4. 不要在 adapter 模板中写请求逻辑。

## Contract

新增：

```txt
scripts/checks/contract/check-revogrid-adapter-product-contract.ts
```

检查：

1. registry item 存在。
2. native/react/vue 三端文件存在。
3. package exports 存在。
4. 模板使用正确入口。
5. 模板不包含 `@revolist/revogrid`。
6. 模板不包含 API key / fetch / provider 逻辑。

## 验收

```bash
pnpm --filter @zeus-web/registry test
pnpm --filter @zeus-web/ai test

pnpm check:revogrid-adapter-product-contract
pnpm check:product-contract
```
