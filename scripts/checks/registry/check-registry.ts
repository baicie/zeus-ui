import type { RegistryComponentSchemaManifest } from '../../../packages/registry/src/component-schema'
import type { ComponentQualityManifest } from '../../../packages/registry/src/quality'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

import { resolve } from 'node:path'

import pc from 'picocolors'
import { validateRegistryComponentSchema } from '../../../packages/registry/src/component-schema'
import { validateComponentQualityManifest } from '../../../packages/registry/src/quality'

type RegistryFramework = 'react' | 'vue' | 'native' | 'shared'
type RegistryItemType = 'component' | 'utility' | 'style'

interface RegistryFile {
  framework: RegistryFramework
  source: string
  target: string
}

interface RegistryItem {
  name: string
  type: RegistryItemType
  description: string
  frameworks: RegistryFramework[]
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

interface RegistryManifest {
  schemaVersion: number
  name: string
  version: string
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
  'quality.json',
  'components.json',
  'components.md',
  'templates/react/button.tsx',
  'templates/react/input.tsx',
  'templates/react/accordion.tsx',
  'templates/react/alert.tsx',
  'templates/react/avatar.tsx',
  'templates/react/badge.tsx',
  'templates/react/card.tsx',
  'templates/react/checkbox.tsx',
  'templates/react/collapsible.tsx',
  'templates/react/dialog.tsx',
  'templates/react/label.tsx',
  'templates/react/progress.tsx',
  'templates/react/radio-group.tsx',
  'templates/react/select.tsx',
  'templates/react/separator.tsx',
  'templates/react/skeleton.tsx',
  'templates/react/switch.tsx',
  'templates/react/tabs.tsx',
  'templates/react/textarea.tsx',
  'templates/react/tooltip.tsx',
  'templates/react/form-field.tsx',
  'templates/react/popover.tsx',
  'templates/react/dropdown-menu.tsx',
  'templates/react/toast.tsx',
  'templates/react/icon.tsx',
  'templates/vue/button.vue',
  'templates/vue/input.vue',
  'templates/vue/accordion.ts',
  'templates/vue/alert.ts',
  'templates/vue/avatar.ts',
  'templates/vue/badge.ts',
  'templates/vue/card.ts',
  'templates/vue/checkbox.ts',
  'templates/vue/collapsible.ts',
  'templates/vue/dialog.ts',
  'templates/vue/label.ts',
  'templates/vue/progress.ts',
  'templates/vue/radio-group.ts',
  'templates/vue/select.ts',
  'templates/vue/separator.ts',
  'templates/vue/skeleton.ts',
  'templates/vue/switch.ts',
  'templates/vue/tabs.ts',
  'templates/vue/textarea.ts',
  'templates/vue/tooltip.ts',
  'templates/vue/form-field.ts',
  'templates/vue/popover.ts',
  'templates/vue/dropdown-menu.ts',
  'templates/vue/toast.ts',
  'templates/vue/icon.ts',
  'templates/css/globals.css',
  'templates/lib/cn.ts',
  'scripts/copy-registry-assets.mjs',
  'scripts/generate-component-contracts.mjs',
  '__tests__/registry-package.spec.ts',
  'src/quality.ts',
  'src/component-schema.ts',
]

const requiredItemNames = [
  'cn',
  'globals',
  'button',
  'input',
  'accordion',
  'alert',
  'avatar',
  'badge',
  'card',
  'checkbox',
  'collapsible',
  'dialog',
  'label',
  'progress',
  'radio-group',
  'select',
  'separator',
  'skeleton',
  'switch',
  'tabs',
  'textarea',
  'tooltip',
  'form-field',
  'popover',
  'dropdown-menu',
  'toast',
  'icon',
]
const contractEnabledItemNames = ['button', 'input']

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
])

const forbiddenDependencies = ['clsx', 'tailwind-merge']

function isUnsafeRegistryPath(path: string): boolean {
  const segments = path.split(/[\\/]/)

  if (
    !path ||
    path.startsWith('/') ||
    path.startsWith('\\') ||
    segments.includes('') ||
    segments.some(segment => /^[A-Z]:/i.test(segment))
  ) {
    return true
  }

  return segments.includes('..')
}

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
    './quality',
    './quality.json',
    './components.json',
    './templates/react/*',
    './templates/vue/*',
    './templates/css/globals.css',
    './templates/lib/cn.ts',
  ]

  const packageExports = packageJson.exports || {}

  for (const exportName of requiredExports) {
    if (!packageExports[exportName]) {
      errors.push(`packages/registry/package.json missing export ${exportName}`)
    }
  }

  for (const exportName of Object.keys(packageExports)) {
    if (!requiredExports.includes(exportName)) {
      errors.push(
        `packages/registry/package.json has unexpected beta.0 export ${exportName}`,
      )
    }
  }

  for (const script of ['build', 'check', 'test']) {
    if (!packageJson.scripts?.[script]) {
      errors.push(`packages/registry/package.json missing script ${script}`)
    }
  }
}

function checkQualityManifest(errors: string[]): void {
  const manifest = readJson<ComponentQualityManifest>('quality.json')
  const componentNames = readdirSync(resolve(root, 'packages/primitives'), {
    withFileTypes: true,
  })
    .filter(
      entry =>
        entry.isDirectory() &&
        existsSync(
          resolve(root, 'packages/primitives', entry.name, 'package.json'),
        ),
    )
    .map(entry => entry.name)
  const validation = validateComponentQualityManifest(manifest, componentNames)

  for (const error of validation.errors) {
    errors.push(`quality.json: ${error}`)
  }

  for (const component of manifest.components) {
    if (!component.evidence || typeof component.evidence !== 'object') {
      continue
    }

    for (const category of ['behavior', 'accessibility', 'endToEnd'] as const) {
      const evidencePaths = component.evidence[category]

      if (!Array.isArray(evidencePaths)) continue

      for (const evidencePath of evidencePaths) {
        if (!existsSync(resolve(root, evidencePath))) {
          errors.push(
            `${component.name}: missing ${category} evidence ${evidencePath}`,
          )
        }
      }
    }
  }
}

function checkComponentSchema(errors: string[]): void {
  const componentSchema =
    readJson<RegistryComponentSchemaManifest>('components.json')
  const result = validateRegistryComponentSchema(componentSchema)
  for (const error of result.errors) {
    errors.push(`components.json: ${error}`)
  }

  if (!Array.isArray(componentSchema.components)) {
    return
  }

  const registry = readJson<RegistryManifest>('registry.json')
  const registryNames = new Set(
    registry.items
      .filter(item => item.type === 'component')
      .map(item => item.name),
  )
  const schemaNames = new Set(componentSchema.components.map(item => item.name))

  for (const name of contractEnabledItemNames) {
    if (registryNames.has(name) && !schemaNames.has(name)) {
      errors.push(`components.json missing contract-enabled component ${name}`)
    }
  }
  for (const name of schemaNames) {
    if (!registryNames.has(name)) {
      errors.push(`components.json includes unregistered component ${name}`)
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
      if (!allowedFrameworks.has(file.framework)) {
        errors.push(`${item.name}: invalid file framework ${file.framework}`)
      }

      if (
        !file.source.startsWith('templates/') ||
        isUnsafeRegistryPath(file.source)
      ) {
        errors.push(`${item.name}: unsafe file source ${file.source}`)
      }

      if (isUnsafeRegistryPath(file.target)) {
        errors.push(`${item.name}: unsafe file target ${file.target}`)
      }

      if (!existsSync(resolve(packageRoot, file.source))) {
        errors.push(`${item.name}: missing template ${file.source}`)
      }
    }
  }

  for (const requiredName of requiredItemNames) {
    if (!names.has(requiredName)) {
      errors.push(`registry.json missing required item ${requiredName}`)
    }
  }

  for (const name of names) {
    if (!requiredItemNames.includes(name)) {
      errors.push(`registry.json has unexpected beta.0 item ${name}`)
    }
  }

  for (const item of manifest.items) {
    for (const dependency of item.registryDependencies) {
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
    if (!button.dependencies.includes('@zeus-web/button')) {
      errors.push('button item must depend on @zeus-web/button')
    }

    if (!button.registryDependencies.includes('cn')) {
      errors.push('button item must depend on registry item cn')
    }

    if (!button.registryDependencies.includes('globals')) {
      errors.push('button item must depend on registry item globals')
    }
  }

  if (!input) {
    errors.push('registry missing input item')
  } else {
    if (!input.dependencies.includes('@zeus-web/input')) {
      errors.push('input item must depend on @zeus-web/input')
    }

    if (!input.registryDependencies.includes('cn')) {
      errors.push('input item must depend on registry item cn')
    }

    if (!input.registryDependencies.includes('globals')) {
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
      file: 'templates/react/dialog.tsx',
      source: read('templates/react/dialog.tsx'),
      contains: [
        'import {\n  DialogClose as DialogClosePrimitive',
        'DialogContent',
        'bg-background',
      ],
    },
    {
      file: 'templates/react/tabs.tsx',
      source: read('templates/react/tabs.tsx'),
      contains: ['TabsList', 'TabsTrigger', 'TabsContent'],
    },
    {
      file: 'templates/react/checkbox.tsx',
      source: read('templates/react/checkbox.tsx'),
      contains: ['data-slot=checkbox-control', 'indeterminate'],
    },
    {
      file: 'templates/react/switch.tsx',
      source: read('templates/react/switch.tsx'),
      contains: ['data-slot=switch-track', 'data-slot=switch-thumb'],
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
      file: 'templates/vue/dialog.ts',
      source: read('templates/vue/dialog.ts'),
      contains: [
        "from '@zeus-web/dialog/vue'",
        'export const DialogContent',
        'export const DialogClose',
      ],
    },
    {
      file: 'templates/vue/tabs.ts',
      source: read('templates/vue/tabs.ts'),
      contains: ['export const TabsList', 'export const TabsTrigger'],
    },
    {
      file: 'templates/vue/checkbox.ts',
      source: read('templates/vue/checkbox.ts'),
      contains: ["from '@zeus-web/checkbox/vue'", 'data-slot=checkbox-control'],
    },
    {
      file: 'templates/vue/switch.ts',
      source: read('templates/vue/switch.ts'),
      contains: ["from '@zeus-web/switch/vue'", 'data-slot=switch-track'],
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

function checkForbiddenDependencies(
  manifest: RegistryManifest,
  errors: string[],
): void {
  for (const item of manifest.items) {
    for (const dependency of item.dependencies) {
      if (forbiddenDependencies.includes(dependency)) {
        errors.push(
          `${item.name}: ${dependency} is not used by Phase 17 templates`,
        )
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
      checkForbiddenDependencies(manifest, errors)
      checkQualityManifest(errors)
      checkComponentSchema(errors)
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
