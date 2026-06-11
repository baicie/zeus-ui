# @zeus-web/input 打包输出审查

审查对象：`packages/primitives/input`

审查时间：2026-06-05

## 结论

当前 `@zeus-web/input` 的打包输出还不符合预期。虽然单包构建可以通过，但发布产物和包元数据之间存在不一致，并且产物不满足项目的 ES2016 兼容性约束。

## 修复归属总览

| 问题                                                                 | 修复项目                                                                                       | 完成标记位置                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| P0-1. 缺少 `dist/custom-elements.json` / `dist/zeus.components.json` | Zeus 工具链：`@zeus-js/output-wc` 或 bundler plugin                                            | Zeus 修复后，在 zeus-ui 重新构建并验证 tarball |
| P0-2. 发布产物不满足 ES2016 兼容性约束                               | Zeus 工具链：rolldown 输出配置、`@zeus-js/output-react-wrapper`、`@zeus-js/output-vue-wrapper` | Zeus 修复后，在 zeus-ui 检查产物语法           |
| P0-3. `@zeus-js/runtime-dom` 依赖声明缺失                            | zeus-ui：`packages/primitives/input/package.json`；如需隐藏该依赖，则回到 Zeus 工具链调整输出  | zeus-ui 直接修复或等待 Zeus 输出策略确定后标记 |
| P0-4. `check:exports` 与配置文件命名不一致                           | zeus-ui：`packages/primitives/input/rolldown.config.*` 或 `scripts/checks/package-rules.ts`    | zeus-ui 直接修复并通过 `pnpm check:exports`    |
| P1-1. 根入口和生成入口语义容易混淆                                   | zeus-ui：primitive 包约定、文档或检查规则；如需减少 `dist/index.js`，可能需要 Zeus 工具链支持  | zeus-ui 明确约定后标记                         |

最终完成标记以 zeus-ui 的验收结果为准：`@zeus-web/input` 重新构建、dry-run 打包和 `check:exports` 全部通过，并且 tarball 与语法检查符合本文最小验收标准。

## Canary 验证结果

验证版本：`@zeus-js/*@0.1.0-canary.20260605.13.1.2e49f2f7`

验证时间：2026-06-05

验证命令：

```bash
pnpm add -Dw @zeus-js/bundler-plugin@canary @zeus-js/compiler@canary @zeus-js/component-analyzer@canary @zeus-js/component-dts@canary @zeus-js/output-icons@canary @zeus-js/output-react-wrapper@canary @zeus-js/output-vue-wrapper@canary @zeus-js/output-wc@canary @zeus-js/runtime-dom@canary @zeus-js/signal@canary @zeus-js/zeus@canary
pnpm --filter @zeus-web/input build
pnpm --filter @zeus-web/input pack --dry-run
pnpm check:exports
pnpm check:zeus-baseline
```

结果：

- `pnpm --filter @zeus-web/input build`：通过。
- `pnpm --filter @zeus-web/input pack --dry-run`：通过。
- `dist/custom-elements.json`：已生成，并进入 dry-run tarball。
- `dist/zeus.components.json`：已生成，并进入 dry-run tarball。
- 发布 JS 产物正文中未再发现 `??`、`...rest`、`...attrs`。
- `pnpm check:exports`：已通过。zeus-ui 已改为使用根级共享 `rolldown.config.ts`，primitive 包内不再保留本地 rolldown 配置。
- `pnpm check:zeus-baseline`：仍失败，原因是仓库基线规则不允许 canary 版本直接进入 root `package.json`，并且 workspace 包的 `@zeus-js/zeus` peer range 尚未同步到 canary baseline。
- `dist/wc/index.js`、`dist/react/index.js`、`dist/vue/index.js`：已可正常导入。zeus-ui 已为 `@zeus-web/input` 补齐 `@zeus-js/runtime-dom` 和 `@zeus-js/web-c-runtime` 运行时依赖。

canary 已修复的问题：

- P0-1：manifest 文件生成问题已修复。
- P0-2：发布 JS 产物正文中的 ES2016 语法问题已修复。

zeus-ui 已配套处理的问题：

- P0-3：`@zeus-web/input` 已补齐产物直接 import 的运行时依赖，包括 `@zeus-js/runtime-dom` 和 `@zeus-js/web-c-runtime`。
- P0-4：已统一为根级共享 `rolldown.config.ts`；primitive 包内本地配置已移除，`pnpm check:exports` 已通过。

仍需策略确认的问题：

- Zeus baseline 策略：当前 `check:zeus-baseline` 明确提示 canary 只应在 `zeus-canary-compat.yml` 中安装；如果本次验证要落地到主分支，需要等待 beta/stable baseline 发布，或调整仓库 canary 验证策略。

## 验证命令

```bash
pnpm --filter @zeus-web/input build
pnpm --filter @zeus-web/input pack --dry-run
pnpm check:exports
```

验证结果：

- `pnpm --filter @zeus-web/input build`：通过。
- `pnpm --filter @zeus-web/input pack --dry-run`：通过，但包内容缺少 `dist/custom-elements.json` 和 `dist/zeus.components.json`。
- `pnpm check:exports`：失败。

失败信息：

```text
[package-rules] @zeus-web/input: primitive package must have rolldown.config.mjs
```

## 问题清单

### P0-1. `package.json` 导出了不存在的 manifest 文件

位置：`packages/primitives/input/package.json`

修复项目：Zeus 工具链，优先检查 `@zeus-js/output-wc` 和 bundler plugin 的 manifest 输出逻辑。

完成标记位置：Zeus 修复发布或工作区依赖更新后，在 zeus-ui 重新执行构建与 dry-run 打包，确认 tarball 包含两个 manifest 文件。

当前 `exports` 声明：

```json
"./custom-elements.json": {
  "default": "./dist/custom-elements.json"
},
"./zeus.components.json": {
  "default": "./dist/zeus.components.json"
}
```

但执行构建后，`dist/` 下没有生成：

- `dist/custom-elements.json`
- `dist/zeus.components.json`

`pnpm --filter @zeus-web/input pack --dry-run` 的 tarball 内容也确认这两个文件不会被发布。

影响：

- 用户导入 `@zeus-web/input/custom-elements.json` 会解析到不存在的文件。
- 文档、registry、AI 元数据链路如果依赖这两个 manifest，会在发布包中失效。
- `package.json` 的导出契约和真实产物不一致。

建议修复：

- 修正 `@zeus-js/output-wc` / rolldown pipeline，确保构建时生成根级 `dist/custom-elements.json` 和 `dist/zeus.components.json`。
- 如果当前阶段暂不支持生成这两个文件，则应先移除对应 `exports`，但这会偏离既有设计文档中对 primitive 包的要求。

### P0-2. 发布产物不满足 ES2016 兼容性约束

位置：

- `packages/primitives/input/dist/chunks/input-Df_uE9t2.js`
- `packages/primitives/input/dist/react/input.js`
- `packages/primitives/input/dist/vue/input.js`

修复项目：Zeus 工具链，包含 rolldown 输出 target、源码编译产物、React wrapper 生成器和 Vue wrapper 生成器。

完成标记位置：Zeus 修复发布或工作区依赖更新后，在 zeus-ui 重新构建 `@zeus-web/input`，确认发布 JS 产物中不再出现 `??`、`...rest`、`...attrs` 等不符合 ES2016 约束的语法。

产物中仍包含项目规范明确避免的语法：

- 空值合并操作符：`??`
- 对象展开/剩余语法：`...rest`、`...attrs`

示例：

```js
bindAttr(_el$, 'type', () => props.type ?? 'text')
```

```js
const Input = React.forwardRef(function Input({ children, ...rest } = {}, ref) {
  return React.createElement(
    'zw-input',
    {
      ...rest,
      ref,
    },
    children,
  )
})
```

```js
return h('zw-input', { ...attrs }, children)
```

影响：

- 项目要求编译目标为 ES2016，但当前发布产物仍依赖更高版本语法。
- 下游如果不再转译 `node_modules`，会把这些语法直接交给目标运行环境。
- 这也和仓库 ESLint/编码规范中“避免对象展开、空值合并”的约束不一致。

建议修复：

- 为 rolldown 输出配置明确的 ES2016 target。
- 如果 rolldown 当前不会降级这些语法，需要在输出链路增加兼容性转译插件。
- wrapper 生成器也需要遵守同一 target，不能只处理源码入口。

### P0-3. 产物直接依赖 `@zeus-js/runtime-dom`，但包未声明该依赖

位置：

- `packages/primitives/input/dist/chunks/input-Df_uE9t2.js`
- `packages/primitives/input/dist/wc/zw-input.entry.js`
- `packages/primitives/input/package.json`

修复项目：默认在 zeus-ui 修复 `packages/primitives/input/package.json` 的依赖声明；如果设计目标是不让 primitive 包直接暴露 `@zeus-js/runtime-dom`，则需要回到 Zeus 工具链调整输出依赖边界。

完成标记位置：zeus-ui 修复后，确认发布包声明覆盖产物中的直接 import，并通过下游严格依赖解析场景。

构建产物中存在直接导入：

```js
import {
  Host,
  bindAttr,
  bindEvent,
  delegateEvents,
  template,
} from '@zeus-js/runtime-dom'
```

```js
import { mountElementDefinition } from '@zeus-js/runtime-dom'
```

但 `packages/primitives/input/package.json` 只声明了：

- `peerDependencies.@zeus-js/zeus`
- `dependencies.@zeus-web/zeus-compat`

没有声明 `@zeus-js/runtime-dom`。

影响：

- 发布包的运行时依赖不完整。
- 在 pnpm 等严格依赖解析环境中，下游可能无法解析 `@zeus-js/runtime-dom`。
- 当前源码已经直接从 `@zeus-js/zeus` 导入，不再直接使用 `@zeus-web/zeus-compat`，但包仍保留该 dependency，依赖关系和实际产物不匹配。

建议修复：

- 明确 `@zeus-js/runtime-dom` 应该由哪个包提供。
- 如果产物会直接 import `@zeus-js/runtime-dom`，则 `@zeus-web/input` 应声明对应 peer dependency 或 dependency。
- 如果设计目标是不暴露 runtime-dom 依赖，则需要调整 bundler/output pipeline，让产物只依赖公共入口。
- 清理或重新确认 `@zeus-web/zeus-compat` 在 primitive 包中的必要性。

### P0-4. `check:exports` 与当前配置文件命名不一致

位置：

- `packages/primitives/input/rolldown.config.ts`
- `scripts/checks/package-rules.ts`

修复项目：zeus-ui。

完成标记位置：zeus-ui 直接修复后，执行 `pnpm check:exports` 并通过。

当前 primitive 包使用：

```text
packages/primitives/input/rolldown.config.ts
```

但检查脚本硬编码读取：

```ts
readFileSync(join(packageDir, 'rolldown.config.mjs'), 'utf8')
```

影响：

- `pnpm check:exports` 无法通过。
- 发布前质量门禁会阻塞。
- 仓库规范和实际配置格式不一致。

建议修复：

- 二选一统一约定：
  - 将 `packages/primitives/input/rolldown.config.ts` 改为 `rolldown.config.mjs`。
  - 或更新 `scripts/checks/package-rules.ts`，允许并校验 `rolldown.config.ts`。
- 同步更新 `scripts/checks/__tests__/package-rules.test.ts`，避免规则和测试再次漂移。

### P1-1. 根入口和生成入口语义容易混淆

位置：

- `packages/primitives/input/package.json`
- `packages/primitives/input/dist/index.js`
- `packages/primitives/input/dist/wc/index.js`

修复项目：主要在 zeus-ui 明确 primitive 包入口约定、文档和检查规则；如果需要从产物层面移除或调整 `dist/index.js`，可能需要 Zeus 工具链支持。

完成标记位置：zeus-ui 明确根入口语义后，在文档或检查规则中固化，并确认发布包 exports 与预期一致。

构建产物中存在：

```text
dist/index.js
```

它导出源码里的 `Input` 定义：

```js
import { t as Input } from './chunks/input-Df_uE9t2.js'
export { Input }
```

但 `package.json` 的根入口 `.` 指向：

```json
{
  "types": "./dist/wc/index.d.ts",
  "import": "./dist/wc/index.js"
}
```

也就是说，发布包的根入口导出的是 WC 注册 API，而不是 `dist/index.js` 中的源码组件定义。

影响：

- 这可能是符合设计的，因为 README 中推荐 `import '@zeus-web/input/wc'`。
- 但产物里保留未导出的 `dist/index.js`，容易让维护者误以为根入口应该导出源码 `Input`。
- 如果后续工具扫描 `dist/index.js`，可能会和 package exports 的真实行为不一致。

建议修复：

- 明确 `dist/index.js` 是否应该作为内部构建中间产物存在。
- 如果它没有发布 API 价值，可以考虑调整构建输出，减少误导。
- 如果根入口设计为等价 `./wc`，建议在文档或检查规则中明确这一点。

## 当前符合预期的部分

- `dist/wc/index.js`、`dist/wc/loader.js`、`dist/wc/auto.js` 已生成。
- `dist/react/index.js` 和 `dist/vue/index.js` 已生成。
- React / Vue wrapper 的类型声明已生成：
  - `dist/react/index.d.ts`
  - `dist/vue/index.d.ts`
  - `dist/vue/global.d.ts`
- WC 类型声明已生成：
  - `dist/wc/index.d.ts`
  - `dist/wc/loader.d.ts`
  - `dist/wc/types/jsx.d.ts`
- `dist/wc/components.manifest.js` 已生成，并包含 `zw-input` 元数据。

## 建议修复顺序

1. 统一 `rolldown.config.ts` / `rolldown.config.mjs` 命名约定，让 `pnpm check:exports` 先恢复通过。
2. 修复 manifest 生成，确保 `dist/custom-elements.json` 和 `dist/zeus.components.json` 与 `package.json` exports 一致。
3. 补齐或调整 `@zeus-js/runtime-dom` 依赖声明。
4. 配置发布产物 ES2016 降级，消除 `??`、对象展开和剩余语法。
5. 明确 `dist/index.js` 的定位，避免根入口语义混淆。

## 最小验收标准

修复后至少应满足：

```bash
pnpm --filter @zeus-web/input build
pnpm --filter @zeus-web/input pack --dry-run
pnpm check:exports
```

并检查 tarball 内容包含：

```text
dist/custom-elements.json
dist/zeus.components.json
dist/wc/index.js
dist/wc/index.d.ts
dist/react/index.js
dist/react/index.d.ts
dist/vue/index.js
dist/vue/index.d.ts
```

同时发布 JS 产物中不应再出现：

```text
??
...rest
...attrs
```
