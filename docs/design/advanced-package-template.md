# 高级组件包模板

本文档定义 `packages/advanced/*` 下高级组件包的最小结构。

## 目录结构

```txt
packages/advanced/<name>/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    core/
      index.ts
    components/
      <name>.tsx
  __tests__/
    <name>.spec.ts
```

## package.json 模板

```json
{
  "name": "@zeus-web/<name>",
  "type": "module",
  "version": "0.0.0",
  "description": "Headless <name> advanced component for Zeus Web.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/baicie/zeus-ui.git",
    "directory": "packages/advanced/<name>"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
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
    "./wc/auto": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/auto.js"
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
    "dev": "rolldown -c ../../../rolldown.config.ts --watch",
    "build": "rimraf dist && rolldown -c ../../../rolldown.config.ts",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../../.. --project unit packages/advanced/<name>/__tests__/<name>.spec.ts"
  },
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.5 <0.2.0",
    "react": ">=18 || >=19",
    "vue": ">=3"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    },
    "vue": {
      "optional": true
    }
  },
  "dependencies": {
    "@zeus-js/runtime-dom": "0.1.0-beta.5",
    "@zeus-js/web-c-runtime": "0.2.0",
    "@zeus-web/zeus-compat": "workspace:*"
  }
}
```

## src/index.ts 模板

```ts
export * from './types'
export * from './components/<name>'
```

## src/types.ts 模板

```ts
export interface <PascalName>Props {
  disabled?: boolean
}

export interface <PascalName>Element extends HTMLElement {
  focus: () => void
}
```

## src/core/index.ts 模板

```ts
export interface <PascalName>State {
  disabled: boolean
}

export function create<P extends <PascalName>State>(state: P): P {
  return state
}
```

## src/components/<name>.tsx 模板

```tsx
import type { DefineElementContext } from '@zeus-js/zeus'
import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

import type { <PascalName>Element, <PascalName>Props } from '../types'

function setup(
  props: <PascalName>Props,
  ctx: DefineElementContext<<PascalName>Element>,
) {
  ctx.expose({
    focus(): void {
      ctx.host.focus()
    },
  })

  return (
    <Host
      data-slot="<name>-root"
      data-disabled={() => (props.disabled ? '' : undefined)}
    >
      <div part="root" data-slot="<name>">
        <Slot />
      </div>
    </Host>
  )
}

export const <PascalName> = defineElement<<PascalName>Props, <PascalName>Element>(
  'zw-<name>',
  {
    shadow: false,
    props: {
      disabled: prop(Boolean, {
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless <name> advanced component.',
    },
  },
  setup,
)
```

## 约束

高级组件包必须：

1. 使用 `packages/advanced/<name>`。
2. 使用共享 `../../../rolldown.config.ts`。
3. 不手写 `src/wc.ts`、`src/react.ts`、`src/vue.ts`。
4. `src/core` 放纯 TypeScript engine。
5. `src/components` 放 Zeus Web Component。
6. Web Component 是第一等产物。
7. React/Vue wrapper 只能做薄适配。
