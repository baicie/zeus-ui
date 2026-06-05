/* eslint-disable no-new */
import { defineCustomElements } from '@zeus-web/input'
import Vue from 'vue'

// 忽略自定义元素，Vue 2 不会尝试将其解析为 Vue 组件
Vue.config.ignoredElements = ['zw-input']

// 注册自定义元素 <zw-input>
defineCustomElements()

new Vue({
  el: '#app',
  data: {
    value: '',
  },
  methods: {
    handleChange(e) {
      this.value = e.detail.value
    },
  },
  render(h) {
    const fontFamily = `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
    return h(
      'div',
      {
        style: {
          fontFamily,
          padding: '2rem',
          background: '#f5f5f5',
          color: '#333',
          minHeight: '100vh',
        },
      },
      [
        h(
          'h1',
          { style: { fontSize: '1.5rem', marginBottom: '1.5rem' } },
          'Zeus Web - Vue 2 Demo',
        ),
        h(
          'div',
          {
            style: {
              background: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,.1)',
              maxWidth: '400px',
            },
          },
          [
            h(
              'h2',
              {
                style: {
                  fontSize: '1rem',
                  marginBottom: '1rem',
                  color: '#666',
                },
              },
              'Input 组件（Vue 2）',
            ),
            h('zw-input', {
              attrs: { placeholder: '请输入内容...', value: this.value },
              on: { 'value-change': this.handleChange },
            }),
            h(
              'p',
              {
                style: {
                  marginTop: '1rem',
                  fontSize: '.875rem',
                  color: '#666',
                },
              },
              [
                '当前值: ',
                h(
                  'span',
                  { style: { color: '#333', fontWeight: '500' } },
                  this.value || '(空)',
                ),
              ],
            ),
          ],
        ),
      ],
    )
  },
})
