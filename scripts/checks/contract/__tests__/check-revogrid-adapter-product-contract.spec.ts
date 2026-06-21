import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('revogrid-adapter product contract files', () => {
  it('has registry templates', () => {
    expect(
      existsSync(
        resolve(root, 'packages/registry/templates/native/revogrid-adapter.ts'),
      ),
    ).toBe(true)

    expect(
      existsSync(
        resolve(root, 'packages/registry/templates/react/revogrid-adapter.tsx'),
      ),
    ).toBe(true)

    expect(
      existsSync(
        resolve(root, 'packages/registry/templates/vue/revogrid-adapter.vue'),
      ),
    ).toBe(true)
  })

  it('registers revogrid-adapter in registry manifest', () => {
    const registry = read('packages/registry/registry.json')

    expect(registry).toContain('"name": "revogrid-adapter"')
    expect(registry).toContain('"@zeus-web/revogrid-adapter"')
    expect(registry).toContain('"templates/native/revogrid-adapter.ts"')
    expect(registry).toContain('"templates/react/revogrid-adapter.tsx"')
    expect(registry).toContain('"templates/vue/revogrid-adapter.vue"')
  })

  it('exports revogrid-adapter templates from registry package', () => {
    const packageJson = read('packages/registry/package.json')

    expect(packageJson).toContain('./templates/native/revogrid-adapter.ts')
    expect(packageJson).toContain('./templates/react/revogrid-adapter.tsx')
    expect(packageJson).toContain('./templates/vue/revogrid-adapter.vue')
  })

  it('native template is copyable source, not a source string wrapper', () => {
    const source = read(
      'packages/registry/templates/native/revogrid-adapter.ts',
    )

    expect(source).toContain("import '@zeus-web/revogrid-adapter/wc/auto'")
    expect(source).toContain("from '@zeus-web/revogrid-adapter'")
    expect(source).toContain('export function mountRevoGridAdapterDemo')
    expect(source).toContain('zw-revogrid-adapter')
    expect(source).not.toContain('String.raw')
    expect(source).not.toContain('revoGridAdapterNativeSource')
  })

  it('react and vue templates use generated wrappers and root type imports', () => {
    const reactSource = read(
      'packages/registry/templates/react/revogrid-adapter.tsx',
    )
    const vueSource = read(
      'packages/registry/templates/vue/revogrid-adapter.vue',
    )

    expect(reactSource).toContain("from '@zeus-web/revogrid-adapter'")
    expect(reactSource).toContain('@zeus-web/revogrid-adapter/react')
    expect(reactSource).toContain("import { cn } from '@/lib/cn'")
    expect(reactSource).toContain('RevoGridAdapterPrimitive')

    expect(vueSource).toContain("from '@zeus-web/revogrid-adapter'")
    expect(vueSource).toContain('@zeus-web/revogrid-adapter/vue')
    expect(vueSource).toContain("import { cn } from '@/lib/cn'")
    expect(vueSource).toContain('RevoGridAdapterPrimitive')
  })

  it('adds revogrid-adapter to AI metadata', () => {
    const types = read('packages/ai/src/types.ts')
    const metadata = read('packages/ai/src/metadata.ts')

    expect(types).toContain("| 'revogrid-adapter'")
    expect(metadata).toContain("name: 'revogrid-adapter'")
    expect(metadata).toContain("packageName: '@zeus-web/revogrid-adapter'")
    expect(metadata).toContain('zw-revogrid-adapter')
    expect(metadata).toContain('adapter-ready')
    expect(metadata).toContain('adapter-change')
  })

  it('does not include provider request logic or revogrid implementation', () => {
    const sources = [
      read('packages/registry/templates/native/revogrid-adapter.ts'),
      read('packages/registry/templates/react/revogrid-adapter.tsx'),
      read('packages/registry/templates/vue/revogrid-adapter.vue'),
    ].join('\n')

    expect(sources).not.toContain('OPENAI_API_KEY')
    expect(sources).not.toContain('ANTHROPIC_API_KEY')
    expect(sources).not.toContain('DEEPSEEK_API_KEY')
    expect(sources).not.toContain('Authorization')
    expect(sources).not.toContain('Bearer ')
    expect(sources).not.toContain('fetch(')
    expect(sources).not.toContain('apiKey')

    const registry = read('packages/registry/registry.json')
    expect(registry).not.toContain('@revolist/revogrid')
  })
})
