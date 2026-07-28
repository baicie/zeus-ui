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
