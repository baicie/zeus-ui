/* eslint-disable no-restricted-globals */
import React from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import '@zeus-web/themes/default.css'
import './styles.css'

const root = document.querySelector('#root')

if (!root) {
  throw new Error('Root element not found.')
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
