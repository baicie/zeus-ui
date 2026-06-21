import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface RegistryFile {
  framework: string
  source: string
  target: string
}

interface RegistryItem {
  name: string
  type: string
  frameworks: string[]
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

interface RegistryManifest {
  items: RegistryItem[]
}

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../..')

function read(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`[agent-console-product-contract] ${message}`)
  }
}

function assertContains(source: string, value: string, label: string): void {
  assert(
    source.includes(value),
    `${label} must contain ${JSON.stringify(value)}`,
  )
}

function assertNotContains(source: string, value: string, label: string): void {
  assert(
    !source.includes(value),
    `${label} must not contain ${JSON.stringify(value)}`,
  )
}

function readManifest(): RegistryManifest {
  return JSON.parse(read('packages/registry/registry.json')) as RegistryManifest
}

export function checkAgentConsoleProductContract(): void {
  const manifest = readManifest()
  const item = manifest.items.find(
    registryItem => registryItem.name === 'agent-console',
  )

  assert(item, 'registry.json must contain agent-console')
  assert(item?.type === 'component', 'agent-console must be a component')
  assert(
    JSON.stringify(item?.frameworks) ===
      JSON.stringify(['native', 'react', 'vue']),
    'agent-console frameworks must be native/react/vue',
  )
  assert(
    JSON.stringify(item?.dependencies) ===
      JSON.stringify(['@zeus-web/agent-console']),
    'agent-console dependency must be @zeus-web/agent-console',
  )
  assert(
    item?.registryDependencies.includes('cn'),
    'agent-console must depend on cn',
  )
  assert(
    item?.registryDependencies.includes('globals'),
    'agent-console must depend on globals',
  )

  const expectedFiles: RegistryFile[] = [
    {
      framework: 'native',
      source: 'templates/native/agent-console.ts',
      target: 'components/agent-console.ts',
    },
    {
      framework: 'react',
      source: 'templates/react/agent-console.tsx',
      target: 'components/ui/agent-console.tsx',
    },
    {
      framework: 'vue',
      source: 'templates/vue/agent-console.vue',
      target: 'components/ui/agent-console.vue',
    },
  ]

  for (const expectedFile of expectedFiles) {
    assert(
      item?.files.some(
        file =>
          file.framework === expectedFile.framework &&
          file.source === expectedFile.source &&
          file.target === expectedFile.target,
      ),
      `registry file missing ${expectedFile.source}`,
    )
  }

  const nativeSource = read(
    'packages/registry/templates/native/agent-console.ts',
  )
  const reactSource = read(
    'packages/registry/templates/react/agent-console.tsx',
  )
  const vueSource = read('packages/registry/templates/vue/agent-console.vue')

  assertContains(
    nativeSource,
    "import '@zeus-web/agent-console/wc/auto'",
    'native template',
  )
  assertContains(
    nativeSource,
    "from '@zeus-web/agent-console'",
    'native template',
  )
  assertContains(nativeSource, 'mountAgentConsoleDemo', 'native template')

  assertContains(reactSource, '@zeus-web/agent-console/react', 'react template')
  assertContains(
    reactSource,
    "from '@zeus-web/agent-console'",
    'react template',
  )
  assertContains(reactSource, "import { cn } from '@/lib/cn'", 'react template')

  assertContains(vueSource, '@zeus-web/agent-console/vue', 'vue template')
  assertContains(vueSource, "from '@zeus-web/agent-console'", 'vue template')
  assertContains(vueSource, "import { cn } from '@/lib/cn'", 'vue template')

  for (const [label, source] of [
    ['native template', nativeSource],
    ['react template', reactSource],
    ['vue template', vueSource],
  ] as const) {
    assertNotContains(source, 'fetch(', label)
    assertNotContains(source, 'EventSource', label)
    assertNotContains(source, 'WebSocket', label)
    assertNotContains(source, 'Authorization', label)
    assertNotContains(source, 'Bearer', label)
    assertNotContains(source, 'OPENAI_API_KEY', label)
    assertNotContains(source, 'ANTHROPIC_API_KEY', label)
    assertNotContains(source, 'DEEPSEEK_API_KEY', label)
  }
}

checkAgentConsoleProductContract()
