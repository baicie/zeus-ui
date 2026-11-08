# 主题、样式隔离与按需 CSS

本文说明 Zeus Web 的样式层如何分发、两种分发模式（WC 包与 Registry 源码）的差异，以及在 CSP、RTL 和暗色模式下的已知约束。数据来自本仓库的实际构建产物与 `scripts/checks/build/check-ui-tarball-baseline.ts` 的实测结果。

## 1. 三份 CSS，各管一段

| 文件                                                                | 作用                                                                                                    | 由谁生成                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `tokens.css`                                                        | 尺度、动效、圆角等与主题无关的非颜色 token                                                              | 手写                                                      |
| `<theme>.css`（`default` / `slate` / `zinc` / `neutral` / `stone`） | 19 个语义颜色 token + 9 个 `--zw-*` 原生别名 + 19 个 `--zeus-*` registry 别名 + `color-scheme` + 暗色块 | `scripts/emit-theme-css.ts` 从 `src/palettes.ts` 生成     |
| `components.css`（或 `components/*.css`）                           | 只作用于 `zw-*` 自定义元素的展示样式                                                                    | `scripts/split-component-css.ts` 从 `components.css` 拆分 |

主题文件是**生成物**：`themePalettes` 是唯一权威数据源，`themes.spec.ts` 断言生成的 CSS 与 `palettes.ts` 字节级一致。要改颜色，改 `palettes.ts` 后重新构建，不要手改 CSS。

## 2. 暗色策略

内置主题文件固定输出 `class` 策略（`.dark`）。`createThemeCss` 的第四个参数可以把同一份调色板输出成另外两种策略：

```ts
import { createThemeCss } from '@zeus-web/themes'

createThemeCss('brand', 'slate', {}, { darkMode: 'class' }) // .dark
createThemeCss('brand', 'slate', {}, { darkMode: 'data' }) // [data-mode="dark"]
createThemeCss('brand', 'slate', {}, { darkMode: 'media' }) // prefers-color-scheme
```

三种策略下，浅色块都同时作用于 `:root` 与 `[data-theme='<name>']`，因此主题可以整体切换，也可以只包住一棵子树：

```html
<div data-theme="brand"><zw-button>Save</zw-button></div>
```

`class` 策略额外覆盖 `.dark [data-theme='brand']`，让「全局 .dark + 局部主题」也能取到暗色值。`media` 策略在 `@media (prefers-color-scheme: dark)` 里重复同一组选择器，不依赖任何 class 或属性。

每个块都写了 `color-scheme: light` / `dark`，滚动条与原生表单控件会跟随主题。

## 3. 两种分发模式

同一个组件有两种落地方式，样式来源不同：

### WC 包（`@zeus-web/<component>`）

- 组件以自定义元素形式随包分发，`dist/wc/auto.js` 注册元素。
- 样式来自 `@zeus-web/themes`：`tokens.css` + 一个主题文件 + `components.css`（或按需的单组件 CSS）。
- 主题变量挂在宿主文档上，所有 `zw-*` 元素共享同一份变量。

### Registry 源码（`zweb add <component>`）

- 组件源码被复制进用户项目（`packages/registry`），用户自己构建。
- 样式由 CLI 写入项目的 globals 文件：`:root` 里输出 `--zeus-*` token 与 `color-scheme`，暗色块按 `theme.darkMode` 输出 `@media` / `[data-mode]` / `.dark`。
- `--zeus-*` 是给 registry 版本使用的别名族，与包版本的 `--zw-*` 一一对应，指向同一批语义 token。所以换模式不需要改主题值。

两者可以共存于同一页面：`--zw-*` 与 `--zeus-*` 都从 19 个语义 token 派生，切换主题时一起更新。

## 4. 按需 CSS

`components.css` 是全量聚合文件（28.7 kB，gzip 4.8 kB，含全部组件的 189 条规则）。要减少首屏 CSS，改用单组件文件：

```ts
import '@zeus-web/themes/tokens.css'
import '@zeus-web/themes/default.css'
import '@zeus-web/themes/components/button.css'
import '@zeus-web/themes/components/dialog.css'
```

约束与事实：

- 单组件文件通过 `split-component-css.ts` 从 `components.css` 拆分，**拆分不丢选择器**（`themes.spec.ts` 逐条断言）。
- 共享规则（`zw-* { font: inherit }`、表单元素宽度）被复制进依赖它的文件，所以同时引入多个组件文件是安全的，不会因为缺 `base.css` 而掉样式。
- 被引用到的 `@keyframes` 会跟着复制进对应文件。
- 26 个组件文件合计 47.5 kB（gzip 17.9 kB），单文件中位 1.6 kB，最大 `select.css` 4.7 kB、最小 `label.css` 0.6 kB。
- 因为有共享规则复制，单组件文件之和（47.5 kB）大于聚合文件（28.7 kB）；按需引入 3–5 个组件仍然比全量小。

## 5. 样式隔离

组件一律使用 Light DOM（`shadow: false`），样式只靠 `[part='x']`、`[data-slot='x']` 和标签选择器命中。这意味着：

- **每个选择器都必须以 `zw-*` 自定义元素开头**。`components.css` 里不允许出现 `button`、`input`、`*` 这类裸选择器，否则会改到宿主页面。
- `check:ui-tarball-baseline` 强制这条规则：解析 `components.css` 的每条规则（含 `@media` / `@supports` 内部），`@keyframes` 的 `0%` / `from` / `to` 帧选择器不算元素选择器。当前违规数为 0。
- 类选择器（如 `.dark`）只出现在主题文件的根级块里，属于 token 定义，不是组件样式。

这条规则的代价是：宿主页面自带的 `zw-*` 同名元素会被组件样式命中。目前 `zw-` 前缀是本仓库专用，可视为约定。

## 6. RTL

组件样式使用 CSS 逻辑属性（`text-align: start`、`border-inline-start`、`inset-inline`、`margin-inline`），跟随文档 `dir`。

需要额外处理的只有两类：

1. **方向性动画/位移**：`zw-progress` 的 indeterminate 动画在 `:dir(rtl)` 下 `animation-direction: reverse`；`zw-tooltip-content` 的 `translate` 在 `:dir(rtl)` 下取反。
2. **方向性图标**：`zw-select` 的展开指示器、`zw-accordion` 的箭头等 glyph 边框保持物理方向，不镜像（它们是字形而非布局）。

已知缺口：右键菜单、下拉菜单的定位用的是物理坐标（`popover` / `dropdown-menu` 的 placement），RTL 下不会自动镜像锚点方向。这一项在 [人工验收脚本](./manual-acceptance.md) 里作为人工检查项，自动化测试不覆盖。

契约层面的其他待办见 [zeus-contract-proposals.md](./zeus-contract-proposals.md)。

## 7. CSP

组件运行时不需要 `unsafe-eval`：

- 运行时用 `el.style.setProperty(...)` 写内联样式（`patchStyle`），不注入 `<style>` 标签，不拼接 CSS 文本。
- 组件不调用 `eval` / `new Function`。
- 主题样式以普通 CSS 文件分发，由宿主页面自己引入。

因此 CSP 只要求 `style-src 'self'`（允许内联样式属性时再加 `'unsafe-inline'`）。用 `style-src` 的 nonce 方案时，**内联 `style` 属性无法加 nonce**：DataGrid 用内联样式做虚拟滚动定位（`grid-template-columns`、`transform`、`width`），这类场景需要允许 `style-src-attr 'unsafe-inline'`。

## 8. 实测体积

来自 `node scripts/checks/build/check-ui-tarball-baseline.ts`（`temp/ui-tarball-baseline.json`），Node 22.12.0 / npm pack --dry-run：

| 包                    | tarball | 解包后 | wc gzip | react gzip | vue gzip |
| --------------------- | ------: | -----: | ------: | ---------: | -------: |
| `@zeus-web/input`     |  8.9 kB |  60 kB |  2.9 kB |     0.5 kB |   0.5 kB |
| `@zeus-web/select`    | 23.4 kB | 143 kB |  7.1 kB |     0.5 kB |   0.5 kB |
| `@zeus-web/dialog`    | 17.0 kB | 225 kB | 12.2 kB |     2.2 kB |   2.3 kB |
| `@zeus-web/data-grid` | 99.0 kB | 564 kB | 15.4 kB |     0.7 kB |   0.6 kB |
| `@zeus-web/themes`    | 15.8 kB | 118 kB |       — |          — |        — |

`themes` 包的 CSS 合计 97.6 kB（gzip 26.4 kB），其中 `components.css` 聚合文件、26 个单组件文件、5 个内置主题与 `tokens.css` 同时随包分发。只引主题时打包器按导入裁剪，不会带进全部组件样式。
