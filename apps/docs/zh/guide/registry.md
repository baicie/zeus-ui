# Registry

Registry 包是 `@zeus-web/registry`。

它包含供 `zweb add` 使用的源码模板。

## 唯一事实来源

Registry 元数据存放在：

```txt
packages/registry/registry.json
```

模板存放在：

```txt
packages/registry/templates
```

基础组件质量等级存放在：

```txt
packages/registry/quality.json
```

该清单是机器可读的质量契约。`experimental` 表示尚未满足完整行为与
a11y 证据门槛，`beta` 需要行为和可访问性合同测试，`stable` 还需要端到端
证据。质量等级必须由清单中的证据路径支持，不能只按组件数量推断。

当前 Phase 22 的 Registry 条目：

```txt
cn
globals
button
input
```

## 为什么复制源码？

Registry 组件由你的应用拥有。

运行：

```bash
zweb add button
```

之后，你可以编辑：

```txt
src/components/ui/button.tsx
```

或者在 Vue 项目中编辑：

```txt
src/components/ui/button.vue
```

## Registry 依赖

组件可以依赖其他 Registry 条目。

例如，`button` 依赖：

```txt
cn
globals
```

因此：

```bash
zweb add button
```

会写入：

```txt
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
```

Vue 项目会获得：

```txt
src/components/ui/button.vue
```

## 框架过滤

Registry 条目可以同时包含 React 和 Vue 模板。

CLI 会读取 `zeus-ui.json`，只复制与配置框架匹配的文件。

React 项目会获得 `.tsx` 文件。

Vue 项目会获得 `.vue` 文件。

## 按组件拆分的 Primitives

Registry 源码会导入按组件拆分的 primitive wrappers。

React：

```tsx
import { Button as ButtonPrimitive } from '@zeus-web/button/react'
```

Vue：

```ts
import { Button as ButtonPrimitive } from '@zeus-web/button/vue'
```

Registry 不应从聚合框架包中导入。

## 本地导入

生成的组件会导入本地工具：

```tsx
import { cn } from '@/lib/cn'
```

CLI 会根据 `zeus-ui.json` 中的别名重写此路径。

## Registry 条目结构

```json
{
  "name": "button",
  "type": "component",
  "description": "Styled button component built on top of @zeus-web/button primitives.",
  "frameworks": ["react", "vue"],
  "dependencies": ["@zeus-web/button"],
  "registryDependencies": ["cn", "globals"],
  "files": [
    {
      "framework": "react",
      "source": "templates/react/button.tsx",
      "target": "components/ui/button.tsx"
    },
    {
      "framework": "vue",
      "source": "templates/vue/button.vue",
      "target": "components/ui/button.vue"
    }
  ]
}
```

## Registry 与原生包

Registry 会复制由应用管理的源码。

`@zeus-web/ui` 提供由包管理的原生带样式 Web Components。

需要在 React/Vue 应用中自定义时，请使用 Registry 源码。

需要无框架的带样式自定义元素时，请使用 `@zeus-web/ui`。

## Registry manifest schema

`registry.json` 使用 `schemaVersion: 2`。合法 manifest 必须声明来源信息：

```json
{
  "schemaVersion": 2,
  "name": "@zeus-web/registry",
  "version": "1.0.0",
  "license": "MIT",
  "authors": [
    {
      "name": "Zeus Web Contributors",
      "url": "https://github.com/baicie/zeus-ui"
    }
  ],
  "items": []
}
```

`schemaVersion: 1` 会被直接拒绝，不提供静默迁移。

校验任意 registry manifest（包括第三方）：

```bash
zweb registry validate
zweb registry validate ./registry.json --json
```

## 发布第三方组件包

用 `zweb add` 复制源码，与发布 custom element 包，是两种不同的产品能力，而不是同一实现的两种说法：

| 模式                  | 分发的产物                               | 归属     | 升级方式                    |
| --------------------- | ---------------------------------------- | -------- | --------------------------- |
| Registry 源码复制     | `.tsx` / `.vue` 模板                     | 你的 app | `zweb update`，保留本地修改 |
| **Custom element 包** | `dist/wc/*`、CEM、DTS、React/Vue wrapper | 包作者   | 提升包版本并重新安装        |

`zweb add` 从不生成 custom element。CE 包由作者在自己的仓库里用 `@zeus-js/bundler-plugin` 与 `@zeus-js/output-wc` 构建，再发布到 npm。

第三方包必须声明稳定的发布形状：`exports` 提供 WC 入口、`./wc/auto`、`./custom-elements.json`、`./zeus.components.json`，以及 `./react` 与 `./vue` wrapper；`files: ["dist"]`；并精确 pin `@zeus-js/zeus` peer。发布前先校验：

```bash
zweb author check
zweb author check ./dist-package --json
```

`zweb author check` 以 `{ code, path, message }` 输出诊断；当消费者 Zeus 版本与 peer pin 不一致时失败。

完整契约、诊断码、插件元信息与安全说明见仓库内 `docs/internal/authoring-sdk.md`。
