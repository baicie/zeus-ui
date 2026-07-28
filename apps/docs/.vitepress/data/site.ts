import type { DocsLocale, DocsNavigationMessages } from './docs-i18n'
import {
  getComponentCatalog,
  getComponentCategories,
  localizeDocsPath,
} from './component-catalog'
import { defaultDocsLocale, getDocsLocale } from './docs-i18n'

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

interface NavigationItemDefinition {
  label: keyof DocsNavigationMessages
  path: string
}

const guideItemDefinitions = [
  {
    label: 'gettingStarted',
    path: '/guide/getting-started',
  },
  {
    label: 'usageModes',
    path: '/guide/usage-modes',
  },
  {
    label: 'cli',
    path: '/guide/cli',
  },
  {
    label: 'theming',
    path: '/guide/theming',
  },
  {
    label: 'icons',
    path: '/guide/icons',
  },
  {
    label: 'registry',
    path: '/guide/registry',
  },
  {
    label: 'ai',
    path: '/guide/ai',
  },
] as const satisfies readonly NavigationItemDefinition[]

const exampleItemDefinitions = [
  {
    label: 'reactVite',
    path: '/examples/react-vite',
  },
  {
    label: 'nextApp',
    path: '/examples/next-app',
  },
  {
    label: 'nativeWebComponents',
    path: '/examples/native-wc',
  },
] as const satisfies readonly NavigationItemDefinition[]

function createNavigationItems(
  definitions: readonly NavigationItemDefinition[],
  locale: DocsLocale,
): DocsNavItem[] {
  const navigation = getDocsLocale(locale).messages.navigation
  return definitions.map(definition => ({
    text: navigation[definition.label],
    link: localizeDocsPath(definition.path, locale),
  }))
}

export function getGuideItems(
  locale: DocsLocale = defaultDocsLocale,
): DocsNavItem[] {
  return createNavigationItems(guideItemDefinitions, locale)
}

export function getExampleItems(
  locale: DocsLocale = defaultDocsLocale,
): DocsNavItem[] {
  return createNavigationItems(exampleItemDefinitions, locale)
}

export function getComponentIndexItem(
  locale: DocsLocale = defaultDocsLocale,
): DocsNavItem {
  const navigation = getDocsLocale(locale).messages.navigation
  return {
    text: navigation.overview,
    link: localizeDocsPath('/components/', locale),
  }
}

export function getComponentCategoryGroups(
  locale: DocsLocale = defaultDocsLocale,
): DocsSidebarGroup[] {
  const categories = getComponentCategories(locale)
  const catalog = getComponentCatalog(locale)
  return categories.map(category => ({
    text: category.label,
    collapsed: false,
    items: catalog
      .filter(component => component.category === category.id)
      .map(component => ({
        text: component.title,
        link: component.route,
      })),
  }))
}

export function getSidebar(
  locale: DocsLocale = defaultDocsLocale,
): DocsSidebarGroup[] {
  const navigation = getDocsLocale(locale).messages.navigation
  return [
    {
      text: navigation.guide,
      items: getGuideItems(locale),
    },
    {
      text: navigation.components,
      items: [
        getComponentIndexItem(locale),
        ...getComponentCategoryGroups(locale),
      ],
    },
    {
      text: navigation.examples,
      items: getExampleItems(locale),
    },
  ]
}

export function getTopNav(
  locale: DocsLocale = defaultDocsLocale,
): DocsNavItem[] {
  const navigation = getDocsLocale(locale).messages.navigation
  return [
    {
      text: navigation.guide,
      link: localizeDocsPath('/guide/getting-started', locale),
    },
    {
      text: navigation.components,
      link: localizeDocsPath('/components/', locale),
    },
    {
      text: navigation.examples,
      link: localizeDocsPath('/examples/react-vite', locale),
    },
  ]
}

export const guideItems = getGuideItems()
export const exampleItems = getExampleItems()
export const componentIndexItem = getComponentIndexItem()
export const componentCategoryGroups = getComponentCategoryGroups()
export const sidebar = getSidebar()
export const topNav = getTopNav()

export const zhGuideItems = getGuideItems('zh')
export const zhExampleItems = getExampleItems('zh')
export const zhComponentIndexItem = getComponentIndexItem('zh')
export const zhComponentCategoryGroups = getComponentCategoryGroups('zh')
export const zhSidebar = getSidebar('zh')
export const zhTopNav = getTopNav('zh')
