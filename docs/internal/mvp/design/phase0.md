下面重新给 **Phase 0：接入 Zeus web-c 构建管线** 的详细设计与代码草案。

这版的核心修正是：**`zeus-ui` 不再自己封装 Web Component / React wrapper / Vue wrapper。** 当前 `@zeus-web/input` 里手写了 `class ZeusInputElement extends HTMLElement`、`connectedCallback`、`attributeChangedCallback`、`customElements.define`，这个方向要在 Phase 0 纠正掉。

`zeus` 仓库已经提供了完整 web-c 工具链：

```txt
@zeus-js/bundler-plugin
@zeus-js/component-analyzer
@zeus-js/component-dts
@zeus-js/output-wc
@zeus-js/output-react-wrapper
@zeus-js/output-vue-wrapper
@zeus-js/output-icons
```

其中 `@zeus-js/bundler-plugin` 是构建宿主，支持 `wc / react / vue / icons-* / asset` 这些输出类型。
`@zeus-js/output-wc` 会生成 WC 入口、`zeus.components.json`、`custom-elements.json`、WC DTS、JSX DTS。
`@zeus-js/output-react-wrapper` 和 `@zeus-js/output-vue-wrapper` 已经负责 React/Vue wrapper 生成，而且它们都要求先有 `wc()` 输出。

# Phase 0 目标

Phase 0 不追求完整 Input 行为，只做工程方向修正：

```txt
1. 移除手写 wc/react/vue 源入口模式
2. 引入 @zeus-js/web-c 输出工具链
3. primitive 包统一改成 rollup + zeus plugin 构建
4. 每个 primitive 只写源组件 src/*.ts(x)
5. wc/react/vue/custom-elements/dts 全部由 Zeus output 插件生成
6. 增加测试规则，禁止后续继续手写 src/wc.ts、src/react.ts、src/vue.ts
7. 建立 Input canary，用于验证构建管线
```

Phase 0 完成后，`@zeus-web/input` 应该从：

```txt
src/index.ts
src/wc.ts
src/react.ts
src/vue.ts
```

改成：

```txt
src/input.ts
src/index.ts
rollup.config.mjs
```

构建后生成：

```txt
dist/wc/index.js
dist/wc/input.js
dist/react/index.js
dist/vue/index.js
dist/vue/global.d.ts
dist/custom-elements.json
dist/zeus.components.json
```

# Phase 0 依赖规则

```txt
1. zeus-ui 根工程直接 npm 安装 @zeus-js/* 相关包。
2. primitive 包不直接依赖 output-*，只通过根构建工具使用。
3. primitive 包必须 peer depend on @zeus-js/runtime-dom。
4. @zeus-web/input 不允许手写 src/wc.ts / src/react.ts / src/vue.ts。
5. wc/react/vue/custom-elements/dts 产物全部由 @zeus-js/output-* 生成。
```

# 1. 根依赖调整

当前 `zeus-ui` 根脚本已经有 `build / check / test / check:exports`，而且 workspace 已覆盖 `packages/primitives/*`。

Phase 0 需要把 Zeus web-c 依赖加入根 `devDependencies`：

```json
{
  "devDependencies": {
    "@zeus-js/bundler-plugin": "^0.1.0-beta.0",
    "@zeus-js/output-wc": "^0.1.0-beta.0",
    "@zeus-js/output-react-wrapper": "^0.1.0-beta.0",
    "@zeus-js/output-vue-wrapper": "^0.1.0-beta.0",
    "@zeus-js/output-icons": "^0.1.0-beta.0",
    "@zeus-js/runtime-dom": "^0.1.0-beta.0",
    "@zeus-js/signal": "^0.1.0-beta.0",
    "@zeus-js/compiler": "^0.1.0-beta.0",
    "@zeus-js/component-analyzer": "^0.1.0-beta.0",
    "@zeus-js/component-dts": "^0.1.0-beta.0",
    "rollup": "^4.0.0"
  }
}
```

# 2. TypeScript 配置调整

当前 `tsconfig.base.json` 已经有 `@zeus-web/*` path。
Phase 0 建议补上 JSX 兼容，后续 primitive 可以写 `.tsx`：

```json
{
  "compilerOptions": {
    "jsx": "preserve"
  }
}
```

完整片段：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": {
      "@zeus-web/*": ["./packages/*/src", "./packages/primitives/*/src"]
    },
    "strict": true,
    "isolatedModules": true,
    "isolatedDeclarations": true,
    "skipLibCheck": true
  }
}
```

# 3. 新增 primitive Rollup 配置工厂

新增：

```txt
scripts/rollup/createPrimitiveRollupConfig.mjs
```

代码草案：

```js
import zeus from '@zeus-js/bundler-plugin'
import wc from '@zeus-js/output-wc'
import react from '@zeus-js/output-react-wrapper'
import vue from '@zeus-js/output-vue-wrapper'

export function createPrimitiveRollupConfig(options = {}) {
  const { input = 'src/index.ts', tagPrefix = 'zw-', external = [] } = options

  return {
    input,
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
    },
    external: [
      '@zeus-js/runtime-dom',
      '@zeus-js/signal',
      'react',
      'vue',
      ...external,
    ],
    plugins: [
      zeus({
        root: process.cwd(),
        dts: true,
        components: {
          include: ['src/**/*.{ts,tsx}'],
          exclude: ['src/**/*.test.*', 'src/**/__tests__/**'],
        },
        plugins: [
          wc({
            outDir: 'wc',
            stripPrefix: tagPrefix,
            manifestFile: 'zeus.components.json',
            customElementsFile: 'custom-elements.json',
            dts: true,
            jsxDts: true,
            index: true,
          }),
          react({
            outDir: 'react',
            stripPrefix: tagPrefix,
            dts: true,
            index: true,
            namedSlots: 'props',
          }),
          vue({
            outDir: 'vue',
            stripPrefix: tagPrefix,
            dts: true,
            globalDts: true,
            index: true,
          }),
        ],
      }),
    ],
  }
}
```

这里和 Zeus 的 web-c 输出模型对齐：

```txt
wc()      → 生成 Web Component 入口 + manifest + dts
react()   → 基于 wc 输出生成 React wrapper
vue()     → 基于 wc 输出生成 Vue wrapper
```

`output-react-wrapper` 和 `output-vue-wrapper` 源码里都会检查是否已经注册 `wc` 输出，没有就报错。

# 4. 改造 `@zeus-web/input/package.json`

当前 `@zeus-web/input` 还是 `tsup src/index.ts src/wc.ts src/react.ts src/vue.ts`。
Phase 0 要改成 Rollup + Zeus 输出管线。

```json
{
  "name": "@zeus-web/input",
  "type": "module",
  "version": "0.0.0",
  "description": "Headless input primitive for Zeus Web.",
  "license": "MIT",
  "sideEffects": ["./dist/wc/index.js", "./dist/wc/*.js", "./dist/**/*.css"],
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
  "files": ["dist"],
  "scripts": {
    "dev": "rollup -c --watch",
    "build": "rollup -c",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --project unit-jsdom"
  },
  "peerDependencies": {
    "@zeus-js/runtime-dom": "^0.1.0-beta.0"
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

注意：`@zeus-js/bundler-plugin / output-*` 是构建期依赖，不应该成为 `@zeus-web/input` 的运行时 dependency。
运行时只需要 `@zeus-js/runtime-dom`。

# 5. 新增 `packages/primitives/input/rollup.config.mjs`

```js
import { createPrimitiveRollupConfig } from '../../../scripts/rollup/createPrimitiveRollupConfig.mjs'

export default createPrimitiveRollupConfig({
  input: 'src/index.ts',
  tagPrefix: 'zw-',
})
```

# 6. 改造 `@zeus-web/input` 源码

Phase 0 只做 canary，不做完整 Input 行为。目标是证明：

```txt
src/input.ts → zeus analyzer → output-wc → output-react-wrapper → output-vue-wrapper
```

能跑通。

## 删除这些文件

```txt
packages/primitives/input/src/wc.ts
packages/primitives/input/src/react.ts
packages/primitives/input/src/vue.ts
```

## 新增 `packages/primitives/input/src/input.ts`

不用 TSX，先用 DOM API 返回节点，降低 Phase 0 风险：

```ts
import { bindAttr, bindProp, defineElement } from '@zeus-js/runtime-dom'

export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'search'
  | 'tel'
  | 'url'
  | 'number'

export interface InputProps {
  value?: string
  defaultValue?: string
  type?: InputType
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  name?: string
}

export interface InputValueChangeDetail {
  value: string
  nativeEvent: Event
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
      props: {
        value: {
          description: 'The controlled input value.',
        },
        defaultValue: {
          description: 'The initial input value.',
        },
        type: {
          description: 'The native input type.',
        },
        placeholder: {
          description: 'The input placeholder.',
        },
        disabled: {
          description: 'Whether the input is disabled.',
        },
      },
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
  (props, { host, emit }) => {
    const input = document.createElement('input')

    input.part.add('input')
    input.setAttribute('data-slot', 'input')

    bindAttr(host, 'data-slot', () => 'input-root')
    bindAttr(host, 'data-disabled', () => (props.disabled ? '' : null))

    bindProp(input, 'value', () => props.value ?? props.defaultValue ?? '')
    bindProp(input, 'defaultValue', () => props.defaultValue ?? '')
    bindProp(input, 'type', () => props.type ?? 'text')
    bindProp(input, 'disabled', () => Boolean(props.disabled))
    bindProp(input, 'readOnly', () => Boolean(props.readonly))
    bindProp(input, 'required', () => Boolean(props.required))

    bindAttr(input, 'placeholder', () => props.placeholder)
    bindAttr(input, 'name', () => props.name)

    input.addEventListener('input', nativeEvent => {
      emit('value-change', {
        value: input.value,
        nativeEvent,
      })
    })

    return input
  },
)
```

这里使用的是 `@zeus-js/runtime-dom` 提供的 `defineElement / bindProp / bindAttr`，不再手写 `HTMLElement` 生命周期。`runtime-dom` 已经导出了这些 API。

## 改造 `packages/primitives/input/src/index.ts`

```ts
export {
  Input,
  type InputProps,
  type InputType,
  type InputValueChangeDetail,
} from './input'
```

注意：这个源码入口被 `output-wc` 生成出来的 WC entry 引用。`output-wc` 的 `generateWCEntry` 实际会生成 `import { exportName } from source` 并重新 export。

# 7. package rules：禁止继续手写 WC 入口

当前有 `scripts/checks/check-package-exports.ts`，只检查包名和 exports。
Phase 0 要把规则升级成“primitive 必须走 Zeus web-c 管线”。

建议拆成纯函数，方便测试：

```txt
scripts/checks/package-rules.ts
scripts/checks/check-package-exports.ts
scripts/checks/__tests__/package-rules.test.ts
```

## `scripts/checks/package-rules.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface PackageJsonLike {
  name?: string
  private?: boolean
  scripts?: Record<string, string>
  sideEffects?: boolean | string[]
  exports?: Record<string, unknown>
  peerDependencies?: Record<string, string>
}

export interface PackageRuleResult {
  valid: boolean
  errors: string[]
}

export function validatePackageRules(
  root: string,
  packageJsonPath: string,
): PackageRuleResult {
  const errors: string[] = []
  const pkg = JSON.parse(
    readFileSync(packageJsonPath, 'utf8'),
  ) as PackageJsonLike
  const rel = relative(root, packageJsonPath)
  const isPrimitive = rel.startsWith('packages/primitives/')

  if (pkg.private) {
    return {
      valid: true,
      errors,
    }
  }

  if (!pkg.name?.startsWith('@zeus-web/')) {
    errors.push(`${rel}: package name must start with @zeus-web/`)
  }

  if (!pkg.exports) {
    errors.push(`${pkg.name}: missing exports`)
  }

  if (isPrimitive) {
    validatePrimitivePackage(root, packageJsonPath, pkg, errors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

function validatePrimitivePackage(
  root: string,
  packageJsonPath: string,
  pkg: PackageJsonLike,
  errors: string[],
): void {
  const packageDir = packageJsonPath.replace(/\/package\.json$/, '')

  if (!existsSync(join(packageDir, 'rollup.config.mjs'))) {
    errors.push(`${pkg.name}: primitive package must have rollup.config.mjs`)
  }

  if (!pkg.scripts?.build?.includes('rollup -c')) {
    errors.push(
      `${pkg.name}: primitive package build script must use rollup -c`,
    )
  }

  if (!pkg.peerDependencies?.['@zeus-js/runtime-dom']) {
    errors.push(
      `${pkg.name}: primitive package must peer depend on @zeus-js/runtime-dom`,
    )
  }

  for (const key of [
    '.',
    './wc',
    './react',
    './vue',
    './custom-elements.json',
    './zeus.components.json',
  ]) {
    if (!pkg.exports || !(key in pkg.exports)) {
      errors.push(`${pkg.name}: primitive package must export ${key}`)
    }
  }

  if (!Array.isArray(pkg.sideEffects)) {
    errors.push(`${pkg.name}: primitive package sideEffects must be string[]`)
  } else {
    const hasWcSideEffect = pkg.sideEffects.some(item =>
      item.includes('dist/wc'),
    )
    if (!hasWcSideEffect) {
      errors.push(
        `${pkg.name}: primitive package sideEffects must include dist/wc entry`,
      )
    }
  }

  for (const forbidden of ['src/wc.ts', 'src/react.ts', 'src/vue.ts']) {
    if (existsSync(join(packageDir, forbidden))) {
      errors.push(
        `${pkg.name}: primitive package must not hand-write ${forbidden}; use @zeus-js/output-* instead`,
      )
    }
  }
}
```

## `scripts/checks/check-package-exports.ts`

```ts
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { validatePackageRules } from './package-rules'

const root = process.cwd()

function listPackageJsonFiles() {
  const files: string[] = []

  for (const rel of ['packages', 'packages/primitives']) {
    const abs = join(root, rel)
    if (!existsSync(abs)) continue

    for (const name of readdirSync(abs)) {
      const file = join(abs, name, 'package.json')
      if (existsSync(file)) files.push(file)
    }
  }

  return files
}

let hasError = false

for (const file of listPackageJsonFiles()) {
  const result = validatePackageRules(root, file)

  for (const error of result.errors) {
    console.error(`[package-rules] ${error}`)
  }

  if (!result.valid) {
    hasError = true
  }
}

if (hasError) {
  process.exit(1)
}

console.log('All packages have valid exports and package rules.')
```

# 8. package rules 测试

当前 `vitest.config.ts` 已经有多项目配置，但 `unit-jsdom` include 只匹配包根一层，建议顺便扩大到 `__tests__`。

## 修改 `vitest.config.ts`

```ts
include: [
  'packages/*/__tests__/**/*.{test,spec}.ts',
  'packages/primitives/*/__tests__/**/*.{test,spec}.ts',
  'scripts/checks/__tests__/**/*.{test,spec}.ts',
]
```

## `scripts/checks/__tests__/package-rules.test.ts`

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { validatePackageRules } from '../package-rules'

function createTempRoot() {
  const root = join(tmpdir(), `zeus-ui-${Date.now()}-${Math.random()}`)
  mkdirSync(root, { recursive: true })
  return root
}

function writeJson(file: string, value: unknown) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

describe('package rules', () => {
  it('accepts a primitive package using zeus web-c pipeline', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeFileSync(join(dir, 'rollup.config.mjs'), 'export default {}\n')
    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rollup -c',
      },
      sideEffects: ['./dist/wc/index.js', './dist/wc/*.js'],
      exports: {
        '.': {},
        './wc': {},
        './react': {},
        './vue': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/runtime-dom': '^0.1.0-beta.0',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects primitive package with hand-written wc/react/vue entries', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeFileSync(join(dir, 'rollup.config.mjs'), 'export default {}\n')
    writeFileSync(join(dir, 'src/wc.ts'), 'export {}\n')

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rollup -c',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './react': {},
        './vue': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/runtime-dom': '^0.1.0-beta.0',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error =>
        error.includes('must not hand-write src/wc.ts'),
      ),
    ).toBe(true)
  })

  it('rejects primitive package without @zeus-js/runtime-dom peer dependency', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeFileSync(join(dir, 'rollup.config.mjs'), 'export default {}\n')

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rollup -c',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './react': {},
        './vue': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error => error.includes('@zeus-js/runtime-dom')),
    ).toBe(true)
  })
})
```

# 9. 构建产物检查脚本

Phase 0 要加一个 build 后 smoke test，确保 Zeus web-c 管线真的输出了文件。

新增：

```txt
scripts/checks/check-build-output.ts
```

```ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'packages/primitives/input/dist/wc/index.js',
  'packages/primitives/input/dist/react/index.js',
  'packages/primitives/input/dist/vue/index.js',
  'packages/primitives/input/dist/custom-elements.json',
  'packages/primitives/input/dist/zeus.components.json',
]

let hasError = false

for (const file of requiredFiles) {
  const abs = join(root, file)

  if (!existsSync(abs)) {
    console.error(`[build-output] missing ${file}`)
    hasError = true
  }
}

if (hasError) {
  process.exit(1)
}

console.log('Build output looks good.')
```

根 `package.json` 增加：

```json
{
  "scripts": {
    "check:build-output": "tsx scripts/checks/check-build-output.ts"
  }
}
```

Phase 0 验收时跑：

```bash
pnpm build
pnpm check:build-output
```

# 10. Input 产物 smoke test

新增：

```txt
packages/primitives/input/__tests__/input.output.test.ts
```

这个测试依赖先执行 `pnpm build`，所以不一定放在普通 `pnpm test` 里，可以作为 build-output 检查的一部分。如果你想放进 vitest，需要确保 CI 顺序是先 build 后 test。

```ts
describe('@zeus-web/input generated outputs', () => {
  it('can import generated wc entry', async () => {
    const mod = await import('../dist/wc/index.js')

    expect(mod).toBeDefined()
  })

  it('can import generated react entry', async () => {
    const mod = await import('../dist/react/index.js')

    expect(mod).toBeDefined()
  })

  it('can import generated vue entry', async () => {
    const mod = await import('../dist/vue/index.js')

    expect(mod).toBeDefined()
  })
})
```

如果不想让普通 test 依赖 dist，可以命名为：

```txt
packages/primitives/input/__tests__/e2e/input.output.spec.ts
```

然后通过 `pnpm build && pnpm test-e2e` 跑。

# 11. 根 build 脚本是否要改

当前 `scripts/commands/build.ts` 已经会先构建 `packages/primitives/*`，再构建 `packages/*`。
这个逻辑可以保留。

不过要注意：`packages/primitives/input` 的 build 从 `tsup` 改成 `rollup -c` 后，根构建无需改。

# 12. Phase 0 文件变更清单

```txt
修改：
  package.json
  scripts/config/tsconfig.base.json
  vitest.config.ts
  scripts/checks/check-package-exports.ts
  packages/primitives/input/package.json
  packages/primitives/input/src/index.ts

新增：
  scripts/rollup/createPrimitiveRollupConfig.mjs
  scripts/checks/package-rules.ts
  scripts/checks/check-build-output.ts
  scripts/checks/__tests__/package-rules.test.ts
  packages/primitives/input/rollup.config.mjs
  packages/primitives/input/src/input.ts
  packages/primitives/input/__tests__/input.output.test.ts

删除：
  packages/primitives/input/src/wc.ts
  packages/primitives/input/src/react.ts
  packages/primitives/input/src/vue.ts
```

# 13. Phase 0 验收标准

必须通过：

```bash
pnpm install
pnpm check
pnpm test
pnpm check:exports
pnpm build
pnpm check:build-output
```

必须满足：

```txt
1. @zeus-web/input 不再有 src/wc.ts / src/react.ts / src/vue.ts
2. @zeus-web/input 使用 rollup -c 构建
3. @zeus-web/input 构建依赖 @zeus-js/bundler-plugin
4. @zeus-web/input 构建使用 output-wc / output-react-wrapper / output-vue-wrapper
5. @zeus-web/input 运行时 peerDependency 只有 @zeus-js/runtime-dom
6. dist/wc/index.js 存在
7. dist/react/index.js 存在
8. dist/vue/index.js 存在
9. dist/custom-elements.json 存在
10. dist/zeus.components.json 存在
11. check:exports 能阻止手写 wc/react/vue 入口回流
```

# 14. Phase 0 PR 标题

```txt
refactor(input): migrate primitive output to zeus web-c pipeline
```

或者更准确一点：

```txt
chore: wire primitive packages to zeus web-c output pipeline
```

# 15. Phase 0 边界

这一阶段不要做：

```txt
不要做完整 Input 交互完善
不要做 Button / Checkbox / Dialog
不要做真实 registry add copy
不要做主题系统
不要做 AI metadata
不要手写 React/Vue wrapper
```

Phase 0 只解决一件事：

```txt
zeus-ui 的 primitive 构建方式从“手写 WC 封装”切换到“Zeus web-c 输出管线”。
```

这个地基改完，Phase 1 再正式把 `@zeus-web/input` 做成标准 headless primitive 模板。
