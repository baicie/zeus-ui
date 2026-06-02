对，我前面确实没扫完整，问题不在 `@zeus-js/runtime-dom`，而是 **`zeus` 里 `packages/web-c` 已经把组件库需要的 Web Component 输出生态都封装好了**。所以 `zeus-ui` 的路线要重写：**不是自己写 `wc/react/vue` 入口，也不是手写 wrapper，而是写源组件，然后用 `@zeus-js/bundler-plugin + output-*` 生成产物。**

# 1. `zeus/packages/web-c` 已经提供了什么

## 1.1 `@zeus-js/bundler-plugin`

这是组件构建宿主，不是简单 Vite 插件。它导出：

```ts
createZeusPlugin
zeus
createOutputRegistry
```

并且类型里已经定义了 `ZeusBuildContext`、`ZeusComponentPlugin`、`ZeusOutputRegistry`、`ZeusOutputKind` 等输出插件协议。

它的输出类型已经覆盖：

```txt
wc
react
vue
icons-react
icons-vue
icons-wc
asset
```

说明这套体系本身就是为了“一个组件源 → 多目标输出”设计的。

`@zeus-js/bundler-plugin` 还带 Vite adapter，导出 `createZeusVitePlugin` / `zeus`，并且会处理 `@zeus-js/runtime-dom` alias、dedupe，以及根据输出插件 external 自动合并构建 external。

## 1.2 `@zeus-js/component-analyzer`

它负责分析组件源码，导出：

```ts
analyzeFile
analyzeComponents
ComponentManifest
ComponentRecord
ComponentProp
ComponentEvent
ComponentSlot
```

这说明 `zeus-ui` 不需要自己维护 registry meta 的底层分析能力，可以依赖 ComponentManifest。

## 1.3 `@zeus-js/component-dts`

它是基于 ComponentManifest 的 DTS 生成器，`output-wc / output-react-wrapper / output-vue-wrapper` 都依赖它。

## 1.4 `@zeus-js/output-wc`

它负责生成 Web Component 产物，不需要 `zeus-ui` 手写 `wc.ts`。

它会生成：

```txt
wc 每组件入口
wc/index.js
zeus.components.json
custom-elements.json
wc d.ts
JSX IntrinsicElements d.ts
```

源码里可以看到它生成 WC virtual modules、manifest、custom-elements.json、dts。

并且它的 options 已支持：

```ts
outDir
stripPrefix
fileName
manifestFile
customElementsFile
dts
jsxDts
index
```

## 1.5 `@zeus-js/output-react-wrapper`

它负责生成 React wrapper，不需要 `zeus-ui` 手写 `packages/react` 聚合 wrapper。

关键点是：**React wrapper 依赖 wc() 插件**，如果没有 wc 输出会直接报错。

它会生成：

```txt
react 每组件 wrapper
react/index.js
react/index.d.ts
```

并且支持 named slot 策略：

```ts
namedSlots?: 'props' | 'none'
```

## 1.6 `@zeus-js/output-vue-wrapper`

它负责生成 Vue wrapper，也要求先有 wc 输出。

它会生成：

```txt
vue 每组件 wrapper
vue/index.js
vue/index.d.ts
vue/global.d.ts
```

## 1.7 `@zeus-js/output-icons`

它负责 no-runtime icon 输出，可以生成：

```txt
icons/react
icons/vue
icons/wc
icons/svg
对应 d.ts
```

并且支持 `react / vue / wc / svg / dts / tagPrefix` 等配置。

# 2. 新结论：`zeus-ui` 应该怎么定位

之前我说：

```txt
@zeus-web/input 自己输出 ./wc ./react ./vue
```

这不对。

正确应该是：

```txt
zeus-ui / zeus-web
  只写组件源代码、主题、registry、CLI、docs、examples

zeus/packages/web-c
  负责分析组件源代码
  负责生成 wc 产物
  负责生成 React wrapper
  负责生成 Vue wrapper
  负责生成 custom-elements.json
  负责生成 d.ts
  负责生成 icons 产物
```

所以 `zeus-ui` 的核心结构应该变成：

```txt
packages/primitives/input/src/input.tsx
packages/primitives/button/src/button.tsx
packages/primitives/dialog/src/dialog.tsx
```

然后通过 build 配置输出：

```txt
packages/primitives/input/dist/wc/index.js
packages/primitives/input/dist/wc/input.js
packages/primitives/input/dist/react/index.js
packages/primitives/input/dist/vue/index.js
packages/primitives/input/dist/custom-elements.json
packages/primitives/input/dist/zeus.components.json
```

也就是说：**源码包不手写 wc/react/vue，产物由 `@zeus-js/output-*` 生成。**

# 3. `zeus-ui` 当前实现要推翻哪些东西

当前 `@zeus-web/input` 手写了：

```ts
class ZeusInputElement extends HTMLElement
customElements.define(...)
```

这个应该删除。

当前 `react.ts` / `vue.ts` 只是 placeholder：

```ts
export const Input = 'zw-input'
export const ZInput = 'zw-input'
```

这个也不应该继续发展。

当前 `@zeus-web/react`、`@zeus-web/vue` 是手写 re-export 聚合包。 这个后面也应该改成 **构建产物聚合**，而不是源码手写 wrapper。

# 4. 新架构

## 4.1 源码层

```txt
packages/
  primitives/
    input/
      src/
        input.tsx
        index.ts
      package.json
      rollup.config.ts

    button/
      src/
        button.tsx
        index.ts
      package.json
      rollup.config.ts

  themes/
  registry/
  cli/
  icons/
```

## 4.2 产物层

每个 primitive 独立包构建后：

```txt
packages/primitives/input/dist/
  wc/
    index.js
    input.js
    index.d.ts
    input.d.ts

  react/
    index.js
    index.d.ts

  vue/
    index.js
    index.d.ts
    global.d.ts

  custom-elements.json
  zeus.components.json
```

## 4.3 用户使用方式

单组件安装：

```bash
pnpm add @zeus-web/input
```

Web Component：

```ts
import '@zeus-web/input/wc'
```

React：

```tsx
import { Input } from '@zeus-web/input/react'
```

Vue：

```ts
import { ZInput } from '@zeus-web/input/vue'
```

shadcn-like registry：

```bash
zweb add input
```

生成的源码依赖：

```ts
import { Input as InputPrimitive } from '@zeus-web/input/react'
```

# 5. `@zeus-web/input/package.json` 应该长这样

```json
{
  "name": "@zeus-web/input",
  "version": "0.0.0",
  "type": "module",
  "description": "Headless input primitive for Zeus Web.",
  "license": "MIT",
  "sideEffects": ["./dist/wc/index.js", "./dist/wc/*.js", "./dist/**/*.css"],
  "files": ["dist"],
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
    "./vue/global": {
      "types": "./dist/vue/global.d.ts"
    },
    "./custom-elements.json": {
      "default": "./dist/custom-elements.json"
    },
    "./zeus.components.json": {
      "default": "./dist/zeus.components.json"
    }
  },
  "scripts": {
    "dev": "rollup -c --watch",
    "build": "rollup -c",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --project unit-jsdom"
  },
  "peerDependencies": {
    "@zeus-js/runtime-dom": "^0.1.0-beta.0"
  },
  "devDependencies": {
    "@zeus-js/bundler-plugin": "^0.1.0-beta.0",
    "@zeus-js/output-wc": "^0.1.0-beta.0",
    "@zeus-js/output-react-wrapper": "^0.1.0-beta.0",
    "@zeus-js/output-vue-wrapper": "^0.1.0-beta.0",
    "@zeus-js/runtime-dom": "^0.1.0-beta.0",
    "rollup": "^4.0.0",
    "typescript": "^6.0.0"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    },
    "vue": {
      "optional": true
    }
  }
}
```

# 6. 组件源码应该怎么写

## `packages/primitives/input/src/input.tsx`

```tsx
import { defineElement, Host } from '@zeus-js/runtime-dom'

export interface InputProps {
  value?: string
  defaultValue?: string
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number'
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  name?: string
}

export const Input = defineElement<InputProps>(
  'zw-input',
  {
    shadow: false,
    props: {
      value: {
        type: String,
        default: '',
        reflect: true,
      },
      defaultValue: {
        type: String,
        attr: 'default-value',
        default: '',
      },
      type: {
        type: String,
        default: 'text',
        reflect: true,
      },
      placeholder: {
        type: String,
        default: '',
      },
      disabled: {
        type: Boolean,
        reflect: true,
      },
      readonly: {
        type: Boolean,
        attr: 'readonly',
        reflect: true,
      },
      required: {
        type: Boolean,
        reflect: true,
      },
      name: {
        type: String,
        default: '',
      },
    },
    meta: {
      description: 'Headless input primitive.',
      events: {
        'value-change': {
          description: 'Emitted when the input value changes.',
          detail: {
            value: 'Current input value.',
            nativeEvent: 'Original input event.',
          },
        },
      },
      cssParts: ['input'],
    },
  },
  (props, { emit }) => {
    function handleInput(event: Event) {
      const target = event.currentTarget as HTMLInputElement

      emit('value-change', {
        value: target.value,
        nativeEvent: event,
      })
    }

    return (
      <Host
        data-slot="input-root"
        data-disabled={props.disabled ? '' : undefined}
      >
        <input
          part="input"
          data-slot="input"
          value={props.value ?? props.defaultValue ?? ''}
          defaultValue={props.defaultValue}
          type={props.type ?? 'text'}
          placeholder={props.placeholder}
          disabled={props.disabled}
          readOnly={props.readonly}
          required={props.required}
          name={props.name}
          onInput={handleInput}
        />
      </Host>
    )
  },
)
```

## `packages/primitives/input/src/index.ts`

```ts
export { Input }
export type { InputProps } from './input'
```

注意：这里是否会自动注册，取决于 `defineElement` 的行为。当前 `defineElement` 内部会调用 `customElements.define`。 所以这个源入口本身就是组件定义入口。后续真实产物由 `output-wc` 生成 `wc/input.js` 和 `wc/index.js`，用户最终应该 import 生成后的 `@zeus-web/input/wc`。

# 7. Rollup 构建配置

## `packages/primitives/input/rollup.config.ts`

```ts
import zeus from '@zeus-js/bundler-plugin'
import wc from '@zeus-js/output-wc'
import react from '@zeus-js/output-react-wrapper'
import vue from '@zeus-js/output-vue-wrapper'

import type { RollupOptions } from 'rollup'

const config: RollupOptions = {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    preserveModules: false,
  },
  external: ['@zeus-js/runtime-dom', '@zeus-js/signal', 'react', 'vue'],
  plugins: [
    zeus({
      root: process.cwd(),
      components: {
        include: ['src/**/*.{ts,tsx}'],
      },
      dts: true,
      plugins: [
        wc({
          outDir: 'wc',
          stripPrefix: 'zw-',
          manifestFile: 'zeus.components.json',
          customElementsFile: 'custom-elements.json',
          dts: true,
          jsxDts: true,
          index: true,
        }),
        react({
          outDir: 'react',
          stripPrefix: 'zw-',
          dts: true,
          index: true,
          namedSlots: 'props',
        }),
        vue({
          outDir: 'vue',
          stripPrefix: 'zw-',
          dts: true,
          globalDts: true,
          index: true,
        }),
      ],
    }),
  ],
}

export default config
```

这才是正确路线：**input 源码只写一次，wc/react/vue 全部由 Zeus web-c 输出插件生成。**

# 8. `zeus-ui` 新路线图

## Phase 0：工程地基修正

目标：把当前 scaffold 从“手写 wc 包结构”改成“消费 Zeus web-c 输出生态”。

要做：

```txt
0.1 删除当前 @zeus-web/input 手写 wc/react/vue 入口
0.2 根 devDependencies 补 @zeus-js/bundler-plugin
0.3 补 @zeus-js/output-wc
0.4 补 @zeus-js/output-react-wrapper
0.5 补 @zeus-js/output-vue-wrapper
0.6 补 @zeus-js/runtime-dom
0.7 primitive 包统一使用 rollup + zeus plugin 构建
0.8 package exports 指向 dist/wc、dist/react、dist/vue
0.9 测试 check:exports 必须要求 primitive 包依赖 zeus web-c 输出体系
```

测试：

```txt
- package-rules.test.ts：primitive 包必须声明 @zeus-js/runtime-dom peerDependency
- package-rules.test.ts：primitive 包不能出现手写 src/wc.ts / src/react.ts / src/vue.ts
- build-config.test.ts：primitive 包必须有 rollup.config.ts
```

## Phase 1：Input primitive 迁移到 Zeus 输出体系

目标：`@zeus-web/input` 作为第一个标准 primitive 模板。

要做：

```txt
1.1 新建 src/input.tsx
1.2 使用 defineElement + Host 实现 zw-input
1.3 通过 meta 声明 props/events/cssParts
1.4 rollup 构建生成 wc/react/vue/custom-elements
1.5 删除手写 HTMLElement 实现
1.6 删除 placeholder react/vue 入口
1.7 补 build 产物 smoke test
```

测试：

```txt
- input.source.test.ts：源码导出 Input
- input.wc.test.ts：dist/wc/index.js 能注册 zw-input
- input.react.test.ts：dist/react/index.js 能导出 Input
- input.vue.test.ts：dist/vue/index.js 能导出 ZInput 或 Input
- input.custom-elements.test.ts：dist/custom-elements.json 包含 zw-input
- input.events.test.ts：input 事件能触发 value-change
```

## Phase 2：Primitive Package 模板固化

目标：后续所有组件都照 `input` 模板生成。

要做：

```txt
2.1 抽 packages/build/createPrimitiveRollupConfig.ts
2.2 统一 stripPrefix: 'zw-'
2.3 统一 outDir: wc/react/vue
2.4 统一 custom-elements.json / zeus.components.json
2.5 统一 package exports
2.6 统一测试模板
```

测试：

```txt
- createPrimitiveRollupConfig.test.ts
- package exports test
- build output path test
```

## Phase 3：首批 Headless primitives

目标：补齐 MVP 组件。

组件：

```txt
@zeus-web/button
@zeus-web/input
@zeus-web/checkbox
@zeus-web/switch
@zeus-web/tabs
@zeus-web/dialog
```

每个组件都要：

```txt
- src/{name}.tsx
- defineElement
- meta
- rollup config
- wc/react/vue 产物
- custom-elements.json
- 单测
- 事件测试
- 产物 smoke test
```

这里不能再手写 wrapper。

## Phase 4：聚合包生成

目标：`@zeus-web/headless`、`@zeus-web/react`、`@zeus-web/vue` 不再手写 placeholder，而是聚合各 primitive 的生成产物。

结构：

```txt
@zeus-web/headless
  re-export @zeus-web/input/wc
  re-export @zeus-web/button/wc

@zeus-web/react
  re-export @zeus-web/input/react
  re-export @zeus-web/button/react

@zeus-web/vue
  re-export @zeus-web/input/vue
  re-export @zeus-web/button/vue
```

测试：

```txt
- 聚合包导出测试
- tree-shaking smoke test
- sideEffects 测试
```

## Phase 5：Registry MVP

目标：shadcn-like copy layer。

注意 registry 组件依赖单 primitive 包：

```json
{
  "dependencies": ["@zeus-web/input"]
}
```

生成：

```tsx
import { Input as InputPrimitive } from '@zeus-web/input/react'
```

测试：

```txt
- registry item schema test
- zweb add input 只安装 @zeus-web/input
- registry source import test
```

## Phase 6：CLI MVP

目标：

```bash
zweb init
zweb add input
zweb add button dialog tabs
```

要做：

```txt
6.1 读取 registry
6.2 安装对应 primitive 包
6.3 复制 styled 源码
6.4 合并 theme.css
6.5 生成 components.json
```

测试：

```txt
- createAddPlan test
- init temp dir test
- add temp dir test
- 不覆盖用户文件测试
```

## Phase 7：主题系统

目标：Tailwind + CSS Variables。

包：

```txt
@zeus-web/themes
```

测试：

```txt
- tokens 文件存在测试
- registry 组件只引用 CSS vars 测试
- dark mode class 测试
```

## Phase 8：Icons

这次应该直接用 `@zeus-js/output-icons`，不要自己写 icon generator。

要做：

```txt
8.1 准备 icons source
8.2 调用 @zeus-js/output-icons
8.3 输出 icons/react
8.4 输出 icons/vue
8.5 输出 icons/wc
8.6 输出 svg
```

测试：

```txt
- IconHome react 导出测试
- IconHome vue 导出测试
- z-icon-home wc 注册测试
- no-runtime size smoke test
```

## Phase 9：Docs / Playground

目标：展示三种用法：

```txt
wc
react
vue
registry
```

测试：

```txt
- docs build
- example build
- registry example smoke test
```

## Phase 10：AI-ready

目标：

```txt
llms.txt
Cursor rules
Copilot instructions
组件 AI metadata
registry usage examples
```

AI metadata 应该从 `zeus.components.json / custom-elements.json / registry.json` 派生，不要手写两份。

测试：

```txt
- ai metadata schema test
- 每个 registry item 都有 AI usage
- 每个 primitive 都能在 metadata 找到
```

# 9. 最终正确路线一句话

```txt
zeus-ui 不实现 Web Component 编译和 wrapper 生成；
zeus-ui 只写 headless primitive 源组件、主题、registry、CLI、docs；
wc/react/vue/custom-elements/dts/icons 全部交给 zeus/packages/web-c 里的 @zeus-js/bundler-plugin 和 @zeus-js/output-*。
```

所以接下来最该做的不是继续强化当前手写 `HTMLElement`，而是开一个修正 PR：

```txt
refactor(input): migrate primitive output to zeus web-c pipeline
```

这个 PR 的核心就是：

```txt
删除手写 src/wc.ts / src/react.ts / src/vue.ts
新增 src/input.tsx
新增 rollup.config.ts
使用 @zeus-js/bundler-plugin + output-wc + output-react-wrapper + output-vue-wrapper
修正 package exports
补构建产物测试
```
