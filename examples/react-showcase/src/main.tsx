/* eslint-disable no-restricted-globals */
import { RouterProvider } from '@tanstack/react-router'
import React from 'react'
import { createRoot } from 'react-dom/client'

import { createShowcaseRouter } from './router'
import '@zeus-web/themes/default.css'

import './app.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing #root element')
}

const router = createShowcaseRouter()

createRoot(root).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
