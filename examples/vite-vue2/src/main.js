import { defineCustomElements } from '@zeus-web/input'
import { createApp } from 'vue'
import '@zeus-web/themes/default.css'

defineCustomElements()

const app = createApp({
  data() {
    return {
      value: '',
    }
  },
  methods: {
    handleChange(e) {
      this.value = e.detail.value
    },
  },
  template: `
    <div class="page">
      <h1 class="title">Zeus Web - Vue 3 Demo</h1>
      <div class="card">
        <h2 class="subtitle">Input 组件（Vue 3）</h2>
        <zw-input
          placeholder="请输入内容..."
          :value="value"
          @value-change="handleChange"
        ></zw-input>
        <p class="value-text">
          当前值:
          <span class="value-display">{{ value || '(空)' }}</span>
        </p>
      </div>
    </div>
  `,
})

app.config.compilerOptions.isCustomElement = tag => tag.startsWith('zw-')
app.mount('#app')
