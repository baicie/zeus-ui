import { defineConfig } from 'vitepress'
import { sidebar, topNav } from './data/site'

export default defineConfig({
  title: 'Zeus Web',
  description:
    'Headless Web Components, shadcn-like registry and AI metadata built on Zeus.',
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    lineNumbers: true,
  },
  head: [
    ['meta', { name: 'theme-color', content: '#111827' }],
    ['meta', { property: 'og:title', content: 'Zeus Web' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Headless Web Components, shadcn-like registry and AI metadata built on Zeus.',
      },
    ],
  ],
  themeConfig: {
    logo: '/logo.svg',
    nav: topNav,
    sidebar,
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Zeus Web contributors.',
    },
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/baicie/zeus-ui',
      },
    ],
    search: {
      provider: 'local',
    },
  },
})
