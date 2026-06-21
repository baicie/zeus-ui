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
  'packages/advanced/data-grid/package.json',
  'packages/registry/registry.json',
  'packages/registry/package.json',
  'packages/registry/templates/native/data-grid.ts',
  'packages/registry/templates/react/data-grid.tsx',
  'packages/registry/templates/vue/data-grid.vue',
  'packages/registry/__tests__/registry-package.spec.ts',
  'packages/ai/src/metadata.ts',
  'packages/ai/src/types.ts',
  'packages/ai/__tests__/data-grid-ai-metadata.spec.ts',
  'scripts/checks/contract/__tests__/check-data-grid-product-contract.spec.ts',
]

const productFiles = [
  'packages/registry/templates/native/data-grid.ts',
  'packages/registry/templates/react/data-grid.tsx',
  'packages/registry/templates/vue/data-grid.vue',
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
  'ag-grid',
  '@ag-grid',
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

function mustMatch(path: string, pattern: RegExp, errors: string[]): void {
  const source = readText(path)

  if (!pattern.test(source)) {
    errors.push(`${path} must match ${pattern}`)
  }
}

function findDataGridItem(
  registry: RegistryManifest,
): RegistryItem | undefined {
  return registry.items.find(item => item.name === 'data-grid')
}

function checkFiles(errors: string[]): void {
  for (const file of requiredFiles) {
    assertFileExists(file, errors)
  }
}

function checkRegistry(errors: string[]): void {
  const registry = readJson<RegistryManifest>('packages/registry/registry.json')
  const dataGrid = findDataGridItem(registry)

  if (!dataGrid) {
    errors.push('packages/registry/registry.json must contain data-grid item')
    return
  }

  if (dataGrid.type !== 'component') {
    errors.push('data-grid registry item type must be component')
  }

  for (const framework of ['native', 'react', 'vue']) {
    if (!dataGrid.frameworks.includes(framework)) {
      errors.push(`data-grid registry item must support ${framework}`)
    }
  }

  if (!dataGrid.dependencies.includes('@zeus-web/data-grid')) {
    errors.push('data-grid registry item must depend on @zeus-web/data-grid')
  }

  for (const dependency of ['cn', 'globals']) {
    if (!dataGrid.registryDependencies.includes(dependency)) {
      errors.push(
        `data-grid registry item must depend on registry item ${dependency}`,
      )
    }
  }

  const expectedFiles: RegistryFile[] = [
    {
      framework: 'native',
      source: 'templates/native/data-grid.ts',
      target: 'components/data-grid.ts',
    },
    {
      framework: 'react',
      source: 'templates/react/data-grid.tsx',
      target: 'components/ui/data-grid.tsx',
    },
    {
      framework: 'vue',
      source: 'templates/vue/data-grid.vue',
      target: 'components/ui/data-grid.vue',
    },
  ]

  for (const expected of expectedFiles) {
    const matched = dataGrid.files.some(
      file =>
        file.framework === expected.framework &&
        file.source === expected.source &&
        file.target === expected.target,
    )

    if (!matched) {
      errors.push(
        `data-grid registry item must include ${expected.framework} template ${expected.source} -> ${expected.target}`,
      )
    }
  }

  mustContain(
    'packages/registry/package.json',
    [
      './templates/native/data-grid.ts',
      './templates/react/data-grid.tsx',
      './templates/vue/data-grid.vue',
    ],
    errors,
  )
}

function checkTemplates(errors: string[]): void {
  mustContain(
    'packages/registry/templates/native/data-grid.ts',
    [
      "import '@zeus-web/data-grid/wc/auto'",
      "from '@zeus-web/data-grid'",
      'mountDataGridDemo',
      'zw-data-grid',
      'dataGridDemoColumns',
      'dataGridDemoRows',
      'selection-change',
      'sort-change',
    ],
    errors,
  )

  mustNotContain(
    'packages/registry/templates/native/data-grid.ts',
    ['String.raw', 'dataGridNativeSource'],
    errors,
  )

  mustContain(
    'packages/registry/templates/react/data-grid.tsx',
    [
      "from '@zeus-web/data-grid'",
      '@zeus-web/data-grid/react',
      "import { cn } from '@/lib/cn'",
      'DataGridPrimitive',
      'DataGridDemo',
      'dataGridDemoColumns',
      'dataGridDemoRows',
    ],
    errors,
  )

  mustMatch(
    'packages/registry/templates/react/data-grid.tsx',
    /extends\s+ComponentProps<\s+typeof\s+DataGridPrimitive/,
    errors,
  )

  mustNotContain(
    'packages/registry/templates/react/data-grid.tsx',
    [
      'DataGridColumn,\n  DataGridProps as DataGridPrimitiveProps',
      "DataGridColumn,\n  DataGridRowData,\n} from '@zeus-web/data-grid/react'",
      "DataGridRowData,\n} from '@zeus-web/data-grid/react'",
    ],
    errors,
  )

  mustContain(
    'packages/registry/templates/vue/data-grid.vue',
    [
      "from '@zeus-web/data-grid'",
      '@zeus-web/data-grid/vue',
      "import { cn } from '@/lib/cn'",
      'DataGridPrimitive',
      'dataGridDemoColumns',
      'dataGridDemoRows',
    ],
    errors,
  )

  mustNotContain(
    'packages/registry/templates/vue/data-grid.vue',
    ["DataGridColumn, DataGridRowData } from '@zeus-web/data-grid/vue'"],
    errors,
  )
}

function checkAiMetadata(errors: string[]): void {
  mustContain('packages/ai/src/types.ts', ["| 'data-grid'"], errors)

  mustContain(
    'packages/ai/src/metadata.ts',
    [
      "name: 'data-grid'",
      "packageName: '@zeus-web/data-grid'",
      "category: 'advanced'",
      'zw-data-grid',
      'range-change',
      'selection-change',
      'sort-change',
      'row-action',
      'cell-action',
      'setRows',
      'setColumns',
      'getVisibleRows',
      'toggleRowSelection',
      '业务请求逻辑应该放在应用层',
      '不要把它当作服务端数据源',
    ],
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
    checkTemplates(errors)
    checkAiMetadata(errors)
    checkForbiddenLogic(errors)
  }

  if (errors.length > 0) {
    console.error(pc.red('DataGrid product contract check failed:'))

    for (const error of errors) {
      console.error(`  ${pc.red('✘')} ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('DataGrid product contract looks good.'))
}

main()
