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
        {
          name: 'ariaLabel',
          type: 'string',
          description: 'Accessible label for icon-only buttons.',
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
        {
          name: 'id',
          type: 'string',
          description: 'Native input id attribute.',
        },
        {
          name: 'autocomplete',
          type: 'string',
          description: 'Native input autocomplete attribute.',
        },
        {
          name: 'ariaLabel',
          type: 'string',
          description: 'Accessible label for unlabeled inputs.',
        },
        {
          name: 'ariaDescribedby',
          type: 'string',
          description: 'ID reference for additional accessible description.',
        },
        {
          name: 'ariaErrormessage',
          type: 'string',
          description: 'ID reference for accessible error message.',
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
        {
          name: 'required',
          type: 'boolean',
          description: 'Marks the checkbox as required.',
        },
        {
          name: 'ariaLabel',
          type: 'string',
          description: 'Accessible label for unlabeled checkboxes.',
        },
        {
          name: 'ariaDescribedby',
          type: 'string',
          description: 'ID reference for additional accessible description.',
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
        {
          name: 'required',
          type: 'boolean',
          description: 'Marks the switch as required.',
        },
        {
          name: 'ariaLabel',
          type: 'string',
          description: 'Accessible label for unlabeled switches.',
        },
        {
          name: 'ariaDescribedby',
          type: 'string',
          description: 'ID reference for additional accessible description.',
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
