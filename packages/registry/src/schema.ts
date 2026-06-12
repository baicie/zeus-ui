export type RegistryFramework = 'react' | 'vue' | 'native' | 'shared'

export type RegistryItemType = 'component' | 'utility' | 'style'

export interface RegistryFile {
  framework: RegistryFramework
  source: string
  target: string
}

export type RegistryItemFile = RegistryFile

export interface RegistryItem {
  name: string
  type: RegistryItemType
  description: string
  frameworks: RegistryFramework[]
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

export interface RegistryManifest {
  schemaVersion: 1
  name: string
  version: string
  items: RegistryItem[]
}

export type Registry = RegistryManifest

export interface RegistryValidationResult {
  valid: boolean
  errors: string[]
}

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

export function findRegistryItem(
  manifest: RegistryManifest,
  name: string,
): RegistryItem | undefined {
  return manifest.items.find(item => item.name === name)
}

export function getRegistryItemNames(manifest: RegistryManifest): string[] {
  return manifest.items.map(item => item.name)
}

export function getRegistryDependencies(
  manifest: RegistryManifest,
  item: RegistryItem,
): RegistryItem[] {
  return item.registryDependencies
    .map(name => findRegistryItem(manifest, name))
    .filter((dependency): dependency is RegistryItem => Boolean(dependency))
}

export function getRegistryFilesForFramework(
  item: RegistryItem,
  framework: RegistryFramework,
): RegistryFile[] {
  return item.files.filter(
    file => file.framework === framework || file.framework === 'shared',
  )
}

export function validateRegistry(registry: Registry): RegistryValidationResult {
  const errors: string[] = []
  const itemNames = new Set<string>()

  if (registry.schemaVersion !== 1) {
    errors.push('registry.schemaVersion must be 1')
  }

  if (registry.name !== '@zeus-web/registry') {
    errors.push('registry.name must be @zeus-web/registry')
  }

  if (!Array.isArray(registry.items)) {
    errors.push('registry.items must be an array')
    return { valid: false, errors }
  }

  for (const item of registry.items) {
    if (!item.name) {
      errors.push('registry item name is required')
      continue
    }

    if (itemNames.has(item.name)) {
      errors.push(`duplicated registry item: ${item.name}`)
    }

    itemNames.add(item.name)

    if (!allowedTypes.has(item.type)) {
      errors.push(`registry item "${item.name}" has invalid type: ${item.type}`)
    }

    if (!item.description) {
      errors.push(`registry item "${item.name}" description is required`)
    }

    if (!Array.isArray(item.frameworks) || item.frameworks.length === 0) {
      errors.push(`registry item "${item.name}" frameworks must be non-empty`)
    } else {
      for (const framework of item.frameworks) {
        if (!allowedFrameworks.has(framework)) {
          errors.push(
            `registry item "${item.name}" has invalid framework: ${framework}`,
          )
        }
      }
    }

    if (!Array.isArray(item.dependencies)) {
      errors.push(`registry item "${item.name}" dependencies must be an array`)
    }

    if (!Array.isArray(item.registryDependencies)) {
      errors.push(
        `registry item "${item.name}" registryDependencies must be an array`,
      )
    }

    if (!Array.isArray(item.files) || item.files.length === 0) {
      errors.push(`registry item "${item.name}" must include files`)
      continue
    }

    for (const file of item.files) {
      if (!allowedFrameworks.has(file.framework)) {
        errors.push(
          `registry item "${item.name}" has invalid file framework: ${file.framework}`,
        )
      }

      if (!file.source.startsWith('templates/')) {
        errors.push(
          `registry item "${item.name}" file source must start with templates/: ${file.source}`,
        )
      }

      if (
        !file.target ||
        file.target.startsWith('/') ||
        file.target.includes('..')
      ) {
        errors.push(
          `registry item "${item.name}" has unsafe file target: ${file.target}`,
        )
      }
    }
  }

  for (const item of registry.items) {
    for (const dependency of item.registryDependencies) {
      if (!itemNames.has(dependency)) {
        errors.push(
          `registry item "${item.name}" references missing registry dependency: ${dependency}`,
        )
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
