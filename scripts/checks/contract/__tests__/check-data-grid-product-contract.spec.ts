import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('data-grid product contract files', () => {
  it('has registry templates', () => {
    expect(
      existsSync(
        resolve(root, 'packages/registry/templates/native/data-grid.ts'),
      ),
    ).toBe(true)

    expect(
      existsSync(
        resolve(root, 'packages/registry/templates/react/data-grid.tsx'),
      ),
    ).toBe(true)

    expect(
      existsSync(
        resolve(root, 'packages/registry/templates/vue/data-grid.vue'),
      ),
    ).toBe(true)
  })

  it('registers data-grid in registry manifest', () => {
    const registry = read('packages/registry/registry.json')

    expect(registry).toContain('"name": "data-grid"')
    expect(registry).toContain('"@zeus-web/data-grid"')
    expect(registry).toContain('"templates/native/data-grid.ts"')
    expect(registry).toContain('"templates/react/data-grid.tsx"')
    expect(registry).toContain('"templates/vue/data-grid.vue"')
  })

  it('exports data-grid templates from registry package', () => {
    const packageJson = read('packages/registry/package.json')

    expect(packageJson).toContain('./templates/native/data-grid.ts')
    expect(packageJson).toContain('./templates/react/data-grid.tsx')
    expect(packageJson).toContain('./templates/vue/data-grid.vue')
  })

  it('native template is copyable source, not a source string wrapper', () => {
    const source = read('packages/registry/templates/native/data-grid.ts')

    expect(source).toContain("import '@zeus-web/data-grid/wc/auto'")
    expect(source).toContain("from '@zeus-web/data-grid'")
    expect(source).toContain('export function mountDataGridDemo')
    expect(source).toContain('zw-data-grid')
    expect(source).not.toContain('String.raw')
    expect(source).not.toContain('dataGridNativeSource')
  })

  it('react and vue templates use generated wrappers and root type imports', () => {
    const reactSource = read('packages/registry/templates/react/data-grid.tsx')
    const vueSource = read('packages/registry/templates/vue/data-grid.vue')

    expect(reactSource).toContain("from '@zeus-web/data-grid'")
    expect(reactSource).toContain('@zeus-web/data-grid/react')
    expect(reactSource).toContain("import { cn } from '@/lib/cn'")
    expect(reactSource).toMatch(
      /extends\s+ComponentProps<\s+typeof\s+DataGridPrimitive/,
    )
    expect(reactSource).toContain('DataGridPrimitive')
    expect(reactSource).not.toContain(
      "DataGridRowData,\n} from '@zeus-web/data-grid/react'",
    )

    expect(vueSource).toContain("from '@zeus-web/data-grid'")
    expect(vueSource).toContain('@zeus-web/data-grid/vue')
    expect(vueSource).toContain("import { cn } from '@/lib/cn'")
    expect(vueSource).toContain('DataGridPrimitive')
    expect(vueSource).not.toContain(
      "DataGridColumn, DataGridRowData } from '@zeus-web/data-grid/vue'",
    )
  })

  it('adds data-grid to AI metadata', () => {
    const types = read('packages/ai/src/types.ts')
    const metadata = read('packages/ai/src/metadata.ts')

    expect(types).toContain("| 'data-grid'")
    expect(metadata).toContain("name: 'data-grid'")
    expect(metadata).toContain("packageName: '@zeus-web/data-grid'")
    expect(metadata).toContain('zw-data-grid')
    expect(metadata).toContain('selection-change')
    expect(metadata).toContain('sort-change')
  })

  it('does not include provider request logic', () => {
    const sources = [
      read('packages/registry/templates/native/data-grid.ts'),
      read('packages/registry/templates/react/data-grid.tsx'),
      read('packages/registry/templates/vue/data-grid.vue'),
      read('packages/ai/src/metadata.ts'),
    ].join('\n')

    expect(sources).not.toContain('OPENAI_API_KEY')
    expect(sources).not.toContain('ANTHROPIC_API_KEY')
    expect(sources).not.toContain('DEEPSEEK_API_KEY')
    expect(sources).not.toContain('Authorization')
    expect(sources).not.toContain('Bearer ')
    expect(sources).not.toContain('fetch(')
    expect(sources).not.toContain('apiKey')
    expect(sources).not.toContain('ag-grid')
    expect(sources).not.toContain('@ag-grid')
  })
})
