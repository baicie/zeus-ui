/* eslint-disable no-restricted-globals, no-console */
import '@zeus-web/themes/default.css'

import '@zeus-web/button/wc/auto'
import '@zeus-web/checkbox/wc/auto'
import '@zeus-web/dialog/wc/auto'
import '@zeus-web/input/wc/auto'
import '@zeus-web/switch/wc/auto'
import '@zeus-web/tabs/wc/auto'

import './styles.css'

window.addEventListener('value-change', event => {
  console.log('value-change', event)
})

window.addEventListener('checked-change', event => {
  console.log('checked-change', event)
})
