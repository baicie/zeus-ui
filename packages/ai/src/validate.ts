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
]

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

  for (const name of requiredComponents) {
    if (!names.has(name)) {
      errors.push(`missing component metadata: ${name}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
