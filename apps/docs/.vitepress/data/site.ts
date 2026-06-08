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
    text: 'CLI',
    link: '/guide/cli',
  },
  {
    text: 'Theming',
    link: '/guide/theming',
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
