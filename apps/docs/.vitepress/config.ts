import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Zeus Web',
  description:
    'Headless Web Components, shadcn-like registry and AI metadata built on Zeus.',
  cleanUrls: true,
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      {
        text: 'Guide',
        link: '/guide/getting-started',
      },
      {
        text: 'Components',
        link: '/components/button',
      },
      {
        text: 'Examples',
        link: '/examples/react-vite',
      },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
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
        ],
      },
      {
        text: 'Components',
        items: [
          {
            text: 'Button',
            link: '/components/button',
          },
          {
            text: 'Input',
            link: '/components/input',
          },
          {
            text: 'Checkbox',
            link: '/components/checkbox',
          },
          {
            text: 'Switch',
            link: '/components/switch',
          },
          {
            text: 'Tabs',
            link: '/components/tabs',
          },
          {
            text: 'Dialog',
            link: '/components/dialog',
          },
        ],
      },
      {
        text: 'Examples',
        items: [
          {
            text: 'React Vite',
            link: '/examples/react-vite',
          },
          {
            text: 'Native Web Components',
            link: '/examples/native-wc',
          },
        ],
      },
    ],
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
