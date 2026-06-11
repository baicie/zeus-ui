import { createApp } from 'vue'

import App from './App.vue'
import { createShowcaseRouter } from './router'

import '@zeus-web/themes/default.css'
import '@zeus-web/themes/components.css'
import './app.css'

const app = createApp(App)

app.use(createShowcaseRouter())
app.mount('#app')
