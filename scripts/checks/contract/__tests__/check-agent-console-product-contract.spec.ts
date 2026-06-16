import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('agent-console product contract files', () => {
  it('has registry templates', () => {
    expect(
      existsSync(
        resolve(root, 'packages/registry/templates/native/agent-console.ts'),
      ),
    ).toBe(true)

    expect(
      existsSync(
        resolve(root, 'packages/registry/templates/react/agent-console.tsx'),
      ),
    ).toBe(true)

    expect(
      existsSync(
        resolve(root, 'packages/registry/templates/vue/agent-console.vue'),
      ),
    ).toBe(true)
  })

  it('registers agent-console in registry manifest', () => {
    const registry = read('packages/registry/registry.json')

    expect(registry).toContain('"name": "agent-console"')
    expect(registry).toContain('"@zeus-web/agent-console"')
    expect(registry).toContain('"templates/native/agent-console.ts"')
    expect(registry).toContain('"templates/react/agent-console.tsx"')
    expect(registry).toContain('"templates/vue/agent-console.vue"')
  })

  it('exports agent-console templates from registry package', () => {
    const packageJson = read('packages/registry/package.json')

    expect(packageJson).toContain('./templates/native/agent-console.ts')
    expect(packageJson).toContain('./templates/react/agent-console.tsx')
    expect(packageJson).toContain('./templates/vue/agent-console.vue')
  })

  it('native template is copyable source, not a source string wrapper', () => {
    const source = read('packages/registry/templates/native/agent-console.ts')

    expect(source).toContain("import '@zeus-web/agent-console/wc/auto'")
    expect(source).toContain("from '@zeus-web/agent-console'")
    expect(source).toContain('export function mountAgentConsoleDemo')
    expect(source).toContain('zw-agent-console')
    expect(source).not.toContain('String.raw')
    expect(source).not.toContain('agentConsoleNativeSource')
  })

  it('react and vue templates use generated wrappers and root type imports', () => {
    const reactSource = read(
      'packages/registry/templates/react/agent-console.tsx',
    )
    const vueSource = read('packages/registry/templates/vue/agent-console.vue')

    expect(reactSource).toContain("from '@zeus-web/agent-console'")
    expect(reactSource).toContain('@zeus-web/agent-console/react')
    expect(reactSource).toContain("import { cn } from '@/lib/cn'")
    expect(reactSource).toContain('AgentConsolePrimitive')

    expect(vueSource).toContain("from '@zeus-web/agent-console'")
    expect(vueSource).toContain('@zeus-web/agent-console/vue')
    expect(vueSource).toContain("import { cn } from '@/lib/cn'")
    expect(vueSource).toContain('AgentConsolePrimitive')
  })

  it('adds agent-console to AI metadata', () => {
    const types = read('packages/ai/src/types.ts')
    const metadata = read('packages/ai/src/metadata.ts')

    expect(types).toContain("| 'agent-console'")
    expect(metadata).toContain("name: 'agent-console'")
    expect(metadata).toContain("packageName: '@zeus-web/agent-console'")
    expect(metadata).toContain('zw-agent-console')
    expect(metadata).toContain('agent-event')
    expect(metadata).toContain('status-change')
  })

  it('does not include provider request logic or network transport', () => {
    const sources = [
      read('packages/registry/templates/native/agent-console.ts'),
      read('packages/registry/templates/react/agent-console.tsx'),
      read('packages/registry/templates/vue/agent-console.vue'),
      read('packages/ai/src/metadata.ts'),
    ].join('\n')

    expect(sources).not.toContain('OPENAI_API_KEY')
    expect(sources).not.toContain('ANTHROPIC_API_KEY')
    expect(sources).not.toContain('DEEPSEEK_API_KEY')
    expect(sources).not.toContain('Authorization')
    expect(sources).not.toContain('Bearer ')
    expect(sources).not.toContain('fetch(')
    expect(sources).not.toContain('EventSource')
    expect(sources).not.toContain('WebSocket')
    expect(sources).not.toContain('apiKey')
  })
})
