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

  it('virtual-list page renders only virtual range items instead of all 120 rows', () => {
    const source = read('src/pages/VirtualListPage.tsx')

    expect(source).toContain('visibleItems.map')
    expect(source).toContain('getItems')
    expect(source).toContain('range-change')
    expect(source).not.toContain('ITEMS.map(item =>')
  })

  it('data-grid page shows event output as debug panel, not as a data row', () => {
    const source = read('src/pages/DataGridPage.tsx')

    expect(source).toContain('className="debug-panel"')
    expect(source).toContain('Debug output')
    expect(source).not.toContain('<StatusNote>{note}</StatusNote>')
  })

  it('revogrid-adapter page displays mapped state instead of a blank target only', () => {
    const source = read('src/pages/RevoGridAdapterPage.tsx')

    expect(source).toContain('adapter-preview')
    expect(source).toContain('adapter-table')
    expect(source).toContain('getState')
    expect(source).toContain('Mapped RevoGrid-compatible state')
  })

  it('styles overlay spacer and virtual body correctly', () => {
    const source = read('src/styles.css')

    expect(source).toContain("zw-virtual-list [data-slot='virtual-list-items']")
    expect(source).toContain('position: absolute')
    expect(source).toContain(
      "zw-data-grid[data-virtual] [data-slot='data-grid-body']",
    )
    expect(source).toContain(
      "zw-data-grid[data-virtual] [data-slot='data-grid-row']",
    )
    expect(source).toContain('.adapter-preview')
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
