下面给 **Phase 8：AI Metadata + LLM Guide MVP** 的详细设计与完整代码。

基于当前 `mvp`，CLI 已经有 `init/add` 两个命令。`add` 已经能读取 registry、解析 `components.json`、复制文件并安装依赖。  
当前 CLI 入口也只有 `init/add`，还没有 AI/LLM 相关能力。

Phase 8 就补这一层：**让 AI 能稳定理解 Zeus Web 的组件、安装方式、导入方式、推荐用法、禁止用法和主题规则**。

# Phase 8 目标

```txt
Phase 8：AI Metadata + LLM Guide MVP

目标：
1. 新增 @zeus-web/ai 包。
2. 提供结构化 AI metadata。
3. metadata 覆盖 input/button/checkbox/switch/tabs/dialog。
4. metadata 描述安装命令、React import、WC import、registry add、props、events、slots、样式规则。
5. 提供 metadata 校验。
6. 提供 markdown/json 渲染能力。
7. 新增 zweb ai 命令。
8. zweb ai 可生成 zeus-web.ai.md。
9. zweb ai --json 可生成 zeus-web.ai.json。
10. zweb ai --cursor 可生成 .cursor/rules/zeus-web.mdc。
```

Phase 8 不做：

```txt
不做 MCP server。
不做远程 docs 爬取。
不做 VSCode 插件。
不做 Playground。
不做 AI 自动修复代码。
```

---

# 1. 文件变更总览

```txt
新增：
  packages/ai/package.json
  packages/ai/tsconfig.json
  packages/ai/src/types.ts
  packages/ai/src/metadata.ts
  packages/ai/src/validate.ts
  packages/ai/src/render.ts
  packages/ai/src/index.ts
  packages/ai/__tests__/ai.spec.ts

新增：
  packages/cli/src/commands/ai.ts
  packages/cli/__tests__/ai.spec.ts

修改：
  packages/cli/package.json
  packages/cli/tsconfig.json
  packages/cli/src/index.ts
```

`pnpm-workspace.yaml` 已经包含 `packages/*`，所以新增 `packages/ai` 不需要改 workspace。

---

# 2. `packages/ai/package.json`

```json
{
  "name": "@zeus-web/ai",
  "type": "module",
  "version": "0.0.0",
  "description": "AI metadata and LLM usage guide for Zeus Web.",
  "license": "MIT",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "dev": "tsup src/index.ts --format esm --dts --clean --watch",
    "build": "tsup src/index.ts --format esm --dts --clean",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit packages/ai/__tests__/ai.spec.ts"
  }
}
```

---

# 3. `packages/ai/tsconfig.json`

```json
{
  "extends": "../../scripts/config/tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

# 4. `packages/ai/src/types.ts`

```ts
export type ZeusWebAiComponentName =
  | 'input'
  | 'button'
  | 'checkbox'
  | 'switch'
  | 'tabs'
  | 'dialog'

export type ZeusWebAiThemeName =
  | 'default'
  | 'slate'
  | 'zinc'
  | 'neutral'
  | 'stone'

export interface ZeusWebAiProp {
  name: string
  type: string
  description: string
  values?: string[]
  default?: string
}

export interface ZeusWebAiEvent {
  name: string
  reactName: string
  description: string
  detail: Record<string, string>
}

export interface ZeusWebAiSlot {
  name: string
  description: string
}

export interface ZeusWebAiExample {
  title: string
  code: string
}

export interface ZeusWebAiComponent {
  name: ZeusWebAiComponentName
  description: string
  primitivePackage: string
  registryCommand: string
  installCommand: string
  reactImport: string
  webComponentImport: string
  styledImport: string
  sourceTarget: string
  dependencies: string[]
  props: ZeusWebAiProp[]
  events: ZeusWebAiEvent[]
  slots: ZeusWebAiSlot[]
  examples: ZeusWebAiExample[]
  styling: {
    usesTailwind: boolean
    themeTokens: string[]
    internalSelectors: string[]
  }
  aiRules: {
    do: string[]
    dont: string[]
  }
}

export interface ZeusWebAiMetadata {
  schemaVersion: 1
  packageName: '@zeus-web/ai'
  libraryName: 'Zeus Web'
  registryPackage: '@zeus-web/registry'
  cliPackage: '@zeus-web/cli'
  recommendedWorkflow: string[]
  themes: ZeusWebAiThemeName[]
  globalRules: {
    do: string[]
    dont: string[]
  }
  components: ZeusWebAiComponent[]
}

export interface ZeusWebAiValidationResult {
  valid: boolean
  errors: string[]
}
```

---

# 5. `packages/ai/src/metadata.ts`

```ts
import type { ZeusWebAiMetadata } from './types'

const sharedDependencies = [
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
]

export const aiMetadata: ZeusWebAiMetadata = {
  schemaVersion: 1,
  packageName: '@zeus-web/ai',
  libraryName: 'Zeus Web',
  registryPackage: '@zeus-web/registry',
  cliPackage: '@zeus-web/cli',
  themes: ['default', 'slate', 'zinc', 'neutral', 'stone'],
  recommendedWorkflow: [
    'Run `zweb init` before adding styled components.',
    'Run `zweb add <component>` to copy shadcn-like styled source into the user project.',
    'Import styled components from the copied local path, usually `@/components/ui/<component>`.',
    'Do not import `@zeus-web/react` directly in generated app code unless the user explicitly wants the aggregate wrapper package.',
    'Prefer per-component packages such as `@zeus-web/button/react` inside registry source.',
  ],
  globalRules: {
    do: [
      'Use Zeus Web registry components for app-level UI code.',
      'Use Tailwind semantic tokens such as bg-background, text-foreground, border-input, ring-ring, bg-primary and text-primary-foreground.',
      'Respect components.json aliases when generating local imports.',
      'Use `zweb add` to add components instead of manually copying package internals.',
      'Use `zweb init --style <theme>` to set up theme CSS.',
    ],
    dont: [
      'Do not hand-write Web Component registration code.',
      'Do not import generated app components from @zeus-web/registry/default/* at runtime.',
      'Do not style only the custom element host when the primitive exposes internal data-slot or part selectors.',
      'Do not assume Shadow DOM; current MVP registry styling targets light DOM internals.',
      'Do not use non-semantic hard-coded colors when theme tokens are available.',
    ],
  },
  components: [
    {
      name: 'button',
      description: 'Styled button component built on the zw-button primitive.',
      primitivePackage: '@zeus-web/button',
      registryCommand: 'zweb add button',
      installCommand:
        'pnpm add @zeus-web/button class-variance-authority clsx tailwind-merge',
      reactImport: "import { Button } from '@zeus-web/button/react'",
      webComponentImport: "import '@zeus-web/button/wc'",
      styledImport: "import { Button } from '@/components/ui/button'",
      sourceTarget: 'components/ui/button.tsx',
      dependencies: ['@zeus-web/button', ...sharedDependencies],
      props: [
        {
          name: 'variant',
          type: 'ButtonVariant',
          description: 'Visual style variant.',
          values: [
            'default',
            'primary',
            'secondary',
            'outline',
            'ghost',
            'danger',
          ],
          default: 'default',
        },
        {
          name: 'size',
          type: 'ButtonSize',
          description: 'Button size.',
          values: ['sm', 'md', 'lg', 'icon'],
          default: 'md',
        },
        {
          name: 'disabled',
          type: 'boolean',
          description: 'Disables user interaction.',
        },
        {
          name: 'loading',
          type: 'boolean',
          description:
            'Marks the button as loading and prevents press handling.',
        },
      ],
      events: [
        {
          name: 'press',
          reactName: 'onPress',
          description: 'Emitted when the button is clicked and not disabled.',
          detail: {
            nativeEvent: 'MouseEvent',
          },
        },
      ],
      slots: [
        {
          name: 'default',
          description: 'Button label content.',
        },
        {
          name: 'prefix',
          description: 'Content before the label.',
        },
        {
          name: 'suffix',
          description: 'Content after the label.',
        },
      ],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Button } from '@/components/ui/button'",
            '',
            'export function Example() {',
            '  return <Button variant="primary">Save</Button>',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: [
          'bg-primary',
          'text-primary-foreground',
          'border-input',
          'ring-ring',
        ],
        internalSelectors: [
          '[&_[data-slot=button]]',
          '[&_[data-slot=button-prefix]]',
          '[&_[data-slot=button-suffix]]',
        ],
      },
      aiRules: {
        do: [
          'Use Button for actions.',
          'Use variant="outline" for secondary actions.',
          'Use size="icon" only for icon-only buttons.',
        ],
        dont: [
          'Do not add asChild; the current registry Button does not implement asChild.',
          'Do not attach click handlers to internal button selectors manually.',
        ],
      },
    },
    {
      name: 'input',
      description:
        'Styled text input component built on the zw-input primitive.',
      primitivePackage: '@zeus-web/input',
      registryCommand: 'zweb add input',
      installCommand:
        'pnpm add @zeus-web/input class-variance-authority clsx tailwind-merge',
      reactImport: "import { Input } from '@zeus-web/input/react'",
      webComponentImport: "import '@zeus-web/input/wc'",
      styledImport: "import { Input } from '@/components/ui/input'",
      sourceTarget: 'components/ui/input.tsx',
      dependencies: ['@zeus-web/input', ...sharedDependencies],
      props: [
        {
          name: 'value',
          type: 'string',
          description: 'Controlled input value.',
        },
        {
          name: 'defaultValue',
          type: 'string',
          description: 'Initial uncontrolled value.',
        },
        {
          name: 'type',
          type: 'InputType',
          description: 'Native input type.',
          values: [
            'text',
            'email',
            'password',
            'search',
            'tel',
            'url',
            'number',
          ],
          default: 'text',
        },
        {
          name: 'placeholder',
          type: 'string',
          description: 'Placeholder text.',
        },
        {
          name: 'disabled',
          type: 'boolean',
          description: 'Disables input interaction.',
        },
      ],
      events: [
        {
          name: 'value-change',
          reactName: 'onValueChange',
          description: 'Emitted when the input value changes.',
          detail: {
            value: 'string',
            nativeEvent: 'Event',
          },
        },
      ],
      slots: [
        {
          name: 'prefix',
          description: 'Content before the native input.',
        },
        {
          name: 'suffix',
          description: 'Content after the native input.',
        },
      ],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Input } from '@/components/ui/input'",
            '',
            'export function Example() {',
            '  return <Input placeholder="Email" type="email" />',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['border-input', 'ring-ring', 'text-muted-foreground'],
        internalSelectors: ['[&_[part=root]]', '[&_[data-slot=input]]'],
      },
      aiRules: {
        do: [
          'Use Input for text-like form fields.',
          'Use onValueChange when the user wants Zeus custom events.',
        ],
        dont: [
          'Do not style only the host for placeholder or disabled states.',
          'Do not assume the native input is the custom element itself.',
        ],
      },
    },
    {
      name: 'checkbox',
      description:
        'Styled checkbox component built on the zw-checkbox primitive.',
      primitivePackage: '@zeus-web/checkbox',
      registryCommand: 'zweb add checkbox',
      installCommand:
        'pnpm add @zeus-web/checkbox class-variance-authority clsx tailwind-merge',
      reactImport: "import { Checkbox } from '@zeus-web/checkbox/react'",
      webComponentImport: "import '@zeus-web/checkbox/wc'",
      styledImport: "import { Checkbox } from '@/components/ui/checkbox'",
      sourceTarget: 'components/ui/checkbox.tsx',
      dependencies: ['@zeus-web/checkbox', ...sharedDependencies],
      props: [
        {
          name: 'checked',
          type: 'boolean',
          description: 'Controlled checked state.',
        },
        {
          name: 'defaultChecked',
          type: 'boolean',
          description: 'Initial checked state.',
        },
        {
          name: 'indeterminate',
          type: 'boolean',
          description: 'Mixed state.',
        },
        {
          name: 'size',
          type: 'CheckboxSize',
          description: 'Checkbox size.',
          values: ['sm', 'md', 'lg'],
          default: 'md',
        },
      ],
      events: [
        {
          name: 'checked-change',
          reactName: 'onCheckedChange',
          description: 'Emitted when checked state changes.',
          detail: {
            checked: 'boolean',
            nativeEvent: 'Event',
          },
        },
        {
          name: 'focus-change',
          reactName: 'onFocusChange',
          description: 'Emitted when focus state changes.',
          detail: {
            focused: 'boolean',
            nativeEvent: 'FocusEvent',
          },
        },
      ],
      slots: [
        {
          name: 'default',
          description: 'Label content.',
        },
        {
          name: 'indicator',
          description: 'Custom indicator content.',
        },
      ],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Checkbox } from '@/components/ui/checkbox'",
            '',
            'export function Example() {',
            '  return <Checkbox>Accept terms</Checkbox>',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['bg-primary', 'text-primary-foreground', 'ring-ring'],
        internalSelectors: [
          '[&_[data-slot=checkbox-control]]',
          '[&_[data-slot=checkbox-indicator]]',
        ],
      },
      aiRules: {
        do: [
          'Use Checkbox for boolean form choices.',
          'Use indeterminate for mixed state.',
        ],
        dont: [
          'Do not render a separate native input next to Checkbox.',
          'Do not manually manage aria-checked when using the primitive props.',
        ],
      },
    },
    {
      name: 'switch',
      description: 'Styled switch component built on the zw-switch primitive.',
      primitivePackage: '@zeus-web/switch',
      registryCommand: 'zweb add switch',
      installCommand:
        'pnpm add @zeus-web/switch class-variance-authority clsx tailwind-merge',
      reactImport: "import { Switch } from '@zeus-web/switch/react'",
      webComponentImport: "import '@zeus-web/switch/wc'",
      styledImport: "import { Switch } from '@/components/ui/switch'",
      sourceTarget: 'components/ui/switch.tsx',
      dependencies: ['@zeus-web/switch', ...sharedDependencies],
      props: [
        {
          name: 'checked',
          type: 'boolean',
          description: 'Controlled checked state.',
        },
        {
          name: 'defaultChecked',
          type: 'boolean',
          description: 'Initial checked state.',
        },
        {
          name: 'size',
          type: 'SwitchSize',
          description: 'Switch size.',
          values: ['sm', 'md', 'lg'],
          default: 'md',
        },
      ],
      events: [
        {
          name: 'checked-change',
          reactName: 'onCheckedChange',
          description: 'Emitted when checked state changes.',
          detail: {
            checked: 'boolean',
            nativeEvent: 'Event',
          },
        },
      ],
      slots: [
        {
          name: 'default',
          description: 'Label content.',
        },
      ],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Switch } from '@/components/ui/switch'",
            '',
            'export function Example() {',
            '  return <Switch>Enable notifications</Switch>',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['bg-primary', 'bg-input'],
        internalSelectors: [
          '[&_[data-slot=switch-track]]',
          '[&_[data-slot=switch-thumb]]',
        ],
      },
      aiRules: {
        do: [
          'Use Switch for on/off settings.',
          'Use Checkbox instead when the field is part of a multi-select list.',
        ],
        dont: [
          'Do not use Switch for submitting an immediate destructive action.',
        ],
      },
    },
    {
      name: 'tabs',
      description: 'Styled tabs component family built on zw-tabs primitives.',
      primitivePackage: '@zeus-web/tabs',
      registryCommand: 'zweb add tabs',
      installCommand:
        'pnpm add @zeus-web/tabs class-variance-authority clsx tailwind-merge',
      reactImport:
        "import { Tabs, TabsList, TabsTrigger, TabsContent } from '@zeus-web/tabs/react'",
      webComponentImport: "import '@zeus-web/tabs/wc'",
      styledImport:
        "import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'",
      sourceTarget: 'components/ui/tabs.tsx',
      dependencies: ['@zeus-web/tabs', ...sharedDependencies],
      props: [
        {
          name: 'value',
          type: 'string',
          description: 'Controlled active tab value.',
        },
        {
          name: 'defaultValue',
          type: 'string',
          description: 'Initial active tab value.',
        },
        {
          name: 'orientation',
          type: 'TabsOrientation',
          description: 'Tabs orientation.',
          values: ['horizontal', 'vertical'],
          default: 'horizontal',
        },
        {
          name: 'disabled',
          type: 'boolean',
          description: 'Disables all triggers.',
        },
      ],
      events: [
        {
          name: 'value-change',
          reactName: 'onValueChange',
          description: 'Emitted when active tab changes.',
          detail: {
            value: 'string',
            nativeEvent: 'Event',
          },
        },
      ],
      slots: [
        {
          name: 'default',
          description: 'Tabs child components.',
        },
      ],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'",
            '',
            'export function Example() {',
            '  return (',
            '    <Tabs defaultValue="account">',
            '      <TabsList>',
            '        <TabsTrigger value="account">Account</TabsTrigger>',
            '        <TabsTrigger value="password">Password</TabsTrigger>',
            '      </TabsList>',
            '      <TabsContent value="account">Account panel</TabsContent>',
            '      <TabsContent value="password">Password panel</TabsContent>',
            '    </Tabs>',
            '  )',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['bg-muted', 'text-muted-foreground', 'ring-ring'],
        internalSelectors: [
          '[data-slot=tabs-list]',
          '[data-slot=tabs-trigger]',
          '[data-slot=tabs-content]',
        ],
      },
      aiRules: {
        do: [
          'Use Tabs, TabsList, TabsTrigger and TabsContent together.',
          'Keep trigger value and content value aligned.',
        ],
        dont: ['Do not use TabsContent without matching TabsTrigger value.'],
      },
    },
    {
      name: 'dialog',
      description:
        'Styled dialog component family built on zw-dialog primitives.',
      primitivePackage: '@zeus-web/dialog',
      registryCommand: 'zweb add dialog',
      installCommand:
        'pnpm add @zeus-web/dialog class-variance-authority clsx tailwind-merge',
      reactImport:
        "import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@zeus-web/dialog/react'",
      webComponentImport: "import '@zeus-web/dialog/wc'",
      styledImport:
        "import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'",
      sourceTarget: 'components/ui/dialog.tsx',
      dependencies: ['@zeus-web/dialog', ...sharedDependencies],
      props: [
        {
          name: 'open',
          type: 'boolean',
          description: 'Controlled open state.',
        },
        {
          name: 'defaultOpen',
          type: 'boolean',
          description: 'Initial open state.',
        },
        {
          name: 'modal',
          type: 'boolean',
          description: 'Whether the dialog is modal.',
          default: 'true',
        },
      ],
      events: [
        {
          name: 'open-change',
          reactName: 'onOpenChange',
          description: 'Emitted when open state changes.',
          detail: {
            open: 'boolean',
            nativeEvent: 'Event',
          },
        },
      ],
      slots: [
        {
          name: 'default',
          description: 'Dialog child components.',
        },
      ],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'",
            "import { Button } from '@/components/ui/button'",
            '',
            'export function Example() {',
            '  return (',
            '    <Dialog>',
            '      <DialogTrigger><Button>Open</Button></DialogTrigger>',
            '      <DialogContent>',
            '        <DialogTitle>Title</DialogTitle>',
            '      </DialogContent>',
            '    </Dialog>',
            '  )',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['bg-background', 'text-foreground', 'ring-ring'],
        internalSelectors: [
          '[data-slot=dialog-content]',
          '[data-slot=dialog-title]',
          '[data-slot=dialog-description]',
        ],
      },
      aiRules: {
        do: [
          'Use Dialog, DialogTrigger and DialogContent together.',
          'Use DialogTitle for accessible titles.',
        ],
        dont: [
          'Do not create a second overlay unless the registry provides one.',
          'Do not assume focus trap is complete in this MVP.',
        ],
      },
    },
  ],
}
```

---

# 6. `packages/ai/src/validate.ts`

```ts
import type {
  ZeusWebAiComponentName,
  ZeusWebAiMetadata,
  ZeusWebAiValidationResult,
} from './types'

const requiredComponents: ZeusWebAiComponentName[] = [
  'input',
  'button',
  'checkbox',
  'switch',
  'tabs',
  'dialog',
]

export function validateAiMetadata(
  metadata: ZeusWebAiMetadata,
): ZeusWebAiValidationResult {
  const errors: string[] = []
  const names = new Set<string>()

  if (metadata.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1')
  }

  if (metadata.packageName !== '@zeus-web/ai') {
    errors.push('packageName must be @zeus-web/ai')
  }

  for (const component of metadata.components) {
    if (names.has(component.name)) {
      errors.push(`duplicated component metadata: ${component.name}`)
    }

    names.add(component.name)

    if (component.primitivePackage !== `@zeus-web/${component.name}`) {
      errors.push(
        `${component.name}: primitivePackage must be @zeus-web/${component.name}`,
      )
    }

    if (component.registryCommand !== `zweb add ${component.name}`) {
      errors.push(
        `${component.name}: registryCommand must be "zweb add ${component.name}"`,
      )
    }

    if (!component.reactImport.includes(`@zeus-web/${component.name}/react`)) {
      errors.push(`${component.name}: reactImport must use per-component entry`)
    }

    if (
      !component.webComponentImport.includes(`@zeus-web/${component.name}/wc`)
    ) {
      errors.push(`${component.name}: webComponentImport must use wc entry`)
    }

    if (!component.styledImport.includes('@/components/ui/')) {
      errors.push(`${component.name}: styledImport must use local ui alias`)
    }

    if (!component.dependencies.includes(`@zeus-web/${component.name}`)) {
      errors.push(
        `${component.name}: dependencies must include @zeus-web/${component.name}`,
      )
    }

    if (component.examples.length === 0) {
      errors.push(`${component.name}: examples are required`)
    }

    if (component.aiRules.do.length === 0) {
      errors.push(`${component.name}: aiRules.do is required`)
    }

    if (component.aiRules.dont.length === 0) {
      errors.push(`${component.name}: aiRules.dont is required`)
    }
  }

  for (const name of requiredComponents) {
    if (!names.has(name)) {
      errors.push(`missing component metadata: ${name}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
```

---

# 7. `packages/ai/src/render.ts`

```ts
import type { ZeusWebAiComponent, ZeusWebAiMetadata } from './types'

function renderList(items: string[]): string {
  return items.map(item => `- ${item}`).join('\n')
}

function renderComponent(component: ZeusWebAiComponent): string {
  const props = component.props.length
    ? component.props
        .map(prop => {
          const values = prop.values?.length
            ? ` Values: ${prop.values.join(', ')}.`
            : ''
          const defaultValue = prop.default ? ` Default: ${prop.default}.` : ''

          return `- \`${prop.name}\` (\`${prop.type}\`): ${prop.description}.${values}${defaultValue}`
        })
        .join('\n')
    : '- No public props documented.'

  const events = component.events.length
    ? component.events
        .map(event => {
          const detail = Object.entries(event.detail)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')

          return `- \`${event.name}\` / React \`${event.reactName}\`: ${event.description}. Detail: ${detail}`
        })
        .join('\n')
    : '- No public events documented.'

  const slots = component.slots.length
    ? component.slots
        .map(slot => `- \`${slot.name}\`: ${slot.description}`)
        .join('\n')
    : '- No slots documented.'

  const examples = component.examples
    .map(
      example => `### ${example.title}\n\n\`\`\`tsx\n${example.code}\n\`\`\``,
    )
    .join('\n\n')

  return [
    `## ${component.name}`,
    '',
    component.description,
    '',
    `Add command: \`${component.registryCommand}\``,
    `Install command: \`${component.installCommand}\``,
    `Styled import: \`${component.styledImport}\``,
    `Primitive React import: \`${component.reactImport}\``,
    `Web Component import: \`${component.webComponentImport}\``,
    '',
    '### Props',
    '',
    props,
    '',
    '### Events',
    '',
    events,
    '',
    '### Slots',
    '',
    slots,
    '',
    '### Styling',
    '',
    `Tailwind: ${component.styling.usesTailwind ? 'yes' : 'no'}`,
    '',
    'Theme tokens:',
    renderList(component.styling.themeTokens),
    '',
    'Internal selectors:',
    renderList(component.styling.internalSelectors),
    '',
    '### AI do',
    '',
    renderList(component.aiRules.do),
    '',
    '### AI do not',
    '',
    renderList(component.aiRules.dont),
    '',
    examples,
  ].join('\n')
}

export function renderAiMarkdown(metadata: ZeusWebAiMetadata): string {
  return [
    '# Zeus Web AI Guide',
    '',
    'This file is generated from `@zeus-web/ai` metadata.',
    '',
    '## Recommended workflow',
    '',
    renderList(metadata.recommendedWorkflow),
    '',
    '## Themes',
    '',
    renderList(metadata.themes.map(theme => `\`${theme}\``)),
    '',
    '## Global AI rules: do',
    '',
    renderList(metadata.globalRules.do),
    '',
    '## Global AI rules: do not',
    '',
    renderList(metadata.globalRules.dont),
    '',
    '# Components',
    '',
    metadata.components.map(renderComponent).join('\n\n---\n\n'),
    '',
  ].join('\n')
}

export function renderAiJson(metadata: ZeusWebAiMetadata): string {
  return `${JSON.stringify(metadata, null, 2)}\n`
}
```

---

# 8. `packages/ai/src/index.ts`

```ts
export { aiMetadata } from './metadata'
export { renderAiJson, renderAiMarkdown } from './render'
export { validateAiMetadata } from './validate'

export type {
  ZeusWebAiComponent,
  ZeusWebAiComponentName,
  ZeusWebAiEvent,
  ZeusWebAiExample,
  ZeusWebAiMetadata,
  ZeusWebAiProp,
  ZeusWebAiSlot,
  ZeusWebAiThemeName,
  ZeusWebAiValidationResult,
} from './types'
```

---

# 9. `packages/ai/__tests__/ai.spec.ts`

```ts
import {
  aiMetadata,
  renderAiJson,
  renderAiMarkdown,
  validateAiMetadata,
} from '../src'

describe('@zeus-web/ai metadata', () => {
  it('contains required MVP components', () => {
    expect(aiMetadata.components.map(component => component.name)).toEqual([
      'button',
      'input',
      'checkbox',
      'switch',
      'tabs',
      'dialog',
    ])
  })

  it('passes metadata validation', () => {
    const result = validateAiMetadata(aiMetadata)

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('uses per-component primitive packages', () => {
    for (const component of aiMetadata.components) {
      expect(component.primitivePackage).toBe(`@zeus-web/${component.name}`)
      expect(component.registryCommand).toBe(`zweb add ${component.name}`)
      expect(component.reactImport).toContain(
        `@zeus-web/${component.name}/react`,
      )
      expect(component.webComponentImport).toContain(
        `@zeus-web/${component.name}/wc`,
      )
    }
  })

  it('renders markdown guide', () => {
    const markdown = renderAiMarkdown(aiMetadata)

    expect(markdown).toContain('# Zeus Web AI Guide')
    expect(markdown).toContain('## button')
    expect(markdown).toContain('zweb add button')
    expect(markdown).toContain('@/components/ui/button')
  })

  it('renders json guide', () => {
    const json = renderAiJson(aiMetadata)
    const parsed = JSON.parse(json)

    expect(parsed.packageName).toBe('@zeus-web/ai')
    expect(parsed.components).toHaveLength(6)
  })
})
```

---

# 10. 修改 `packages/cli/package.json`

在 dependencies 增加 `@zeus-web/ai`。
同时 test script 加上 `ai.spec.ts`。

```json
{
  "name": "@zeus-web/cli",
  "type": "module",
  "version": "0.0.0",
  "description": "CLI for Zeus Web.",
  "license": "MIT",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "bin": {
    "zweb": "./dist/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup && node -e \"const fs=require('fs');const f='dist/index.js';const c=fs.readFileSync(f,'utf8');if(!c.startsWith('#!/'))fs.writeFileSync(f,'#!/usr/bin/env node\\n'+c,'utf8');\"",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit packages/cli/__tests__/add.spec.ts packages/cli/__tests__/ai.spec.ts packages/cli/__tests__/config.spec.ts packages/cli/__tests__/init.spec.ts packages/cli/__tests__/package-manager.spec.ts"
  },
  "dependencies": {
    "@zeus-web/ai": "workspace:*",
    "@zeus-web/registry": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "execa": "^9.6.1",
    "picocolors": "^1.1.1"
  }
}
```

---

# 11. 修改 `packages/cli/tsconfig.json`

```json
{
  "extends": "../../scripts/config/tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "rootDir": "../..",
    "types": ["node"],
    "outDir": "dist",
    "isolatedDeclarations": false
  },
  "include": [
    "src",
    "../../packages/ai/src",
    "../../packages/registry/src",
    "../../packages/themes/src"
  ]
}
```

---

# 12. 新增 `packages/cli/src/commands/ai.ts`

```ts
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import {
  aiMetadata,
  renderAiJson,
  renderAiMarkdown,
  validateAiMetadata,
} from '@zeus-web/ai'
import pc from 'picocolors'

export type AiOutputFormat = 'markdown' | 'json'

export interface AiOptions {
  cwd: string
  format: AiOutputFormat
  output: string
  overwrite: boolean
  dryRun: boolean
}

export interface ParsedAiArgs {
  options: AiOptions
}

export interface AiWriteResult {
  output: string
  planned: boolean
  written: boolean
  skipped: boolean
}

function defaultOutputForFormat(format: AiOutputFormat): string {
  return format === 'json' ? 'zeus-web.ai.json' : 'zeus-web.ai.md'
}

function assertSafeTarget(cwd: string, target: string): string {
  const absoluteTarget = resolve(cwd, target)
  const relativeTarget = relative(cwd, absoluteTarget).replace(/\\/g, '/')

  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith('../') ||
    isAbsolute(relativeTarget)
  ) {
    throw new Error(`Refusing to write outside cwd: ${target}`)
  }

  return absoluteTarget
}

function parseFormat(value: string): AiOutputFormat {
  if (value === 'markdown' || value === 'md') return 'markdown'
  if (value === 'json') return 'json'

  throw new Error(`Unsupported AI output format: ${value}`)
}

export function parseAiArgs(args: string[], cwd = process.cwd()): ParsedAiArgs {
  const options: AiOptions = {
    cwd,
    format: 'markdown',
    output: defaultOutputForFormat('markdown'),
    overwrite: false,
    dryRun: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--overwrite') {
      options.overwrite = true
      continue
    }

    if (arg === '--json') {
      options.format = 'json'
      options.output = defaultOutputForFormat('json')
      continue
    }

    if (arg === '--markdown' || arg === '--md') {
      options.format = 'markdown'
      options.output = defaultOutputForFormat('markdown')
      continue
    }

    if (arg === '--cursor') {
      options.format = 'markdown'
      options.output = '.cursor/rules/zeus-web.mdc'
      continue
    }

    if (arg === '--cwd') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      continue
    }

    if (arg === '--format') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--format requires a value')
      }

      options.format = parseFormat(value)

      if (
        options.output === 'zeus-web.ai.md' ||
        options.output === 'zeus-web.ai.json'
      ) {
        options.output = defaultOutputForFormat(options.format)
      }

      index += 1
      continue
    }

    if (arg.startsWith('--format=')) {
      const value = arg.slice('--format='.length)

      if (!value) {
        throw new Error('--format requires a value')
      }

      options.format = parseFormat(value)

      if (
        options.output === 'zeus-web.ai.md' ||
        options.output === 'zeus-web.ai.json'
      ) {
        options.output = defaultOutputForFormat(options.format)
      }

      continue
    }

    if (arg === '--output') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--output requires a file path')
      }

      options.output = value
      index += 1
      continue
    }

    if (arg.startsWith('--output=')) {
      const value = arg.slice('--output='.length)

      if (!value) {
        throw new Error('--output requires a file path')
      }

      options.output = value
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return {
    options,
  }
}

export function createAiGuideContent(format: AiOutputFormat): string {
  const result = validateAiMetadata(aiMetadata)

  if (!result.valid) {
    throw new Error(
      [
        'Invalid @zeus-web/ai metadata:',
        ...result.errors.map(error => `- ${error}`),
      ].join('\n'),
    )
  }

  return format === 'json'
    ? renderAiJson(aiMetadata)
    : renderAiMarkdown(aiMetadata)
}

export async function writeAiGuide(options: AiOptions): Promise<AiWriteResult> {
  const outputPath = assertSafeTarget(options.cwd, options.output)

  if (existsSync(outputPath) && !options.overwrite) {
    return {
      output: options.output,
      planned: false,
      written: false,
      skipped: true,
    }
  }

  if (options.dryRun) {
    return {
      output: options.output,
      planned: true,
      written: false,
      skipped: false,
    }
  }

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, createAiGuideContent(options.format), 'utf-8')

  return {
    output: options.output,
    planned: false,
    written: true,
    skipped: false,
  }
}

export async function ai(args: string[]) {
  try {
    const { options } = parseAiArgs(args)
    const result = await writeAiGuide(options)

    if (result.planned) {
      console.log(pc.cyan(`Planned AI guide: ${result.output}`))
      return
    }

    if (result.skipped) {
      console.log(
        pc.yellow(
          `${result.output} already exists. Use --overwrite to replace it.`,
        ),
      )
      return
    }

    console.log(pc.green(`Created AI guide: ${result.output}`))
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 13. 修改 `packages/cli/src/index.ts`

```ts
#!/usr/bin/env node

import pc from 'picocolors'
import { add } from './commands/add'
import { ai } from './commands/ai'
import { init } from './commands/init'

const [, , command, ...args] = process.argv

async function main() {
  switch (command) {
    case 'init':
      await init(args)
      break

    case 'add':
      await add(args)
      break

    case 'ai':
      await ai(args)
      break

    case undefined:
    case '-h':
    case '--help':
      printHelp()
      break

    default:
      console.error(pc.red(`Unknown command: ${command}`))
      printHelp()
      process.exit(1)
  }
}

function printHelp() {
  console.log(`\n${pc.bold('zweb')} - Zeus Web CLI\n`)
  console.log('Usage:')
  console.log('  zweb init')
  console.log('  zweb init --style slate --css src/styles/globals.css')
  console.log('  zweb add button')
  console.log('  zweb add button input dialog')
  console.log('  zweb ai')
  console.log('  zweb ai --cursor')
  console.log('  zweb ai --json')
  console.log('')
  console.log('Options:')
  console.log('  --cwd <dir>                 Use a specific project directory')
  console.log('  --style <name>              Theme style for init')
  console.log('  --css <file>                Tailwind css file for init')
  console.log(
    '  --dry-run                   Print the plan without writing files',
  )
  console.log('  --overwrite                 Replace existing files')
  console.log('  --no-install                Do not install dependencies')
  console.log('  --package-manager <name>    pnpm | npm | yarn | bun')
  console.log('  --format <name>             markdown | json')
  console.log('  --output <file>             Output file path')
  console.log('  --cursor                    Write .cursor/rules/zeus-web.mdc')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
```

---

# 14. 新增 `packages/cli/__tests__/ai.spec.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  createAiGuideContent,
  parseAiArgs,
  writeAiGuide,
} from '../src/commands/ai'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-ai-'))
}

describe('@zeus-web/cli ai', () => {
  it('parses default options', () => {
    const parsed = parseAiArgs([], '/repo')

    expect(parsed.options).toEqual({
      cwd: '/repo',
      format: 'markdown',
      output: 'zeus-web.ai.md',
      overwrite: false,
      dryRun: false,
    })
  })

  it('parses json output', () => {
    const parsed = parseAiArgs(['--json'], '/repo')

    expect(parsed.options.format).toBe('json')
    expect(parsed.options.output).toBe('zeus-web.ai.json')
  })

  it('parses cursor output', () => {
    const parsed = parseAiArgs(['--cursor'], '/repo')

    expect(parsed.options.format).toBe('markdown')
    expect(parsed.options.output).toBe('.cursor/rules/zeus-web.mdc')
  })

  it('parses cwd output and overwrite', () => {
    const parsed = parseAiArgs(
      ['--cwd', 'demo', '--output', 'docs/ai.md', '--overwrite'],
      '/repo',
    )

    expect(parsed.options.cwd).toBe(resolve('/repo', 'demo'))
    expect(parsed.options.output).toBe('docs/ai.md')
    expect(parsed.options.overwrite).toBe(true)
  })

  it('renders markdown content', () => {
    const content = createAiGuideContent('markdown')

    expect(content).toContain('# Zeus Web AI Guide')
    expect(content).toContain('zweb add button')
    expect(content).toContain('@/components/ui/button')
  })

  it('renders json content', () => {
    const content = createAiGuideContent('json')
    const parsed = JSON.parse(content)

    expect(parsed.packageName).toBe('@zeus-web/ai')
    expect(parsed.components).toHaveLength(6)
  })

  it('dry-runs without writing files', async () => {
    const cwd = await createTempDir()

    try {
      const result = await writeAiGuide({
        cwd,
        format: 'markdown',
        output: 'zeus-web.ai.md',
        overwrite: false,
        dryRun: true,
      })

      expect(result).toEqual({
        output: 'zeus-web.ai.md',
        planned: true,
        written: false,
        skipped: false,
      })
      expect(existsSync(resolve(cwd, 'zeus-web.ai.md'))).toBe(false)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('writes markdown guide', async () => {
    const cwd = await createTempDir()

    try {
      const result = await writeAiGuide({
        cwd,
        format: 'markdown',
        output: 'zeus-web.ai.md',
        overwrite: false,
        dryRun: false,
      })

      expect(result.written).toBe(true)
      expect(readFileSync(resolve(cwd, 'zeus-web.ai.md'), 'utf-8')).toContain(
        '# Zeus Web AI Guide',
      )
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('skips existing file by default', async () => {
    const cwd = await createTempDir()

    try {
      await writeAiGuide({
        cwd,
        format: 'markdown',
        output: 'zeus-web.ai.md',
        overwrite: false,
        dryRun: false,
      })

      const result = await writeAiGuide({
        cwd,
        format: 'markdown',
        output: 'zeus-web.ai.md',
        overwrite: false,
        dryRun: false,
      })

      expect(result.skipped).toBe(true)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
```

---

# 15. Phase 8 验收命令

```bash
pnpm --filter @zeus-web/ai check
pnpm --filter @zeus-web/ai test
pnpm --filter @zeus-web/ai build

pnpm --filter @zeus-web/cli check
pnpm --filter @zeus-web/cli test
pnpm --filter @zeus-web/cli build

pnpm check
pnpm test
pnpm check:exports
pnpm build
pnpm check:build-output
```

---

# 16. 使用效果

生成默认 AI 指南：

```bash
zweb ai
```

生成：

```txt
zeus-web.ai.md
```

生成 Cursor 规则：

```bash
zweb ai --cursor
```

生成：

```txt
.cursor/rules/zeus-web.mdc
```

生成 JSON：

```bash
zweb ai --json
```

生成：

```txt
zeus-web.ai.json
```

自定义位置：

```bash
zweb ai --output docs/zeus-web-ai.md --overwrite
```

---

# 17. Phase 8 验收标准

```txt
1. @zeus-web/ai 能导出 aiMetadata。
2. aiMetadata 覆盖 button/input/checkbox/switch/tabs/dialog。
3. aiMetadata 通过 validateAiMetadata。
4. renderAiMarkdown 能生成可读 LLM guide。
5. renderAiJson 能生成机器可读 metadata。
6. zweb ai 能生成 zeus-web.ai.md。
7. zweb ai --json 能生成 zeus-web.ai.json。
8. zweb ai --cursor 能生成 .cursor/rules/zeus-web.mdc。
9. CLI help 展示 ai 命令。
```

建议提交：

```txt
feat(ai): add zeus web ai metadata package
feat(cli): generate ai usage guides
test(ai): validate metadata and render outputs
test(cli): cover ai guide command
```
