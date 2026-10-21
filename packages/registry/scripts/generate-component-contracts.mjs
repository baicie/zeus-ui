/* eslint-disable style/brace-style */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = resolve(packageRoot, 'components.json')
const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
const checkOnly = process.argv.includes('--check')
const prettierConfig =
  (await prettier.resolveConfig(resolve(packageRoot, '..'))) || {}

validateManifest(schema)

for (const component of schema.components) {
  const contract = renderContractBlock(component)
  await replaceGeneratedBlock(
    resolve(packageRoot, `templates/react/${component.name}.tsx`),
    'tsx',
    contract.react,
  )
  const vueTemplate = resolve(
    packageRoot,
    `templates/vue/${component.name}.vue`,
  )
  const vueModule = resolve(packageRoot, `templates/vue/${component.name}.ts`)
  const hasVueSfc = await fileExists(vueTemplate)
  await replaceGeneratedBlock(
    hasVueSfc ? vueTemplate : vueModule,
    'vue',
    hasVueSfc ? contract.vue : contract.vueModule,
  )
}

async function fileExists(path) {
  try {
    await readFile(path)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

await writeGeneratedFile(
  resolve(packageRoot, 'components.md'),
  renderApiTable(schema.components),
)

function validateManifest(value) {
  if (!isRecord(value)) {
    throw new Error('components.json must be an object')
  }
  if (value.schemaVersion !== 1 || !Array.isArray(value.components)) {
    throw new Error(
      'components.json must use schemaVersion 1 and contain components',
    )
  }

  const names = new Set()
  for (const component of value.components) {
    validateComponent(component)
    if (names.has(component.name)) {
      throw new Error(`duplicate component schema: ${component.name}`)
    }
    names.add(component.name)
  }
}

function validateComponent(component) {
  if (!isRecord(component)) {
    throw new Error('component schema entries must be objects')
  }
  if (!/^[a-z][a-z0-9-]*$/.test(component.name)) {
    throw new Error(`invalid component name: ${String(component.name)}`)
  }
  if (
    typeof component.primitive !== 'string' ||
    component.primitive.length === 0
  ) {
    throw new Error(`${component.name}: primitive is required`)
  }
  if (
    typeof component.description !== 'string' ||
    component.description.length === 0
  ) {
    throw new Error(`${component.name}: description is required`)
  }
  if (!isRecord(component.variants)) {
    throw new Error(`${component.name}: variants are required`)
  }
  for (const [name, variant] of Object.entries(component.variants)) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
      throw new Error(`${component.name}: invalid variant name ${name}`)
    }
    if (!isRecord(variant)) {
      throw new Error(`${component.name}.${name}: invalid variant definition`)
    }
    const validVariant = Object.values({
      type: typeof variant.type === 'string',
      values:
        Array.isArray(variant.values) &&
        variant.values.length > 0 &&
        variant.values.every(
          value => typeof value === 'string' && value.length > 0,
        ),
      uniqueValues:
        Array.isArray(variant.values) &&
        new Set(variant.values).size === variant.values.length,
      default:
        typeof variant.default === 'string' &&
        Array.isArray(variant.values) &&
        variant.values.includes(variant.default),
      description:
        typeof variant.description === 'string' &&
        variant.description.length > 0,
    }).every(Boolean)
    if (!validVariant) {
      throw new Error(`${component.name}.${name}: invalid variant definition`)
    }
  }
  if (!Array.isArray(component.props)) {
    throw new TypeError(`${component.name}: props must be an array`)
  }
  if (!Array.isArray(component.events)) {
    throw new TypeError(`${component.name}: events must be an array`)
  }
  if (!Array.isArray(component.slots)) {
    throw new TypeError(`${component.name}: slots must be an array`)
  }

  const propNames = new Set()
  for (const prop of component.props) {
    if (!isRecord(prop) || typeof prop.name !== 'string') {
      throw new Error(`${component.name}: invalid prop definition`)
    }
    if (propNames.has(prop.name)) {
      throw new Error(`${component.name}: duplicate prop ${prop.name}`)
    }
    propNames.add(prop.name)
    if (!/^[a-z][a-zA-Z0-9:.-]*$/.test(prop.name)) {
      throw new Error(`${component.name}: invalid prop name ${prop.name}`)
    }
    const hasType = typeof prop.type === 'string' && prop.type.length > 0
    const hasVariant =
      typeof prop.variant === 'string' && prop.variant.length > 0
    if (hasType === hasVariant) {
      throw new Error(
        `${component.name}.${prop.name}: type or variant is required, but not both`,
      )
    }
    if (hasVariant && !component.variants[prop.variant]) {
      throw new Error(
        `${component.name}.${prop.name}: unknown variant ${prop.variant}`,
      )
    }
    if (
      hasVariant &&
      prop.default !== undefined &&
      !component.variants[prop.variant].values.includes(prop.default)
    ) {
      throw new Error(
        `${component.name}.${prop.name}: default must be one of the variant values`,
      )
    }
    if (prop.required !== undefined && typeof prop.required !== 'boolean') {
      throw new Error(
        `${component.name}.${prop.name}: required must be boolean`,
      )
    }
    if (
      prop.default !== undefined &&
      !['string', 'number', 'boolean'].includes(typeof prop.default)
    ) {
      throw new Error(
        `${component.name}.${prop.name}: default must be primitive`,
      )
    }
    if (typeof prop.description !== 'string' || prop.description.length === 0) {
      throw new Error(`${component.name}.${prop.name}: description is required`)
    }
    validateFrameworks(component.name, prop.frameworks)
  }

  const eventNames = new Set()
  for (const event of component.events) {
    if (!isRecord(event) || typeof event.name !== 'string') {
      throw new Error(`${component.name}: invalid event definition`)
    }
    if (eventNames.has(event.name)) {
      throw new Error(`${component.name}: duplicate event ${event.name}`)
    }
    eventNames.add(event.name)
    if (!/^[a-z][a-zA-Z0-9:.-]*$/.test(event.name)) {
      throw new Error(`${component.name}: invalid event name ${event.name}`)
    }
    if (typeof event.type !== 'string' || event.type.length === 0) {
      throw new Error(`${component.name}.${event.name}: event type is required`)
    }
    if (
      typeof event.description !== 'string' ||
      event.description.length === 0
    ) {
      throw new Error(
        `${component.name}.${event.name}: event description is required`,
      )
    }
    if (!isFrameworkName(event.reactName) && !isFrameworkName(event.vueName)) {
      throw new Error(
        `${component.name}.${event.name}: event needs a React or Vue name`,
      )
    }
    if (event.reactName !== undefined && !isFrameworkName(event.reactName)) {
      throw new Error(
        `${component.name}.${event.name}: reactName must be a string`,
      )
    }
    if (event.vueName !== undefined && !isFrameworkName(event.vueName)) {
      throw new Error(
        `${component.name}.${event.name}: vueName must be a string`,
      )
    }
  }

  const slotNames = new Set()
  for (const slot of component.slots) {
    if (!isRecord(slot) || typeof slot.name !== 'string') {
      throw new Error(`${component.name}: invalid slot definition`)
    }
    if (slotNames.has(slot.name)) {
      throw new Error(`${component.name}: duplicate slot ${slot.name}`)
    }
    slotNames.add(slot.name)
    if (!/^[a-z][a-zA-Z0-9:.-]*$/.test(slot.name)) {
      throw new Error(`${component.name}: invalid slot name ${slot.name}`)
    }
    if (
      !isRecord(slot.types) ||
      typeof slot.types.react !== 'string' ||
      slot.types.react.length === 0 ||
      typeof slot.types.vue !== 'string' ||
      slot.types.vue.length === 0
    ) {
      throw new Error(`${component.name}.${slot.name}: slot types are required`)
    }
    if (typeof slot.description !== 'string' || slot.description.length === 0) {
      throw new Error(
        `${component.name}.${slot.name}: slot description is required`,
      )
    }
  }
}

function validateFrameworks(componentName, frameworks) {
  if (frameworks === undefined) return
  if (!Array.isArray(frameworks) || frameworks.length === 0) {
    throw new Error(
      `${componentName}: frameworks must be a non-empty array when provided`,
    )
  }
  if (new Set(frameworks).size !== frameworks.length) {
    throw new Error(`${componentName}: frameworks must not contain duplicates`)
  }
  for (const framework of frameworks) {
    if (framework !== 'react' && framework !== 'vue') {
      throw new Error(
        `${componentName}: unsupported framework ${String(framework)}`,
      )
    }
  }
}

function toPascalCase(name) {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function typeUnion(values) {
  return values.map(value => `'${value}'`).join(' | ')
}

function propLines(component, framework) {
  return component.props
    .filter(prop => !prop.frameworks || prop.frameworks.includes(framework))
    .map(prop => {
      const optional = prop.required ? '' : '?'
      const variant = prop.variant
        ? component.variants[prop.variant]
        : undefined
      const type = variant ? variant.type : prop.type
      return `  ${prop.name}${optional}: ${type}`
    })
    .join('\n')
}

function eventNames(component, framework) {
  const key = framework === 'react' ? 'reactName' : 'vueName'
  return component.events.filter(event => event[key]).map(event => event[key])
}

function renderContractBlock(component) {
  const pascal = toPascalCase(component.name)
  const camel = `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`
  const variants = Object.entries(component.variants)
    .map(
      ([, variant]) =>
        `export type ${variant.type} = ${typeUnion(variant.values)}`,
    )
    .join('\n')
  const defaults = collectDefaults(component)
  const defaultEntries = Object.entries(defaults)
    .map(
      ([name, value]) =>
        `  ${formatObjectKey(name)}: ${JSON.stringify(value)},`,
    )
    .join('\n')
  const reactSlots = component.slots
    .map(slot => `  ${formatObjectKey(slot.name)}: ${slot.types.react}`)
    .join('\n')
  const vueEmitProperties = component.events
    .filter(event => event.vueName)
    .map(
      event =>
        `  (event: ${JSON.stringify(event.vueName)}, payload: ${event.type}): void`,
    )
    .join('\n')
  const vueModuleEventProperties = component.events
    .filter(event => event.vueName)
    .map(event => `  ${formatObjectKey(event.vueName)}: ${event.type}`)
    .join('\n')
  const vueModuleSlots = component.slots
    .map(slot => `  ${formatObjectKey(slot.name)}: ${slot.types.vue}`)
    .join('\n')
  const vueModuleProps = propLines(component, 'vue')
  const reactSlotProperties = component.slots
    .map(slot => {
      const property = slot.name === 'default' ? 'children' : slot.name
      return `  ${formatObjectKey(property)}?: ${pascal}RegistrySlots[${JSON.stringify(slot.name)}]`
    })
    .join('\n')
  const reactEventProperties = component.events
    .filter(event => event.reactName)
    .map(
      event =>
        `  ${formatObjectKey(event.reactName)}?: (event: ${event.type}) => void`,
    )
    .join('\n')
  const reactDefaults =
    Object.keys(defaults).length > 0
      ? `const ${camel}RegistryDefaults = {\n${defaultEntries}\n} as const`
      : ''
  const vueDefaultDeclaration =
    Object.keys(defaults).length > 0
      ? `const props = withDefaults(\n  defineProps<${pascal}RegistryProps>(),\n  {\n${defaultEntries}\n  },\n)`
      : `const props = defineProps<${pascal}RegistryProps>()`
  const react = [
    '/* @generated by scripts/generate-component-contracts.mjs:BEGIN */',
    variants,
    `export interface ${pascal}RegistryProps {`,
    propLines(component, 'react'),
    '}',
    `export interface ${pascal}RegistryEvents {`,
    reactEventProperties || '  // This component has no React events.',
    '}',
    `export type ${pascal}RegistryEventName = ${typeUnion(eventNames(component, 'react')) || 'never'}`,
    `export interface ${pascal}RegistrySlots {`,
    reactSlots || '  // This component has no slots.',
    '}',
    `export interface ${pascal}RegistrySlotProps {`,
    reactSlotProperties || '  // This component has no slots.',
    '}',
    reactDefaults,
    `export type ${pascal}Props = Omit<\n  React.ComponentProps<typeof ${pascal}Primitive>,\n  keyof ${pascal}RegistryProps | keyof ${pascal}RegistryEvents | 'children'\n> & ${pascal}RegistryProps & ${pascal}RegistryEvents & ${pascal}RegistrySlotProps`,
    '/* @generated by scripts/generate-component-contracts.mjs:END */',
  ].join('\n')
  const vue = [
    '// @generated by scripts/generate-component-contracts.mjs:BEGIN',
    variants.replaceAll('export type', 'type'),
    `interface ${pascal}RegistryProps {`,
    propLines(component, 'vue'),
    '}',
    `interface ${pascal}RegistryEmits {`,
    vueEmitProperties || '  // This component has no Vue events.',
    '}',
    ...(component.name === 'input'
      ? ['defineOptions({', '  inheritAttrs: false,', '})']
      : []),
    vueDefaultDeclaration,
    `const emit = defineEmits<${pascal}RegistryEmits>()`,
    '// @generated by scripts/generate-component-contracts.mjs:END',
  ].join('\n')
  const vueModule = [
    '// @generated by scripts/generate-component-contracts.mjs:BEGIN',
    variants,
    `export interface ${pascal}RegistryProps${vueModuleProps ? '' : ' extends Record<never, never>'} {`,
    vueModuleProps || '  // This component has no Vue props.',
    '}',
    `export interface ${pascal}RegistryEvents${vueModuleEventProperties ? '' : ' extends Record<never, never>'} {`,
    vueModuleEventProperties || '  // This component has no Vue events.',
    '}',
    `export interface ${pascal}RegistrySlots {`,
    vueModuleSlots || '  // This component has no Vue slots.',
    '}',
    '// @generated by scripts/generate-component-contracts.mjs:END',
  ].join('\n')
  return { react, vue, vueModule }
}

function collectDefaults(component) {
  const defaults = {}
  for (const prop of component.props) {
    const variant = prop.variant ? component.variants[prop.variant] : undefined
    const value =
      prop.default === undefined && variant ? variant.default : prop.default
    if (value !== undefined) defaults[prop.name] = value
  }
  return defaults
}

function formatObjectKey(value) {
  return /^[$\w]+$/.test(value) ? value : JSON.stringify(value)
}

async function replaceGeneratedBlock(path, format, replacement) {
  const source = await readFile(path, 'utf8')
  const begin =
    format === 'tsx'
      ? String.raw`/\* @generated by scripts/generate-component-contracts.mjs:BEGIN \*/`
      : '// @generated by scripts/generate-component-contracts.mjs:BEGIN'
  const end =
    format === 'tsx'
      ? String.raw`/\* @generated by scripts/generate-component-contracts.mjs:END \*/`
      : '// @generated by scripts/generate-component-contracts.mjs:END'
  const pattern = new RegExp(`${begin}[\\s\\S]*?${end}`, 'g')
  const matches = source.match(pattern)
  if (!matches || matches.length !== 1) {
    throw new Error(`${path} is missing generated contract markers`)
  }
  await writeGeneratedFile(path, source.replace(pattern, replacement))
}

async function writeGeneratedFile(path, content) {
  const formatted = await prettier.format(content, {
    ...prettierConfig,
    filepath: path,
  })
  const current = await readFile(path, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return undefined
    throw error
  })
  if (current === formatted) return
  if (checkOnly) {
    throw new Error(
      `${path} is stale; run pnpm --filter @zeus-web/registry generate:components`,
    )
  }
  await writeFile(path, formatted, 'utf8')
}

function renderApiTable(components) {
  const rows = [
    '# Registry Component Schema',
    '',
    '此文件由 `components.json` 生成。公共 Props、事件和 Slot 只在 schema 中维护。',
    '',
  ]
  for (const component of components) {
    rows.push(
      `## ${component.name}`,
      '',
      component.description,
      '',
      `Primitive: \`${component.primitive}\``,
      '',
    )
    rows.push(
      '| Kind | Name | Type / Values | Default | Framework | Description |',
    )
    rows.push('| --- | --- | --- | --- | --- | --- |')
    for (const prop of component.props) {
      const framework = prop.frameworks
        ? prop.frameworks.join(', ')
        : 'react, vue'
      const variant = prop.variant
        ? component.variants[prop.variant]
        : undefined
      const values = variant
        ? `${variant.type}: ${variant.values.map(value => `\`${escapeMarkdown(value)}\``).join(', ')}`
        : `\`${escapeMarkdown(prop.type)}\``
      const defaultValue = variant ? variant.default : prop.default
      rows.push(
        `| Prop | \`${escapeMarkdown(prop.name)}\` | ${values} | ${formatDefault(defaultValue)} | ${framework} | ${escapeMarkdown(prop.description)} |`,
      )
    }
    for (const event of component.events) {
      const framework = [event.reactName && 'react', event.vueName && 'vue']
        .filter(Boolean)
        .join(', ')
      rows.push(
        `| Event | \`${escapeMarkdown(event.name)}\` | \`${escapeMarkdown(event.type)}\` | - | ${framework} | ${escapeMarkdown(event.description)} |`,
      )
    }
    for (const slot of component.slots) {
      rows.push(
        `| Slot | \`${escapeMarkdown(slot.name)}\` | react: \`${escapeMarkdown(slot.types.react)}\`; vue: \`${escapeMarkdown(slot.types.vue)}\` | - | react, vue | ${escapeMarkdown(slot.description)} |`,
      )
    }
    rows.push('')
  }
  return `${rows.join('\n')}\n`
}

function formatDefault(value) {
  return value === undefined ? '-' : `\`${escapeMarkdown(String(value))}\``
}

function escapeMarkdown(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('`', '\\`')
}

function isFrameworkName(value) {
  return typeof value === 'string' && value.length > 0
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
