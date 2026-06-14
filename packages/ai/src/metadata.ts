import type { ZeusWebAiMetadata } from './types'

export const aiMetadata: ZeusWebAiMetadata = {
  schemaVersion: 1,
  packageName: '@zeus-web/ai',
  libraryName: 'Zeus Web',
  registryPackage: '@zeus-web/registry',
  cliPackage: '@zeus-web/cli',
  themes: ['default', 'slate', 'zinc', 'neutral', 'stone'],
  recommendedWorkflow: [
    'Run `zweb init` before adding registry-backed styled components.',
    'Run `zweb add button input` to copy currently available registry source into the user project.',
    'Import styled components from the copied local path, usually `@/components/ui/<component>`.',
    'Use `@zeus-web/ui` for package-owned styled native Web Components.',
    'Use per-component packages such as `@zeus-web/button/react` when building advanced primitive-based design systems.',
  ],
  icons: {
    packageName: '@zeus-web/icons',
    installCommand: 'pnpm add @zeus-web/icons',
    reactImport: "import { IconCheck, IconX } from '@zeus-web/icons/react'",
    vueImport: "import { IconCheck, IconX } from '@zeus-web/icons/vue'",
    webComponentImport: "import '@zeus-web/icons/wc'",
    rawSvgImport: "import checkIcon from '@zeus-web/icons/svg/check.svg'",
    recommendedIcons: [
      'check',
      'x',
      'plus',
      'minus',
      'chevron-down',
      'chevron-up',
      'chevron-left',
      'chevron-right',
      'search',
      'menu',
      'settings',
      'user',
      'copy',
      'external-link',
      'info',
      'alert-triangle',
      'circle-check',
      'circle-x',
      'loader',
      'sun',
      'moon',
      'eye',
      'eye-off',
      'trash',
    ],
    aiRules: {
      do: [
        'Use @zeus-web/icons/react for React examples.',
        'Use @zeus-web/icons/vue for Vue examples.',
        'Use @zeus-web/icons/wc when showing native Web Component usage.',
        'Use aria-hidden for decorative icons.',
        'Provide an accessible label on the parent control when an icon-only button is used.',
        'Prefer currentColor icons so color follows text/theme tokens.',
      ],
      dont: [
        'Do not inline random SVG markup when an icon exists in @zeus-web/icons.',
        'Do not use icons as the only accessible name.',
        'Do not hardcode width/height when size can be controlled with className or CSS.',
        'Do not import React icons in Vue examples or Vue icons in React examples.',
      ],
    },
  },
  globalRules: {
    do: [
      'Use Zeus Web registry components for app-level React and Vue code when a registry template exists.',
      'Use --zeus-* semantic variables inside registry-installed source components.',
      'Respect zeus-ui.json aliases when generating local imports.',
      'Use `zweb add button input` for currently available registry components.',
      'Use `zweb init --style <theme>` to set up registry CSS variables.',
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
      installCommand: 'pnpm add @zeus-web/button',
      reactImport: "import { Button } from '@zeus-web/button/react'",
      webComponentImport: "import '@zeus-web/button/wc'",
      styledImport: "import { Button } from '@/components/ui/button'",
      sourceTarget: 'components/ui/button.tsx',
      dependencies: ['@zeus-web/button'],
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
      installCommand: 'pnpm add @zeus-web/input',
      reactImport: "import { Input } from '@zeus-web/input/react'",
      webComponentImport: "import '@zeus-web/input/wc'",
      styledImport: "import { Input } from '@/components/ui/input'",
      sourceTarget: 'components/ui/input.tsx',
      dependencies: ['@zeus-web/input'],
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
      installCommand: 'pnpm add @zeus-web/checkbox',
      reactImport: "import { Checkbox } from '@zeus-web/checkbox/react'",
      webComponentImport: "import '@zeus-web/checkbox/wc'",
      styledImport: "import { Checkbox } from '@/components/ui/checkbox'",
      sourceTarget: 'components/ui/checkbox.tsx',
      dependencies: ['@zeus-web/checkbox'],
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
      installCommand: 'pnpm add @zeus-web/switch',
      reactImport: "import { Switch } from '@zeus-web/switch/react'",
      webComponentImport: "import '@zeus-web/switch/wc'",
      styledImport: "import { Switch } from '@/components/ui/switch'",
      sourceTarget: 'components/ui/switch.tsx',
      dependencies: ['@zeus-web/switch'],
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
      installCommand: 'pnpm add @zeus-web/tabs',
      reactImport:
        "import { Tabs, TabsList, TabsTrigger, TabsContent } from '@zeus-web/tabs/react'",
      webComponentImport: "import '@zeus-web/tabs/wc'",
      styledImport:
        "import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'",
      sourceTarget: 'components/ui/tabs.tsx',
      dependencies: ['@zeus-web/tabs'],
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
      installCommand: 'pnpm add @zeus-web/dialog',
      reactImport:
        "import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@zeus-web/dialog/react'",
      webComponentImport: "import '@zeus-web/dialog/wc'",
      styledImport:
        "import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'",
      sourceTarget: 'components/ui/dialog.tsx',
      dependencies: ['@zeus-web/dialog'],
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
          'Use DialogDescription when extra accessible context is available.',
          'Rely on the primitive for Escape close, focus return, and modal focus trapping.',
        ],
        dont: [
          'Do not create a second overlay unless the registry provides one.',
          'Do not remove DialogTitle when the dialog needs an accessible name.',
          'Do not manually wire aria-labelledby or aria-describedby when using the provided title and description primitives.',
        ],
      },
    },
    {
      name: 'label',
      description: 'Styled label component built on the zw-label primitive.',
      primitivePackage: '@zeus-web/label',
      registryCommand: 'zweb add label',
      installCommand: 'pnpm add @zeus-web/label',
      reactImport: "import { Label } from '@zeus-web/label/react'",
      webComponentImport: "import '@zeus-web/label/wc'",
      styledImport: "import { Label } from '@/components/ui/label'",
      sourceTarget: 'components/ui/label.tsx',
      dependencies: ['@zeus-web/label'],
      props: [
        {
          name: 'for',
          type: 'string',
          description: 'ID of the associated form control.',
        },
        {
          name: 'required',
          type: 'boolean',
          description: 'Shows a required indicator.',
        },
        {
          name: 'disabled',
          type: 'boolean',
          description: 'Marks the label as disabled.',
        },
        {
          name: 'visuallyHidden',
          type: 'boolean',
          description: 'Visually hides the label while keeping it accessible.',
        },
      ],
      events: [],
      slots: [{ name: 'default', description: 'Label content.' }],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Label } from '@/components/ui/label'",
            '',
            'export function Example() {',
            '  return <Label for="email">Email</Label>',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['text-foreground', 'text-destructive'],
        internalSelectors: [
          '[data-slot=label]',
          '[data-slot=label-required-indicator]',
        ],
      },
      aiRules: {
        do: [
          'Use Label with form controls.',
          'Use for to associate labels with control ids.',
        ],
        dont: ['Do not use Label as a generic text wrapper.'],
      },
    },
    {
      name: 'textarea',
      description:
        'Styled textarea component built on the zw-textarea primitive.',
      primitivePackage: '@zeus-web/textarea',
      registryCommand: 'zweb add textarea',
      installCommand: 'pnpm add @zeus-web/textarea',
      reactImport: "import { Textarea } from '@zeus-web/textarea/react'",
      webComponentImport: "import '@zeus-web/textarea/wc'",
      styledImport: "import { Textarea } from '@/components/ui/textarea'",
      sourceTarget: 'components/ui/textarea.tsx',
      dependencies: ['@zeus-web/textarea'],
      props: [
        {
          name: 'value',
          type: 'string',
          description: 'Controlled textarea value.',
        },
        {
          name: 'defaultValue',
          type: 'string',
          description: 'Initial uncontrolled value.',
        },
        {
          name: 'placeholder',
          type: 'string',
          description: 'Placeholder text.',
        },
        { name: 'rows', type: 'number', description: 'Native rows attribute.' },
        {
          name: 'disabled',
          type: 'boolean',
          description: 'Disables user interaction.',
        },
        {
          name: 'ariaLabel',
          type: 'string',
          description: 'Accessible label for unlabeled textareas.',
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
          description: 'Emitted when the textarea value changes.',
          detail: { value: 'string', nativeEvent: 'Event' },
        },
        {
          name: 'focus-change',
          reactName: 'onFocusChange',
          description: 'Emitted when focus state changes.',
          detail: { focused: 'boolean', nativeEvent: 'FocusEvent' },
        },
      ],
      slots: [{ name: 'message', description: 'Validation or help message.' }],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Textarea } from '@/components/ui/textarea'",
            '',
            'export function Example() {',
            '  return <Textarea placeholder="Message" />',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['border-input', 'ring-ring', 'text-muted-foreground'],
        internalSelectors: [
          '[data-slot=textarea]',
          '[data-slot=textarea-message]',
        ],
      },
      aiRules: {
        do: ['Use Textarea for multi-line text input.'],
        dont: ['Do not use Input for multi-line content.'],
      },
    },
    {
      name: 'radio-group',
      description:
        'Styled radio group component built on zw-radio-group primitives.',
      primitivePackage: '@zeus-web/radio-group',
      registryCommand: 'zweb add radio-group',
      installCommand: 'pnpm add @zeus-web/radio-group',
      reactImport:
        "import { RadioGroup, RadioGroupItem } from '@zeus-web/radio-group/react'",
      webComponentImport: "import '@zeus-web/radio-group/wc'",
      styledImport:
        "import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'",
      sourceTarget: 'components/ui/radio-group.tsx',
      dependencies: ['@zeus-web/radio-group'],
      props: [
        {
          name: 'value',
          type: 'string',
          description: 'Controlled selected value.',
        },
        {
          name: 'defaultValue',
          type: 'string',
          description: 'Initial selected value.',
        },
        {
          name: 'name',
          type: 'string',
          description: 'Native radio group name.',
        },
        {
          name: 'orientation',
          type: 'RadioGroupOrientation',
          description: 'Layout orientation.',
          values: ['horizontal', 'vertical'],
          default: 'vertical',
        },
        {
          name: 'required',
          type: 'boolean',
          description: 'Marks the group as required.',
        },
      ],
      events: [
        {
          name: 'value-change',
          reactName: 'onValueChange',
          description: 'Emitted when selected value changes.',
          detail: { value: 'string', nativeEvent: 'Event' },
        },
      ],
      slots: [{ name: 'default', description: 'RadioGroupItem children.' }],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'",
            '',
            'export function Example() {',
            '  return (',
            '    <RadioGroup defaultValue="email">',
            '      <RadioGroupItem value="email">Email</RadioGroupItem>',
            '      <RadioGroupItem value="sms">SMS</RadioGroupItem>',
            '    </RadioGroup>',
            '  )',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['text-primary', 'ring-ring'],
        internalSelectors: [
          '[data-slot=radio-group-control]',
          '[data-slot=radio-group-label]',
        ],
      },
      aiRules: {
        do: [
          'Use RadioGroup for one-of-many choices.',
          'Keep RadioGroupItem values unique.',
        ],
        dont: ['Do not use Checkbox when only one option can be selected.'],
      },
    },
    {
      name: 'select',
      description:
        'Styled native select component built on the zw-select primitive.',
      primitivePackage: '@zeus-web/select',
      registryCommand: 'zweb add select',
      installCommand: 'pnpm add @zeus-web/select',
      reactImport: "import { Select } from '@zeus-web/select/react'",
      webComponentImport: "import '@zeus-web/select/wc'",
      styledImport: "import { Select } from '@/components/ui/select'",
      sourceTarget: 'components/ui/select.tsx',
      dependencies: ['@zeus-web/select'],
      props: [
        {
          name: 'value',
          type: 'string',
          description: 'Controlled selected value.',
        },
        {
          name: 'defaultValue',
          type: 'string',
          description: 'Initial selected value.',
        },
        {
          name: 'multiple',
          type: 'boolean',
          description: 'Enables multiple selection.',
        },
        {
          name: 'disabled',
          type: 'boolean',
          description: 'Disables user interaction.',
        },
        {
          name: 'ariaLabel',
          type: 'string',
          description: 'Accessible label for unlabeled selects.',
        },
      ],
      events: [
        {
          name: 'value-change',
          reactName: 'onValueChange',
          description: 'Emitted when selected value changes.',
          detail: { value: 'string', values: 'string[]', nativeEvent: 'Event' },
        },
      ],
      slots: [{ name: 'default', description: 'Native option children.' }],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Select } from '@/components/ui/select'",
            '',
            'export function Example() {',
            '  return (',
            '    <Select defaultValue="apple">',
            '      <option value="apple">Apple</option>',
            '      <option value="orange">Orange</option>',
            '    </Select>',
            '  )',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['border-input', 'ring-ring'],
        internalSelectors: ['[data-slot=select]', '[data-slot=select-message]'],
      },
      aiRules: {
        do: ['Use Select for simple native option lists.'],
        dont: ['Do not use Select for combobox/typeahead behavior yet.'],
      },
    },
    {
      name: 'card',
      description: 'Styled card component family built on zw-card primitives.',
      primitivePackage: '@zeus-web/card',
      registryCommand: 'zweb add card',
      installCommand: 'pnpm add @zeus-web/card',
      reactImport:
        "import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@zeus-web/card/react'",
      webComponentImport: "import '@zeus-web/card/wc'",
      styledImport:
        "import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'",
      sourceTarget: 'components/ui/card.tsx',
      dependencies: ['@zeus-web/card'],
      props: [],
      events: [],
      slots: [{ name: 'default', description: 'Card child components.' }],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'",
            '',
            'export function Example() {',
            '  return (',
            '    <Card>',
            '      <CardHeader>',
            '        <CardTitle>Title</CardTitle>',
            '        <CardDescription>Description</CardDescription>',
            '      </CardHeader>',
            '      <CardContent>Content</CardContent>',
            '    </Card>',
            '  )',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['bg-card', 'text-card-foreground', 'border'],
        internalSelectors: [
          '[data-slot=card-root]',
          '[data-slot=card-header]',
          '[data-slot=card-title]',
          '[data-slot=card-content]',
        ],
      },
      aiRules: {
        do: [
          'Use Card for grouped content containers.',
          'Use CardHeader + CardTitle for titles.',
          'Use CardContent for the main body.',
          'Use CardFooter for actions.',
        ],
        dont: [
          'Do not use Card inside another Card.',
          'Do not place interactive elements in CardDescription.',
        ],
      },
    },
    {
      name: 'badge',
      description: 'Styled badge component built on the zw-badge primitive.',
      primitivePackage: '@zeus-web/badge',
      registryCommand: 'zweb add badge',
      installCommand: 'pnpm add @zeus-web/badge',
      reactImport: "import { Badge } from '@zeus-web/badge/react'",
      webComponentImport: "import '@zeus-web/badge/wc'",
      styledImport: "import { Badge } from '@/components/ui/badge'",
      sourceTarget: 'components/ui/badge.tsx',
      dependencies: ['@zeus-web/badge'],
      props: [
        {
          name: 'variant',
          type: 'BadgeVariant',
          description: 'Visual style variant.',
          values: [
            'default',
            'secondary',
            'outline',
            'danger',
            'success',
            'warning',
          ],
          default: 'default',
        },
        {
          name: 'size',
          type: 'BadgeSize',
          description: 'Badge size.',
          values: ['sm', 'md', 'lg'],
          default: 'md',
        },
      ],
      events: [],
      slots: [{ name: 'default', description: 'Badge content.' }],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Badge } from '@/components/ui/badge'",
            '',
            'export function Example() {',
            '  return <Badge>New</Badge>',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['bg-primary', 'text-primary-foreground', 'bg-secondary'],
        internalSelectors: ['[data-slot=badge-root]'],
      },
      aiRules: {
        do: ['Use Badge for status labels and counts.'],
        dont: ['Do not use Badge as a clickable button.'],
      },
    },
    {
      name: 'separator',
      description:
        'Styled separator component built on the zw-separator primitive.',
      primitivePackage: '@zeus-web/separator',
      registryCommand: 'zweb add separator',
      installCommand: 'pnpm add @zeus-web/separator',
      reactImport: "import { Separator } from '@zeus-web/separator/react'",
      webComponentImport: "import '@zeus-web/separator/wc'",
      styledImport: "import { Separator } from '@/components/ui/separator'",
      sourceTarget: 'components/ui/separator.tsx',
      dependencies: ['@zeus-web/separator'],
      props: [
        {
          name: 'orientation',
          type: 'SeparatorOrientation',
          description: 'Visual orientation.',
          values: ['horizontal', 'vertical'],
          default: 'horizontal',
        },
      ],
      events: [],
      slots: [],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Separator } from '@/components/ui/separator'",
            '',
            'export function Example() {',
            '  return <Separator />',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['bg-border'],
        internalSelectors: ['[data-slot=separator-root]'],
      },
      aiRules: {
        do: ['Use Separator to divide sections.'],
        dont: ['Do not use Separator for decorative spacing.'],
      },
    },
    {
      name: 'skeleton',
      description:
        'Styled skeleton component built on the zw-skeleton primitive.',
      primitivePackage: '@zeus-web/skeleton',
      registryCommand: 'zweb add skeleton',
      installCommand: 'pnpm add @zeus-web/skeleton',
      reactImport: "import { Skeleton } from '@zeus-web/skeleton/react'",
      webComponentImport: "import '@zeus-web/skeleton/wc'",
      styledImport: "import { Skeleton } from '@/components/ui/skeleton'",
      sourceTarget: 'components/ui/skeleton.tsx',
      dependencies: ['@zeus-web/skeleton'],
      props: [
        {
          name: 'variant',
          type: 'SkeletonVariant',
          description: 'Shape variant.',
          values: ['text', 'rect', 'circle'],
          default: 'rect',
        },
        {
          name: 'animated',
          type: 'boolean',
          description: 'Enables loading animation.',
          default: 'true',
        },
      ],
      events: [],
      slots: [],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Skeleton } from '@/components/ui/skeleton'",
            '',
            'export function Example() {',
            '  return <Skeleton className="h-4 w-12" />',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['bg-muted'],
        internalSelectors: ['[data-slot=skeleton-root]'],
      },
      aiRules: {
        do: ['Use Skeleton for loading placeholders.'],
        dont: ['Do not show Skeleton for content that loads instantly.'],
      },
    },
    {
      name: 'alert',
      description:
        'Styled alert component family built on zw-alert primitives.',
      primitivePackage: '@zeus-web/alert',
      registryCommand: 'zweb add alert',
      installCommand: 'pnpm add @zeus-web/alert',
      reactImport:
        "import { Alert, AlertTitle, AlertDescription } from '@zeus-web/alert/react'",
      webComponentImport: "import '@zeus-web/alert/wc'",
      styledImport:
        "import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'",
      sourceTarget: 'components/ui/alert.tsx',
      dependencies: ['@zeus-web/alert'],
      props: [
        {
          name: 'variant',
          type: 'AlertVariant',
          description: 'Visual style variant.',
          values: ['default', 'info', 'success', 'warning', 'danger'],
          default: 'default',
        },
        {
          name: 'live',
          type: 'string',
          description: 'ARIA live region mode.',
          default: 'polite',
        },
      ],
      events: [],
      slots: [{ name: 'default', description: 'Alert content.' }],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'",
            '',
            'export function Example() {',
            '  return (',
            '    <Alert variant="info">',
            '      <AlertTitle>Heads up!</AlertTitle>',
            '      <AlertDescription>Info message here.</AlertDescription>',
            '    </Alert>',
            '  )',
            '}',
          ].join('\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['bg-background', 'text-foreground', 'border'],
        internalSelectors: [
          '[data-slot=alert-root]',
          '[data-slot=alert-title]',
          '[data-slot=alert-description]',
        ],
      },
      aiRules: {
        do: [
          'Use Alert for system messages.',
          'Use AlertTitle for the heading.',
          'Use AlertDescription for the detail.',
        ],
        dont: [
          'Do not use Alert for persistent banners outside the page content.',
        ],
      },
    },
    {
      name: 'collapsible',
      description:
        'Styled collapsible component family built on zw-collapsible primitives.',
      primitivePackage: '@zeus-web/collapsible',
      registryCommand: 'zweb add collapsible',
      installCommand: 'pnpm add @zeus-web/collapsible',
      reactImport:
        "import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@zeus-web/collapsible/react'",
      webComponentImport: "import '@zeus-web/collapsible/wc'",
      styledImport:
        "import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'",
      sourceTarget: 'components/ui/collapsible.tsx',
      dependencies: ['@zeus-web/collapsible'],
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
          name: 'disabled',
          type: 'boolean',
          description: 'Disables trigger interaction.',
        },
      ],
      events: [
        {
          name: 'open-change',
          reactName: 'onOpenChange',
          description: 'Emitted when open state changes.',
          detail: { open: 'boolean', nativeEvent: 'Event' },
        },
      ],
      slots: [
        { name: 'default', description: 'Trigger and content children.' },
      ],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'",
            '',
            'export function Example() {',
            '  return (',
            '    <Collapsible>',
            '      <CollapsibleTrigger>Toggle</CollapsibleTrigger>',
            '      <CollapsibleContent>Content</CollapsibleContent>',
            '    </Collapsible>',
            '  )',
            '}',
          ].join('\\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['ring-ring'],
        internalSelectors: [
          '[data-slot=collapsible-trigger-button]',
          '[data-slot=collapsible-content]',
        ],
      },
      aiRules: {
        do: [
          'Use Collapsible for simple show/hide content.',
          'Use CollapsibleTrigger and CollapsibleContent together.',
        ],
        dont: [
          'Do not use Collapsible when multiple related sections should coordinate; use Accordion instead.',
        ],
      },
    },
    {
      name: 'accordion',
      description:
        'Styled accordion component family built on zw-accordion primitives.',
      primitivePackage: '@zeus-web/accordion',
      registryCommand: 'zweb add accordion',
      installCommand: 'pnpm add @zeus-web/accordion',
      reactImport:
        "import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@zeus-web/accordion/react'",
      webComponentImport: "import '@zeus-web/accordion/wc'",
      styledImport:
        "import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'",
      sourceTarget: 'components/ui/accordion.tsx',
      dependencies: ['@zeus-web/accordion'],
      props: [
        {
          name: 'type',
          type: 'AccordionType',
          description: 'Accordion selection mode.',
          values: ['single', 'multiple'],
          default: 'single',
        },
        {
          name: 'value',
          type: 'string',
          description: 'Controlled selected value.',
        },
        {
          name: 'defaultValue',
          type: 'string',
          description: 'Initial selected value.',
        },
        {
          name: 'collapsible',
          type: 'boolean',
          description: 'Allows closing the active item in single mode.',
        },
      ],
      events: [
        {
          name: 'value-change',
          reactName: 'onValueChange',
          description: 'Emitted when open item values change.',
          detail: { value: 'string', values: 'string[]', nativeEvent: 'Event' },
        },
      ],
      slots: [{ name: 'default', description: 'AccordionItem children.' }],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'",
            '',
            'export function Example() {',
            '  return (',
            '    <Accordion defaultValue="item-1" collapsible>',
            '      <AccordionItem value="item-1">',
            '        <AccordionTrigger>Question</AccordionTrigger>',
            '        <AccordionContent>Answer</AccordionContent>',
            '      </AccordionItem>',
            '    </Accordion>',
            '  )',
            '}',
          ].join('\\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['border', 'ring-ring'],
        internalSelectors: [
          '[data-slot=accordion-item]',
          '[data-slot=accordion-trigger-button]',
          '[data-slot=accordion-content]',
        ],
      },
      aiRules: {
        do: [
          'Use Accordion for grouped expandable sections.',
          'Keep AccordionItem values unique.',
        ],
        dont: [
          'Do not use Accordion as a tab replacement.',
          'Do not omit AccordionItem value.',
        ],
      },
    },
    {
      name: 'tooltip',
      description:
        'Styled tooltip component family built on zw-tooltip primitives.',
      primitivePackage: '@zeus-web/tooltip',
      registryCommand: 'zweb add tooltip',
      installCommand: 'pnpm add @zeus-web/tooltip',
      reactImport:
        "import { Tooltip, TooltipContent, TooltipTrigger } from '@zeus-web/tooltip/react'",
      webComponentImport: "import '@zeus-web/tooltip/wc'",
      styledImport:
        "import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'",
      sourceTarget: 'components/ui/tooltip.tsx',
      dependencies: ['@zeus-web/tooltip'],
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
          name: 'delayDuration',
          type: 'number',
          description: 'Delay in milliseconds before opening.',
          default: '300',
        },
      ],
      events: [
        {
          name: 'open-change',
          reactName: 'onOpenChange',
          description: 'Emitted when open state changes.',
          detail: { open: 'boolean', nativeEvent: 'Event' },
        },
      ],
      slots: [{ name: 'default', description: 'Tooltip trigger and content.' }],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'",
            '',
            'export function Example() {',
            '  return (',
            '    <Tooltip>',
            '      <TooltipTrigger>Hover me</TooltipTrigger>',
            '      <TooltipContent>Tooltip content</TooltipContent>',
            '    </Tooltip>',
            '  )',
            '}',
          ].join('\\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['bg-primary', 'text-primary-foreground'],
        internalSelectors: [
          '[data-slot=tooltip-trigger-control]',
          '[data-slot=tooltip-content]',
        ],
      },
      aiRules: {
        do: [
          'Use Tooltip for short supplemental information.',
          'Keep tooltip content concise.',
        ],
        dont: [
          'Do not put interactive controls inside TooltipContent.',
          'Do not rely on Tooltip for essential information.',
        ],
      },
    },
    {
      name: 'progress',
      description:
        'Styled progress component built on the zw-progress primitive.',
      primitivePackage: '@zeus-web/progress',
      registryCommand: 'zweb add progress',
      installCommand: 'pnpm add @zeus-web/progress',
      reactImport: "import { Progress } from '@zeus-web/progress/react'",
      webComponentImport: "import '@zeus-web/progress/wc'",
      styledImport: "import { Progress } from '@/components/ui/progress'",
      sourceTarget: 'components/ui/progress.tsx',
      dependencies: ['@zeus-web/progress'],
      props: [
        {
          name: 'value',
          type: 'number',
          description: 'Current progress value.',
        },
        {
          name: 'max',
          type: 'number',
          description: 'Maximum progress value.',
          default: '100',
        },
        {
          name: 'indeterminate',
          type: 'boolean',
          description: 'Whether progress is indeterminate.',
        },
        {
          name: 'label',
          type: 'string',
          description: 'Accessible progress label.',
        },
      ],
      events: [],
      slots: [{ name: 'default', description: 'Optional content.' }],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Progress } from '@/components/ui/progress'",
            '',
            'export function Example() {',
            '  return <Progress value={60} label="Upload progress" />',
            '}',
          ].join('\\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['bg-primary', 'bg-primary/20'],
        internalSelectors: [
          '[data-slot=progress-root]',
          '[data-slot=progress-indicator]',
        ],
      },
      aiRules: {
        do: ['Use Progress to represent task completion.'],
        dont: ['Do not use Progress as a generic loading spinner.'],
      },
    },
    {
      name: 'avatar',
      description:
        'Styled avatar component family built on zw-avatar primitives.',
      primitivePackage: '@zeus-web/avatar',
      registryCommand: 'zweb add avatar',
      installCommand: 'pnpm add @zeus-web/avatar',
      reactImport:
        "import { Avatar, AvatarFallback, AvatarImage } from '@zeus-web/avatar/react'",
      webComponentImport: "import '@zeus-web/avatar/wc'",
      styledImport:
        "import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'",
      sourceTarget: 'components/ui/avatar.tsx',
      dependencies: ['@zeus-web/avatar'],
      props: [
        {
          name: 'size',
          type: 'AvatarSize',
          description: 'Avatar size.',
          values: ['sm', 'md', 'lg'],
          default: 'md',
        },
        {
          name: 'shape',
          type: 'AvatarShape',
          description: 'Avatar shape.',
          values: ['circle', 'square'],
          default: 'circle',
        },
      ],
      events: [
        {
          name: 'image-load',
          reactName: 'onImageLoad',
          description: 'Emitted when avatar image loads.',
          detail: { nativeEvent: 'Event' },
        },
        {
          name: 'image-error',
          reactName: 'onImageError',
          description: 'Emitted when avatar image fails to load.',
          detail: { nativeEvent: 'Event' },
        },
      ],
      slots: [
        {
          name: 'default',
          description: 'AvatarImage and AvatarFallback children.',
        },
      ],
      examples: [
        {
          title: 'React styled usage',
          code: [
            "import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'",
            '',
            'export function Example() {',
            '  return (',
            '    <Avatar>',
            '      <AvatarImage src="/avatar.png" alt="User" />',
            '      <AvatarFallback>ZW</AvatarFallback>',
            '    </Avatar>',
            '  )',
            '}',
          ].join('\\n'),
        },
      ],
      styling: {
        usesTailwind: true,
        themeTokens: ['bg-muted'],
        internalSelectors: [
          '[data-slot=avatar-root]',
          '[data-slot=avatar-image]',
          '[data-slot=avatar-fallback]',
        ],
      },
      aiRules: {
        do: [
          'Use AvatarImage with meaningful alt text.',
          'Always provide AvatarFallback.',
        ],
        dont: [
          'Do not use Avatar for decorative icons.',
          'Do not omit fallback content.',
        ],
      },
    },
  ],
  advancedComponents: [
    {
      name: 'chat',
      packageName: '@zeus-web/chat',
      category: 'advanced',
      summary:
        'Use @zeus-web/chat to build headless ChatGPT-style chat interfaces with Web Components and thin React/Vue wrappers.',
      whenToUse: [
        'Build AI chat, agent console or conversational assistant UIs.',
        'Reuse the same chat behavior protocol across native Web Component, React and Vue.',
        'Keep product styling free while reusing structure, events, methods and a11y semantics.',
      ],
      doNotUseFor: [
        '不要把它当作模型请求库。',
        '不要在组件内部嵌入 provider 请求逻辑。',
        '不要把凭据、密钥或 token 放进组件属性。',
        '不要在 Phase 3 依赖 markdown 解析、代码高亮或文件上传传输层。',
      ],
      tags: ['chat', 'ai', 'agent', 'advanced', 'headless', 'web-component'],
      components: [
        'zw-chat',
        'zw-chat-thread',
        'zw-chat-message',
        'zw-chat-composer',
        'zw-chat-code-block',
        'zw-chat-tool-call',
        'zw-chat-artifact',
        'zw-chat-typing',
      ],
      slots: {
        'zw-chat': [
          'header',
          'sidebar',
          'thread',
          'artifact',
          'composer',
          'empty',
          'loading',
        ],
        'zw-chat-message': ['avatar', 'header', 'default', 'footer', 'actions'],
        'zw-chat-composer': ['prefix', 'attachments', 'submit', 'suffix'],
        'zw-chat-code-block': ['filename', 'language', 'actions', 'default'],
        'zw-chat-tool-call': ['summary', 'input', 'output', 'error', 'actions'],
        'zw-chat-artifact': ['header', 'default', 'footer', 'actions'],
      },
      events: {
        'zw-chat': [
          'send',
          'abort',
          'regenerate',
          'message-action',
          'artifact-open',
        ],
        'zw-chat-composer': ['send', 'value-change', 'attachment-change'],
        'zw-chat-message': ['message-action'],
        'zw-chat-code-block': ['code-action'],
        'zw-chat-artifact': ['artifact-open'],
      },
      methods: {
        'zw-chat': [
          'setMessages',
          'appendMessage',
          'updateMessage',
          'appendMessagePart',
          'clear',
          'getMessages',
          'scrollToBottom',
          'emitSend',
          'emitAbort',
          'emitRegenerate',
          'emitMessageAction',
          'emitArtifactOpen',
        ],
        'zw-chat-thread': ['scrollToBottom'],
        'zw-chat-composer': ['focus', 'clear', 'submit'],
        'zw-chat-message': ['emitAction'],
        'zw-chat-code-block': ['emitAction'],
        'zw-chat-artifact': ['openArtifact'],
      },
      examples: [
        {
          title: 'Native Web Component usage',
          description:
            'Use the auto entry and compose chat, thread, message and composer with plain DOM.',
          code: [
            "import '@zeus-web/chat/wc/auto'",
            '',
            "const chat = document.createElement('zw-chat')",
            "const thread = document.createElement('zw-chat-thread')",
            "const composer = document.createElement('zw-chat-composer')",
            '',
            "thread.slot = 'thread'",
            "composer.slot = 'composer'",
            '',
            "composer.addEventListener('send', event => {",
            '  console.log((event as CustomEvent).detail.value)',
            '})',
            '',
            'chat.append(thread, composer)',
            'document.body.append(chat)',
          ].join('\n'),
        },
        {
          title: 'React wrapper usage',
          description:
            'Use the generated React wrapper when the host application is React.',
          code: [
            "import { Chat, ChatComposer, ChatThread } from '@zeus-web/chat/react'",
            '',
            'export function App() {',
            '  return (',
            '    <Chat emptyText="暂无消息">',
            '      <ChatThread slot="thread" />',
            '      <ChatComposer slot="composer" placeholder="输入消息..." />',
            '    </Chat>',
            '  )',
            '}',
          ].join('\n'),
        },
      ],
      promptHints: [
        '生成 Chat UI 时优先组合 zw-chat、zw-chat-thread、zw-chat-message、zw-chat-composer。',
        '需要代码块时使用 zw-chat-code-block，不要把代码高亮库塞入 chat 根组件。',
        '需要 artifact / canvas 区域时使用 zw-chat-artifact 的对应 slot。',
        '需要工具调用展示时使用 zw-chat-tool-call。',
        '业务请求逻辑应该放在应用层，不应放在组件内部。',
      ],
    },
  ],
}
