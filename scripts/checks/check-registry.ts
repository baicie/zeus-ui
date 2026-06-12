import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

type RegistryFramework = 'react' | 'vue' | 'native' | 'shared'
type RegistryItemType =
  | 'component'
  | 'utility'
  | 'style'
  | 'registry:ui'
  | 'registry:lib'
  | 'registry:style'

interface RegistryFile {
  framework?: RegistryFramework
  source?: string
  path?: string
  target: string
  type?: string
}

interface RegistryItem {
  name: string
  type: RegistryItemType
  description?: string
  frameworks?: RegistryFramework[]
  dependencies?: string[]
  registryDependencies?: string[]
  files: RegistryFile[]
}

interface RegistryManifest {
  schemaVersion?: number
  name: string
  version?: string
  items: RegistryItem[]
}

const root = process.cwd()
const packageRoot = resolve(root, 'packages/registry')

const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'src/index.ts',
  'src/schema.ts',
  'registry.json',
  'templates/react/button.tsx',
  'templates/react/input.tsx',
  'templates/vue/button.vue',
  'templates/vue/input.vue',
  'templates/css/globals.css',
  'templates/lib/cn.ts',
  'scripts/copy-registry-assets.mjs',
  '__tests__/registry-package.spec.ts',
]

const requiredItemNames = ['cn', 'globals', 'button', 'input']

const allowedFrameworks = new Set<RegistryFramework>([
  'react',
  'vue',
  'native',
  'shared',
])

const allowedTypes = new Set<RegistryItemType>([
  'component',
  'utility',
  'style',
  'registry:ui',
  'registry:lib',
  'registry:style',
])

function read(relativePath: string): string {
  return readFileSync(resolve(packageRoot, relativePath), 'utf-8')
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(read(relativePath)) as T
}

function assertFileExists(relativePath: string, errors: string[]): void {
  if (!existsSync(resolve(packageRoot, relativePath))) {
    errors.push(`Missing packages/registry/${relativePath}`)
  }
}

function checkPackageJson(errors: string[]): void {
  const packageJson = readJson<{
    name?: string
    description?: string
    exports?: Record<string, unknown>
    scripts?: Record<string, string>
    sideEffects?: boolean
  }>('package.json')

  if (packageJson.name !== '@zeus-web/registry') {
    errors.push(
      'packages/registry/package.json name must be @zeus-web/registry',
    )
  }

  if (
    packageJson.description !==
    'Source component registry templates for Zeus Web.'
  ) {
    errors.push('packages/registry/package.json description is incorrect')
  }

  if (packageJson.sideEffects !== false) {
    errors.push('packages/registry/package.json sideEffects must be false')
  }

  const requiredExports = [
    '.',
    './schema',
    './registry.json',
    './templates/react/button.tsx',
    './templates/react/input.tsx',
    './templates/vue/button.vue',
    './templates/vue/input.vue',
    './templates/css/globals.css',
    './templates/lib/cn.ts',
  ]

  for (const exportName of requiredExports) {
    if (!packageJson.exports?.[exportName]) {
      errors.push(`packages/registry/package.json missing export ${exportName}`)
    }
  }

  for (const script of ['build', 'check', 'test']) {
    if (!packageJson.scripts?.[script]) {
      errors.push(`packages/registry/package.json missing script ${script}`)
    }
  }
}

function checkManifestShape(
  manifest: RegistryManifest,
  errors: string[],
): void {
  if (manifest.schemaVersion !== 1) {
    errors.push('registry.json schemaVersion must be 1')
  }

  if (manifest.name !== '@zeus-web/registry') {
    errors.push('registry.json name must be @zeus-web/registry')
  }

  if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
    errors.push('registry.json must contain items')
    return
  }

  const names = new Set<string>()

  for (const item of manifest.items) {
    if (!item.name) {
      errors.push('registry item missing name')
      continue
    }

    if (names.has(item.name)) {
      errors.push(`duplicate registry item name: ${item.name}`)
    }

    names.add(item.name)

    if (!allowedTypes.has(item.type)) {
      errors.push(`${item.name}: invalid item type ${item.type}`)
    }

    if (!item.description) {
      errors.push(`${item.name}: description is required`)
    }

    if (!Array.isArray(item.frameworks) || item.frameworks.length === 0) {
      errors.push(`${item.name}: frameworks must be non-empty`)
    } else {
      for (const framework of item.frameworks) {
        if (!allowedFrameworks.has(framework)) {
          errors.push(`${item.name}: invalid framework ${framework}`)
        }
      }
    }

    if (!Array.isArray(item.dependencies)) {
      errors.push(`${item.name}: dependencies must be an array`)
    }

    if (!Array.isArray(item.registryDependencies)) {
      errors.push(`${item.name}: registryDependencies must be an array`)
    }

    if (!Array.isArray(item.files) || item.files.length === 0) {
      errors.push(`${item.name}: files must be non-empty`)
    }

    for (const file of item.files) {
      if (file.framework && !allowedFrameworks.has(file.framework)) {
        errors.push(`${item.name}: invalid file framework ${file.framework}`)
      }

      const sourcePath = file.source ?? file.path
      if (sourcePath && !sourcePath.startsWith('templates/')) {
        errors.push(`${item.name}: file source must start with templates/`)
      }

      if (file.target.startsWith('/') || file.target.includes('..')) {
        errors.push(`${item.name}: unsafe file target ${file.target}`)
      }

      if (sourcePath && !existsSync(resolve(packageRoot, sourcePath))) {
        errors.push(`${item.name}: missing template ${sourcePath}`)
      }
    }
  }

  for (const requiredName of requiredItemNames) {
    if (!names.has(requiredName)) {
      errors.push(`registry.json missing required item ${requiredName}`)
    }
  }

  for (const item of manifest.items) {
    for (const dependency of item.registryDependencies ?? []) {
      if (!names.has(dependency)) {
        errors.push(`${item.name}: missing registry dependency ${dependency}`)
      }
    }
  }
}

function findItem(
  manifest: RegistryManifest,
  name: string,
): RegistryItem | undefined {
  return manifest.items.find(item => item.name === name)
}

function checkComponentItems(
  manifest: RegistryManifest,
  errors: string[],
): void {
  const button = findItem(manifest, 'button')
  const input = findItem(manifest, 'input')

  if (!button) {
    errors.push('registry missing button item')
  } else {
    if (!(button.dependencies ?? []).includes('@zeus-web/button')) {
      errors.push('button item must depend on @zeus-web/button')
    }

    if (!(button.registryDependencies ?? []).includes('cn')) {
      errors.push('button item must depend on registry item cn')
    }

    if (!(button.registryDependencies ?? []).includes('globals')) {
      errors.push('button item must depend on registry item globals')
    }
  }

  if (!input) {
    errors.push('registry missing input item')
  } else {
    if (!(input.dependencies ?? []).includes('@zeus-web/input')) {
      errors.push('input item must depend on @zeus-web/input')
    }

    if (!(input.registryDependencies ?? []).includes('cn')) {
      errors.push('input item must depend on registry item cn')
    }

    if (!(input.registryDependencies ?? []).includes('globals')) {
      errors.push('input item must depend on registry item globals')
    }
  }
}

function checkTemplateContents(errors: string[]): void {
  const reactButton = read('templates/react/button.tsx')
  const reactInput = read('templates/react/input.tsx')
  const vueButton = read('templates/vue/button.vue')
  const vueInput = read('templates/vue/input.vue')
  const cn = read('templates/lib/cn.ts')
  const globals = read('templates/css/globals.css')

  const requiredTemplateContents = [
    {
      file: 'templates/react/button.tsx',
      source: reactButton,
      contains: [
        "import { Button as ButtonPrimitive } from '@zeus-web/button/react'",
        "import { cn } from '@/lib/cn'",
        'export function Button',
        '--zeus-primary',
      ],
    },
    {
      file: 'templates/react/input.tsx',
      source: reactInput,
      contains: [
        "import { Input as InputPrimitive } from '@zeus-web/input/react'",
        "import { cn } from '@/lib/cn'",
        'export function Input',
        '--zeus-input',
      ],
    },
    {
      file: 'templates/vue/button.vue',
      source: vueButton,
      contains: [
        "import { Button as ButtonPrimitive } from '@zeus-web/button/vue'",
        "import { cn } from '@/lib/cn'",
        '<ButtonPrimitive',
        '--zeus-primary',
      ],
    },
    {
      file: 'templates/vue/input.vue',
      source: vueInput,
      contains: [
        "import { Input as InputPrimitive } from '@zeus-web/input/vue'",
        "import { cn } from '@/lib/cn'",
        '<InputPrimitive',
        '--zeus-input',
      ],
    },
    {
      file: 'templates/lib/cn.ts',
      source: cn,
      contains: ['export function cn', 'ClassValue'],
    },
    {
      file: 'templates/css/globals.css',
      source: globals,
      contains: [
        ':root',
        '.dark',
        '--zeus-primary',
        '--zeus-destructive',
        '--zeus-radius-md',
      ],
    },
  ]

  for (const item of requiredTemplateContents) {
    for (const text of item.contains) {
      if (!item.source.includes(text)) {
        errors.push(`${item.file} must contain ${text}`)
      }
    }
  }
}

function main(): void {
  const errors: string[] = []

  if (!existsSync(packageRoot)) {
    errors.push('Missing packages/registry package')
  } else {
    for (const file of requiredFiles) {
      assertFileExists(file, errors)
    }

    if (errors.length === 0) {
      checkPackageJson(errors)

      const manifest = readJson<RegistryManifest>('registry.json')
      checkManifestShape(manifest, errors)
      checkComponentItems(manifest, errors)
      checkTemplateContents(errors)
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('@zeus-web/registry check failed:'))
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log(pc.green('@zeus-web/registry check passed.'))
}

main()
