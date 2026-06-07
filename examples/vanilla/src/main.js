/* eslint-disable no-restricted-globals */
import { defineCustomElements } from '@zeus-web/input'
import '@zeus-web/themes/default.css'

// 注册自定义元素 <zw-input>
defineCustomElements()

const input = document.getElementById('my-input')
const display = document.getElementById('value-display')

// 监听 value-change 自定义事件
input.addEventListener('value-change', event => {
  display.textContent = event.detail.value
})
