import type { AuthorDiagnostic } from './author'

export type RegistryFramework = 'react' | 'vue' | 'native' | 'shared'

export type RegistryItemType = 'component' | 'utility' | 'style'

export interface RegistryFile {
  framework: RegistryFramework
  source: string
  target: string
}

export type RegistryItemFile = RegistryFile

export interface RegistryAuthor {
  name: string
  url?: string
  email?: string
}

export interface RegistryItem {
  name: string
  type: RegistryItemType
  description: string
  frameworks: RegistryFramework[]
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

/**
 * Registry manifest format.
 *
 * Version 2 is the only accepted format. Compared with version 1 it adds the
 * provenance fields a third-party author must publish (`license`, `authors`)
 * so consumers can audit where a registry comes from. Version 1 manifests are
 * rejected with an explicit error instead of being upgraded silently.
 */
export interface RegistryManifest {
  schemaVersion: 2
  name: string
  version: string
  license: string
  authors: RegistryAuthor[]
  items: RegistryItem[]
}

export type Registry = RegistryManifest

export interface RegistryValidationResult {
  valid: boolean
  errors: string[]
  diagnostics: AuthorDiagnostic[]
}

const supportedSchemaVersion = 2

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

/**
 * Shape check for SPDX license identifiers (`MIT`, `Apache-2.0`,
 * `GPL-3.0-only`, `BlueOak-1.0.0`, …). This is deliberately a shape check:
 * the CLI does not ship an SPDX license list.
 */
const spdxLicensePattern = /^[A-Z0-9.+:-]+$/i

const httpUrlPattern = /^https?:\/\/\S+$/i

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

function createError(
  diagnostics: AuthorDiagnostic[],
  path: string,
  message: string,
): void {
  diagnostics.push({ code: 'ZEUS_REGISTRY_INVALID', path, message })
}

/**
 * Validates a registry manifest and returns both a flat `errors` list (for
 * CLI rendering) and structured `diagnostics` with JSON paths (for tooling).
 *
 * An unknown `schemaVersion` is a hard error. There is no implicit upgrade:
 * authors must migrate the manifest and bump the version themselves.
 */
export function validateRegistry(registry: Registry): RegistryValidationResult {
  const diagnostics: AuthorDiagnostic[] = []
  const itemNames = new Set<string>()

  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    createError(diagnostics, 'registry', 'registry must be an object')
    return { valid: false, errors: messageList(diagnostics), diagnostics }
  }

  const version = (registry as { schemaVersion?: unknown }).schemaVersion
  if (version !== supportedSchemaVersion) {
    createError(
      diagnostics,
      'schemaVersion',
      `registry.schemaVersion must be ${supportedSchemaVersion}; ${formatRegistryValue(version)} is not supported. Migrate the manifest and set schemaVersion to ${supportedSchemaVersion}.`,
    )
  }

  if (
    typeof registry.name !== 'string' ||
    !/^(?:@\w[\w.-]*\/)?\w[\w.-]*$/.test(registry.name)
  ) {
    createError(
      diagnostics,
      'name',
      'registry.name must be a valid package-like name',
    )
  }

  if (typeof registry.version !== 'string' || !registry.version) {
    createError(diagnostics, 'version', 'registry.version is required')
  }

  if (
    typeof registry.license !== 'string' ||
    !spdxLicensePattern.test(registry.license)
  ) {
    createError(
      diagnostics,
      'license',
      'registry.license must be an SPDX license identifier',
    )
  }

  validateAuthors(registry.authors, diagnostics)

  if (!Array.isArray(registry.items)) {
    createError(diagnostics, 'items', 'registry.items must be an array')
    return { valid: false, errors: messageList(diagnostics), diagnostics }
  }

  for (let index = 0; index < registry.items.length; index += 1) {
    const item = registry.items[index]
    const path = `items[${index}]`

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      createError(diagnostics, path, 'registry items must be objects')
      continue
    }

    if (!isRegistryItemName(item.name)) {
      createError(
        diagnostics,
        `${path}.name`,
        `registry item name must be a safe identifier: ${formatRegistryValue(item.name)}`,
      )
    } else {
      if (itemNames.has(item.name)) {
        createError(
          diagnostics,
          `${path}.name`,
          `duplicated registry item: ${item.name}`,
        )
      }
      itemNames.add(item.name)
    }
    const itemLabel = formatRegistryValue(item.name)

    if (!allowedTypes.has(item.type)) {
      createError(
        diagnostics,
        `${path}.type`,
        `registry item ${itemLabel} has invalid type: ${formatRegistryValue(item.type)}`,
      )
    }

    if (typeof item.description !== 'string' || !item.description) {
      createError(
        diagnostics,
        `${path}.description`,
        `registry item ${itemLabel} description is required`,
      )
    }

    if (!Array.isArray(item.frameworks) || item.frameworks.length === 0) {
      createError(
        diagnostics,
        `${path}.frameworks`,
        `registry item ${itemLabel} frameworks must be non-empty`,
      )
    } else {
      for (
        let frameworkIndex = 0;
        frameworkIndex < item.frameworks.length;
        frameworkIndex += 1
      ) {
        const framework = item.frameworks[frameworkIndex]
        if (!allowedFrameworks.has(framework)) {
          createError(
            diagnostics,
            `${path}.frameworks[${frameworkIndex}]`,
            `registry item ${itemLabel} has invalid framework: ${formatRegistryValue(framework)}`,
          )
        }
      }
    }

    if (!Array.isArray(item.dependencies)) {
      createError(
        diagnostics,
        `${path}.dependencies`,
        `registry item ${itemLabel} dependencies must be an array`,
      )
    } else {
      for (
        let dependencyIndex = 0;
        dependencyIndex < item.dependencies.length;
        dependencyIndex += 1
      ) {
        const dependency = item.dependencies[dependencyIndex]
        if (!isSafeDependencySpec(dependency)) {
          createError(
            diagnostics,
            `${path}.dependencies[${dependencyIndex}]`,
            `registry item ${itemLabel} has unsafe dependency: ${formatRegistryValue(dependency)}`,
          )
        }
      }
    }

    if (!Array.isArray(item.registryDependencies)) {
      createError(
        diagnostics,
        `${path}.registryDependencies`,
        `registry item ${itemLabel} registryDependencies must be an array`,
      )
    } else {
      for (
        let dependencyIndex = 0;
        dependencyIndex < item.registryDependencies.length;
        dependencyIndex += 1
      ) {
        const dependency = item.registryDependencies[dependencyIndex]
        if (!isRegistryItemName(dependency)) {
          createError(
            diagnostics,
            `${path}.registryDependencies[${dependencyIndex}]`,
            `registry item ${itemLabel} has unsafe registry dependency: ${formatRegistryValue(dependency)}`,
          )
        }
      }
    }

    if (!Array.isArray(item.files) || item.files.length === 0) {
      createError(
        diagnostics,
        `${path}.files`,
        `registry item ${itemLabel} must include files`,
      )
      continue
    }

    for (let fileIndex = 0; fileIndex < item.files.length; fileIndex += 1) {
      const file = item.files[fileIndex]
      const filePath = `${path}.files[${fileIndex}]`

      if (!file || typeof file !== 'object' || Array.isArray(file)) {
        createError(
          diagnostics,
          filePath,
          `registry item ${itemLabel} has invalid file entry`,
        )
        continue
      }

      if (!allowedFrameworks.has(file.framework)) {
        createError(
          diagnostics,
          `${filePath}.framework`,
          `registry item ${itemLabel} has invalid file framework: ${formatRegistryValue(file.framework)}`,
        )
      }

      if (
        typeof file.source !== 'string' ||
        !file.source.startsWith('templates/') ||
        isUnsafeRegistryPath(file.source)
      ) {
        createError(
          diagnostics,
          `${filePath}.source`,
          `registry item ${itemLabel} has unsafe file source: ${formatRegistryValue(file.source)}`,
        )
      }

      if (
        typeof file.target !== 'string' ||
        isUnsafeRegistryPath(file.target)
      ) {
        createError(
          diagnostics,
          `${filePath}.target`,
          `registry item ${itemLabel} has unsafe file target: ${formatRegistryValue(file.target)}`,
        )
      }
    }
  }

  for (let index = 0; index < registry.items.length; index += 1) {
    const item = registry.items[index]
    if (
      !item ||
      typeof item !== 'object' ||
      !Array.isArray(item.registryDependencies)
    ) {
      continue
    }
    for (
      let dependencyIndex = 0;
      dependencyIndex < item.registryDependencies.length;
      dependencyIndex += 1
    ) {
      const dependency = item.registryDependencies[dependencyIndex]
      if (isRegistryItemName(dependency) && !itemNames.has(dependency)) {
        createError(
          diagnostics,
          `items[${index}].registryDependencies[${dependencyIndex}]`,
          `registry item "${item.name}" references missing registry dependency: ${dependency}`,
        )
      }
    }
  }

  return {
    valid: diagnostics.length === 0,
    errors: messageList(diagnostics),
    diagnostics,
  }
}

function validateAuthors(
  authors: unknown,
  diagnostics: AuthorDiagnostic[],
): void {
  if (!Array.isArray(authors) || authors.length === 0) {
    createError(
      diagnostics,
      'authors',
      'registry.authors must contain at least one author',
    )
    return
  }

  for (let index = 0; index < authors.length; index += 1) {
    const author = authors[index]
    const path = `authors[${index}]`

    if (!author || typeof author !== 'object' || Array.isArray(author)) {
      createError(diagnostics, path, 'registry author must be an object')
      continue
    }

    const record = author as Record<string, unknown>
    if (typeof record.name !== 'string' || !record.name) {
      createError(
        diagnostics,
        `${path}.name`,
        'registry author name is required',
      )
    }

    if (record.url !== undefined && !httpUrlPattern.test(String(record.url))) {
      createError(
        diagnostics,
        `${path}.url`,
        'registry author url must be an http(s) URL',
      )
    }

    if (
      record.email !== undefined &&
      (typeof record.email !== 'string' || !record.email.includes('@'))
    ) {
      createError(
        diagnostics,
        `${path}.email`,
        'registry author email is invalid',
      )
    }
  }
}

function messageList(diagnostics: AuthorDiagnostic[]): string[] {
  return diagnostics.map(diagnostic => {
    const nested =
      diagnostic.path.startsWith('items[') ||
      diagnostic.path.startsWith('authors[')
    return nested
      ? `${diagnostic.path}: ${diagnostic.message}`
      : diagnostic.message
  })
}
