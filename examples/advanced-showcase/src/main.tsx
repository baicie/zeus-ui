import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from './App'
import './styles.css'

import '@zeus-web/agent-console/wc/auto'
import '@zeus-web/chat/wc/auto'
import '@zeus-web/data-grid/wc/auto'
import '@zeus-web/revogrid-adapter/wc/auto'
import '@zeus-web/virtual/wc/auto'

// eslint-disable-next-line no-restricted-globals
const app = document.querySelector<HTMLElement>('#app')

if (app) {
  createRoot(app).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}
