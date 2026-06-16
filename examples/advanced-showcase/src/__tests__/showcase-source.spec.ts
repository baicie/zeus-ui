import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? resolve(process.cwd(), 'examples/advanced-showcase')
  : process.cwd()

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf-8')
}

describe('advanced showcase source', () => {
  it('uses React entry and React Router', () => {
    const indexHtml = read('index.html')
    const mainSource = read('src/main.tsx')
    const appSource = read('src/App.tsx')
    const layoutSource = read('src/components/Layout.tsx')

    expect(indexHtml).toContain('/src/main.tsx')
    expect(mainSource).toContain(
      "import { createRoot } from 'react-dom/client'",
    )
    expect(mainSource).toContain(
      "import { BrowserRouter } from 'react-router-dom'",
    )
    expect(appSource).toContain(
      "import { Navigate, Route, Routes } from 'react-router-dom'",
    )
    expect(layoutSource).toContain(
      "import { NavLink, Outlet } from 'react-router-dom'",
    )
  })

  it('registers advanced web components through wc auto entries', () => {
    const mainSource = read('src/main.tsx')

    expect(mainSource).toContain('@zeus-web/agent-console/wc/auto')
    expect(mainSource).toContain('@zeus-web/chat/wc/auto')
    expect(mainSource).toContain('@zeus-web/data-grid/wc/auto')
    expect(mainSource).toContain('@zeus-web/revogrid-adapter/wc/auto')
    expect(mainSource).toContain('@zeus-web/virtual/wc/auto')
  })

  it('has one page per advanced component', () => {
    for (const page of [
      'src/pages/DataGridPage.tsx',
      'src/pages/RevoGridAdapterPage.tsx',
      'src/pages/ChatPage.tsx',
      'src/pages/VirtualListPage.tsx',
      'src/pages/AgentConsolePage.tsx',
    ]) {
      expect(read(page)).toBeTruthy()
    }
  })

  it('does not bundle provider or RevoGrid implementations', () => {
    const files = [
      'src/main.tsx',
      'src/App.tsx',
      'src/routes.tsx',
      'src/pages/DataGridPage.tsx',
      'src/pages/RevoGridAdapterPage.tsx',
      'src/pages/ChatPage.tsx',
      'src/pages/VirtualListPage.tsx',
      'src/pages/AgentConsolePage.tsx',
    ]

    const source = files.map(file => read(file)).join('\n')

    for (const forbidden of [
      'fetch(',
      'EventSource',
      'WebSocket',
      'XMLHttpRequest',
      'Authorization',
      'Bearer',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'DEEPSEEK_API_KEY',
      '@revolist/revogrid',
      'defineCustomElements',
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })
})
