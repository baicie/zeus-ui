import type {
  ZeusWebAiComponentName,
  ZeusWebAiMetadata,
  ZeusWebAiValidationResult,
} from './types'

const requiredComponents: ZeusWebAiComponentName[] = [
  'input',
  'button',
  'checkbox',
  'switch',
  'tabs',
  'dialog',
  'label',
  'textarea',
  'radio-group',
  'select',
  'card',
  'badge',
  'separator',
  'skeleton',
  'alert',
  'collapsible',
  'accordion',
  'tooltip',
  'progress',
  'avatar',
]

function validateIcons(metadata: ZeusWebAiMetadata, errors: string[]): void {
  if (metadata.icons.packageName !== '@zeus-web/icons') {
    errors.push('icons.packageName must be @zeus-web/icons')
  }

  if (!metadata.icons.installCommand.includes('@zeus-web/icons')) {
    errors.push('icons.installCommand must include @zeus-web/icons')
  }

  if (!metadata.icons.reactImport.includes('@zeus-web/icons/react')) {
    errors.push('icons.reactImport must use @zeus-web/icons/react')
  }

  if (!metadata.icons.vueImport.includes('@zeus-web/icons/vue')) {
    errors.push('icons.vueImport must use @zeus-web/icons/vue')
  }

  if (!metadata.icons.webComponentImport.includes('@zeus-web/icons/wc')) {
    errors.push('icons.webComponentImport must use @zeus-web/icons/wc')
  }

  if (!metadata.icons.rawSvgImport.includes('@zeus-web/icons/svg/')) {
    errors.push('icons.rawSvgImport must use @zeus-web/icons/svg/*')
  }

  if (metadata.icons.recommendedIcons.length === 0) {
    errors.push('icons.recommendedIcons is required')
  }

  if (metadata.icons.aiRules.do.length === 0) {
    errors.push('icons.aiRules.do is required')
  }

  if (metadata.icons.aiRules.dont.length === 0) {
    errors.push('icons.aiRules.dont is required')
  }
}

export function validateAiMetadata(
  metadata: ZeusWebAiMetadata,
): ZeusWebAiValidationResult {
  const errors: string[] = []
  const names = new Set<string>()

  if (metadata.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1')
  }

  if (metadata.packageName !== '@zeus-web/ai') {
    errors.push('packageName must be @zeus-web/ai')
  }

  for (const component of metadata.components) {
    if (names.has(component.name)) {
      errors.push(`duplicated component metadata: ${component.name}`)
    }

    names.add(component.name)

    if (component.primitivePackage !== `@zeus-web/${component.name}`) {
      errors.push(
        `${component.name}: primitivePackage must be @zeus-web/${component.name}`,
      )
    }

    if (component.registryCommand !== `zweb add ${component.name}`) {
      errors.push(
        `${component.name}: registryCommand must be "zweb add ${component.name}"`,
      )
    }

    if (!component.installCommand.includes(`@zeus-web/${component.name}`)) {
      errors.push(
        `${component.name}: installCommand must include @zeus-web/${component.name}`,
      )
    }

    if (component.sourceTarget !== `components/ui/${component.name}.tsx`) {
      errors.push(
        `${component.name}: sourceTarget must be components/ui/${component.name}.tsx`,
      )
    }

    if (!component.reactImport.includes(`@zeus-web/${component.name}/react`)) {
      errors.push(`${component.name}: reactImport must use per-component entry`)
    }

    if (
      !component.webComponentImport.includes(`@zeus-web/${component.name}/wc`)
    ) {
      errors.push(`${component.name}: webComponentImport must use wc entry`)
    }

    if (!component.styledImport.includes('@/components/ui/')) {
      errors.push(`${component.name}: styledImport must use local ui alias`)
    }

    if (!component.dependencies.includes(`@zeus-web/${component.name}`)) {
      errors.push(
        `${component.name}: dependencies must include @zeus-web/${component.name}`,
      )
    }

    if (component.examples.length === 0) {
      errors.push(`${component.name}: examples are required`)
    }

    if (component.aiRules.do.length === 0) {
      errors.push(`${component.name}: aiRules.do is required`)
    }

    if (component.aiRules.dont.length === 0) {
      errors.push(`${component.name}: aiRules.dont is required`)
    }
  }

  const advancedNames = new Set<string>()

  for (const advanced of metadata.advancedComponents ?? []) {
    if (advancedNames.has(advanced.name)) {
      errors.push(`duplicated advanced component metadata: ${advanced.name}`)
    }

    advancedNames.add(advanced.name)

    if (advanced.category !== 'advanced') {
      errors.push(`${advanced.name}: category must be 'advanced'`)
    }

    if (advanced.packageName !== `@zeus-web/${advanced.name}`) {
      errors.push(
        `${advanced.name}: packageName must be @zeus-web/${advanced.name}`,
      )
    }

    if (advanced.components.length === 0) {
      errors.push(`${advanced.name}: components are required`)
    }

    if (advanced.examples.length === 0) {
      errors.push(`${advanced.name}: examples are required`)
    }

    if (advanced.promptHints.length === 0) {
      errors.push(`${advanced.name}: promptHints are required`)
    }

    if (advanced.doNotUseFor.length === 0) {
      errors.push(`${advanced.name}: doNotUseFor is required`)
    }

    if (
      !advanced.doNotUseFor.some(rule =>
        rule.includes('不要把它当作模型请求库'),
      )
    ) {
      errors.push(
        `${advanced.name}: doNotUseFor must include "不要把它当作模型请求库"`,
      )
    }

    if (
      !advanced.promptHints.some(rule =>
        rule.includes('业务请求逻辑应该放在应用层'),
      )
    ) {
      errors.push(
        `${advanced.name}: promptHints must include "业务请求逻辑应该放在应用层"`,
      )
    }
  }

  for (const name of requiredComponents) {
    if (!names.has(name)) {
      errors.push(`missing component metadata: ${name}`)
    }
  }

  validateIcons(metadata, errors)

  return {
    valid: errors.length === 0,
    errors,
  }
}
