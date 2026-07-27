import type { Theme } from 'vitepress'

import DefaultTheme from 'vitepress/theme'
import ComponentPlayground from './components/ComponentPlayground.vue'
import DataGridPlayground from './components/DataGridPlayground.vue'
import PlaygroundDirectory from './components/PlaygroundDirectory.vue'
import ZeusPlayground from './components/ZeusPlayground.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ComponentPlayground', ComponentPlayground)
    app.component('DataGridPlayground', DataGridPlayground)
    app.component('PlaygroundDirectory', PlaygroundDirectory)
    app.component('ZeusPlayground', ZeusPlayground)
  },
} satisfies Theme
