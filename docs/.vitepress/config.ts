import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Project',
  description: 'A TypeScript monorepo powered by pnpm workspace',

  cleanUrls: true,

  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],

  themeConfig: {
    logo: '/logo.svg',
    nav: [{ text: 'Guide', link: '/guide/getting-started' }],

    sidebar: [
      {
        text: 'Guide',
        items: [{ text: 'Getting Started', link: '/guide/getting-started' }],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/baicie/zeus' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present',
    },

    search: {
      provider: 'local',
    },
  },
})
