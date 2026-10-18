export type ComponentSchemaFramework = 'react' | 'vue'

export interface ComponentVariantSchema {
  type: string
  values: string[]
  default: string
  description: string
}

export interface ComponentPropSchema {
  name: string
  type?: string
  variant?: string
  default?: string | number | boolean
  required?: boolean
  frameworks?: ComponentSchemaFramework[]
  description: string
}

export interface ComponentEventSchema {
  name: string
  reactName?: string
  vueName?: string
  type: string
  description: string
}

export interface ComponentSlotSchema {
  name: string
  types: Record<ComponentSchemaFramework, string>
  description: string
}

export interface RegistryComponentSchema {
  name: string
  primitive: string
  description: string
  variants: Record<string, ComponentVariantSchema>
  props: ComponentPropSchema[]
  events: ComponentEventSchema[]
  slots: ComponentSlotSchema[]
}

export interface RegistryComponentSchemaManifest {
  schemaVersion: 1
  components: RegistryComponentSchema[]
}

export interface ComponentSchemaValidationResult {
  valid: boolean
  errors: string[]
}

const frameworks = new Set<ComponentSchemaFramework>(['react', 'vue'])
const componentNamePattern = /^[a-z][a-z0-9-]*$/
const fieldNamePattern = /^[a-z][a-zA-Z0-9:.-]*$/
const variantNamePattern = /^[a-z][a-zA-Z0-9]*$/

export function getRegistryComponentSchema(
  manifest: RegistryComponentSchemaManifest,
  name: string,
): RegistryComponentSchema | undefined {
  return manifest.components.find(component => component.name === name)
}

export function validateRegistryComponentSchema(
  manifest: RegistryComponentSchemaManifest,
): ComponentSchemaValidationResult {
  const errors: string[] = []

  if (!isRecord(manifest)) {
    return { valid: false, errors: ['components manifest must be an object'] }
  }

  if (manifest.schemaVersion !== 1) {
    errors.push('components.schemaVersion must be 1')
  }

  if (!Array.isArray(manifest.components)) {
    return {
      valid: false,
      errors: errors.concat('components.components must be an array'),
    }
  }

  const names = new Set<string>()
  for (const component of manifest.components) {
    validateComponent(component, names, errors)
  }

  return { valid: errors.length === 0, errors }
}

function validateComponent(
  value: unknown,
  names: Set<string>,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push('component schema entry must be an object')
    return
  }

  const name = value.name
  if (typeof name !== 'string' || !componentNamePattern.test(name)) {
    errors.push('component schema name must be a kebab-case string')
    return
  }
  if (names.has(name)) {
    errors.push(`duplicate component schema: ${name}`)
  }
  names.add(name)

  if (typeof value.primitive !== 'string' || value.primitive.length === 0) {
    errors.push(`${name}: primitive is required`)
  }
  if (typeof value.description !== 'string' || value.description.length === 0) {
    errors.push(`${name}: description is required`)
  }

  const variants = value.variants
  if (!isRecord(variants)) {
    errors.push(`${name}: variants must be an object`)
  } else {
    validateVariants(name, variants, errors)
  }

  const props = value.props
  if (!Array.isArray(props)) {
    errors.push(`${name}: props must be an array`)
  } else {
    validateProps(name, props, variants, errors)
  }

  const events = value.events
  if (!Array.isArray(events)) {
    errors.push(`${name}: events must be an array`)
  } else {
    validateEvents(name, events, errors)
  }

  const slots = value.slots
  if (!Array.isArray(slots)) {
    errors.push(`${name}: slots must be an array`)
  } else {
    validateSlots(name, slots, errors)
  }
}

function validateVariants(
  componentName: string,
  variants: Record<string, unknown>,
  errors: string[],
): void {
  for (const [variantName, value] of Object.entries(variants)) {
    if (!variantNamePattern.test(variantName)) {
      errors.push(`${componentName}: invalid variant name ${variantName}`)
    }
    if (!isRecord(value)) {
      errors.push(`${componentName}.${variantName}: invalid variant definition`)
      continue
    }

    const values = value.values
    const variantValues: unknown[] = Array.isArray(values) ? values : []
    if (
      typeof value.type !== 'string' ||
      value.type.length === 0 ||
      variantValues.length === 0 ||
      variantValues.some(
        item => typeof item !== 'string' || item.length === 0,
      ) ||
      new Set(variantValues).size !== variantValues.length ||
      typeof value.default !== 'string' ||
      !variantValues.includes(value.default) ||
      typeof value.description !== 'string' ||
      value.description.length === 0
    ) {
      errors.push(`${componentName}.${variantName}: invalid variant definition`)
    }
  }
}

function validateProps(
  componentName: string,
  props: unknown[],
  variants: unknown,
  errors: string[],
): void {
  const names = new Set<string>()
  for (const value of props) {
    if (!isRecord(value)) {
      errors.push(`${componentName}: invalid prop definition`)
      continue
    }
    const name = value.name
    if (typeof name !== 'string' || !fieldNamePattern.test(name)) {
      errors.push(`${componentName}: invalid prop name`)
      continue
    }
    if (names.has(name)) {
      errors.push(`${componentName}: duplicate prop ${name}`)
    }
    names.add(name)

    const type = value.type
    const variant = value.variant
    const hasType = typeof type === 'string' && type.length > 0
    const hasVariant = typeof variant === 'string' && variant.length > 0
    if (hasType === hasVariant) {
      errors.push(
        `${componentName}.${name}: type or variant is required, but not both`,
      )
    }
    if (
      hasVariant &&
      (!isRecord(variants) || !isRecord(variants[variant as string]))
    ) {
      errors.push(`${componentName}.${name}: unknown variant ${variant}`)
    }
    let variantValues: unknown[] | undefined
    if (hasVariant && isRecord(variants)) {
      const candidate = variants[variant as string]
      if (isRecord(candidate) && Array.isArray(candidate.values)) {
        variantValues = candidate.values
      }
    }
    if (
      hasVariant &&
      value.default !== undefined &&
      variantValues &&
      !variantValues.includes(value.default)
    ) {
      errors.push(
        `${componentName}.${name}: default must be one of the variant values`,
      )
    }
    if (value.required !== undefined && typeof value.required !== 'boolean') {
      errors.push(`${componentName}.${name}: required must be boolean`)
    }
    if (
      value.default !== undefined &&
      !['string', 'number', 'boolean'].includes(typeof value.default)
    ) {
      errors.push(`${componentName}.${name}: default must be a primitive value`)
    }
    if (
      typeof value.description !== 'string' ||
      value.description.length === 0
    ) {
      errors.push(`${componentName}.${name}: description is required`)
    }
    validateFrameworkList(`${componentName}.${name}`, value.frameworks, errors)
  }
}

function validateEvents(
  componentName: string,
  events: unknown[],
  errors: string[],
): void {
  const names = new Set<string>()
  for (const value of events) {
    if (!isRecord(value)) {
      errors.push(`${componentName}: invalid event definition`)
      continue
    }
    const name = value.name
    if (typeof name !== 'string' || !fieldNamePattern.test(name)) {
      errors.push(`${componentName}: invalid event name`)
      continue
    }
    if (names.has(name)) {
      errors.push(`${componentName}: duplicate event ${name}`)
    }
    names.add(name)
    if (typeof value.type !== 'string' || value.type.length === 0) {
      errors.push(`${componentName}.${name}: event type is required`)
    }
    if (
      typeof value.description !== 'string' ||
      value.description.length === 0
    ) {
      errors.push(`${componentName}.${name}: event description is required`)
    }
    if (
      !hasFrameworkEventName(value.reactName) &&
      !hasFrameworkEventName(value.vueName)
    ) {
      errors.push(`${componentName}.${name}: event needs a React or Vue name`)
    }
    if (
      value.reactName !== undefined &&
      !hasFrameworkEventName(value.reactName)
    ) {
      errors.push(`${componentName}.${name}: reactName must be a string`)
    }
    if (value.vueName !== undefined && !hasFrameworkEventName(value.vueName)) {
      errors.push(`${componentName}.${name}: vueName must be a string`)
    }
  }
}

function validateSlots(
  componentName: string,
  slots: unknown[],
  errors: string[],
): void {
  const names = new Set<string>()
  for (const value of slots) {
    if (!isRecord(value)) {
      errors.push(`${componentName}: invalid slot definition`)
      continue
    }
    const name = value.name
    if (typeof name !== 'string' || !fieldNamePattern.test(name)) {
      errors.push(`${componentName}: invalid slot name`)
      continue
    }
    if (names.has(name)) {
      errors.push(`${componentName}: duplicate slot ${name}`)
    }
    names.add(name)
    if (!isRecord(value.types)) {
      errors.push(`${componentName}.${name}: slot types are required`)
    } else {
      if (
        typeof value.types.react !== 'string' ||
        value.types.react.length === 0
      ) {
        errors.push(`${componentName}.${name}: React slot type is required`)
      }
      if (typeof value.types.vue !== 'string' || value.types.vue.length === 0) {
        errors.push(`${componentName}.${name}: Vue slot type is required`)
      }
    }
    if (
      typeof value.description !== 'string' ||
      value.description.length === 0
    ) {
      errors.push(`${componentName}.${name}: slot description is required`)
    }
  }
}

function validateFrameworkList(
  name: string,
  value: unknown,
  errors: string[],
): void {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${name}: frameworks must be a non-empty array`)
    return
  }
  if (new Set(value).size !== value.length) {
    errors.push(`${name}: frameworks must not contain duplicates`)
  }
  for (const framework of value) {
    if (!frameworks.has(framework as ComponentSchemaFramework)) {
      errors.push(`${name}: unsupported framework ${String(framework)}`)
    }
  }
}

function hasFrameworkEventName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
