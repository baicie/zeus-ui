export const docsLocaleIds = ['en', 'zh'] as const

export type DocsLocale = (typeof docsLocaleIds)[number]

export type VitePressLocaleKey = 'root' | 'zh'

export interface DocsNavigationMessages {
  guide: string
  components: string
  examples: string
  overview: string
  gettingStarted: string
  usageModes: string
  cli: string
  theming: string
  icons: string
  registry: string
  ai: string
  reactVite: string
  nextApp: string
  nativeWebComponents: string
}

export interface DocsShellMessages {
  siteTitle: string
  siteDescription: string
  navigation: DocsNavigationMessages
  outlineLabel: string
  footerMessage: string
  footerCopyright: string
  previousPageLabel: string
  nextPageLabel: string
  lastUpdatedLabel: string
  appearanceLabel: string
  lightModeTitle: string
  darkModeTitle: string
  sidebarMenuLabel: string
  returnToTopLabel: string
  languageMenuLabel: string
  skipToContentLabel: string
  notFoundTitle: string
  notFoundQuote: string
  notFoundLinkLabel: string
  notFoundLinkText: string
}

export interface DocsLocaleDefinition {
  id: DocsLocale
  vitePressKey: VitePressLocaleKey
  label: string
  lang: string
  pathPrefix: '' | '/zh'
  messages: DocsShellMessages
}

export const defaultDocsLocale: DocsLocale = 'en'

export const docsLocales = {
  en: {
    id: 'en',
    vitePressKey: 'root',
    label: 'English',
    lang: 'en-US',
    pathPrefix: '',
    messages: {
      siteTitle: 'Zeus Web',
      siteDescription:
        'Headless Web Components, shadcn-like registry and AI metadata built on Zeus.',
      navigation: {
        guide: 'Guide',
        components: 'Components',
        examples: 'Examples',
        overview: 'Overview',
        gettingStarted: 'Getting Started',
        usageModes: 'Usage Modes',
        cli: 'CLI',
        theming: 'Theming',
        icons: 'Icons',
        registry: 'Registry',
        ai: 'AI',
        reactVite: 'React Vite',
        nextApp: 'Next.js App Router',
        nativeWebComponents: 'Native Web Components',
      },
      outlineLabel: 'On this page',
      footerMessage: 'Released under the MIT License.',
      footerCopyright: 'Copyright © Zeus Web contributors.',
      previousPageLabel: 'Previous page',
      nextPageLabel: 'Next page',
      lastUpdatedLabel: 'Last updated',
      appearanceLabel: 'Appearance',
      lightModeTitle: 'Switch to light theme',
      darkModeTitle: 'Switch to dark theme',
      sidebarMenuLabel: 'Menu',
      returnToTopLabel: 'Return to top',
      languageMenuLabel: 'Change language',
      skipToContentLabel: 'Skip to content',
      notFoundTitle: 'PAGE NOT FOUND',
      notFoundQuote: 'The page you requested could not be found.',
      notFoundLinkLabel: 'Go to home',
      notFoundLinkText: 'Take me home',
    },
  },
  zh: {
    id: 'zh',
    vitePressKey: 'zh',
    label: '简体中文',
    lang: 'zh-CN',
    pathPrefix: '/zh',
    messages: {
      siteTitle: 'Zeus Web',
      siteDescription:
        '基于 Zeus 构建的无头 Web Components、类 shadcn 注册表与 AI 元数据。',
      navigation: {
        guide: '指南',
        components: '组件',
        examples: '示例',
        overview: '概览',
        gettingStarted: '快速开始',
        usageModes: '使用模式',
        cli: '命令行工具',
        theming: '主题',
        icons: '图标',
        registry: '注册表',
        ai: 'AI',
        reactVite: 'React Vite',
        nextApp: 'Next.js App Router',
        nativeWebComponents: '原生 Web Components',
      },
      outlineLabel: '本页内容',
      footerMessage: '基于 MIT 许可证发布。',
      footerCopyright: '版权所有 © Zeus Web 贡献者。',
      previousPageLabel: '上一页',
      nextPageLabel: '下一页',
      lastUpdatedLabel: '最后更新',
      appearanceLabel: '外观',
      lightModeTitle: '切换到浅色主题',
      darkModeTitle: '切换到深色主题',
      sidebarMenuLabel: '菜单',
      returnToTopLabel: '返回顶部',
      languageMenuLabel: '切换语言',
      skipToContentLabel: '跳转到内容',
      notFoundTitle: '页面未找到',
      notFoundQuote: '无法找到你请求的页面。',
      notFoundLinkLabel: '返回首页',
      notFoundLinkText: '返回首页',
    },
  },
} as const satisfies Record<DocsLocale, DocsLocaleDefinition>

export function getDocsLocale(
  locale: DocsLocale = defaultDocsLocale,
): DocsLocaleDefinition {
  return docsLocales[locale]
}

export function resolveDocsLocale(lang: string): DocsLocale {
  return lang.toLowerCase().startsWith('zh') ? 'zh' : defaultDocsLocale
}
