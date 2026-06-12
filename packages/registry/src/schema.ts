export type RegistryFramework = 'react' | 'vue' | 'native' | 'shared'

export type RegistryItemType =
  | 'component'
  | 'utility'
  | 'style'
  | 'registry:ui'
  | 'registry:lib'
  | 'registry:style'

export interface RegistryFile {
  framework?: RegistryFramework
  source?: string
  path?: string
  target: string
  type?: string
}

export type RegistryItemFile = RegistryFile

export interface RegistryItem {
  name: string
  type: RegistryItemType
  description?: string
  frameworks?: RegistryFramework[]
  dependencies?: string[]
  devDependencies?: string[]
  registryDependencies?: string[]
  files: RegistryFile[]
}

export interface RegistryManifest {
  $schema?: string
  schemaVersion?: number
  name: string
  version?: string
  homepage?: string
  items: RegistryItem[]
}

export type Registry = RegistryManifest

export interface RegistryValidationResult {
  valid: boolean
  errors: string[]
}

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
  return (item.registryDependencies ?? [])
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

    if (!item.type) {
      errors.push(`registry item "${item.name}" type is required`)
    }

    if (!Array.isArray(item.files) || item.files.length === 0) {
      errors.push(`registry item "${item.name}" must include files`)
    }

    for (const file of item.files ?? []) {
      if (!file.target) {
        errors.push(`registry item "${item.name}" has file without target`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
