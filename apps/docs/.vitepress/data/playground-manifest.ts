export type PlaygroundPackageGroup = 'primitives' | 'advanced'

export interface PlaygroundComponent {
  name: string
  title: string
  packageName: `@zeus-web/${string}`
  group: PlaygroundPackageGroup
  route: `/playground/${string}/`
  description: string
}

export const playgroundComponents = [
  {
    name: 'button',
    title: 'Button',
    packageName: '@zeus-web/button',
    group: 'primitives',
    route: '/playground/button/',
    description: 'Actions, variants, sizes and disabled states.',
  },
  {
    name: 'input',
    title: 'Input',
    packageName: '@zeus-web/input',
    group: 'primitives',
    route: '/playground/input/',
    description: 'Text entry, placeholders and validation states.',
  },
  {
    name: 'checkbox',
    title: 'Checkbox',
    packageName: '@zeus-web/checkbox',
    group: 'primitives',
    route: '/playground/checkbox/',
    description: 'Boolean and indeterminate selection states.',
  },
  {
    name: 'switch',
    title: 'Switch',
    packageName: '@zeus-web/switch',
    group: 'primitives',
    route: '/playground/switch/',
    description: 'On and off controls for application settings.',
  },
  {
    name: 'tabs',
    title: 'Tabs',
    packageName: '@zeus-web/tabs',
    group: 'primitives',
    route: '/playground/tabs/',
    description: 'Keyboard-accessible tab lists and panels.',
  },
  {
    name: 'dialog',
    title: 'Dialog',
    packageName: '@zeus-web/dialog',
    group: 'primitives',
    route: '/playground/dialog/',
    description: 'Modal content, focus management and dismissal.',
  },
  {
    name: 'label',
    title: 'Label',
    packageName: '@zeus-web/label',
    group: 'primitives',
    route: '/playground/label/',
    description: 'Accessible labels for form controls.',
  },
  {
    name: 'textarea',
    title: 'Textarea',
    packageName: '@zeus-web/textarea',
    group: 'primitives',
    route: '/playground/textarea/',
    description: 'Multi-line text input and validation states.',
  },
  {
    name: 'radio-group',
    title: 'Radio Group',
    packageName: '@zeus-web/radio-group',
    group: 'primitives',
    route: '/playground/radio-group/',
    description: 'Single-choice groups with keyboard navigation.',
  },
  {
    name: 'select',
    title: 'Select',
    packageName: '@zeus-web/select',
    group: 'primitives',
    route: '/playground/select/',
    description: 'Native selection with Zeus Web styling.',
  },
  {
    name: 'card',
    title: 'Card',
    packageName: '@zeus-web/card',
    group: 'primitives',
    route: '/playground/card/',
    description: 'Structured surfaces for grouped content.',
  },
  {
    name: 'badge',
    title: 'Badge',
    packageName: '@zeus-web/badge',
    group: 'primitives',
    route: '/playground/badge/',
    description: 'Compact labels for states and categories.',
  },
  {
    name: 'separator',
    title: 'Separator',
    packageName: '@zeus-web/separator',
    group: 'primitives',
    route: '/playground/separator/',
    description: 'Visual and semantic content separation.',
  },
  {
    name: 'skeleton',
    title: 'Skeleton',
    packageName: '@zeus-web/skeleton',
    group: 'primitives',
    route: '/playground/skeleton/',
    description: 'Loading placeholders for common layouts.',
  },
  {
    name: 'alert',
    title: 'Alert',
    packageName: '@zeus-web/alert',
    group: 'primitives',
    route: '/playground/alert/',
    description: 'Inline contextual feedback and status messages.',
  },
  {
    name: 'collapsible',
    title: 'Collapsible',
    packageName: '@zeus-web/collapsible',
    group: 'primitives',
    route: '/playground/collapsible/',
    description: 'Expandable regions for progressive disclosure.',
  },
  {
    name: 'accordion',
    title: 'Accordion',
    packageName: '@zeus-web/accordion',
    group: 'primitives',
    route: '/playground/accordion/',
    description: 'Grouped disclosure sections and keyboard control.',
  },
  {
    name: 'tooltip',
    title: 'Tooltip',
    packageName: '@zeus-web/tooltip',
    group: 'primitives',
    route: '/playground/tooltip/',
    description: 'Contextual help on pointer hover and keyboard focus.',
  },
  {
    name: 'progress',
    title: 'Progress',
    packageName: '@zeus-web/progress',
    group: 'primitives',
    route: '/playground/progress/',
    description: 'Progress indicators for known completion values.',
  },
  {
    name: 'avatar',
    title: 'Avatar',
    packageName: '@zeus-web/avatar',
    group: 'primitives',
    route: '/playground/avatar/',
    description: 'User images with accessible fallback content.',
  },
  {
    name: 'agent-console',
    title: 'Agent Console',
    packageName: '@zeus-web/agent-console',
    group: 'advanced',
    route: '/playground/agent-console/',
    description: 'Messages, tool calls, artifacts and diagnostics for agents.',
  },
  {
    name: 'chat',
    title: 'Chat',
    packageName: '@zeus-web/chat',
    group: 'advanced',
    route: '/playground/chat/',
    description: 'Composable chat threads, messages and input.',
  },
  {
    name: 'data-grid',
    title: 'Data Grid',
    packageName: '@zeus-web/data-grid',
    group: 'advanced',
    route: '/playground/data-grid/',
    description: 'Two-axis virtualization for high-volume tabular data.',
  },
  {
    name: 'revogrid-adapter',
    title: 'RevoGrid Adapter',
    packageName: '@zeus-web/revogrid-adapter',
    group: 'advanced',
    route: '/playground/revogrid-adapter/',
    description: 'RevoGrid-compatible mapping for Zeus grid models.',
  },
  {
    name: 'virtual',
    title: 'Virtual List',
    packageName: '@zeus-web/virtual',
    group: 'advanced',
    route: '/playground/virtual/',
    description: 'Low-level virtual scrolling for high-volume lists.',
  },
] as const satisfies readonly PlaygroundComponent[]

export type PlaygroundComponentName =
  (typeof playgroundComponents)[number]['name']

export function findPlaygroundComponent(
  name: string,
): (typeof playgroundComponents)[number] | undefined {
  return playgroundComponents.find(component => component.name === name)
}
