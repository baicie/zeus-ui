import type { Theme } from 'vitepress'

import DefaultTheme from 'vitepress/theme'
import ComponentDirectory from './components/ComponentDirectory.vue'
import ComponentPlayground from './components/ComponentPlayground.vue'
import DataGridPlayground from './components/DataGridPlayground.vue'
import ZeusPlayground from './components/ZeusPlayground.vue'
import '@zeus-web/themes/default.css'
import '@zeus-web/themes/components.css'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ComponentDirectory', ComponentDirectory)
    app.component('ComponentPlayground', ComponentPlayground)
    app.component('DataGridPlayground', DataGridPlayground)
    app.component('ZeusPlayground', ZeusPlayground)
  },
} satisfies Theme
