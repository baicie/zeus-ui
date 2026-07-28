# 主题

Zeus Web 提供两套 token：

1. `--zeus-*` 变量用于通过 Registry 安装的 React/Vue 源码组件。
2. `--zw-*` 变量用于由包管理的原生带样式 Web Components。

## Registry 源码 Token

运行：

```bash
zweb init --style slate
```

CLI 会写入或更新：

```txt
src/styles/zeus.css
```

该文件包含生成组件所使用的 `--zeus-*` 变量。

示例：

```css
:root {
  --zeus-background: 0 0% 100%;
  --zeus-foreground: 240 10% 3.9%;
  --zeus-primary: 240 5.9% 10%;
  --zeus-primary-foreground: 0 0% 98%;
  --zeus-border: 240 5.9% 90%;
  --zeus-ring: 240 5.9% 10%;
}
```

Registry 组件会使用这些变量：

```tsx
<Button variant="primary">Save</Button>
<Input placeholder="Email" />
```

## 原生带样式 Web Component Token

导入：

```ts
import '@zeus-web/ui'
```

该包会在内部加载 `@zeus-web/themes/default.css` 和组件 CSS。

原生带样式 Web Components 使用 `--zw-*` 变量：

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

你也可以只导入样式：

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/button/wc/auto'
import '@zeus-web/input/wc/auto'
```

## 可用主题名称

<div class="zw-badge-row">
  <span class="zw-badge">default</span>
  <span class="zw-badge">slate</span>
  <span class="zw-badge">zinc</span>
  <span class="zw-badge">neutral</span>
  <span class="zw-badge">stone</span>
</div>

## 深色模式

Registry 样式支持 `.dark`：

```html
<html class="dark">
  ...
</html>
```

原生 `@zeus-web/ui` 样式也会通过主题包提供深色 token 值。

## 圆角与动效

```bash
zweb init --radius lg --motion reduced
```

此命令会更新 `src/styles/zeus.css` 中由 CLI 管理的变量。

## 强调色

```bash
zweb init --accent "220 90% 56%"
```

此命令可以覆盖 primary 和 ring 颜色 token。

## 规则

使用语义化变量，不要硬编码颜色。

在由 Registry 管理的应用源码中使用 `--zeus-*`。

在设置或覆盖原生 `@zeus-web/ui` 界面的样式时使用 `--zw-*`。
