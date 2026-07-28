# Next.js App Router 示例

Next.js 示例用于验证 App Router 项目中 Registry 风格的 React 使用路径。

运行：

```bash
pnpm --filter @zeus-web/example-next-app dev
```

构建：

```bash
pnpm --filter @zeus-web/example-next-app build
```

类型检查：

```bash
pnpm --filter @zeus-web/example-next-app check
```

## 此示例验证的内容

```txt
1. 本地 `src/components/ui/*` 组件。
2. 通过 `@zeus-web/button/react` 等路径按组件导入 React wrapper。
3. 使用 `"use client"` 声明 Client Component 边界。
4. 通过 `@zeus-web/themes/default.css` 导入主题。
5. 使用 `zeus-ui.json` 配置路径别名。
```

## Client 边界

Zeus Web React wrappers 在 Client Components 中使用。

```tsx
'use client'

import { Button } from '@/components/ui/button'

export function Demo() {
  return <Button>Save</Button>
}
```

## 主题导入

该示例在 `src/app/layout.tsx` 中导入默认主题。

```tsx
import '@zeus-web/themes/default.css'
import '@zeus-web/themes/components.css'
import './globals.css'
```

## 别名配置

该示例包含 `zeus-ui.json`。

```json
{
  "$schema": "https://zeus-web.dev/schema/zeus-ui.json",
  "framework": "react",
  "style": "default",
  "typescript": true,
  "srcDir": "src",
  "tailwind": {
    "css": "src/styles/zeus.css",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "styles": "@/styles"
  }
}
```
