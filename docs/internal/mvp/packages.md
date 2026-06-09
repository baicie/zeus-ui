# Zeus Packages — Publish Reference & API Guide

> 本文档面向 AI agent 使用，列出 Zeus 所有可发布包的元信息、依赖关系与公共 API。语言：中文。

---

## 目录

1. [包总览](#1-包总览)
2. [包依赖关系图](#2-包依赖关系图)
3. [核心包详述](#3-核心包详述)
4. [工具链包](#4-工具链包)
5. [Web Component 输出包](#5-web-component-输出包)
6. [脚手架 / CLI 包](#6-脚手架--cli-包)
7. [安装方式](#7-安装方式)
8. [Headless Primitive 包](#8-headless-primitive-包)

---

## 1. 包总览

所有包版本均为 `0.1.0-beta.0`（另有说明的除外），位于 monorepo `packages/` 下，通过 pnpm workspace 管理。

| 包名                                | 路径                                      | 版本         | 类型       | 说明                              |
| ----------------------------------- | ----------------------------------------- | ------------ | ---------- | --------------------------------- |
| `@zeus-js/zeus`                     | `packages/core/zeus`                      | 0.1.0-beta.0 | core       | 统一入口，导出所有公共 API        |
| `@zeus-js/signal`                   | `packages/core/signal`                    | 0.1.0-beta.0 | core       | 响应式核心，基于 alien-signals    |
| `@zeus-js/runtime-dom`              | `packages/core/runtime-dom`               | 0.1.0-beta.0 | core       | DOM runtime helpers               |
| `@zeus-js/compiler`                 | `packages/core/compiler`                  | 0.1.0-beta.0 | core       | Babel JSX 编译器插件              |
| `@zeus-js/shared`                   | `packages/core/shared`                    | 0.1.0-beta.0 | core       | 内部工具函数，无外部依赖          |
| `@zeus-js/vite-plugin`              | `packages/devtools/vite-plugin`           | 0.0.2        | devtools   | Vite 集成插件                     |
| `create-zeus`                       | `packages/devtools/create-zeus`           | 0.0.1        | devtools   | 项目脚手架生成器（CLI）           |
| `@zeus-js/output-wc`                | `packages/web-c/output-wc`                | 0.1.0-beta.0 | web-c      | Web Component 输出插件            |
| `@zeus-js/output-react-wrapper`     | `packages/web-c/output-react-wrapper`     | 0.1.0-beta.0 | web-c      | React wrapper 输出插件            |
| `@zeus-js/output-vue-wrapper`       | `packages/web-c/output-vue-wrapper`       | 0.1.0-beta.0 | web-c      | Vue wrapper 输出插件              |
| `@zeus-js/output-icons`             | `packages/web-c/output-icons`             | 0.1.0-beta.0 | web-c      | 图标输出插件                      |
| `@zeus-js/output-css`               | `packages/web-c/output-css`               | 0.1.0-beta.0 | web-c      | CSS 资源输出插件                  |
| `@zeus-js/component-analyzer`       | `packages/web-c/component-analyzer`       | 0.1.0-beta.0 | web-c      | 组件分析器（解析 JSX）            |
| `@zeus-js/component-dts`            | `packages/web-c/component-dts`            | 0.1.0-beta.0 | web-c      | manifest DTS 生成器               |
| `@zeus-js/bundler-plugin`           | `packages/web-c/bundler-plugin`           | 0.1.0-beta.0 | web-c      | bundler 插件宿主（Vite / Rollup） |
| `@zeus-js/preset-component-library` | `packages/web-c/preset-component-library` | 0.1.0-beta.0 | web-c      | 组件库预设（一键集成）            |
| `@zeus-ui/registry`                 | `packages/create/registry`                | 0.0.1        | create     | UI 组件注册表（copyable 源码）    |
| `zeus-ui`                           | `packages/create/zeus-ui`                 | 0.0.1        | create     | CLI 工具添加 UI 组件到项目        |
| `@zeus-web/headless`                | `packages/headless`                       | 0.0.0        | primitives | 聚合所有 headless 原语            |
| `@zeus-web/react`                   | `packages/react`                          | 0.0.0        | primitives | React wrapper 聚合包              |
| `@zeus-web/vue`                     | `packages/vue`                            | 0.0.0        | primitives | Vue wrapper 聚合包                |
| `@zeus-web/input`                   | `packages/primitives/input`               | 0.0.0        | primitives | 输入框原语                        |
| `@zeus-web/button`                  | `packages/primitives/button`              | 0.0.0        | primitives | 按钮原语                          |
| `@zeus-web/checkbox`                | `packages/primitives/checkbox`            | 0.0.0        | primitives | 复选框原语                        |
| `@zeus-web/switch`                  | `packages/primitives/switch`              | 0.0.0        | primitives | 开关原语                          |
| `@zeus-web/tabs`                    | `packages/primitives/tabs`                | 0.0.0        | primitives | 标签页原语（含子组件）            |
| `@zeus-web/dialog`                  | `packages/primitives/dialog`              | 0.0.0        | primitives | 对话框原语（含 6 个子组件）       |

**不推荐直接引入的内部包**（无 `main`/`exports`，仅供 workspace 内部使用）：

- `packages/core/runtime-dom/src/` 下的各子模块（template、bindings、events、context 等）

---

## 2. 包依赖关系图

```
@zeus-js/zeus (统一入口)
├── @zeus-js/signal
│   ├── @zeus-js/shared
│   └── alien-signals (external)
└── @zeus-js/runtime-dom
    └── @zeus-js/signal

@zeus-js/compiler
├── @babel/core
├── @babel/plugin-syntax-jsx
├── @babel/types
├── @baicie/logger
└── @zeus-js/shared

@zeus-js/vite-plugin
├── @babel/core
└── @zeus-js/compiler

@zeus-js/preset-component-library (peer)
├── @zeus-js/output-css (peer)
├── @zeus-js/output-react-wrapper (peer)
├── @zeus-js/output-vue-wrapper (peer)
└── @zeus-js/output-wc (peer)

@zeus-js/output-wc
├── @zeus-js/bundler-plugin
├── @zeus-js/component-analyzer
└── @zeus-js/component-dts

@zeus-js/bundler-plugin
├── @babel/core
├── @zeus-js/compiler
├── @zeus-js/component-analyzer
├── fast-glob
└── picomatch

@zeus-js/component-dts
└── @zeus-js/component-analyzer

@zeus-web/headless
├── @zeus-web/button (peer)
├── @zeus-web/checkbox (peer)
├── @zeus-web/dialog (peer)
├── @zeus-web/input (peer)
├── @zeus-web/switch (peer)
└── @zeus-web/tabs (peer)

@zeus-web/react
└── @zeus-web/{button,checkbox,dialog,input,switch,tabs} (workspace:*)

@zeus-web/vue
└── @zeus-web/{button,checkbox,dialog,input,switch,tabs} (workspace:*)

各 @zeus-web/primitive (button / checkbox / dialog / input / switch / tabs)
├── @zeus-js/zeus (peer)
├── @zeus-js/runtime-dom
├── @zeus-js/web-c-runtime
└── @zeus-web/zeus-compat (workspace:*)
```

---

## 3. 核心包详述

### 3.1 `@zeus-js/zeus`

**用途**：Zeus 的统一入口包，推荐用户直接 import 的包。

**导出文件**：

```
@zeus-js/zeus
├── main export    → 响应式 API + DOM Runtime + Context + JSX
├── ./jsx          → JSX 类型引用 (jsx.d.ts)
├── ./jsx-runtime  → jsx / jsxs / jsxDEV / Fragment
└── ./jsx-dev-runtime → 开发环境 JSX runtime
```

#### 响应式 API（来自 `@zeus-js/signal`）

| API         | 签名                                                 | 说明                         |
| ----------- | ---------------------------------------------------- | ---------------------------- |
| `state`     | `(initial: T) => T`                                  | 创建响应式状态，返回代理对象 |
| `computed`  | `(fn: () => T) => ComputedRef<T>`                    | 创建派生值，自动追踪依赖     |
| `effect`    | `(fn: () => void, options?) => ReactiveEffectRunner` | 创建副作用，自动追踪依赖     |
| `watch`     | `(source, cb, options?) => WatchHandle`              | 监听数据源变化               |
| `scope`     | `(fn: () => T) => T`                                 | 创建响应式作用域             |
| `batch`     | `(fn: () => void) => void`                           | 批量更新，合并多次变更       |
| `untrack`   | `(fn: () => T) => T`                                 | 在无追踪上下文执行函数       |
| `nextTick`  | `() => Promise<void>`                                | 等待响应式更新 flush 后执行  |
| `onCleanup` | `(fn: () => void) => void`                           | 注册清理函数                 |

#### DOM Runtime API

| API             | 签名                                                         | 说明                                      |
| --------------- | ------------------------------------------------------------ | ----------------------------------------- |
| `render`        | `(vnode: JSXValue, target: Element, options?) => () => void` | 将 JSX 渲染到 DOM 节点，返回 dispose 函数 |
| `Show`          | `(props: ShowProps) => JSXValue`                             | 条件渲染组件                              |
| `For`           | `<T>(props: ForProps<T>) => JSXValue`                        | 列表渲染组件                              |
| `Host`          | `(props: HostProps) => JSXValue`                             | Web Component 宿主边界（编译期内置）      |
| `Slot`          | `(props: SlotProps) => JSXValue`                             | Web Component slot（编译期内置）          |
| `defineElement` | `(tagName, options, setup) => CustomElementConstructor`      | 定义 custom element                       |

#### Context API

| API             | 签名                                      | 说明                |
| --------------- | ----------------------------------------- | ------------------- |
| `createContext` | `<T>(defaultValue?: T) => Context<T>`     | 创建 context        |
| `provide`       | `(context: Context<T>, value: T) => void` | 提供值              |
| `inject`        | `<T>(context: Context<T>) => T`           | 注入值              |
| `useContext`    | `<T>(context: Context<T>) => T`           | 同 `inject`（别名） |

#### JSX Runtime

| API        | 说明                         |
| ---------- | ---------------------------- |
| `jsx`      | 编译时调用，创建 JSX 元素    |
| `jsxs`     | 编译时调用，创建多个子元素   |
| `jsxDEV`   | 开发环境 JSX 运行时          |
| `Fragment` | JSX Fragment，等价于 `<></>` |

#### 类型导出

```ts
type State<T>
type ValueState<T>
type ComputedRef<T>
type WatchOptions
type WatchHandle
type Scope
type JSXValue
type Component<P>
type ShowProps
type ForProps<T, K>
type HostProps
type SlotProps
type DefineElementOptions<P>
type DefineElementMeta
type DefineElementContext
type DefineElementSetup<P, E>
type Context<T>
type ContextProviderProps<T>
type ContextBridgeProps<T>
```

#### 使用示例

```tsx
import {
  render,
  Show,
  For,
  state,
  computed,
  effect,
  onCleanup,
} from '@zeus-js/zeus'

// 基础渲染
const [count, setCount] = state(0)
const doubled = computed(() => count() * 2)

effect(() => {
  console.log('count changed:', count())
  onCleanup(() => console.log('cleanup'))
})

render(
  <div>
    <p>count: {count()}</p>
    <p>doubled: {doubled()}</p>
    <button onClick={() => setCount(c => c + 1)}>+</button>
  </div>,
  document.getElementById('app')!,
)

// 条件渲染
render(
  <Show when={count() > 5} fallback={<p>small</p>}>
    <p>big!</p>
  </Show>,
  document.getElementById('app')!,
)

// 列表渲染
const items = state(['apple', 'banana', 'cherry'])
render(
  <For each={items()}>{(item, i) => <li key={i()}>{item}</li>}</For>,
  document.getElementById('app')!,
)
```

---

### 3.2 `@zeus-js/signal`

**用途**：响应式核心，纯 TypeScript，无 DOM 依赖。基于 `alien-signals`。

#### 完整导出列表

```ts
// state
export { state, isValueState, type State, type ValueState }

// computed
export {
  computed,
  type ComputedRef,
  type WritableComputedRef,
  type WritableComputedOptions,
  type ComputedGetter,
  type ComputedSetter,
  type ComputedRefImpl,
}

// effect
export {
  effect,
  stop,
  enableTracking,
  pauseTracking,
  resetTracking,
  onEffectCleanup,
  ReactiveEffect,
  EffectFlags,
  batch,
  untrack,
  getCurrentEffect,
  type ReactiveEffectRunner,
  type ReactiveEffectOptions,
  type EffectScheduler,
  type DebuggerOptions,
  type DebuggerEvent,
  type DebuggerEventExtraInfo,
}

// scheduler
export { queueJob, flushJobs, nextTick }

// dep (tracking internals)
export { trigger, track, ITERATE_KEY, ARRAY_ITERATE_KEY, MAP_KEY_ITERATE_KEY }

// scope
export { effectScope, EffectScope, getCurrentScope, onScopeDispose }
export { scope, type Scope }

// watch
export {
  watch,
  getCurrentWatcher,
  traverse,
  onWatcherCleanup,
  WatchErrorCodes,
  type WatchOptions,
  type WatchScheduler,
  type WatchStopHandle,
  type WatchHandle,
  type WatchEffect,
  type WatchSource,
  type WatchCallback,
  type OnCleanup,
}

// lifecycle
export { onCleanup }

// array instrumentations
export { reactiveReadArray, shallowReadArray }

// constants
export { TrackOpTypes, TriggerOpTypes, ReactiveFlags }
```

#### 详细 API

**state** — 创建响应式状态

```ts
const count = state(0)
count() // 读取 → 0
count(1) // 写入 → 1
count(c => c + 1) // 回调式写入
```

**computed** — 派生值

```ts
const doubled = computed(() => count() * 2)
```

**effect** — 副作用

```ts
const runner = effect(() => {
  document.title = `count: ${count()}`
})
runner.stop() // 停止 effect
```

**watch** — 监听

```ts
const stop = watch(
  count, // 要监听的值（signal、getter、数组）
  (newVal, oldVal) => {
    console.log('changed', newVal)
  },
  { immediate: false, flush: 'pre' }, // 可选配置
)
stop() // 停止监听
```

**batch** — 批量更新

```ts
batch(() => {
  count(1)
  count(2)
  count(3)
}) // 只触发一次更新
```

**scope** — 隔离作用域

```ts
const result = scope(() => {
  const local = state(42)
  effect(() => console.log(local()))
  local(100) // effect 触发
  return local()
})
// scope 结束后，内部 effect 自动清理
```

**effectScope** — 命名的 effect 作用域

```ts
const scope = effectScope()
scope.run(() => {
  effect(() => {...})
})
scope.stop() // 整个 scope 内的 effect 全部清理
```

**onCleanup** — 注册清理函数

```ts
effect(() => {
  const timer = setInterval(() => {}, 100)
  onCleanup(() => clearInterval(timer))
})
```

**nextTick** — 等待更新 flush

```ts
count(1)
await nextTick()
// 此时 DOM 已更新
```

---

### 3.3 `@zeus-js/runtime-dom`

**用途**：DOM runtime helpers，供编译器生成的代码调用，也可直接使用。

#### 完整导出列表

```ts
// types
export type {
  JSXValue,
  JSXGetter,
  Component,
  TemplateFactory,
  AttrValue,
  ClassValue,
  StyleValue,
  RefTarget,
}

// template
export { template }

// render
export { render, type RenderOptions }

// insert
export { insert, mountDynamic, insertTracked }

// dom utils
export { marker, child, removeNodes }

// bindings
export {
  bindText,
  bindTextContent,
  bindAttr,
  bindProp,
  bindClass,
  bindStyle,
  setAttr,
  normalizeClass,
}

// events
export { bindEvent, delegateEvents }

// refs
export { setRef, bindRef }

// component
export { createComponent }

// control flow
export {
  Show,
  For,
  mountShow,
  mountFor,
  resolveValue,
  type ShowProps,
  type ForProps,
}

// web components
export {
  defineElement,
  type DefineElementOptions,
  type DefineElementMeta,
  type DefineElementContext,
  type DefineElementSetup,
  type ElementPropConstructor,
  type PropDefinition,
  type PropOptions,
}
export { Host, Slot, type HostProps, type SlotProps }
export { createSlot }

// host context
export {
  getCurrentHostContext,
  withHostContext,
  captureCurrentHostContext,
  withCapturedHostContext,
  type HostRenderContext,
  type HostRenderMode,
}

// context
export { createContext, useContext, provide, inject }

// advanced context (内部)
export {
  getCurrentOwner,
  createOwner,
  runWithOwner,
  createDOMContextBoundary,
  provideDOMContext,
  requestDOMContext,
  resolveDOMContext,
  ZEUS_CONTEXT_REQUEST,
  type Context,
  type ContextId,
  type ContextProviderProps,
  type ContextBridgeProps,
  type Owner,
  type ZeusContextRequestDetail,
  type ZeusContextRequestEvent,
  type DOMContextResolution,
}
```

#### defineElement 详解

```tsx
import { defineElement, Host, Slot } from '@zeus-js/runtime-dom'

const Counter = defineElement(
  'z-counter',
  {
    shadow: true, // 或 { mode: 'open', delegatesFocus: true }
    props: {
      count: Number,
      title: String,
      open: Boolean,
      data: {
        type: Object,
        attr: 'data-config', // 指定 attribute 名称
        reflect: true, // prop → attribute 反射
        default: () => ({ value: 0 }),
      },
    },
    styles: `
      :host { display: block; padding: 1rem; }
      :host([open]) { border: 1px solid #ccc; }
    `,
    consumes: [], // 消费的 context
    meta: {
      description: 'A simple counter component',
      props: { count: { description: 'Current count value' } },
      events: {
        change: {
          description: 'Fired when count changes',
          detail: { value: 'number' },
        },
      },
    },
  },
  (props, context) => {
    // props: Readonly<P>，响应式
    // context: { host: E, emit: (name, detail?, options?) => boolean }
    return (
      <Host>
        <h2>{props.title ?? 'Default Title'}</h2>
        <p>Count: {props.count}</p>
        <button onClick={() => context.emit('change', props.count + 1)}>
          +
        </button>
        <Slot name="extra" />
      </Host>
    )
  },
)

// 使用
// <z-counter count="5" title="My Counter"></z-counter>
```

#### Host / Slot 详解

```tsx
// Host — Web Component 根边界，只能在 defineElement 内使用
// mode: 'shadow' | 'light'
// lightChildren: 子节点投影
const node = <Host mode="light" />

// Slot — 投影槽
// Shadow DOM: 编译为原生 <slot>
// Light DOM: Zeus 自己实现投影逻辑（MutationObserver）
<Slot name="header" />        // 具名 slot
<Slot />                       // 默认 slot
```

#### Context 详解

```ts
// 定义 context
const ThemeContext = createContext({ color: 'blue', setColor: () => {} })

// provide — 在父组件中提供
provide(ThemeContext, { color: 'red', setColor: (c) => {} })

// inject — 在子组件中消费
const theme = inject(ThemeContext)

// 配合 Web Component 使用
defineElement('my-element', {
  consumes: [ThemeContext], // 自动从 DOM 树解析
}, (props, ctx) => ...)
```

---

### 3.4 `@zeus-js/compiler`

**用途**：Babel 插件，将 TSX/JSX 编译为 Zeus runtime 调用。

#### 导出

```ts
import zeusCompiler from '@zeus-js/compiler'
import type { CompilerOptions } from '@zeus-js/compiler'

// 作为 Babel 插件直接使用
const result = await transformAsync(code, {
  plugins: [
    [
      zeusCompiler,
      {
        moduleName: '@zeus-js/runtime-dom',
        generate: 'dom',
        hydratable: false,
        delegateEvents: true,
        delegatedEvents: [],
        builtIns: [],
        wrapConditionals: true,
        omitNestedClosingTags: false,
        omitLastClosingTag: true,
        omitQuotes: true,
        contextToCustomElements: false,
        staticMarker: '@once',
        effectWrapper: 'effect',
        memoWrapper: 'memo',
        validate: true,
        inlineStyles: true,
      } satisfies Partial<CompilerOptions>,
    ],
  ],
})
```

#### CompilerOptions 说明

| 选项                      | 默认值                 | 说明                                     |
| ------------------------- | ---------------------- | ---------------------------------------- |
| `moduleName`              | `@zeus-js/runtime-dom` | 运行时模块名（生成的 import 路径）       |
| `generate`                | `'dom'`                | 输出模式，目前仅支持 `'dom'`             |
| `hydratable`              | `false`                | 是否生成可 hydrate 的标记                |
| `delegateEvents`          | `true`                 | 自动事件委托（onClick → click 事件冒泡） |
| `delegatedEvents`         | `[]`                   | 额外需要委托的事件列表                   |
| `builtIns`                | `[]`                   | 内置组件列表（编译器不报错）             |
| `wrapConditionals`        | `true`                 | 优化简单条件表达式                       |
| `staticMarker`            | `'@once'`              | 静态表达式标记注释                       |
| `effectWrapper`           | `'effect'`             | 响应式包装函数名                         |
| `memoWrapper`             | `'memo'`               | 派生值包装函数名                         |
| `contextToCustomElements` | `false`                | 是否向 custom element 传递 context       |
| `inlineStyles`            | `true`                 | 是否内联 style                           |
| `validate`                | `true`                 | HTML 验证                                |
| `omitLastClosingTag`      | `true`                 | 省略最后一个闭合标签                     |
| `omitQuotes`              | `true`                 | 省略可省略的属性引号                     |

---

### 3.5 `@zeus-js/shared`

**用途**：内部工具库，无外部依赖，供所有 `@zeus-js/*` 包共享。

#### 导出

```ts
export { makeMap } from './makeMap'
export * from './general' // 通用工具函数
export * from './typeUtils' // 类型工具
```

---

## 4. 工具链包

### 4.1 `@zeus-js/vite-plugin`

**用途**：Vite 集成插件，封装 `@zeus-js/compiler`，在 `transform` 阶段处理 TSX。

#### 导出

```ts
import { createZeus, zeus } from '@zeus-js/vite-plugin'
// createZeus === zeus

export interface ZeusVitePluginOptions {
  include?: RegExp | RegExp[] // 包含的文件，默认 /\.t[j]sx/
  exclude?: RegExp | RegExp[] // 排除的文件，默认 node_modules
  compiler?: Partial<CompilerOptions> // 编译器选项
  diagnostics?: boolean // 是否输出诊断信息
}
```

#### vite.config.ts 使用

```ts
// 方式 1：推荐
import { defineConfig } from 'vite'
import { createZeus } from '@zeus-js/vite-plugin'

export default defineConfig({
  plugins: [
    createZeus({
      compiler: {
        moduleName: '@zeus-js/runtime-dom',
        delegateEvents: true,
        // ... 其他编译器选项
      },
      diagnostics: true,
    }),
  ],
})

// 方式 2：别名
import { zeus } from '@zeus-js/vite-plugin'
export default defineConfig({ plugins: [zeus()] })
```

> 注意：`@zeus-js/vite-plugin` 需要 `vite` 作为 peer dependency。插件会自动解析 `@zeus-js/runtime-dom` 的入口路径。

---

## 5. Web Component 输出包

这是 Zeus 的组件库编译器基础设施，用于将 Zeus 组件库源码编译为多种输出格式。

### 5.1 架构概览

```
@zeus-js/preset-component-library (预设入口)
    │
    ├── @zeus-js/output-css          → CSS 资源输出（PostCSS / Sass / Less / LightningCSS）
    ├── @zeus-js/output-icons        → 无运行时图标处理
    ├── @zeus-js/output-react-wrapper → 生成 React wrapper（useXxx hooks）
    ├── @zeus-js/output-vue-wrapper  → 生成 Vue wrapper（setup composables）
    └── @zeus-js/output-wc          → Web Component 输出
                                          ├── @zeus-js/bundler-plugin (宿主)
                                          │       ├── ./vite   → Vite 插件
                                          │       └── ./manifest → manifest 生成
                                          ├── @zeus-js/component-analyzer (JSX 解析)
                                          └── @zeus-js/component-dts (类型生成)
```

### 5.2 `@zeus-js/bundler-plugin`

**用途**：bundler 插件宿主，支持 Vite 和 Rollup。

#### 导出

```ts
// 主入口
export from './main'

// Vite 插件
export { createVitePlugin } from './vite'

// Manifest 插件
export { createManifestPlugin } from './manifest'
```

### 5.3 `@zeus-js/component-analyzer`

**用途**：解析 Zeus 组件源码，提取组件元信息（props、events、slots、CSS vars/parts）。

**peerDependencies**：`@babel/parser`、`@babel/types`、`fast-glob`

### 5.4 `@zeus-js/component-dts`

**用途**：根据 `component-analyzer` 提取的 manifest 生成 `.d.ts` 类型文件。

### 5.5 `@zeus-js/output-css`

**用途**：将组件的 CSS 提取并处理为独立资源文件。

**peerDependencies**（全部 optional）：

- `lightningcss`
- `postcss` + `postcss-load-config`
- `sass`
- `less`
- `rollup`

### 5.6 `@zeus-js/output-icons`

**用途**：处理 SVG 图标为无运行时引用的静态资源。

**peerDependencies**（optional）：`react`、`vue`

### 5.7 `@zeus-js/output-react-wrapper`

**用途**：为每个 Zeus 组件生成 React wrapper（以 hook 形式：`useZCounter`）。

**peerDependencies**（optional）：`react >=18 || >=19`

### 5.8 `@zeus-js/output-vue-wrapper`

**用途**：为每个 Zeus 组件生成 Vue 3 wrapper（以 composable 形式：`useZCounter`）。

**peerDependencies**（optional）：`vue >=3`

### 5.9 `@zeus-js/output-wc`

**用途**：为每个 Zeus 组件生成原生 Web Component 输出。

**peerDependencies**（optional）：`rollup`

### 5.10 `@zeus-js/preset-component-library`

**用途**：一键预设，集成上述所有输出插件，简化组件库发布配置。

**peerDependencies**：

- `@zeus-js/output-css`
- `@zeus-js/output-react-wrapper`
- `@zeus-js/output-vue-wrapper`
- `@zeus-js/output-wc`
- `rollup`（optional）

---

## 6. 脚手架 / CLI 包

### 6.1 `create-zeus`

**用途**：交互式项目脚手架生成器。

```bash
pnpm create zeus
# 或
npx create-zeus
```

**内部依赖**：`@clack/prompts`、`picocolors`

### 6.2 `zeus-ui`

**用途**：CLI 工具，从 `@zeus-ui/registry` 拉取组件模板到用户项目。

```bash
npx zeus-ui add button
npx zeus-ui add dialog --theme dark
```

**依赖**：`@zeus-ui/registry`、`commander`、`prompts`、`kleur`

### 6.3 `@zeus-ui/registry`

**用途**：UI 组件注册表，提供 copyable 源码模板。

#### 导出

```ts
// 主入口
export from './main'

// 工具函数
export from './shared/cn'    // className 合并工具 (clsx/cn 风格)
export from './shared/theme' // 主题配置工具
```

---

## 7. 安装方式

```bash
# 核心包
pnpm add @zeus-js/zeus
# 或单独安装
pnpm add @zeus-js/signal @zeus-js/runtime-dom
pnpm add @zeus-js/compiler  # peer: @babel/core
pnpm add @zeus-js/vite-plugin  # peer: vite

# Web Component 组件库输出
pnpm add @zeus-js/preset-component-library
# 或单独添加需要的输出插件
pnpm add @zeus-js/output-wc @zeus-js/output-react-wrapper @zeus-js/output-vue-wrapper @zeus-js/output-css

# CLI
pnpm add -D @zeus-js/vite-plugin create-zeus
pnpm add @zeus-ui/registry
pnpm add @zeus-ui/cli
```

---

## 8. Headless Primitive 包

Phase 3 MVP 产出的 headless 原语包，源码使用 `@zeus-js/zeus` 的 `defineElement / Host / Slot / prop / event`，通过 `@zeus-js/bundler-plugin/rolldown` 输出 WC / React / Vue 三端产物。

### 8.1 `@zeus-web/button`

**源码路径**：`packages/primitives/button/src/button.tsx`

#### 导出

```ts
export {
  Button,
  type ButtonElement,
  type ButtonPressDetail,
  type ButtonProps,
  type ButtonSize,
  type ButtonType,
  type ButtonVariant,
} from './button'
```

#### 类型定义

```ts
export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export type ButtonType = 'button' | 'submit' | 'reset'

export interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  type?: ButtonType
  disabled?: boolean
  loading?: boolean
  pressed?: boolean
  name?: string
  value?: string
}

export interface ButtonPressDetail {
  nativeEvent: MouseEvent
}

export interface ButtonElement extends HTMLElement {
  focus: () => void
  blur: () => void
  click: () => void
}
```

#### props

| prop       | type                                                                        | default     | reflect |
| ---------- | --------------------------------------------------------------------------- | ----------- | ------- |
| `variant`  | `'default' \| 'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'danger'` | `'default'` | yes     |
| `size`     | `'sm' \| 'md' \| 'lg' \| 'icon'`                                            | `'md'`      | yes     |
| `type`     | `'button' \| 'submit' \| 'reset'`                                           | `'button'`  | no      |
| `disabled` | `boolean`                                                                   | `false`     | no      |
| `loading`  | `boolean`                                                                   | `false`     | no      |
| `pressed`  | `boolean`                                                                   | —           | yes     |

#### emits

| event   | detail                        |
| ------- | ----------------------------- |
| `press` | `{ nativeEvent: MouseEvent }` |

#### CSS parts

`button` / `label` / `prefix` / `suffix`

#### 使用示例

```html
<zw-button variant="primary" size="md">Click me</zw-button>
<zw-button loading disabled>Loading</zw-button>
```

---

### 8.2 `@zeus-web/checkbox`

**源码路径**：`packages/primitives/checkbox/src/checkbox.tsx`

#### 导出

```ts
export {
  Checkbox,
  type CheckboxCheckedChangeDetail,
  type CheckboxElement,
  type CheckboxFocusChangeDetail,
  type CheckboxProps,
  type CheckboxSize,
} from './checkbox'
```

#### 类型定义

```ts
export type CheckboxSize = 'sm' | 'md' | 'lg'

export interface CheckboxProps {
  checked?: boolean
  defaultChecked?: boolean
  indeterminate?: boolean
  size?: CheckboxSize
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  name?: string
  value?: string
}

export interface CheckboxCheckedChangeDetail {
  checked: boolean
  nativeEvent: Event
}

export interface CheckboxFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface CheckboxElement extends HTMLElement {
  checked?: boolean
  indeterminate?: boolean
  focus: () => void
  blur: () => void
}
```

#### props

| prop            | type                   | default | reflect |
| --------------- | ---------------------- | ------- | ------- |
| `checked`       | `boolean`              | `false` | yes     |
| `indeterminate` | `boolean`              | `false` | yes     |
| `size`          | `'sm' \| 'md' \| 'lg'` | `'md'`  | yes     |

#### emits

| event           | detail                                          |
| --------------- | ----------------------------------------------- |
| `checkedChange` | `{ checked: boolean, nativeEvent: Event }`      |
| `focusChange`   | `{ focused: boolean, nativeEvent: FocusEvent }` |

#### CSS parts

`root` / `control` / `indicator` / `label`

#### 使用示例

```html
<zw-checkbox checked>Accept terms</zw-checkbox>
<zw-checkbox indeterminate>Select all</zw-checkbox>
```

---

### 8.3 `@zeus-web/switch`

**源码路径**：`packages/primitives/switch/src/switch.tsx`

#### 导出

```ts
export {
  Switch,
  type SwitchCheckedChangeDetail,
  type SwitchElement,
  type SwitchFocusChangeDetail,
  type SwitchProps,
  type SwitchSize,
} from './switch'
```

#### 类型定义

```ts
export type SwitchSize = 'sm' | 'md' | 'lg'

export interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  size?: SwitchSize
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  name?: string
  value?: string
}

export interface SwitchCheckedChangeDetail {
  checked: boolean
  nativeEvent: Event
}

export interface SwitchFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface SwitchElement extends HTMLElement {
  checked?: boolean
  focus: () => void
  blur: () => void
}
```

#### props

| prop      | type                   | default | reflect |
| --------- | ---------------------- | ------- | ------- |
| `checked` | `boolean`              | `false` | yes     |
| `size`    | `'sm' \| 'md' \| 'lg'` | `'md'`  | yes     |

#### emits

| event           | detail                                          |
| --------------- | ----------------------------------------------- |
| `checkedChange` | `{ checked: boolean, nativeEvent: Event }`      |
| `focusChange`   | `{ focused: boolean, nativeEvent: FocusEvent }` |

#### CSS parts

`root` / `control` / `track` / `thumb` / `label`

#### 使用示例

```html
<zw-switch checked>Enable notifications</zw-switch>
```

---

### 8.4 `@zeus-web/tabs`

**源码路径**：`packages/primitives/tabs/src/tabs.tsx`

#### 导出

```ts
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type TabsContentElement,
  type TabsContentProps,
  type TabsElement,
  type TabsListElement,
  type TabsOrientation,
  type TabsProps,
  type TabsTriggerElement,
  type TabsTriggerProps,
  type TabsValueChangeDetail,
} from './tabs'
```

#### 类型定义

```ts
export type TabsOrientation = 'horizontal' | 'vertical'

export interface TabsProps {
  value?: string
  defaultValue?: string
  orientation?: TabsOrientation
  disabled?: boolean
}

export interface TabsValueChangeDetail {
  value: string
  nativeEvent?: Event
}

export interface TabsElement extends HTMLElement {
  value?: string
}

export interface TabsTriggerProps {
  value?: string
  disabled?: boolean
}

export interface TabsTriggerElement extends HTMLElement {
  focus: () => void
}

export interface TabsContentProps {
  value?: string
}

export interface TabsContentElement extends HTMLElement {}
```

#### Tabs root props

| prop          | type                         | default        | reflect |
| ------------- | ---------------------------- | -------------- | ------- |
| `value`       | `string`                     | —              | yes     |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | yes     |
| `disabled`    | `boolean`                    | `false`        | no      |

#### Tabs root emits

| event         | detail                                   |
| ------------- | ---------------------------------------- |
| `valueChange` | `{ value: string, nativeEvent?: Event }` |

#### CSS parts

- `Tabs` root: 无额外 part
- `TabsList`: `list`
- `TabsTrigger`: `trigger`
- `TabsContent`: `content`

#### 使用示例

```html
<zw-tabs value="tab1">
  <zw-tabs-list>
    <zw-tabs-trigger value="tab1">Tab 1</zw-tabs-trigger>
    <zw-tabs-trigger value="tab2">Tab 2</zw-tabs-trigger>
  </zw-tabs-list>
  <zw-tabs-content value="tab1">Content 1</zw-tabs-content>
  <zw-tabs-content value="tab2">Content 2</zw-tabs-content>
</zw-tabs>
```

---

### 8.5 `@zeus-web/dialog`

**源码路径**：`packages/primitives/dialog/src/dialog.tsx`

#### 导出

```ts
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  type DialogCloseElement,
  type DialogCloseProps,
  type DialogContentElement,
  type DialogContentProps,
  type DialogDescriptionElement,
  type DialogElement,
  type DialogOpenChangeDetail,
  type DialogProps,
  type DialogTitleElement,
  type DialogTriggerElement,
  type DialogTriggerProps,
} from './dialog'
```

#### 类型定义

```ts
export interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  modal?: boolean
}

export interface DialogOpenChangeDetail {
  open: boolean
  nativeEvent?: Event
}

export interface DialogElement extends HTMLElement {
  open?: boolean
  show: () => void
  close: () => void
}

export interface DialogTriggerProps {
  disabled?: boolean
}

export interface DialogTriggerElement extends HTMLElement {
  focus: () => void
}

export interface DialogContentProps {
  forceMount?: boolean
}

export interface DialogContentElement extends HTMLElement {
  focus: () => void
}

export interface DialogCloseProps {
  disabled?: boolean
}

export interface DialogCloseElement extends HTMLElement {
  focus: () => void
}

export interface DialogTitleElement extends HTMLElement {}
export interface DialogDescriptionElement extends HTMLElement {}
```

#### Dialog root props

| prop    | type      | default | reflect |
| ------- | --------- | ------- | ------- |
| `open`  | `boolean` | `false` | yes     |
| `modal` | `boolean` | `true`  | yes     |

#### Dialog root emits

| event        | detail                                   |
| ------------ | ---------------------------------------- |
| `openChange` | `{ open: boolean, nativeEvent?: Event }` |

#### Dialog root methods

| method  | 说明       |
| ------- | ---------- |
| `show`  | 打开对话框 |
| `close` | 关闭对话框 |

#### CSS parts

- `DialogTrigger`: `trigger`
- `DialogContent`: `content`
- `DialogClose`: `close`
- `DialogTitle`: `title`
- `DialogDescription`: `description`

#### 使用示例

```html
<zw-dialog>
  <zw-dialog-trigger>Open</zw-dialog-trigger>
  <zw-dialog-content>
    <zw-dialog-title>Title</zw-dialog-title>
    <zw-dialog-description>Description text</zw-dialog-description>
    <zw-dialog-close>Close</zw-dialog-close>
  </zw-dialog-content>
</zw-dialog>
```

---

### 8.6 聚合包

#### `@zeus-web/headless`

聚合所有 primitive WC 的 side-effect 导入，引入即注册全部 MVP 原语。

```ts
import '@zeus-web/headless'
// 等价于分别引入:
// import '@zeus-web/button/wc'
// import '@zeus-web/checkbox/wc'
// import '@zeus-web/dialog/wc'
// import '@zeus-web/input/wc'
// import '@zeus-web/switch/wc'
// import '@zeus-web/tabs/wc'
```

同时 re-export 所有 primitive 的类型：

```ts
export type { ButtonElement } from '@zeus-web/button'
export type { CheckboxElement } from '@zeus-web/checkbox'
export type { DialogElement, DialogContentElement, ... } from '@zeus-web/dialog'
export type { InputElement } from '@zeus-web/input'
export type { SwitchElement } from '@zeus-web/switch'
export type { TabsElement, TabsContentElement, ... } from '@zeus-web/tabs'
```

#### `@zeus-web/react`

Re-export 所有 primitive 的 React wrapper 输出：

```ts
export * from '@zeus-web/button/react'
export * from '@zeus-web/checkbox/react'
export * from '@zeus-web/dialog/react'
export * from '@zeus-web/input/react'
export * from '@zeus-web/switch/react'
export * from '@zeus-web/tabs/react'
```

#### `@zeus-web/vue`

Re-export 所有 primitive 的 Vue wrapper 输出：

```ts
export * from '@zeus-web/button/vue'
export * from '@zeus-web/checkbox/vue'
export * from '@zeus-web/dialog/vue'
export * from '@zeus-web/input/vue'
export * from '@zeus-web/switch/vue'
export * from '@zeus-web/tabs/vue'
```

---

## 附录 A：package.json exports 速查

| 包                     | ESM 入口                          | CJS 入口                  | 全局 CDN                     |
| ---------------------- | --------------------------------- | ------------------------- | ---------------------------- |
| `@zeus-js/zeus`        | `dist/zeus.esm-bundler.js`        | `dist/zeus.cjs.js`        | `dist/zeus.global.js`        |
| `@zeus-js/signal`      | `dist/signal.esm-bundler.js`      | `dist/signal.cjs.js`      | `dist/signal.global.js`      |
| `@zeus-js/runtime-dom` | `dist/runtime-dom.esm-bundler.js` | `dist/runtime-dom.cjs.js` | `dist/runtime-dom.global.js` |
| `@zeus-js/compiler`    | `dist/compiler.esm-bundler.js`    | `dist/compiler.cjs.js`    | `dist/compiler.global.js`    |
| `@zeus-js/shared`      | `dist/shared.esm-bundler.js`      | `dist/shared.cjs.js`      | —                            |
| `@zeus-js/vite-plugin` | `dist/vite-plugin.esm-bundler.js` | `dist/vite-plugin.cjs.js` | —                            |

## 附录 B：pnpm catalog 共享依赖版本

```yaml
'@babel/core': ^7.29.0
'@babel/parser': ^7.29.0
'@babel/plugin-syntax-jsx': ^7.28.6
'@babel/preset-env': ^7.29.0
'@babel/preset-typescript': ^7.29.7
'@babel/types': ^7.29.0
'@napi-rs/cli': ^3.5.1
'@napi-rs/wasm-runtime': ^1.1.1
'@types/babel__core': 7.20.5
vite: ^8.0.5
```
