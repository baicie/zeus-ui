import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pc from 'picocolors'

import { aiMetadata } from '../../packages/ai/src/metadata'

interface RegistryItem {
  name: string
  type: string
  dependencies?: string[]
  files?: Array<{
    path: string
    target: string
    type: string
  }>
}

interface Registry {
  items: RegistryItem[]
}

interface CoverageResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  primitiveNames: string[]
  registryNames: string[]
  aiNames: string[]
  deferredNames: string[]
}

const deferredOverlayComponents = ['popover', 'dropdown', 'toast'] as const

const knownNonPrimitivePackages = new Set([
  'ai',
  'cli',
  'icons',
  'registry',
  'themes',
  'zeus-compat',
])

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf-8')) as T
}

function readPrimitiveNames(root: string): string[] {
  const primitivesRoot = resolve(root, 'packages/primitives')

  if (!existsSync(primitivesRoot)) {
    return []
  }

  const names: string[] = []

  for (const entry of readdirSync(primitivesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const packageJsonPath = resolve(primitivesRoot, entry.name, 'package.json')

    if (!existsSync(packageJsonPath)) continue

    const packageJson = readJson<{ name?: string }>(packageJsonPath)
    const name = packageJson.name?.replace(/^@zeus-web\//, '')

    if (!name) continue

    names.push(name)
  }

  return names.sort()
}

function readRegistry(root: string): Registry {
  const registryPath = resolve(root, 'packages/registry/registry.json')

  return readJson<Registry>(registryPath)
}

function getRegistryUiItems(registry: Registry): RegistryItem[] {
  return registry.items.filter(item => item.type === 'registry:ui')
}

function getRegistryNames(registry: Registry): string[] {
  return getRegistryUiItems(registry)
    .map(item => item.name)
    .sort()
}

function getAiNames(): string[] {
  return aiMetadata.components.map(component => component.name).sort()
}

function includesPackageDependency(item: RegistryItem): boolean {
  const expected = `@zeus-web/${item.name}`

  return item.dependencies?.includes(expected) ?? false
}

function includesUiTarget(item: RegistryItem): boolean {
  const expected = `components/ui/${item.name}.tsx`

  return item.files?.some(file => file.target === expected) ?? false
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort()
}

export function checkComponentCoverage(root = process.cwd()): CoverageResult {
  const primitiveNames = readPrimitiveNames(root)
  const registry = readRegistry(root)
  const registryItems = getRegistryUiItems(registry)
  const registryNames = getRegistryNames(registry)
  const aiNames = getAiNames()

  const primitiveNameSet = new Set(primitiveNames)
  const registryNameSet = new Set(registryNames)
  const aiNameSet = new Set(aiNames)

  const errors: string[] = []
  const warnings: string[] = []

  for (const item of registryItems) {
    if (!primitiveNameSet.has(item.name)) {
      errors.push(
        `registry item "${item.name}" has no matching primitive package`,
      )
    }

    if (!aiNameSet.has(item.name)) {
      errors.push(`registry item "${item.name}" has no matching AI metadata`)
    }

    if (!includesPackageDependency(item)) {
      errors.push(
        `registry item "${item.name}" must depend on @zeus-web/${item.name}`,
      )
    }

    if (!includesUiTarget(item)) {
      errors.push(
        `registry item "${item.name}" must target components/ui/${item.name}.tsx`,
      )
    }
  }

  for (const name of aiNames) {
    if (!registryNameSet.has(name)) {
      errors.push(
        `AI metadata component "${name}" has no matching registry item`,
      )
    }

    if (!primitiveNameSet.has(name)) {
      errors.push(
        `AI metadata component "${name}" has no matching primitive package`,
      )
    }
  }

  for (const name of primitiveNames) {
    if (knownNonPrimitivePackages.has(name)) continue

    if (!registryNameSet.has(name)) {
      warnings.push(
        `primitive "${name}" has no registry item; keep it only if it is intentionally headless-only`,
      )
    }

    if (!aiNameSet.has(name)) {
      warnings.push(
        `primitive "${name}" has no AI metadata; keep it only if it is intentionally internal`,
      )
    }
  }

  const deferredNames = unique([...deferredOverlayComponents])

  for (const name of deferredNames) {
    if (
      registryNameSet.has(name) ||
      primitiveNameSet.has(name) ||
      aiNameSet.has(name)
    ) {
      warnings.push(
        `deferred overlay component "${name}" already exists partially; finish primitive + registry + AI metadata before enabling it`,
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    primitiveNames,
    registryNames,
    aiNames,
    deferredNames,
  }
}

function printResult(result: CoverageResult): void {
  console.log(pc.bold('Zeus Web component coverage'))
  console.log('')
  console.log(`  primitives: ${pc.cyan(String(result.primitiveNames.length))}`)
  console.log(`  registry:   ${pc.cyan(String(result.registryNames.length))}`)
  console.log(`  AI:         ${pc.cyan(String(result.aiNames.length))}`)
  console.log(`  deferred:   ${pc.yellow(result.deferredNames.join(', '))}`)
  console.log('')

  for (const warning of result.warnings) {
    console.log(pc.yellow(`warning: ${warning}`))
  }

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(pc.red(`error: ${error}`))
    }
  }
}

async function main(): Promise<void> {
  const result = checkComponentCoverage()

  printResult(result)

  if (!result.valid) {
    process.exit(1)
  }

  console.log(pc.green('Component coverage check passed.'))
}

const currentFile = fileURLToPath(import.meta.url)
const entryFile = process.argv[1] ? resolve(process.argv[1]) : ''

if (currentFile === entryFile) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
