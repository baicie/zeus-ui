/**
 * Third-party component author contract.
 *
 * Everything here is a public contract: authors outside this repository use
 * these types and validators to check a component package or output plugin
 * before publishing. This module deliberately has no `@zeus-js/*` or Node
 * dependency, so a third-party package can depend on it without pulling in the
 * compiler or the DOM runtime.
 *
 * Contract versioning: `authorContractVersion` changes whenever the accepted
 * package shape or diagnostic set changes incompatibly. Beta policy is fail
 * fast: an unknown version is rejected, never silently downgraded.
 */

export interface AuthorDiagnostic {
  /** Stable diagnostic code. See the `ZEUS_AUTHOR_*` list below. */
  code: string
  /** JSON path inside the validated document, e.g. `exports["./wc/auto"]`. */
  path: string
  message: string
}

export interface AuthorValidationResult {
  valid: boolean
  diagnostics: AuthorDiagnostic[]
}

export interface AuthorPackageExport {
  types?: string
  import?: string
  default?: string
}

export interface AuthorPackageMetadata {
  kind: 'component-package' | 'output-plugin' | 'registry'
  contractVersion: number
  zeusVersion: string
  plugins: AuthorOutputPluginMetadata[]
}

export interface AuthorOutputPluginMetadata {
  id: string
  version: string
  apiVersion: number
  capabilities: string[]
  /** Artifact names the plugin owns. Two plugins may not own the same name. */
  outputs: string[]
  order: number
}

export interface AuthorPackageJson {
  name: string
  version: string
  type?: string
  exports?: Record<string, string | AuthorPackageExport>
  files?: string[]
  license?: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  zeus?: AuthorPackageMetadata
}

export interface AuthorPropManifest {
  type?: string
  attribute?: string
  attr?: string
  reflect?: boolean
  required?: boolean
  values?: string[]
  default?: string | number | boolean
  hasDefault?: boolean
}

export interface AuthorEventManifest {
  key?: string
  name: string
  reactName?: string
  vueName?: string
  detail?: Record<string, string>
  bubbles?: boolean
  composed?: boolean
  cancelable?: boolean
}

export interface AuthorSlotManifest {
  name: string
}

export interface AuthorComponentManifestEntry {
  tag: string
  name: string
  exportName?: string
  source?: string
  props?: Record<string, AuthorPropManifest>
  events?: Record<string, AuthorEventManifest>
  methods?: Record<string, unknown>
  slots?: Record<string, AuthorSlotManifest>
  hostAttributes?: string[]
  cssParts?: string[]
  cssVars?: Record<string, string>
  description?: string
  meta?: Record<string, unknown>
}

export interface AuthorComponentManifest {
  schemaVersion: number
  components: AuthorComponentManifestEntry[]
}

export interface AuthorCustomElementsManifest {
  schemaVersion: string | number
  modules: Array<{
    kind?: string
    path?: string
    declarations?: Array<Record<string, unknown>>
    exports?: Array<Record<string, unknown>>
  }>
}

export interface AuthorComponentPackageInput {
  packageJson: AuthorPackageJson
  manifest: AuthorComponentManifest
  customElements: AuthorCustomElementsManifest
  /**
   * Zeus runtime version the consumer resolves. When it differs from the
   * package's peer pin the package was built against another ABI.
   */
  expectedZeusVersion?: string
  /** Whether a package-relative export target exists on disk. */
  fileExists: (file: string) => boolean
}

export interface AuthorPluginMetadataInput {
  zeus?: AuthorPackageMetadata
}

/** Current author contract version. Bump only with a migration note. */
export const authorContractVersion = 1

/** Output plugin API version understood by the current Zeus bundler. */
export const pluginApiVersion = 1

/**
 * Zeus runtime baseline this contract is verified against. Used by the CLI
 * scaffold when no installed `@zeus-js/zeus` can be resolved.
 */
export const authorZeusBaselineVersion = '0.1.1-beta.20'

/** Tags starting with this prefix belong to Zeus Web packages. */
export const reservedTagPrefix = 'zw-'

const supportedComponentManifestSchema = 1
const supportedCustomElementsManifestSchema = '1.0.0'

const requiredExports = [
  '.',
  './wc/auto',
  './custom-elements.json',
  './zeus.components.json',
] as const

const wrapperExports = ['./react', './vue'] as const

const wrapperRuntimeDependencies = [
  '@zeus-js/output-react-wrapper',
  '@zeus-js/output-vue-wrapper',
] as const

const componentPackageRuntimeDependencies = [
  '@zeus-js/runtime-dom',
  '@zeus-js/web-c-runtime',
] as const

const customElementNamePattern = /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/
const packageNamePattern = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?(?:\+[0-9a-z.-]+)?$/i
const pluginIdPattern = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i
const outputNamePattern = /^[a-z0-9][a-z0-9._-]*$/

const reservedComponentNames = new Set([
  '__proto__',
  'constructor',
  'prototype',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return '[unserializable value]'
  }
}

function stripLeadingDotSlash(file: string): string {
  return file.startsWith('./') ? file.slice(2) : file
}

function exportTargets(
  value: string | AuthorPackageExport | undefined,
): string[] {
  if (typeof value === 'string') return [value]
  if (!value) return []
  const targets: string[] = []
  if (value.types) targets.push(value.types)
  if (value.import) targets.push(value.import)
  if (value.default) targets.push(value.default)
  return targets
}

function validatePackageExports(
  packageJson: AuthorPackageJson,
  fileExists: AuthorComponentPackageInput['fileExists'],
  diagnostics: AuthorDiagnostic[],
): void {
  const exportsField = isRecord(packageJson.exports) ? packageJson.exports : {}

  for (const name of requiredExports) {
    const value = exportsField[name] as string | AuthorPackageExport | undefined
    if (!value) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_PACKAGE_EXPORTS',
        path: `exports["${name}"]`,
        message: `Package export "${name}" is required.`,
      })
      continue
    }

    if (name === '.') {
      const root = value
      const rootTypes = typeof root === 'string' ? undefined : root.types
      const rootImport = typeof root === 'string' ? root : root.import
      if (!rootTypes || !rootImport) {
        diagnostics.push({
          code: 'ZEUS_AUTHOR_PACKAGE_EXPORTS',
          path: 'exports["."]',
          message:
            'Root export must declare both "types" and "import" WC entries.',
        })
        continue
      }
    }

    for (const target of exportTargets(value)) {
      if (!target.startsWith('./')) {
        diagnostics.push({
          code: 'ZEUS_AUTHOR_PACKAGE_EXPORTS',
          path: `exports["${name}"]`,
          message: `Export target must be package-relative, got ${formatValue(target)}.`,
        })
        continue
      }
      if (!fileExists(stripLeadingDotSlash(target))) {
        diagnostics.push({
          code: 'ZEUS_AUTHOR_FILE_MISSING',
          path: `exports["${name}"]`,
          message: `Export target ${target} does not exist in the packed package.`,
        })
      }
    }
  }

  for (const name of Object.keys(exportsField)) {
    if (!isNonEmptyString(name) || (!name.startsWith('./') && name !== '.')) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_PACKAGE_EXPORTS',
        path: `exports["${name}"]`,
        message: 'Export keys must be "." or start with "./".',
      })
    }
  }
}

function validateWrapperExports(
  packageJson: AuthorPackageJson,
  diagnostics: AuthorDiagnostic[],
): void {
  const exportsField = isRecord(packageJson.exports) ? packageJson.exports : {}
  const dependencies = {
    ...(packageJson.peerDependencies ?? {}),
    ...(packageJson.dependencies ?? {}),
  }

  for (const name of wrapperExports) {
    const value = exportsField[name] as string | AuthorPackageExport | undefined
    if (!value) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_WRAPPER_MISSING',
        path: `exports["${name}"]`,
        message: `Wrapper export "${name}" is required for third-party component packages.`,
      })
    }
  }

  const hasReactWrapper = Boolean(exportsField['./react'])
  const hasVueWrapper = Boolean(exportsField['./vue'])
  const requiredDependencies: string[] = [
    ...componentPackageRuntimeDependencies,
  ]
  if (hasReactWrapper) requiredDependencies.push(wrapperRuntimeDependencies[0])
  if (hasVueWrapper) requiredDependencies.push(wrapperRuntimeDependencies[1])

  for (const dependency of requiredDependencies) {
    if (!dependencies[dependency]) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_WRAPPER_MISSING',
        path: `dependencies["${dependency}"]`,
        message: `Generated wrappers/runtime need ${dependency} as a dependency.`,
      })
    }
  }
}

function validatePeerPin(
  packageJson: AuthorPackageJson,
  expectedZeusVersion: string | undefined,
  diagnostics: AuthorDiagnostic[],
): void {
  const peers = isRecord(packageJson.peerDependencies)
    ? packageJson.peerDependencies
    : {}
  const pinned = peers['@zeus-js/zeus']

  if (!isNonEmptyString(pinned) || !semverPattern.test(pinned)) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_PACKAGE_PEER',
      path: 'peerDependencies["@zeus-js/zeus"]',
      message:
        'Beta packages must pin an exact @zeus-js/zeus version in peerDependencies, not a range.',
    })
    return
  }

  if (expectedZeusVersion && pinned !== expectedZeusVersion) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_PACKAGE_VERSION_MISMATCH',
      path: 'peerDependencies["@zeus-js/zeus"]',
      message: `Package was built for Zeus ${pinned}, but the consumer resolves Zeus ${expectedZeusVersion}. Rebuild against the consumer version or install a matching package version.`,
    })
  }
}

function validateManifestTags(
  manifest: AuthorComponentManifest,
  diagnostics: AuthorDiagnostic[],
): void {
  if (
    !isRecord(manifest) ||
    manifest.schemaVersion !== supportedComponentManifestSchema
  ) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_MANIFEST_SCHEMA',
      path: 'zeus.components.json#schemaVersion',
      message: `Unsupported component manifest schemaVersion ${formatValue(manifest?.schemaVersion)}; expected ${supportedComponentManifestSchema}.`,
    })
  }
}

function validateComponents(
  manifest: AuthorComponentManifest,
  diagnostics: AuthorDiagnostic[],
): void {
  const components = Array.isArray(manifest.components)
    ? manifest.components
    : []

  if (components.length === 0) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_MANIFEST_EMPTY',
      path: 'components',
      message: 'Component manifest must declare at least one component.',
    })
    return
  }

  const tags = new Set<string>()

  for (let index = 0; index < components.length; index += 1) {
    const component = components[index]
    const path = `components[${index}]`

    if (!isRecord(component)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_META',
        path,
        message: 'Component entry must be an object.',
      })
      continue
    }

    const tag = component.tag
    if (!isNonEmptyString(tag) || !customElementNamePattern.test(tag)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_TAG',
        path: `${path}.tag`,
        message: `Custom element tag must be a valid kebab-case name, got ${formatValue(tag)}.`,
      })
    } else if (tag.startsWith(reservedTagPrefix)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_TAG',
        path: `${path}.tag`,
        message: `Tag "${tag}" uses the Zeus Web reserved prefix "${reservedTagPrefix}". Choose another prefix.`,
      })
    } else if (tags.has(tag)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_TAG',
        path: `${path}.tag`,
        message: `Duplicate custom element tag "${tag}".`,
      })
    }
    tags.add(tag)

    if (reservedComponentNames.has(component.name as string)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_META',
        path: `${path}.name`,
        message: `Component name ${formatValue(component.name)} is reserved.`,
      })
    }

    if (!isNonEmptyString(component.name)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_META',
        path: `${path}.name`,
        message: 'Component name is required.',
      })
    }

    validateEventDefinitions(component.events, `${path}.events`, diagnostics)
    validatePartDefinitions(component.cssParts, `${path}.cssParts`, diagnostics)
    validateSlotDefinitions(component.slots, `${path}.slots`, diagnostics)
    validateHostAttributes(
      component.hostAttributes,
      `${path}.hostAttributes`,
      diagnostics,
    )
  }
}

function validateEventDefinitions(
  events: unknown,
  path: string,
  diagnostics: AuthorDiagnostic[],
): void {
  if (events === undefined) return
  if (!isRecord(events)) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_MANIFEST_META',
      path,
      message: 'events must be an object keyed by event name.',
    })
    return
  }

  for (const [name, value] of Object.entries(events)) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_META',
        path: `${path}["${name}"]`,
        message: 'Event names must be kebab-case.',
      })
    }
    if (!isRecord(value) || !isNonEmptyString(value.name)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_META',
        path: `${path}["${name}"]`,
        message: 'Event entries need a name.',
      })
    }
  }
}

function validatePartDefinitions(
  parts: unknown,
  path: string,
  diagnostics: AuthorDiagnostic[],
): void {
  if (parts === undefined) return
  if (!Array.isArray(parts)) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_MANIFEST_META',
      path,
      message: 'cssParts must be an array.',
    })
    return
  }
  const seen = new Set<string>()
  for (const part of parts) {
    if (!isNonEmptyString(part) || !/^[a-z][a-z0-9-]*$/.test(part)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_META',
        path,
        message: `Invalid CSS part name ${formatValue(part)}.`,
      })
      continue
    }
    if (seen.has(part)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_META',
        path,
        message: `Duplicate CSS part "${part}".`,
      })
    }
    seen.add(part)
  }
}

function validateSlotDefinitions(
  slots: unknown,
  path: string,
  diagnostics: AuthorDiagnostic[],
): void {
  if (slots === undefined) return
  if (!isRecord(slots)) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_MANIFEST_META',
      path,
      message: 'slots must be an object keyed by slot name.',
    })
    return
  }
  for (const [name, value] of Object.entries(slots)) {
    if (!/^[a-z][a-z0-9-]*$/.test(name) && name !== 'default') {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_META',
        path: `${path}["${name}"]`,
        message: 'Slot names must be kebab-case or "default".',
      })
    }
    if (!isRecord(value) || value.name !== name) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_META',
        path: `${path}["${name}"]`,
        message: 'Slot entries must repeat their own name.',
      })
    }
  }
}

function validateHostAttributes(
  attributes: unknown,
  path: string,
  diagnostics: AuthorDiagnostic[],
): void {
  if (attributes === undefined) return
  if (!Array.isArray(attributes)) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_MANIFEST_META',
      path,
      message: 'hostAttributes must be an array.',
    })
    return
  }
  for (const attribute of attributes) {
    if (!isNonEmptyString(attribute)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_MANIFEST_META',
        path,
        message: `Host attribute name must be a string, got ${formatValue(attribute)}.`,
      })
    }
  }
}

function readCemDeclarations(
  customElements: AuthorCustomElementsManifest,
): Array<{ tag: string; declaration: Record<string, unknown> }> {
  const result: Array<{ tag: string; declaration: Record<string, unknown> }> =
    []
  const modules = Array.isArray(customElements.modules)
    ? customElements.modules
    : []
  for (const module of modules) {
    const declarations = Array.isArray(module.declarations)
      ? module.declarations
      : []
    for (const declaration of declarations) {
      if (
        isRecord(declaration) &&
        declaration.customElement === true &&
        isNonEmptyString(declaration.tagName)
      ) {
        result.push({ tag: declaration.tagName, declaration })
      }
    }
  }
  return result
}

function normalizeCemSlots(declaration: Record<string, unknown>): string[] {
  const slots = Array.isArray(declaration.slots) ? declaration.slots : []
  return slots
    .map(slot =>
      isRecord(slot) && typeof slot.name === 'string' ? slot.name : '',
    )
    .map(name => (name === '' ? 'default' : name))
    .sort()
}

function collectCemNames(
  declaration: Record<string, unknown>,
  field: 'events' | 'cssParts',
): string[] {
  const entries = Array.isArray(declaration[field]) ? declaration[field] : []
  return entries
    .map(entry =>
      isRecord(entry) && typeof entry.name === 'string' ? entry.name : '',
    )
    .filter(name => name.length > 0)
    .sort()
}

function validateCustomElementsManifest(
  manifest: AuthorComponentManifest,
  customElements: AuthorCustomElementsManifest,
  diagnostics: AuthorDiagnostic[],
): void {
  if (
    !isRecord(customElements) ||
    customElements.schemaVersion !== supportedCustomElementsManifestSchema
  ) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_CEM_SCHEMA',
      path: 'custom-elements.json#schemaVersion',
      message: `Unsupported Custom Elements Manifest schemaVersion ${formatValue(customElements?.schemaVersion)}; expected "${supportedCustomElementsManifestSchema}".`,
    })
    return
  }

  const declarations = readCemDeclarations(customElements)
  const components = Array.isArray(manifest.components)
    ? manifest.components
    : []

  for (const component of components) {
    if (!isRecord(component) || !isNonEmptyString(component.tag)) continue
    const entry = declarations.find(item => item.tag === component.tag)
    if (!entry) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_CEM_DRIFT',
        path: `custom-elements.json["${component.tag}"]`,
        message: `Custom Elements Manifest is missing a declaration for "${component.tag}".`,
      })
      continue
    }

    const manifestEvents = Object.keys(
      isRecord(component.events) ? component.events : {},
    ).sort()
    const cemEvents = collectCemNames(entry.declaration, 'events')
    if (manifestEvents.join(',') !== cemEvents.join(',')) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_CEM_DRIFT',
        path: `custom-elements.json["${component.tag}"].events`,
        message: `Event contract drifted: zeus.components.json declares [${manifestEvents.join(', ')}], custom-elements.json declares [${cemEvents.join(', ')}].`,
      })
    }

    const manifestParts = Array.isArray(component.cssParts)
      ? component.cssParts.slice().sort()
      : []
    const cemParts = collectCemNames(entry.declaration, 'cssParts')
    if (manifestParts.join(',') !== cemParts.join(',')) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_CEM_DRIFT',
        path: `custom-elements.json["${component.tag}"].cssParts`,
        message: `CSS part contract drifted: zeus.components.json declares [${manifestParts.join(', ')}], custom-elements.json declares [${cemParts.join(', ')}].`,
      })
    }

    const manifestSlots = Object.keys(
      isRecord(component.slots) ? component.slots : {},
    ).sort()
    const cemSlots = normalizeCemSlots(entry.declaration)
    if (manifestSlots.join(',') !== cemSlots.join(',')) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_CEM_DRIFT',
        path: `custom-elements.json["${component.tag}"].slots`,
        message: `Slot contract drifted: zeus.components.json declares [${manifestSlots.join(', ')}], custom-elements.json declares [${cemSlots.join(', ')}].`,
      })
    }
  }
}

function validatePackageName(
  packageJson: AuthorPackageJson,
  diagnostics: AuthorDiagnostic[],
): void {
  if (
    !isNonEmptyString(packageJson.name) ||
    !packageNamePattern.test(packageJson.name)
  ) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_PACKAGE_META',
      path: 'name',
      message: `Package name must be a valid package name, got ${formatValue(packageJson.name)}.`,
    })
  }

  if (
    !isNonEmptyString(packageJson.version) ||
    !semverPattern.test(packageJson.version)
  ) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_PACKAGE_META',
      path: 'version',
      message: `Package version must be semver, got ${formatValue(packageJson.version)}.`,
    })
  }

  if (packageJson.name?.startsWith('zw-')) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_PACKAGE_META',
      path: 'name',
      message: 'Package names must not use the reserved "zw-" element prefix.',
    })
  }
}

/**
 * Validates a built third-party component package.
 *
 * Call it after the package build, on the same directory that will be packed,
 * so missing exports are caught before `npm publish` instead of at runtime in
 * a consumer.
 */
export function validateComponentPackage(
  input: AuthorComponentPackageInput,
): AuthorValidationResult {
  const diagnostics: AuthorDiagnostic[] = []

  if (!isRecord(input) || !isRecord(input.packageJson)) {
    return {
      valid: false,
      diagnostics: [
        {
          code: 'ZEUS_AUTHOR_PACKAGE_META',
          path: 'package.json',
          message: 'package.json must be an object.',
        },
      ],
    }
  }

  validatePackageName(input.packageJson, diagnostics)
  validatePackageExports(input.packageJson, input.fileExists, diagnostics)
  validatePublishFiles(input.packageJson, diagnostics)
  validateWrapperExports(input.packageJson, diagnostics)
  validatePeerPin(input.packageJson, input.expectedZeusVersion, diagnostics)
  validateManifestTags(input.manifest, diagnostics)
  validateComponents(input.manifest, diagnostics)
  validateCustomElementsManifest(
    input.manifest,
    input.customElements,
    diagnostics,
  )
  validateOutputPluginMetadata({ zeus: input.packageJson.zeus }, diagnostics)

  return { valid: diagnostics.length === 0, diagnostics }
}

/**
 * Validates the `files` allowlist so a published package ships build output
 * only. Sources, node_modules and build tooling stay out of the tarball.
 */
function validatePublishFiles(
  packageJson: AuthorPackageJson,
  diagnostics: AuthorDiagnostic[],
): void {
  const files = packageJson.files
  if (!Array.isArray(files) || files.length === 0) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_PACKAGE_FILES',
      path: 'files',
      message:
        'package.json must declare a "files" allowlist so only build output is published.',
    })
    return
  }

  const forbidden = files.filter(
    entry =>
      typeof entry !== 'string' ||
      entry === '' ||
      entry === '.' ||
      entry === './' ||
      entry === '*' ||
      entry.startsWith('..') ||
      entry.startsWith('/') ||
      entry.includes('\\') ||
      entry.split('/').includes('node_modules') ||
      !(entry === 'dist' || entry.startsWith('dist/')),
  )

  for (const entry of forbidden) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_PACKAGE_FILES',
      path: 'files',
      message: `files entry ${formatValue(entry)} is not allowed: publish build output under "dist" only.`,
    })
  }
}

/**
 * Validates the `zeus` metadata block a third-party output plugin publishes.
 *
 * Plugins run as build-time code with full Node privileges. This validator
 * checks declared versions and artifact ownership; it does not sandbox them.
 */
export function validateOutputPluginMetadata(
  input: AuthorPluginMetadataInput,
  diagnostics: AuthorDiagnostic[] = [],
): AuthorValidationResult {
  const metadata = input.zeus
  if (!isRecord(metadata)) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_PLUGIN_META',
      path: 'zeus',
      message: 'Package must declare a "zeus" metadata block.',
    })
    return { valid: false, diagnostics }
  }

  if (
    metadata.kind !== 'output-plugin' &&
    metadata.kind !== 'component-package'
  ) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_PLUGIN_META',
      path: 'zeus.kind',
      message: `zeus.kind must be "output-plugin" or "component-package", got ${formatValue(metadata.kind)}.`,
    })
  }

  if (metadata.contractVersion !== authorContractVersion) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_CONTRACT_VERSION',
      path: 'zeus.contractVersion',
      message: `Unsupported author contract version ${formatValue(metadata.contractVersion)}; this tooling implements version ${authorContractVersion}.`,
    })
  }

  if (
    !isNonEmptyString(metadata.zeusVersion) ||
    !semverPattern.test(metadata.zeusVersion)
  ) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_PLUGIN_META',
      path: 'zeus.zeusVersion',
      message: 'zeus.zeusVersion must be an exact Zeus version.',
    })
  }

  const plugins = Array.isArray(metadata.plugins) ? metadata.plugins : []
  if (!Array.isArray(metadata.plugins)) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_PLUGIN_META',
      path: 'zeus.plugins',
      message: 'zeus.plugins must be an array.',
    })
  }

  const ids = new Set<string>()
  const outputOwners = new Map<string, string>()

  for (let index = 0; index < plugins.length; index += 1) {
    const plugin = plugins[index]
    const path = `zeus.plugins[${index}]`

    if (!isRecord(plugin)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_PLUGIN_META',
        path,
        message: 'Plugin entry must be an object.',
      })
      continue
    }

    const id = plugin.id
    if (!isNonEmptyString(id) || !pluginIdPattern.test(id)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_PLUGIN_ID',
        path: `${path}.id`,
        message: `Plugin id must be a package-like name, got ${formatValue(id)}.`,
      })
    } else if (ids.has(id)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_PLUGIN_ID',
        path: `${path}.id`,
        message: `Duplicate plugin id "${id}".`,
      })
    } else {
      ids.add(id)
    }

    if (
      !isNonEmptyString(plugin.version) ||
      !semverPattern.test(plugin.version)
    ) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_PLUGIN_META',
        path: `${path}.version`,
        message: 'Plugin version must be semver.',
      })
    }

    if (plugin.apiVersion !== pluginApiVersion) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_PLUGIN_API_VERSION',
        path: `${path}.apiVersion`,
        message: `Plugin "${String(id)}" targets output plugin API ${formatValue(plugin.apiVersion)}, but this toolchain implements API ${pluginApiVersion}.`,
      })
    }

    if (
      !Array.isArray(plugin.capabilities) ||
      plugin.capabilities.some(capability => !isNonEmptyString(capability))
    ) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_PLUGIN_META',
        path: `${path}.capabilities`,
        message: 'Plugin capabilities must be an array of strings.',
      })
    }

    if (
      !Array.isArray(plugin.outputs) ||
      plugin.outputs.length === 0 ||
      plugin.outputs.some(
        output => !isNonEmptyString(output) || !outputNamePattern.test(output),
      )
    ) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_PLUGIN_META',
        path: `${path}.outputs`,
        message: 'Plugin outputs must be a non-empty array of artifact names.',
      })
    } else {
      for (const output of plugin.outputs) {
        const owner = outputOwners.get(output)
        if (owner && owner !== id) {
          diagnostics.push({
            code: 'ZEUS_AUTHOR_PLUGIN_OUTPUT_CONFLICT',
            path: `${path}.outputs`,
            message: `Output "${output}" is already owned by plugin "${owner}".`,
          })
          continue
        }
        outputOwners.set(output, String(id))
      }
    }

    if (!Number.isInteger(plugin.order)) {
      diagnostics.push({
        code: 'ZEUS_AUTHOR_PLUGIN_META',
        path: `${path}.order`,
        message: 'Plugin order must be an integer.',
      })
    }
  }

  return { valid: diagnostics.length === 0, diagnostics }
}

export interface AuthorPluginReport {
  schemaVersion: 1
  plugin: {
    id: string
    version: string
    apiVersion: number
  }
  components: Array<{
    tag: string
    events: string[]
    slots: string[]
    parts: string[]
    hostAttributes: string[]
  }>
}

/**
 * Builds the machine-readable report a third-party output plugin can emit as
 * an asset. It only consumes the public component manifest shape, so the
 * plugin never imports compiler internals.
 */
export function createAuthorPluginReport(input: {
  id: string
  version: string
  apiVersion?: number
  manifest: { components?: AuthorComponentManifestEntry[] }
}): AuthorPluginReport {
  const apiVersion = input.apiVersion ?? pluginApiVersion
  if (apiVersion !== pluginApiVersion) {
    throw new Error(
      `[zeus-ui] plugin ${input.id} targets output plugin API ${apiVersion}, but this toolchain implements API ${pluginApiVersion}.`,
    )
  }

  const components = Array.isArray(input.manifest.components)
    ? input.manifest.components
    : []

  return {
    schemaVersion: 1,
    plugin: { id: input.id, version: input.version, apiVersion },
    components: components.map(component => ({
      tag: component.tag,
      events: Object.keys(component.events ?? {}).sort(),
      slots: Object.keys(component.slots ?? {}).sort(),
      parts: (component.cssParts ?? []).slice().sort(),
      hostAttributes: (component.hostAttributes ?? []).slice().sort(),
    })),
  }
}

export interface AuthorPluginAsset {
  type: 'asset'
  fileName: string
  source: string
}

export function createAuthorPluginAsset(input: {
  id: string
  version: string
  apiVersion?: number
  fileName: string
  manifest: { components?: AuthorComponentManifestEntry[] }
}): AuthorPluginAsset {
  if (!outputNamePattern.test(input.fileName.replace(/\.json$/, ''))) {
    throw new Error(
      `[zeus-ui] plugin asset file name must be a safe artifact name, got ${JSON.stringify(input.fileName)}.`,
    )
  }

  return {
    type: 'asset',
    fileName: input.fileName,
    source: `${JSON.stringify(
      createAuthorPluginReport({
        id: input.id,
        version: input.version,
        apiVersion: input.apiVersion,
        manifest: input.manifest,
      }),
      null,
      2,
    )}\n`,
  }
}
