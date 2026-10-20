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

const reservedItemNames = new Set(['__proto__', 'constructor', 'prototype'])

function isRegistryItemName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-z0-9][\w.-]*$/i.test(value) &&
    !reservedItemNames.has(value)
  )
}

function isSafeDependencySpec(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.startsWith('-') &&
    !/[\s\0]/.test(value)
  )
}

function formatRegistryValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  try {
    return JSON.stringify(value) ?? typeof value
  } catch {
    return '[unserializable value]'
  }
}

function isUnsafeRegistryPath(path: string): boolean {
  const segments = path.split(/[\\/]/)

  if (
    !path ||
    path.includes('\0') ||
    path.startsWith('/') ||
    path.startsWith('\\') ||
    segments.includes('') ||
    segments.includes('.') ||
    segments.some(segment => segment.endsWith('.') || segment.endsWith(' ')) ||
    segments.some(segment => /^[A-Z]:/i.test(segment))
  ) {
    return true
  }

  return segments.includes('..')
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

  if (
    typeof registry.name !== 'string' ||
    !/^(?:@\w[\w.-]*\/)?\w[\w.-]*$/.test(registry.name)
  ) {
    errors.push('registry.name must be a valid package-like name')
  }

  if (!Array.isArray(registry.items)) {
    errors.push('registry.items must be an array')
    return { valid: false, errors }
  }

  for (const item of registry.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push('registry items must be objects')
      continue
    }

    if (!isRegistryItemName(item.name)) {
      errors.push(
        `registry item name must be a safe identifier: ${formatRegistryValue(item.name)}`,
      )
    } else {
      if (itemNames.has(item.name)) {
        errors.push(`duplicated registry item: ${item.name}`)
      }
      itemNames.add(item.name)
    }
    const itemLabel = formatRegistryValue(item.name)

    if (!allowedTypes.has(item.type)) {
      errors.push(
        `registry item ${itemLabel} has invalid type: ${formatRegistryValue(item.type)}`,
      )
    }

    if (typeof item.description !== 'string' || !item.description) {
      errors.push(`registry item ${itemLabel} description is required`)
    }

    if (!Array.isArray(item.frameworks) || item.frameworks.length === 0) {
      errors.push(`registry item ${itemLabel} frameworks must be non-empty`)
    } else {
      for (const framework of item.frameworks) {
        if (!allowedFrameworks.has(framework)) {
          errors.push(
            `registry item ${itemLabel} has invalid framework: ${formatRegistryValue(framework)}`,
          )
        }
      }
    }

    if (!Array.isArray(item.dependencies)) {
      errors.push(`registry item ${itemLabel} dependencies must be an array`)
    } else {
      for (const dependency of item.dependencies) {
        if (!isSafeDependencySpec(dependency)) {
          errors.push(
            `registry item ${itemLabel} has unsafe dependency: ${formatRegistryValue(dependency)}`,
          )
        }
      }
    }

    if (!Array.isArray(item.registryDependencies)) {
      errors.push(
        `registry item ${itemLabel} registryDependencies must be an array`,
      )
    } else {
      for (const dependency of item.registryDependencies) {
        if (!isRegistryItemName(dependency)) {
          errors.push(
            `registry item ${itemLabel} has unsafe registry dependency: ${formatRegistryValue(dependency)}`,
          )
        }
      }
    }

    if (!Array.isArray(item.files) || item.files.length === 0) {
      errors.push(`registry item ${itemLabel} must include files`)
      continue
    }

    for (const file of item.files) {
      if (!file || typeof file !== 'object' || Array.isArray(file)) {
        errors.push(`registry item ${itemLabel} has invalid file entry`)
        continue
      }

      if (!allowedFrameworks.has(file.framework)) {
        errors.push(
          `registry item ${itemLabel} has invalid file framework: ${formatRegistryValue(file.framework)}`,
        )
      }

      if (
        typeof file.source !== 'string' ||
        !file.source.startsWith('templates/') ||
        isUnsafeRegistryPath(file.source)
      ) {
        errors.push(
          `registry item ${itemLabel} has unsafe file source: ${formatRegistryValue(file.source)}`,
        )
      }

      if (
        typeof file.target !== 'string' ||
        isUnsafeRegistryPath(file.target)
      ) {
        errors.push(
          `registry item ${itemLabel} has unsafe file target: ${formatRegistryValue(file.target)}`,
        )
      }
    }
  }

  for (const item of registry.items) {
    if (
      !item ||
      typeof item !== 'object' ||
      !Array.isArray(item.registryDependencies)
    ) {
      continue
    }
    for (const dependency of item.registryDependencies) {
      if (isRegistryItemName(dependency) && !itemNames.has(dependency)) {
        errors.push(
          `registry item "${item.name}" references missing registry dependency: ${dependency}`,
        )
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
