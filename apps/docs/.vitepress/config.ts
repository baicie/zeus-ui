import type { DefaultTheme } from 'vitepress'
import type { DocsLocale } from './data/docs-i18n'
import type { DocsNavItem, DocsSidebarGroup } from './data/site'
import nodeProcess from 'node:process'
import { defineConfig } from 'vitepress'
import { docsLocales, getDocsLocale } from './data/docs-i18n'
import { sidebar, topNav, zhSidebar, zhTopNav } from './data/site'

const siteBase =
  nodeProcess.env.DOCS_BASE !== undefined ? nodeProcess.env.DOCS_BASE : '/'

function createLocaleThemeConfig(
  locale: DocsLocale,
  nav: DocsNavItem[],
  localeSidebar: DocsSidebarGroup[],
): DefaultTheme.Config {
  const messages = getDocsLocale(locale).messages
  return {
    nav,
    sidebar: localeSidebar,
    outline: {
      level: [2, 3],
      label: messages.outlineLabel,
    },
    footer: {
      message: messages.footerMessage,
      copyright: messages.footerCopyright,
    },
    docFooter: {
      prev: messages.previousPageLabel,
      next: messages.nextPageLabel,
    },
    lastUpdated: {
      text: messages.lastUpdatedLabel,
      formatOptions: {
        forceLocale: true,
      },
    },
    darkModeSwitchLabel: messages.appearanceLabel,
    lightModeSwitchTitle: messages.lightModeTitle,
    darkModeSwitchTitle: messages.darkModeTitle,
    sidebarMenuLabel: messages.sidebarMenuLabel,
    returnToTopLabel: messages.returnToTopLabel,
    langMenuLabel: messages.languageMenuLabel,
    skipToContentLabel: messages.skipToContentLabel,
    notFound: {
      title: messages.notFoundTitle,
      quote: messages.notFoundQuote,
      linkLabel: messages.notFoundLinkLabel,
      linkText: messages.notFoundLinkText,
    },
  }
}

export default defineConfig({
  base: siteBase,
  cacheDir: nodeProcess.env.ZEUS_DOCS_CACHE_DIR,
  title: docsLocales.en.messages.siteTitle,
  description: docsLocales.en.messages.siteDescription,
  locales: {
    root: {
      label: docsLocales.en.label,
      lang: docsLocales.en.lang,
      title: docsLocales.en.messages.siteTitle,
      description: docsLocales.en.messages.siteDescription,
      themeConfig: createLocaleThemeConfig('en', topNav, sidebar),
    },
    zh: {
      label: docsLocales.zh.label,
      lang: docsLocales.zh.lang,
      link: '/zh/',
      title: docsLocales.zh.messages.siteTitle,
      description: docsLocales.zh.messages.siteDescription,
      head: [
        [
          'meta',
          {
            property: 'og:title',
            content: docsLocales.zh.messages.siteTitle,
          },
        ],
        [
          'meta',
          {
            property: 'og:description',
            content: docsLocales.zh.messages.siteDescription,
          },
        ],
      ],
      themeConfig: createLocaleThemeConfig('zh', zhTopNav, zhSidebar),
    },
  },
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    lineNumbers: true,
  },
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: tag => tag.startsWith('zw-'),
      },
    },
  },
  vite: {
    optimizeDeps: {
      include: [
        '@zeus-js/zeus/capabilities',
        '@zeus-web/data-grid > @zeus-js/runtime-dom',
        '@zeus-web/data-grid > @zeus-js/web-c-runtime',
        '@zeus-web/data-grid > @zeus-js/zeus',
      ],
    },
  },
  head: [
    ['meta', { name: 'theme-color', content: '#111827' }],
    [
      'meta',
      {
        property: 'og:title',
        content: docsLocales.en.messages.siteTitle,
      },
    ],
    [
      'meta',
      {
        property: 'og:description',
        content: docsLocales.en.messages.siteDescription,
      },
    ],
  ],
  themeConfig: {
    logo: '/logo.svg',
    i18nRouting: true,
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/baicie/zeus-ui',
      },
    ],
    search: {
      provider: 'local',
      options: {
        locales: {
          zh: {
            translations: {
              button: {
                buttonText: '搜索',
                buttonAriaLabel: '搜索',
              },
              modal: {
                displayDetails: '显示详细列表',
                resetButtonTitle: '重置搜索',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有结果',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '确认',
                  navigateText: '导航',
                  navigateUpKeyAriaLabel: '上箭头',
                  navigateDownKeyAriaLabel: '下箭头',
                  closeText: '关闭',
                  closeKeyAriaLabel: 'Esc',
                },
              },
            },
          },
        },
      },
    },
  },
})
