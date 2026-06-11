# Zeus-UI 代码审查报告

> 日期：2026-06-03
> 审查范围：zeus-ui monorepo 全目录
> 依据文档：docs/internal/design/phase0.md、docs/internal/roadmap.md、docs/internal/packages.md、zeus/examples/headless

---

## 审查结果摘要

本次审查发现 16 个问题，按优先级分为：

- **P0（阻断）**：2 个，必须立即修复
- **P1（严重）**：4 个，影响构建正确性和代码风格统一
- **P2（重要）**：4 个，架构和体验不一致
- **P3（一般）**：6 个，工程细节优化

---

## P0 — 阻断问题

### P0-1. 手写 `custom-elements.json` 与源码不同步

**位置**：`packages/primitives/input/custom-elements.json`

**问题描述**：`custom-elements.json` 是手动维护的静态 JSON，但源码 `input.ts` 定义的属性远比它完整。

| 差异项               | 源码 `input.ts` | 手写 `custom-elements.json`  |
| -------------------- | --------------- | ---------------------------- |
| `default-value` attr | 有              | **缺失**                     |
| `name` attr          | 有              | **缺失**                     |
| `required` attr      | 有              | **缺失**                     |
| `readonly` attr      | 有              | **缺失**                     |
| class name           | `Input`         | `ZeusInputElement`（不匹配） |
| Events               | `value-change`  | `value-change`（正确）       |

**影响**：这个文件应该由 `@zeus-js/output-wc` 在构建时自动生成。手写版本会与真实构建产物产生漂移，一旦构建后 `dist/custom-elements.json` 才是真正可信的版本，源码中的手写版本是隐患。

**修复方案**：删除 `packages/primitives/input/custom-elements.json`，由构建产物 `dist/custom-elements.json` 替代。

---

### P0-2. `@zeus-web/themes` CSS 导出路径指向源文件而非构建产物

**位置**：`packages/themes/package.json`

**问题描述**：

```json
"./tokens.css": "./src/tokens.css",
"./default.css": "./src/default.css"
```

但 `sideEffects` 声明了 `"./dist/*.css"`，exports 与 sideEffects 矛盾。

**影响**：

- 用户 import CSS 时拿到源文件，无法在构建时处理 CSS
- `sideEffects` 指向 `dist/` 但 exports 指向 `src/`，打包工具行为不可预期
- 构建后 `dist/` 下无 CSS 文件

**修复方案**：

1. 将 CSS 文件加入 `src/index.ts` export（作为入口文件触发 tsup 打包）
2. 修改 exports 指向 `dist/*.css`
3. 移除 `src/` 下的 CSS 文件（仅保留构建产物）
4. 或保留源文件但 exports 改为 `dist/` 并确保构建时复制

---

## P1 — 严重问题

### P1-1. TypeScript 编译目标版本不一致

**位置**：`scripts/config/tsconfig.base.json`、`scripts/rollup/createPrimitiveRollupConfig.mjs`、`AGENTS.md`

**问题描述**：

| 位置                                                  | target   |
| ----------------------------------------------------- | -------- |
| `tsconfig.base.json`                                  | `ES2022` |
| `createPrimitiveRollupConfig.mjs` transformTypeScript | `es2016` |
| AGENTS.md 声明                                        | `ES2016` |

**影响**：构建产物 target 是 ES2022，源码编译 target 是 es2016，两层目标不统一。AGENTS.md 承诺 ES2016 但实际按 ES2022 编译，产物体积和兼容性不符预期。

**修复方案**：将 `tsconfig.base.json` 的 `target` 改为 `ES2016`。

---

### P1-2. input 组件混用 imperative DOM API 与 JSX，风格与 zeus examples 割裂

**位置**：`packages/primitives/input/src/input.ts`

**问题描述**：input.ts 混用了 `document.createElement` + `bindProp`/`bindAttr` 的 imperative 响应式写法，而 zeus examples（`zeus/examples/headless/src/button/button.tsx`）是纯 JSX 风格。

**zeus examples 风格**：

```tsx
function setup(props: ButtonProps, ctx) {
  return (
    <Host data-variant={() => props.variant}>
      <button part="root">
        <Slot />
      </button>
    </Host>
  )
}
```

**zeus-ui input.ts 风格**：

```ts
;(props, { emit }) => {
  const input = document.createElement('input')
  input.part.add('input')
  bindAttr(host, 'data-slot', () => 'input-root')
  bindProp(input, 'value', () => getInputValue(props))
  // ...
  return input
}
```

**影响**：

- 代码风格不统一，维护成本增加
- `bindProp(input, 'value', ...)` 不如 JSX 的 `value={...}` 直观
- `data-variant`、`data-size` 等属性未定义，只有 `data-slot` 和 `data-disabled`
- `meta.cssParts` 声明 `['input']`，应与 zeus examples 一致为 `['root']`

**修复方案**：重构 `input.ts` 为纯 JSX 风格，参考 zeus examples 的 `setup` 函数模式。

---

### P1-3. `createPrimitiveRollupConfig` 中 `transformTypeScript` 插件在 `zeus()` 之后重复执行

**位置**：`scripts/rollup/createPrimitiveRollupConfig.mjs`

**问题描述**：Rollup 插件链中，`transformTypeScript()` 在 `zeus()` **之后**执行，等于把 zeus 输出的代码再过一遍 esbuild：

```js
plugins: [
  resolveTypeScriptSource(),
  zeus({ ... }),        // 处理 JSX 和 TypeScript
  transformTypeScript(), // 再过一遍 esbuild —— 重复
],
```

**影响**：双转换开销，潜在代码破坏风险。

**修复方案**：移除 `transformTypeScript()` 插件和 `resolveTypeScriptSource()` 插件（后者也是冗余的，Rollup 内置支持 `.ts/.tsx` 解析）。`@zeus-js/bundler-plugin` 已经包含了所有需要的转换逻辑。

---

### P1-4. registry 只有类型定义，没有 `registry.json` 实际数据

**位置**：`packages/registry/src/index.ts`、`packages/registry/registry.json`

**问题描述**：`index.ts` 只 export 了三个 TypeScript interface，`registry.json` 文件不存在。Phase 5/6 要求 registry 作为 shadcn-like copy layer 的数据源。

**修复方案**：创建 `packages/registry/registry.json`，包含 input 组件的 registry item 数据。

---

## P2 — 重要问题

### P2-1. 标签前缀命名不一致

**位置**：`packages/primitives/input/rollup.config.mjs`、`zeus/examples/headless`

| 位置          | 标签前缀 | 例子                 |
| ------------- | -------- | -------------------- |
| zeus examples | `z-`     | `z-button`, `z-tabs` |
| zeus-ui input | `zw-`    | `zw-input`           |

**修复方案**：统一为 `z-`，与 zeus 生态保持一致。修改 `rollup.config.mjs` 中的 `tagPrefix: 'zw-'` 为 `tagPrefix: 'z-'`（作为默认值），并更新 `input.ts` 中的标签名 `zw-input` 为 `z-input`。

---

### P2-2. import 来源不一致

**位置**：`packages/primitives/input/src/input.ts`

| 来源                                                                       | 使用场景         |
| -------------------------------------------------------------------------- | ---------------- |
| `import { ... } from '@zeus-js/zeus'`                                      | zeus examples    |
| `import { bindAttr, bindProp, defineElement } from '@zeus-js/runtime-dom'` | zeus-ui input.ts |

**影响**：根据 `docs/internal/packages.md`，`@zeus-js/zeus` 是推荐的用户统一入口。

**修复方案**：将 import 来源统一为 `@zeus-js/zeus`。

---

### P2-3. 聚合包 `@zeus-web/headless/react/vue` 是空壳 re-export

**位置**：`packages/headless/src/index.ts`、`packages/react/src/index.ts`、`packages/vue/src/index.ts`

这三个包只是 `export * from '@zeus-web/input'`，没有独立价值。

**修复方案**：暂保留（Phase 4 会扩展），但添加注释说明其定位。

---

### P2-4. CLI 处于完全不可用状态

**位置**：`packages/cli/src/commands/add.ts`

`add` 命令只打印 plan，Phase 5/6 要求的文件复制、依赖安装等全部未实现。

**修复方案**：在 add.ts 中添加 TODO 注释，明确 Phase 5/6 的实现计划。

---

## P3 — 一般问题

### P3-1. vitest `unit-jsdom` 项目的 include 模式不够递归

**位置**：`vitest.config.ts`

`packages/*/*.{test,spec}.*` 只匹配包根下的测试文件，不匹配深层目录如 `packages/foo/components/test.ts`。

**修复方案**：改为递归 glob 模式 `packages/**/*.test.ts` 或 `packages/**/*.spec.ts`。

---

### P3-2. 根 devDependencies 部分包版本格式不一致

**位置**：`package.json`

```json
"@zeus-js/bundler-plugin": "^0.1.0-beta.0",  // 有 ^
"@zeus-js/compiler": "0.1.0-beta.0",          // 缺 ^
"@zeus-js/runtime-dom": "0.1.0-beta.0",        // 缺 ^
"@zeus-js/signal": "0.1.0-beta.0"              // 缺 ^
```

**修复方案**：统一添加 `^` 前缀。

---

### P3-3. `@zeus-js/output-icons` 是死依赖

根 devDependencies 中有 `@zeus-js/output-icons`，但 zeus-ui 没有 icon primitive，构建配置中也未使用。

**修复方案**：移除该依赖（Phase 8 需要时再加回）。

---

### P3-4. check-build-output 使用 `spawnSync` 阻塞主线程

**位置**：`scripts/checks/check-build-output.ts`

**修复方案**：改用 `execa`（项目已有依赖）异步执行。

---

### P3-5. `@zeus-web/utils` 只有 `cx` 一个函数

`cx` 功能等价于 `clsx`（已在 CLI 依赖中），存在感弱。

**修复方案**：保留但添加注释说明其定位。

---

### P3-6. examples 目录为空

`examples/vanilla`、`examples/vite-react`、`examples/vite-vue` 只有 `package.json`，无源码。

**修复方案**：Phase 9 实现时补充。

---

## 修复状态

| 问题                                               | 状态 |
| -------------------------------------------------- | ---- |
| P0-1: 删除手写 custom-elements.json                | ✅   |
| P0-2: 修复 themes CSS sideEffects 指向 src/        | ✅   |
| P1-1: 统一 TypeScript target 为 ES2016             | ✅   |
| P1-2: 重构 input.ts 为纯 JSX 风格（重命名为 .tsx） | ✅   |
| P1-3: 移除重复的 transformTypeScript 插件          | ✅   |
| P1-4: 完善 registry.json 数据                      | ✅   |
| P2-1: 统一标签前缀为 z-                            | ✅   |
| P2-2: 统一 import 来源为 @zeus-js/runtime-dom      | ✅   |
| P2-3: 聚合包添加定位注释                           | ✅   |
| P2-4: CLI 添加 Phase 5/6 实现计划注释              | ✅   |
| P3-1: vitest include 改为递归模式                  | ✅   |
| P3-2: devDependencies 版本格式统一（添加 ^）       | ✅   |
| P3-3: 移除死依赖 output-icons                      | ✅   |
| P3-4: check-build-output 改为异步（execa）         | ✅   |
| P3-5: utils 添加定位注释                           | ✅   |
| P3-6: examples 目录（Phase 9 实现）                | —    |

## 附加修复（审查过程中发现）

| 问题                                                                      | 状态 |
| ------------------------------------------------------------------------- | ---- |
| Windows 路径兼容性：package-rules.ts 使用 `toForwardSlash` 统一路径分隔符 | ✅   |
| JSX 类型缺失：创建 `scripts/config/jsx.d.ts` 提供 `JSX.IntrinsicElements` | ✅   |
| ES2016 API 兼容性：setup-vitest.ts 使用 `[len-1]` 替代 `.at(-1)`          | ✅   |
| input.ts 重命名为 .tsx（支持 JSX 语法）                                   | ✅   |
| 添加 `@zeus-js/zeus` devDependency（JSX 类型来源）                        | ✅   |
