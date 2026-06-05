# Zeus Web Package Collections Design

> 状态：设计草案
> 目标：减少用户感知的子包数量，同时保留 primitive 级别的按需安装、按需构建和可发布边界。

## 1. 背景

当前 Zeus Web 包会随组件数量增长快速膨胀：

```txt
@zeus-web/input
@zeus-web/button
@zeus-web/checkbox
@zeus-web/switch
@zeus-web/tabs
@zeus-web/dialog
...
```

这种结构对维护和构建有好处：

- 每个 primitive 可以独立构建、测试、发布。
- registry / CLI 可以只安装用户选择的组件。
- Web Component、React wrapper、Vue wrapper 都可以由 Zeus output pipeline 从单一源码生成。

但它对用户不友好：

- 用户需要理解太多包名。
- 文档和安装说明会变长。
- React / Vue / Headless 聚合入口容易变成空壳或重复维护。
- 后续几十个组件时，package list 会失控。

因此需要引入“集合包”和“分类集合包”。

## 2. 设计目标

1. 用户常规安装只需要少数几个集合包。
2. CLI / registry 仍然可以按单组件安装 primitive 包。
3. primitive 源码仍然独立，构建产物仍然由 Zeus output pipeline 生成。
4. React / Vue / WC 三种消费方式都能通过集合入口获得。
5. 分类集合必须稳定、可解释，避免随意扩张。
6. 不把主题、registry、CLI、兼容层混入组件集合。

## 3. 非目标

本设计不做：

- 删除所有 primitive 包。
- 把所有组件源码合并到一个巨型包。
- 改变 Zeus output-wc / output-react-wrapper / output-vue-wrapper 的职责。
- 改变 registry 的 copy layer 设计。
- 改变 `@zeus-js/*` 核心包的公共 API。

## 4. 包分层

建议将包分为四层。

### 4.1 Primitive Layer

单组件源码包，继续保留。

```txt
@zeus-web/input
@zeus-web/button
@zeus-web/checkbox
@zeus-web/switch
@zeus-web/tabs
@zeus-web/dialog
```

职责：

- 持有组件源码：`src/{name}.tsx`
- 通过 Rolldown + Zeus output pipeline 生成：
  - `dist/wc`
  - `dist/react`
  - `dist/vue`
  - `dist/custom-elements.json`
  - `dist/zeus.components.json`
- 暴露单组件入口：
  - `@zeus-web/input/wc`
  - `@zeus-web/input/react`
  - `@zeus-web/input/vue`

用户通常不需要手动安装 primitive，除非追求最小依赖。

### 4.2 Category Collection Layer

分类集合包，按产品语义聚合多个 primitive。

建议首批分类：

| 包名                   | 分类     | 包含组件                      |
| ---------------------- | -------- | ----------------------------- |
| `@zeus-web/forms`      | 表单输入 | `input`、`checkbox`、`switch` |
| `@zeus-web/actions`    | 操作控件 | `button`                      |
| `@zeus-web/overlays`   | 浮层反馈 | `dialog`                      |
| `@zeus-web/navigation` | 导航结构 | `tabs`                        |

后续可扩展：

| 包名                     | 分类     | 可能组件                                   |
| ------------------------ | -------- | ------------------------------------------ |
| `@zeus-web/selection`    | 选择器   | `select`、`radio-group`、`combobox`        |
| `@zeus-web/feedback`     | 反馈     | `toast`、`alert`、`progress`               |
| `@zeus-web/layout`       | 布局     | `separator`、`scroll-area`、`aspect-ratio` |
| `@zeus-web/data-display` | 数据展示 | `table`、`avatar`、`badge`                 |

职责：

- 不持有组件源码。
- 只 re-export primitive 生成产物。
- 为每个 runtime 提供子路径入口。

示例：

```ts
// @zeus-web/forms/wc
export * from '@zeus-web/input/wc'
export * from '@zeus-web/checkbox/wc'
export * from '@zeus-web/switch/wc'

// @zeus-web/forms/react
export * from '@zeus-web/input/react'
export * from '@zeus-web/checkbox/react'
export * from '@zeus-web/switch/react'

// @zeus-web/forms/vue
export * from '@zeus-web/input/vue'
export * from '@zeus-web/checkbox/vue'
export * from '@zeus-web/switch/vue'
```

### 4.3 Runtime Aggregate Layer

按 runtime 聚合所有组件，面向框架用户。

现有包可保留并调整定位：

```txt
@zeus-web/headless
@zeus-web/react
@zeus-web/vue
```

职责：

- `@zeus-web/headless` 聚合所有 primitive 的 `wc` 输出。
- `@zeus-web/react` 聚合所有 primitive 的 `react` 输出。
- `@zeus-web/vue` 聚合所有 primitive 的 `vue` 输出。
- 不持有组件源码。
- 不生成 wrapper，只 re-export 已生成产物。

用户入口：

```ts
import { Input, Button } from '@zeus-web/react'
import { Input, Button } from '@zeus-web/vue'
import '@zeus-web/headless'
```

### 4.4 Platform Layer

平台工具包，不进入组件集合。

```txt
@zeus-web/themes
@zeus-web/registry
@zeus-web/cli
@zeus-web/utils
@zeus-web/zeus-compat
```

职责：

- `themes`：设计变量和默认主题。
- `registry`：copyable source 数据源。
- `cli`：`zweb init` / `zweb add`。
- `utils`：用户组件源码可复用工具。
- `zeus-compat`：Zeus 公共 API 兼容性断言。

这些包不应被组件集合隐式 re-export。

## 5. 推荐包结构

```txt
packages/
  primitives/
    input/
    button/
    checkbox/
    switch/
    tabs/
    dialog/

  collections/
    forms/
    actions/
    overlays/
    navigation/

  headless/
  react/
  vue/

  themes/
  registry/
  cli/
  utils/
  zeus-compat/
```

说明：

- `packages/primitives/*` 是真实源码包。
- `packages/collections/*` 是分类集合包。
- `packages/headless`、`packages/react`、`packages/vue` 是 runtime 总集合。
- `packages/themes`、`registry`、`cli` 等保持平台工具定位。

## 6. 命名规则

### 6.1 Primitive 包

```txt
@zeus-web/{component}
```

示例：

```txt
@zeus-web/input
@zeus-web/dialog
```

### 6.2 分类集合包

```txt
@zeus-web/{category}
```

分类名必须是产品语义，不使用技术语义。

推荐：

```txt
forms
actions
overlays
navigation
feedback
layout
data-display
selection
```

不推荐：

```txt
basic
common
misc
core-components
components-1
```

### 6.3 Runtime 总集合包

```txt
@zeus-web/headless
@zeus-web/react
@zeus-web/vue
```

这三个包只表示消费 runtime，不表示组件分类。

## 7. Export 设计

### 7.1 Primitive package exports

以 `@zeus-web/input` 为例：

```json
{
  "exports": {
    ".": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js"
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue/index.js"
    },
    "./custom-elements.json": {
      "default": "./dist/custom-elements.json"
    },
    "./zeus.components.json": {
      "default": "./dist/zeus.components.json"
    }
  }
}
```

### 7.2 Category collection exports

以 `@zeus-web/forms` 为例：

```json
{
  "exports": {
    ".": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js"
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue/index.js"
    }
  }
}
```

默认入口 `.` 指向 `wc`，与 primitive 包保持一致。

### 7.3 Runtime aggregate exports

以 `@zeus-web/react` 为例：

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./forms": {
      "types": "./dist/forms.d.ts",
      "import": "./dist/forms.js"
    },
    "./overlays": {
      "types": "./dist/overlays.d.ts",
      "import": "./dist/overlays.js"
    }
  }
}
```

`./forms` 这类子路径可以作为可选增强，不作为第一阶段必需项。

## 8. 用户安装方式

### 8.1 最小安装

适合只用一个组件的用户。

```bash
pnpm add @zeus-web/input
```

```ts
import { Input } from '@zeus-web/input/react'
```

### 8.2 分类安装

适合使用某一类组件的用户。

```bash
pnpm add @zeus-web/forms
```

```ts
import { Input, Checkbox, Switch } from '@zeus-web/forms/react'
```

### 8.3 Runtime 总集合安装

适合应用项目。

```bash
pnpm add @zeus-web/react
```

```ts
import { Input, Button, Dialog } from '@zeus-web/react'
```

### 8.4 CLI 安装

CLI 仍然按 registry item 的 primitive 依赖安装，保证 copy layer 最小化。

```bash
zweb add input dialog
```

生成 registry item 时：

```json
{
  "name": "input",
  "dependencies": ["@zeus-web/input"]
}
```

不建议 CLI 默认安装 `@zeus-web/forms`，因为用户添加单个组件时应保持最小依赖。

## 9. 构建策略

### 9.1 Primitive 构建

primitive 包使用 Rolldown + Zeus output pipeline：

```ts
import { createPrimitiveRolldownConfig } from '../../../scripts/rolldown/createPrimitiveRolldownConfig.mjs'

export default createPrimitiveRolldownConfig({
  input: 'src/index.ts',
})
```

### 9.2 分类集合构建

分类集合包只需要普通 TS 构建或 tsup 构建。

源码结构：

```txt
packages/collections/forms/src/
  index.ts
  wc.ts
  react.ts
  vue.ts
```

示例：

```ts
// src/wc.ts
export * from '@zeus-web/input/wc'
export * from '@zeus-web/checkbox/wc'
export * from '@zeus-web/switch/wc'
```

```ts
// src/react.ts
export * from '@zeus-web/input/react'
export * from '@zeus-web/checkbox/react'
export * from '@zeus-web/switch/react'
```

```ts
// src/vue.ts
export * from '@zeus-web/input/vue'
export * from '@zeus-web/checkbox/vue'
export * from '@zeus-web/switch/vue'
```

```ts
// src/index.ts
export * from './wc'
```

### 9.3 Runtime 总集合构建

`@zeus-web/react` 可以直接聚合所有分类集合：

```ts
export * from '@zeus-web/forms/react'
export * from '@zeus-web/actions/react'
export * from '@zeus-web/overlays/react'
export * from '@zeus-web/navigation/react'
```

`@zeus-web/headless`：

```ts
export * from '@zeus-web/forms/wc'
export * from '@zeus-web/actions/wc'
export * from '@zeus-web/overlays/wc'
export * from '@zeus-web/navigation/wc'
```

`@zeus-web/vue`：

```ts
export * from '@zeus-web/forms/vue'
export * from '@zeus-web/actions/vue'
export * from '@zeus-web/overlays/vue'
export * from '@zeus-web/navigation/vue'
```

## 10. Tree-shaking 与 sideEffects

### 10.1 Primitive sideEffects

WC 输出可能注册 custom element，因此 primitive 需要保留 WC side effect：

```json
{
  "sideEffects": ["./dist/wc/index.js", "./dist/wc/*.js", "./dist/**/*.css"]
}
```

### 10.2 React / Vue wrapper

React / Vue wrapper 应尽量保持无副作用。

集合包本身不应引入额外副作用，只 re-export。

### 10.3 Headless 总集合

`@zeus-web/headless` 聚合 WC 输出，会触发 custom element 注册，应声明 sideEffects。

`@zeus-web/react` 和 `@zeus-web/vue` 如果只导出 wrapper，可以声明 `sideEffects: false`，但要等实际产物确认后再加。

## 11. Registry 设计

registry item 仍以 primitive 为依赖单位。

```json
{
  "name": "input",
  "type": "registry:ui",
  "dependencies": ["@zeus-web/input"],
  "files": [
    {
      "path": "input.tsx",
      "target": "components/ui/input.tsx",
      "type": "registry:ui"
    }
  ]
}
```

原因：

- copy layer 应尽量小。
- 用户添加 `input` 不应被迫安装 `checkbox/switch`。
- 分类集合是手写代码消费入口，不是 registry 的默认安装策略。

可选增强：registry 可以增加 `collection` 字段供文档分组使用。

```json
{
  "name": "input",
  "collection": "forms"
}
```

该字段只用于展示和过滤，不影响依赖安装。

## 12. 文档导航

文档应按分类集合组织，而不是按包目录组织。

建议结构：

```txt
Components
  Forms
    Input
    Checkbox
    Switch
  Actions
    Button
  Overlays
    Dialog
  Navigation
    Tabs
```

每个组件文档展示三种安装方式：

```txt
最小安装：@zeus-web/input
分类安装：@zeus-web/forms
总集合安装：@zeus-web/react / @zeus-web/vue / @zeus-web/headless
```

## 13. 迁移计划

### Phase A：设计落地

1. 新增本文档。
2. 确认首批分类：
   - forms
   - actions
   - overlays
   - navigation
3. 更新 roadmap 中 Phase 4 的聚合包目标。

### Phase B：新增分类集合包

1. 新增 `packages/collections/forms`。
2. 新增 `packages/collections/actions`。
3. 新增 `packages/collections/overlays`。
4. 新增 `packages/collections/navigation`。
5. 每个集合包只 re-export primitive 产物。

### Phase C：调整 runtime 总集合

1. `@zeus-web/headless` 改为聚合分类集合的 `wc`。
2. `@zeus-web/react` 改为聚合分类集合的 `react`。
3. `@zeus-web/vue` 改为聚合分类集合的 `vue`。

### Phase D：CLI / registry 对齐

1. registry item 增加 `collection` 字段。
2. CLI 继续按 primitive 依赖安装。
3. 文档按 collection 分组展示。

### Phase E：质量检查

新增或更新检查：

```txt
- 分类集合包必须只 re-export primitive 包或其他集合包
- 分类集合包不能依赖 @zeus-js/*
- 分类集合包不能持有组件源码
- runtime 总集合必须通过分类集合聚合
- registry dependencies 必须指向 primitive 包，不默认指向集合包
```

## 14. 推荐首批实现顺序

当前项目只有 `input` primitive，因此不要一次性创建空分类包。

推荐顺序：

1. 先创建 `@zeus-web/forms`，只包含 `input`。
2. 等 `button` 完成后创建 `@zeus-web/actions`。
3. 等 `dialog` 完成后创建 `@zeus-web/overlays`。
4. 等 `tabs` 完成后创建 `@zeus-web/navigation`。
5. 最后把 `@zeus-web/react/vue/headless` 改为聚合这些分类集合。

这样可以避免大量空集合包，也避免用户安装后拿不到实际组件。

## 15. 最终推荐

采用“三层组件入口”：

```txt
单组件：@zeus-web/input
分类集合：@zeus-web/forms
总集合：@zeus-web/react / @zeus-web/vue / @zeus-web/headless
```

维护侧继续按 primitive 拆包，用户侧通过分类集合和总集合减少心智负担。

第一步只建议落地 `@zeus-web/forms`，因为当前只有 `input` 已经可用。
