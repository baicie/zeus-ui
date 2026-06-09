import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pc from 'picocolors'

import { aiMetadata } from '../../packages/ai/src/metadata'

export interface RegistryItem {
  name: string
  type: string
  dependencies?: string[]
  files?: Array<{
    path: string
    target: string
    type: string
  }>
}

export interface Registry {
  items: RegistryItem[]
}

export interface AiComponentLike {
  name: string
  primitivePackage?: string
  sourceTarget?: string
  dependencies?: string[]
}

export interface CoverageResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  primitiveNames: string[]
  registryNames: string[]
  aiNames: string[]
  deferredNames: string[]
}

const deferredOverlayComponents = ['popover', 'dropdown', 'toast'] as const

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf-8')) as T
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
      continue
    }

    seen.add(value)
  }

  return Array.from(duplicates).sort()
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

function getAiComponents(): AiComponentLike[] {
  return aiMetadata.components as AiComponentLike[]
}

function getAiNames(): string[] {
  return getAiComponents()
    .map(component => component.name)
    .sort()
}

function includesPackageDependency(item: RegistryItem): boolean {
  const expected = `@zeus-web/${item.name}`

  return item.dependencies?.includes(expected) ?? false
}

function includesUiTarget(item: RegistryItem): boolean {
  const expected = `components/ui/${item.name}.tsx`

  return item.files?.some(file => file.target === expected) ?? false
}

function registryFileExists(root: string, filePath: string): boolean {
  return existsSync(resolve(root, 'packages/registry', filePath))
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort()
}

function pushDuplicateErrors(
  errors: string[],
  label: string,
  names: string[],
): void {
  for (const name of findDuplicates(names)) {
    errors.push(`${label} has duplicate component name "${name}"`)
  }
}

function checkRegistryFiles(
  root: string,
  item: RegistryItem,
  errors: string[],
): void {
  if (!item.files || item.files.length === 0) {
    errors.push(`registry item "${item.name}" must declare files`)
    return
  }

  for (const file of item.files) {
    if (!registryFileExists(root, file.path)) {
      errors.push(
        `registry item "${item.name}" references missing file "${file.path}"`,
      )
    }
  }
}

function checkAiComponent(component: AiComponentLike, errors: string[]): void {
  const expectedPackage = `@zeus-web/${component.name}`
  const expectedSourceTarget = `components/ui/${component.name}.tsx`

  if (component.primitivePackage !== expectedPackage) {
    errors.push(
      `AI metadata component "${component.name}" must use primitivePackage "${expectedPackage}"`,
    )
  }

  if (component.sourceTarget !== expectedSourceTarget) {
    errors.push(
      `AI metadata component "${component.name}" must use sourceTarget "${expectedSourceTarget}"`,
    )
  }

  if (!component.dependencies?.includes(expectedPackage)) {
    errors.push(
      `AI metadata component "${component.name}" must depend on "${expectedPackage}"`,
    )
  }
}

export function checkComponentCoverage(root = process.cwd()): CoverageResult {
  const primitiveNames = readPrimitiveNames(root)
  const registry = readRegistry(root)
  const registryItems = getRegistryUiItems(registry)
  const registryNames = getRegistryNames(registry)
  const aiComponents = getAiComponents()
  const aiNames = getAiNames()

  const primitiveNameSet = new Set(primitiveNames)
  const registryNameSet = new Set(registryNames)
  const aiNameSet = new Set(aiNames)

  const errors: string[] = []
  const warnings: string[] = []

  pushDuplicateErrors(errors, 'primitives', primitiveNames)
  pushDuplicateErrors(errors, 'registry', registryNames)
  pushDuplicateErrors(errors, 'AI metadata', aiNames)

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

    checkRegistryFiles(root, item, errors)
  }

  for (const component of aiComponents) {
    const name = component.name

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

    checkAiComponent(component, errors)
  }

  for (const name of primitiveNames) {
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
