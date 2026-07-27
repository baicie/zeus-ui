import { componentCatalog, componentCategories } from './component-catalog'

export interface DocsNavItem {
  text: string
  link: string
}

export interface DocsSidebarItem {
  text: string
  link?: string
  items?: DocsSidebarItem[]
  collapsed?: boolean
}

export interface DocsSidebarGroup {
  text: string
  items: DocsSidebarItem[]
  collapsed?: boolean
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

export const componentCategoryGroups: DocsSidebarGroup[] =
  componentCategories.map(category => ({
    text: category.label,
    collapsed: false,
    items: componentCatalog
      .filter(component => component.category === category.id)
      .map(component => ({
        text: component.title,
        link: component.route,
      })),
  }))

export const sidebar: DocsSidebarGroup[] = [
  {
    text: 'Guide',
    items: guideItems,
  },
  {
    text: 'Components',
    items: [componentIndexItem, ...componentCategoryGroups],
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
    text: 'Examples',
    link: '/examples/react-vite',
  },
]
