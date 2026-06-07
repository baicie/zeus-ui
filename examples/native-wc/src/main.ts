/* eslint-disable no-restricted-globals, no-console */
import '@zeus-web/themes/default.css'

import '@zeus-web/button/wc'
import '@zeus-web/checkbox/wc'
import '@zeus-web/dialog/wc'
import '@zeus-web/input/wc'
import '@zeus-web/switch/wc'
import '@zeus-web/tabs/wc'

import './styles.css'

window.addEventListener('value-change', event => {
  console.log('value-change', event)
})

window.addEventListener('checked-change', event => {
  console.log('checked-change', event)
})
