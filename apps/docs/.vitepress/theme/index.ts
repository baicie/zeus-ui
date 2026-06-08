import type { Theme } from 'vitepress'

import DefaultTheme from 'vitepress/theme'
import ZeusPlayground from './components/ZeusPlayground.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ZeusPlayground', ZeusPlayground)
  },
} satisfies Theme
