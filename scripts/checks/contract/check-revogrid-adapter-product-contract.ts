import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

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
  schemaVersion: number
  name: string
  items: RegistryItem[]
}

const root = process.cwd()

const requiredFiles = [
  'packages/registry/registry.json',
  'packages/registry/templates/native/revogrid-adapter.ts',
  'packages/registry/templates/react/revogrid-adapter.tsx',
  'packages/registry/templates/vue/revogrid-adapter.vue',
  'packages/registry/package.json',
  'packages/registry/__tests__/registry-package.spec.ts',
  'packages/ai/src/metadata.ts',
  'packages/ai/src/types.ts',
  'packages/ai/__tests__/revogrid-adapter-ai-metadata.spec.ts',
  'scripts/checks/contract/__tests__/check-revogrid-adapter-product-contract.spec.ts',
]

const productFiles = [
  'packages/registry/templates/native/revogrid-adapter.ts',
  'packages/registry/templates/react/revogrid-adapter.tsx',
  'packages/registry/templates/vue/revogrid-adapter.vue',
]

const forbiddenPatterns = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'apiKey',
  'Authorization',
  'Bearer ',
  'fetch(',
  'XMLHttpRequest',
  'EventSource',
  'WebSocket',
]

const nativeTemplatePath =
  'packages/registry/templates/native/revogrid-adapter.ts'

const nativeTemplateForbiddenWrappers = [
  'String.raw',
  'revoGridAdapterNativeSource',
]

const nativeTemplateMustContain = [
  "import '@zeus-web/revogrid-adapter/wc/auto'",
  "from '@zeus-web/revogrid-adapter'",
  'mountRevoGridAdapterDemo',
  'zw-revogrid-adapter',
  'revoGridAdapterDemoColumns',
  'revoGridAdapterDemoRows',
]

function readText(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function readJson<T>(path: string): T {
  return JSON.parse(readText(path)) as T
}

function assertFileExists(path: string, errors: string[]): void {
  if (!existsSync(resolve(root, path))) {
    errors.push(`Missing required file: ${path}`)
  }
}

function mustContain(path: string, contents: string[], errors: string[]): void {
  const source = readText(path)

  for (const content of contents) {
    if (!source.includes(content)) {
      errors.push(`${path} must contain ${JSON.stringify(content)}`)
    }
  }
}

function mustNotContain(
  path: string,
  contents: string[],
  errors: string[],
): void {
  const source = readText(path)

  for (const content of contents) {
    if (source.includes(content)) {
      errors.push(`${path} must not contain ${JSON.stringify(content)}`)
    }
  }
}

function findRevoGridAdapterItem(
  registry: RegistryManifest,
): RegistryItem | undefined {
  return registry.items.find(item => item.name === 'revogrid-adapter')
}

function checkFiles(errors: string[]): void {
  for (const file of requiredFiles) {
    assertFileExists(file, errors)
  }
}

function checkRegistry(errors: string[]): void {
  const registry = readJson<RegistryManifest>('packages/registry/registry.json')
  const adapter = findRevoGridAdapterItem(registry)

  if (!adapter) {
    errors.push(
      'packages/registry/registry.json must contain revogrid-adapter item',
    )
    return
  }

  if (adapter.type !== 'component') {
    errors.push('revogrid-adapter registry item type must be component')
  }

  for (const framework of ['native', 'react', 'vue']) {
    if (!adapter.frameworks.includes(framework)) {
      errors.push(`revogrid-adapter registry item must support ${framework}`)
    }
  }

  if (!adapter.dependencies.includes('@zeus-web/revogrid-adapter')) {
    errors.push(
      'revogrid-adapter registry item must depend on @zeus-web/revogrid-adapter',
    )
  }

  for (const dependency of ['cn', 'globals']) {
    if (!adapter.registryDependencies.includes(dependency)) {
      errors.push(
        `revogrid-adapter registry item must depend on registry item ${dependency}`,
      )
    }
  }

  const expectedFiles: RegistryFile[] = [
    {
      framework: 'native',
      source: 'templates/native/revogrid-adapter.ts',
      target: 'components/revogrid-adapter.ts',
    },
    {
      framework: 'react',
      source: 'templates/react/revogrid-adapter.tsx',
      target: 'components/ui/revogrid-adapter.tsx',
    },
    {
      framework: 'vue',
      source: 'templates/vue/revogrid-adapter.vue',
      target: 'components/ui/revogrid-adapter.vue',
    },
  ]

  for (const expected of expectedFiles) {
    const matched = adapter.files.some(
      file =>
        file.framework === expected.framework &&
        file.source === expected.source &&
        file.target === expected.target,
    )

    if (!matched) {
      errors.push(
        `revogrid-adapter registry item must include ${expected.framework} template ${expected.source} -> ${expected.target}`,
      )
    }
  }

  mustNotContain(
    'packages/registry/registry.json',
    ['@revolist/revogrid', 'defineCustomElements'],
    errors,
  )

  mustContain(
    'packages/registry/package.json',
    [
      './templates/native/revogrid-adapter.ts',
      './templates/react/revogrid-adapter.tsx',
      './templates/vue/revogrid-adapter.vue',
    ],
    errors,
  )
}

function checkAiMetadata(errors: string[]): void {
  mustContain('packages/ai/src/types.ts', ["| 'revogrid-adapter'"], errors)

  mustContain(
    'packages/ai/src/metadata.ts',
    [
      "name: 'revogrid-adapter'",
      "packageName: '@zeus-web/revogrid-adapter'",
      "category: 'advanced'",
      'zw-revogrid-adapter',
      'adapter-ready',
      'adapter-change',
      'getRevoColumns',
      'getRevoSource',
      'setRows',
      'setColumns',
      '业务请求逻辑应该放在应用层',
      '不要把它当作模型请求库',
    ],
    errors,
  )
}

function checkTemplates(errors: string[]): void {
  mustContain(nativeTemplatePath, nativeTemplateMustContain, errors)

  mustNotContain(nativeTemplatePath, nativeTemplateForbiddenWrappers, errors)

  mustContain(
    'packages/registry/templates/react/revogrid-adapter.tsx',
    [
      "from '@zeus-web/revogrid-adapter'",
      '@zeus-web/revogrid-adapter/react',
      "import { cn } from '@/lib/cn'",
      'RevoGridAdapterPrimitive',
      'RevoGridAdapterDemo',
      'revoGridAdapterDemoColumns',
      'revoGridAdapterDemoRows',
    ],
    errors,
  )

  mustNotContain(
    'packages/registry/templates/react/revogrid-adapter.tsx',
    [
      'DataGridColumn,\n  DataGridProps as RevoGridAdapterPrimitiveProps',
      "DataGridColumn,\n  DataGridRowData,\n} from '@zeus-web/revogrid-adapter/react'",
      "DataGridRowData,\n} from '@zeus-web/revogrid-adapter/react'",
    ],
    errors,
  )

  mustContain(
    'packages/registry/templates/vue/revogrid-adapter.vue',
    [
      "from '@zeus-web/revogrid-adapter'",
      '@zeus-web/revogrid-adapter/vue',
      "import { cn } from '@/lib/cn'",
      'RevoGridAdapterPrimitive',
      'revoGridAdapterDemoColumns',
      'revoGridAdapterDemoRows',
    ],
    errors,
  )

  mustNotContain(
    'packages/registry/templates/vue/revogrid-adapter.vue',
    ["DataGridColumn, DataGridRowData } from '@zeus-web/revogrid-adapter/vue'"],
    errors,
  )
}

function checkForbiddenLogic(errors: string[]): void {
  for (const file of productFiles) {
    if (!existsSync(resolve(root, file))) continue

    mustNotContain(file, forbiddenPatterns, errors)
  }
}

function main(): void {
  const errors: string[] = []

  checkFiles(errors)

  if (errors.length === 0) {
    checkRegistry(errors)
    checkAiMetadata(errors)
    checkTemplates(errors)
    checkForbiddenLogic(errors)
  }

  if (errors.length > 0) {
    console.error(pc.red('RevoGrid adapter product contract check failed:'))

    for (const error of errors) {
      console.error(`  ${pc.red('✘')} ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('RevoGrid adapter product contract looks good.'))
}

main()
