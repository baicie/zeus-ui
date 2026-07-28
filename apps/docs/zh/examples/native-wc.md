# 原生 Web Components 示例

Zeus Web 支持两种原生 Web Component 路径：

1. 通过 `@zeus-web/ui` 使用原生带样式 Web Components。
2. 通过按组件拆分的 `/wc` 入口使用 headless primitive Web Components。

## 原生带样式 Showcase

运行：

```bash
pnpm showcase:native
```

构建：

```bash
pnpm showcase:native:build
```

测试：

```bash
pnpm showcase:native:test
```

原生 Showcase 会导入由包管理的带样式 UI 入口：

```ts
import '@zeus-web/ui'
```

然后使用原生自定义元素：

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

此路径不需要 React 或 Vue。

## 按组件导入带样式入口

你可以分别导入各组件的带样式入口：

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

## 仅样式路径

你可以只加载带样式 CSS，并分别注册 primitives：

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/button/wc/auto'
import '@zeus-web/input/wc/auto'
```

## Headless Primitive 路径

如果你希望自行管理样式层，请直接使用 primitive WC 入口：

```ts
import '@zeus-web/button/wc/auto'
import '@zeus-web/input/wc/auto'
```

```html
<zw-button>Save</zw-button> <zw-input placeholder="Email"></zw-input>
```

## 应该选择哪一种？

| 需求                        | 使用方式                   |
| --------------------------- | -------------------------- |
| 带样式的自定义元素          | `@zeus-web/ui`             |
| 不使用 React 或 Vue runtime | `@zeus-web/ui`             |
| 由包管理样式                | `@zeus-web/ui`             |
| 自定义样式和行为 primitives | `@zeus-web/<component>/wc` |
