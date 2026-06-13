export interface DocsNavItem {
  text: string
  link: string
}

export interface DocsSidebarGroup {
  text: string
  items: DocsNavItem[]
}

export interface ComponentDoc {
  name: string
  title: string
  packageName: string
  addCommand: string
  route: string
  description: string
}

export const guideItems: DocsNavItem[] = [
  {
    text: 'Getting Started',
    link: '/guide/getting-started',
  },
  {
    text: 'Usage Modes',
    link: '/guide/usage-modes',
  },
  {
    text: 'CLI',
    link: '/guide/cli',
  },
  {
    text: 'Theming',
    link: '/guide/theming',
  },
  {
    text: 'Icons',
    link: '/guide/icons',
  },
  {
    text: 'Registry',
    link: '/guide/registry',
  },
  {
    text: 'AI',
    link: '/guide/ai',
  },
]

export const componentDocs: ComponentDoc[] = [
  {
    name: 'button',
    title: 'Button',
    packageName: '@zeus-web/button',
    addCommand: 'zweb add button',
    route: '/components/button',
    description: 'Action component built on the zw-button primitive.',
  },
  {
    name: 'input',
    title: 'Input',
    packageName: '@zeus-web/input',
    addCommand: 'zweb add input',
    route: '/components/input',
    description: 'Text field component built on the zw-input primitive.',
  },
  {
    name: 'checkbox',
    title: 'Checkbox',
    packageName: '@zeus-web/checkbox',
    addCommand: 'zweb add checkbox',
    route: '/components/checkbox',
    description:
      'Boolean selection component built on the zw-checkbox primitive.',
  },
  {
    name: 'switch',
    title: 'Switch',
    packageName: '@zeus-web/switch',
    addCommand: 'zweb add switch',
    route: '/components/switch',
    description: 'On/off setting component built on the zw-switch primitive.',
  },
  {
    name: 'tabs',
    title: 'Tabs',
    packageName: '@zeus-web/tabs',
    addCommand: 'zweb add tabs',
    route: '/components/tabs',
    description:
      'Tabbed interface component family built on zw-tabs primitives.',
  },
  {
    name: 'dialog',
    title: 'Dialog',
    packageName: '@zeus-web/dialog',
    addCommand: 'zweb add dialog',
    route: '/components/dialog',
    description: 'Dialog component family built on the zw-dialog primitive.',
  },
  {
    name: 'label',
    title: 'Label',
    packageName: '@zeus-web/label',
    addCommand: 'zweb add label',
    route: '/components/label',
    description: 'Form label component built on the zw-label primitive.',
  },
  {
    name: 'textarea',
    title: 'Textarea',
    packageName: '@zeus-web/textarea',
    addCommand: 'zweb add textarea',
    route: '/components/textarea',
    description: 'Textarea component built on the zw-textarea primitive.',
  },
  {
    name: 'radio-group',
    title: 'Radio Group',
    packageName: '@zeus-web/radio-group',
    addCommand: 'zweb add radio-group',
    route: '/components/radio-group',
    description: 'Radio group component built on zw-radio-group primitives.',
  },
  {
    name: 'select',
    title: 'Select',
    packageName: '@zeus-web/select',
    addCommand: 'zweb add select',
    route: '/components/select',
    description: 'Native select component built on the zw-select primitive.',
  },
  {
    name: 'card',
    title: 'Card',
    packageName: '@zeus-web/card',
    addCommand: 'zweb add card',
    route: '/components/card',
    description: 'Card component family built on zw-card primitives.',
  },
  {
    name: 'badge',
    title: 'Badge',
    packageName: '@zeus-web/badge',
    addCommand: 'zweb add badge',
    route: '/components/badge',
    description: 'Badge component built on the zw-badge primitive.',
  },
  {
    name: 'separator',
    title: 'Separator',
    packageName: '@zeus-web/separator',
    addCommand: 'zweb add separator',
    route: '/components/separator',
    description: 'Separator component built on the zw-separator primitive.',
  },
  {
    name: 'skeleton',
    title: 'Skeleton',
    packageName: '@zeus-web/skeleton',
    addCommand: 'zweb add skeleton',
    route: '/components/skeleton',
    description: 'Skeleton component built on the zw-skeleton primitive.',
  },
  {
    name: 'collapsible',
    title: 'Collapsible',
    packageName: '@zeus-web/collapsible',
    addCommand: 'zweb add collapsible',
    route: '/components/collapsible',
    description:
      'Collapsible component family built on zw-collapsible primitives.',
  },
  {
    name: 'accordion',
    title: 'Accordion',
    packageName: '@zeus-web/accordion',
    addCommand: 'zweb add accordion',
    route: '/components/accordion',
    description: 'Accordion component family built on zw-accordion primitives.',
  },
  {
    name: 'tooltip',
    title: 'Tooltip',
    packageName: '@zeus-web/tooltip',
    addCommand: 'zweb add tooltip',
    route: '/components/tooltip',
    description: 'Tooltip component family built on zw-tooltip primitives.',
  },
  {
    name: 'progress',
    title: 'Progress',
    packageName: '@zeus-web/progress',
    addCommand: 'zweb add progress',
    route: '/components/progress',
    description: 'Progress component built on the zw-progress primitive.',
  },
  {
    name: 'avatar',
    title: 'Avatar',
    packageName: '@zeus-web/avatar',
    addCommand: 'zweb add avatar',
    route: '/components/avatar',
    description: 'Avatar component family built on zw-avatar primitives.',
  },
  {
    name: 'alert',
    title: 'Alert',
    packageName: '@zeus-web/alert',
    addCommand: 'zweb add alert',
    route: '/components/alert',
    description: 'Alert component family built on zw-alert primitives.',
  },
]

export const exampleItems: DocsNavItem[] = [
  {
    text: 'React Vite',
    link: '/examples/react-vite',
  },
  {
    text: 'Next.js App Router',
    link: '/examples/next-app',
  },
  {
    text: 'Native Web Components',
    link: '/examples/native-wc',
  },
]

export const componentIndexItem: DocsNavItem = {
  text: 'Overview',
  link: '/components/',
}

export const playgroundItems: DocsNavItem[] = [
  {
    text: 'Interactive Playground',
    link: '/playground/',
  },
]

export const sidebar: DocsSidebarGroup[] = [
  {
    text: 'Guide',
    items: guideItems,
  },
  {
    text: 'Components',
    items: [
      componentIndexItem,
      ...componentDocs.map(component => ({
        text: component.title,
        link: component.route,
      })),
    ],
  },
  {
    text: 'Playground',
    items: playgroundItems,
  },
  {
    text: 'Examples',
    items: exampleItems,
  },
]

export const topNav: DocsNavItem[] = [
  {
    text: 'Guide',
    link: '/guide/getting-started',
  },
  {
    text: 'Components',
    link: '/components/',
  },
  {
    text: 'Playground',
    link: '/playground/',
  },
  {
    text: 'Examples',
    link: '/examples/react-vite',
  },
]
