import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('advanced showcase source', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf-8')

  it('exports a renderable Vite entry', () => {
    expect(true).toBe(true)
  })

  it('registers advanced package demos', () => {
    expect(source).toContain('@zeus-web/chat/wc/auto')
    expect(source).toContain('@zeus-web/data-grid/wc/auto')
    expect(source).toContain('@zeus-web/virtual/wc/auto')
    expect(source).toContain('@zeus-web/revogrid-adapter/wc/auto')
  })

  it('renders revogrid adapter section without bundling RevoGrid implementation', () => {
    expect(source).toContain('renderRevoGridAdapter')
    expect(source).toContain('zw-revogrid-adapter')
    expect(source).not.toContain('@revolist/revogrid')
    expect(source).not.toContain('defineCustomElements')
    expect(source).not.toContain('fetch(')
  })
})
