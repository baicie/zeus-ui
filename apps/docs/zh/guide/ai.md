# AI

Zeus Web 通过 `@zeus-web/ai` 提供 AI 元数据。

## 生成 Markdown

```bash
zweb ai
```

这会创建：

```txt
zeus-web.ai.md
```

## 生成 JSON

```bash
zweb ai --json
```

这会创建：

```txt
zeus-web.ai.json
```

## 生成 Cursor 规则

```bash
zweb ai --cursor
```

这会创建：

```txt
.cursor/rules/zeus-web.mdc
```

## 指南包含的内容

```txt
recommended workflow
theme names
icon package usage
icon import rules
global usage rules
component props
component events
component slots
examples
AI do / do-not rules
```

## 图标

生成的 AI 指南包含以下入口的图标使用规则：

```txt
@zeus-web/icons/react
@zeus-web/icons/vue
@zeus-web/icons/wc
@zeus-web/icons/svg/*
```

生成含图标的示例时，请遵循这些规则。装饰性图标使用 `aria-hidden`。只有图标的按钮应把无障碍名称放在父级控件上。

## 感知别名

存在 `zeus-ui.json` 时，`zweb ai` 应使用你配置的别名，使 AI 生成的导入路径与项目一致。

示例：

```json
{
  "aliases": {
    "ui": "~/components/ui",
    "lib": "~/shared/lib"
  }
}
```

AI 指南应优先使用：

```tsx
import { Button } from '~/components/ui/button'
```

## 推荐的 AI 指令

```txt
Use Zeus Web registry components from the local components/ui directory.
Do not import registry components from package internals.
Prefer zweb add when adding a new component.
Use semantic theme tokens instead of hard-coded colors.
```
