import type {
  Registry,
  RegistryItem,
  RegistryItemFile,
} from '@zeus-web/registry'

import { createRequire } from 'node:module'
import { validateRegistry } from '@zeus-web/registry'
import pc from 'picocolors'

export interface RegistryFilePlan {
  source: string
  target: string
  type: 'registry:ui' | 'registry:lib' | 'registry:style'
}

export interface AddPlan {
  component: string
  dependencies: string[]
  devDependencies: string[]
  files: RegistryFilePlan[]
}

const require = createRequire(import.meta.url)

function loadRegistry(): Registry {
  const registry = require('@zeus-web/registry/registry.json') as Registry
  const result = validateRegistry(registry)

  if (!result.valid) {
    throw new Error(
      [
        'Invalid @zeus-web/registry/registry.json:',
        ...result.errors.map(error => `- ${error}`),
      ].join('\n'),
    )
  }

  return registry
}

function toFilePlan(file: RegistryItemFile): RegistryFilePlan {
  return {
    source: file.path,
    target: file.target,
    type: file.type,
  }
}

function toAddPlan(item: RegistryItem): AddPlan {
  return {
    component: item.name,
    dependencies: item.dependencies ?? [],
    devDependencies: item.devDependencies ?? [],
    files: item.files.map(toFilePlan),
  }
}

function findRegistryItem(registry: Registry, component: string): RegistryItem {
  const item = registry.items.find(entry => entry.name === component)

  if (!item) {
    throw new Error(`Unknown component: ${component}`)
  }

  return item
}

export function listAvailableComponents(registry = loadRegistry()): string[] {
  const result = validateRegistry(registry)

  if (!result.valid) {
    throw new Error(
      [
        'Invalid @zeus-web/registry/registry.json:',
        ...result.errors.map(error => `- ${error}`),
      ].join('\n'),
    )
  }

  return registry.items
    .filter(item => item.type === 'registry:ui')
    .map(item => item.name)
}

export function createAddPlan(
  components: string[],
  registry = loadRegistry(),
): AddPlan[] {
  const result = validateRegistry(registry)

  if (!result.valid) {
    throw new Error(
      [
        'Invalid @zeus-web/registry/registry.json:',
        ...result.errors.map(error => `- ${error}`),
      ].join('\n'),
    )
  }

  return components.map(component => {
    const item = findRegistryItem(registry, component)
    return toAddPlan(item)
  })
}

export async function add(args: string[]) {
  const components = args.filter(Boolean)

  if (components.length === 0) {
    console.error(pc.red('Please provide at least one component.'))
    console.log(`Example: zweb add ${listAvailableComponents().join(' ')}`)
    process.exit(1)
  }

  try {
    const plans = createAddPlan(components)

    for (const plan of plans) {
      console.log(pc.green(`Add ${plan.component}`))

      if (plan.dependencies.length > 0) {
        console.log(`Dependencies: ${plan.dependencies.join(', ')}`)
      }

      if (plan.devDependencies.length > 0) {
        console.log(`Dev dependencies: ${plan.devDependencies.join(', ')}`)
      }

      console.log('Files:')

      for (const file of plan.files) {
        console.log(`  ${file.source} -> ${file.target}`)
      }
    }

    console.log(
      pc.gray(
        'Phase 5 only prints add plan. Phase 6 will copy files and install dependencies.',
      ),
    )
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
