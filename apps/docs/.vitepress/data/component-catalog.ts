export type ComponentPackageGroup = 'primitives' | 'advanced'

export type ComponentCategory =
  | 'general'
  | 'layout'
  | 'navigation'
  | 'data-entry'
  | 'data-display'
  | 'feedback'
  | 'advanced'

export interface ComponentCategoryDefinition {
  id: ComponentCategory
  label: string
  description: string
}

export interface ComponentCatalogItem {
  name: string
  title: string
  packageName: `@zeus-web/${string}`
  packageGroup: ComponentPackageGroup
  category: ComponentCategory
  route: `/components/${string}`
  description: string
}

export const componentCategories = [
  {
    id: 'general',
    label: 'General',
    description: 'Essential actions and common interface foundations.',
  },
  {
    id: 'layout',
    label: 'Layout',
    description: 'Structure and separate content within an interface.',
  },
  {
    id: 'navigation',
    label: 'Navigation',
    description: 'Help users move between views and content sections.',
  },
  {
    id: 'data-entry',
    label: 'Data Entry',
    description: 'Collect, select and edit values from users.',
  },
  {
    id: 'data-display',
    label: 'Data Display',
    description: 'Present structured content, identity and supporting details.',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    description: 'Communicate status, progress and important outcomes.',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'High-volume and application-level interaction foundations.',
  },
] as const satisfies readonly ComponentCategoryDefinition[]

export const componentCatalog = [
  {
    name: 'button',
    title: 'Button',
    packageName: '@zeus-web/button',
    packageGroup: 'primitives',
    category: 'general',
    route: '/components/button',
    description: 'Actions, variants, sizes and disabled states.',
  },
  {
    name: 'separator',
    title: 'Separator',
    packageName: '@zeus-web/separator',
    packageGroup: 'primitives',
    category: 'layout',
    route: '/components/separator',
    description: 'Visual and semantic content separation.',
  },
  {
    name: 'tabs',
    title: 'Tabs',
    packageName: '@zeus-web/tabs',
    packageGroup: 'primitives',
    category: 'navigation',
    route: '/components/tabs',
    description: 'Keyboard-accessible tab lists and panels.',
  },
  {
    name: 'label',
    title: 'Label',
    packageName: '@zeus-web/label',
    packageGroup: 'primitives',
    category: 'data-entry',
    route: '/components/label',
    description: 'Accessible labels for form controls.',
  },
  {
    name: 'input',
    title: 'Input',
    packageName: '@zeus-web/input',
    packageGroup: 'primitives',
    category: 'data-entry',
    route: '/components/input',
    description: 'Text entry, placeholders and validation states.',
  },
  {
    name: 'textarea',
    title: 'Textarea',
    packageName: '@zeus-web/textarea',
    packageGroup: 'primitives',
    category: 'data-entry',
    route: '/components/textarea',
    description: 'Multi-line text input and validation states.',
  },
  {
    name: 'checkbox',
    title: 'Checkbox',
    packageName: '@zeus-web/checkbox',
    packageGroup: 'primitives',
    category: 'data-entry',
    route: '/components/checkbox',
    description: 'Boolean and indeterminate selection states.',
  },
  {
    name: 'radio-group',
    title: 'Radio Group',
    packageName: '@zeus-web/radio-group',
    packageGroup: 'primitives',
    category: 'data-entry',
    route: '/components/radio-group',
    description: 'Single-choice groups with keyboard navigation.',
  },
  {
    name: 'select',
    title: 'Select',
    packageName: '@zeus-web/select',
    packageGroup: 'primitives',
    category: 'data-entry',
    route: '/components/select',
    description: 'Native selection with Zeus Web styling.',
  },
  {
    name: 'switch',
    title: 'Switch',
    packageName: '@zeus-web/switch',
    packageGroup: 'primitives',
    category: 'data-entry',
    route: '/components/switch',
    description: 'On and off controls for application settings.',
  },
  {
    name: 'avatar',
    title: 'Avatar',
    packageName: '@zeus-web/avatar',
    packageGroup: 'primitives',
    category: 'data-display',
    route: '/components/avatar',
    description: 'User images with accessible fallback content.',
  },
  {
    name: 'badge',
    title: 'Badge',
    packageName: '@zeus-web/badge',
    packageGroup: 'primitives',
    category: 'data-display',
    route: '/components/badge',
    description: 'Compact labels for states and categories.',
  },
  {
    name: 'card',
    title: 'Card',
    packageName: '@zeus-web/card',
    packageGroup: 'primitives',
    category: 'data-display',
    route: '/components/card',
    description: 'Structured surfaces for grouped content.',
  },
  {
    name: 'accordion',
    title: 'Accordion',
    packageName: '@zeus-web/accordion',
    packageGroup: 'primitives',
    category: 'data-display',
    route: '/components/accordion',
    description: 'Grouped disclosure sections and keyboard control.',
  },
  {
    name: 'collapsible',
    title: 'Collapsible',
    packageName: '@zeus-web/collapsible',
    packageGroup: 'primitives',
    category: 'data-display',
    route: '/components/collapsible',
    description: 'Expandable regions for progressive disclosure.',
  },
  {
    name: 'tooltip',
    title: 'Tooltip',
    packageName: '@zeus-web/tooltip',
    packageGroup: 'primitives',
    category: 'data-display',
    route: '/components/tooltip',
    description: 'Contextual help on pointer hover and keyboard focus.',
  },
  {
    name: 'alert',
    title: 'Alert',
    packageName: '@zeus-web/alert',
    packageGroup: 'primitives',
    category: 'feedback',
    route: '/components/alert',
    description: 'Inline contextual feedback and status messages.',
  },
  {
    name: 'dialog',
    title: 'Dialog',
    packageName: '@zeus-web/dialog',
    packageGroup: 'primitives',
    category: 'feedback',
    route: '/components/dialog',
    description: 'Modal content, focus management and dismissal.',
  },
  {
    name: 'progress',
    title: 'Progress',
    packageName: '@zeus-web/progress',
    packageGroup: 'primitives',
    category: 'feedback',
    route: '/components/progress',
    description: 'Progress indicators for known completion values.',
  },
  {
    name: 'skeleton',
    title: 'Skeleton',
    packageName: '@zeus-web/skeleton',
    packageGroup: 'primitives',
    category: 'feedback',
    route: '/components/skeleton',
    description: 'Loading placeholders for common layouts.',
  },
  {
    name: 'agent-console',
    title: 'Agent Console',
    packageName: '@zeus-web/agent-console',
    packageGroup: 'advanced',
    category: 'advanced',
    route: '/components/agent-console',
    description: 'Messages, tool calls, artifacts and diagnostics for agents.',
  },
  {
    name: 'chat',
    title: 'Chat',
    packageName: '@zeus-web/chat',
    packageGroup: 'advanced',
    category: 'advanced',
    route: '/components/chat',
    description: 'Composable chat threads, messages and input.',
  },
  {
    name: 'data-grid',
    title: 'Data Grid',
    packageName: '@zeus-web/data-grid',
    packageGroup: 'advanced',
    category: 'advanced',
    route: '/components/data-grid',
    description: 'Two-axis virtualization for high-volume tabular data.',
  },
  {
    name: 'revogrid-adapter',
    title: 'RevoGrid Adapter',
    packageName: '@zeus-web/revogrid-adapter',
    packageGroup: 'advanced',
    category: 'advanced',
    route: '/components/revogrid-adapter',
    description: 'RevoGrid-compatible mapping for Zeus grid models.',
  },
  {
    name: 'virtual',
    title: 'Virtual List',
    packageName: '@zeus-web/virtual',
    packageGroup: 'advanced',
    category: 'advanced',
    route: '/components/virtual',
    description: 'Low-level virtual scrolling for high-volume lists.',
  },
] as const satisfies readonly ComponentCatalogItem[]

export type ComponentName = (typeof componentCatalog)[number]['name']

export function findComponentCatalogItem(
  name: string,
): (typeof componentCatalog)[number] | undefined {
  return componentCatalog.find(component => component.name === name)
}
