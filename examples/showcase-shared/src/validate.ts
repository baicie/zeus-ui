import type { ShowcaseComponent, ShowcaseValidationResult } from './types'
import { deferredComponents, showcaseComponents } from './components'
import { showcaseIcons } from './icons'
import { showcaseRoutes } from './routes'
import { semanticTokens, showcaseThemes } from './themes'

export interface ShowcaseValidationOptions {
  registryComponentNames?: string[]
}

const requiredSections = [
  'basic',
  'states',
  'theme',
  'accessibility',
  'production',
] as const

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
      continue
    }

    seen.add(value)
  }

  return Array.from(duplicates).sort()
}

function assertNoDuplicates(
  errors: string[],
  label: string,
  values: string[],
): void {
  for (const duplicate of findDuplicates(values)) {
    errors.push(`${label} has duplicate value "${duplicate}"`)
  }
}

function validateComponent(
  component: ShowcaseComponent,
  errors: string[],
  warnings: string[],
  context: {
    iconNames: Set<string>
    tokenNames: Set<string>
  },
): void {
  const expectedPackageName = `@zeus-web/${component.name}`
  const expectedRoutePath = `/components/${component.name}` as const
  const expectedRegistryCommand = `zweb add ${component.name}`

  if (component.packageName !== expectedPackageName) {
    errors.push(
      `${component.name}: packageName must be "${expectedPackageName}"`,
    )
  }

  if (component.routePath !== expectedRoutePath) {
    errors.push(`${component.name}: routePath must be "${expectedRoutePath}"`)
  }

  if (component.registryCommand !== expectedRegistryCommand) {
    errors.push(
      `${component.name}: registryCommand must be "${expectedRegistryCommand}"`,
    )
  }

  for (const section of requiredSections) {
    if (!component.sections.includes(section)) {
      errors.push(`${component.name}: missing required section "${section}"`)
    }
  }

  if (!component.imports.react) {
    errors.push(`${component.name}: missing React import spec`)
  }

  if (!component.imports.vue) {
    errors.push(`${component.name}: missing Vue import spec`)
  }

  if (!component.imports.webComponent) {
    errors.push(`${component.name}: missing Web Component import spec`)
  }

  if (!component.imports.registry) {
    errors.push(`${component.name}: missing registry command import spec`)
  }

  if (component.states.length === 0) {
    errors.push(`${component.name}: states must not be empty`)
  }

  if (component.events.length > 0 && !component.sections.includes('events')) {
    errors.push(`${component.name}: has events but missing "events" section`)
  }

  if (component.themeTokens.length === 0) {
    warnings.push(`${component.name}: themeTokens is empty`)
  }

  for (const token of component.themeTokens) {
    if (!context.tokenNames.has(token)) {
      errors.push(`${component.name}: unknown theme token "${token}"`)
    }
  }

  for (const icon of component.iconExamples) {
    if (!context.iconNames.has(icon)) {
      errors.push(`${component.name}: unknown icon example "${icon}"`)
    }
  }

  if (component.productionPatterns.length === 0) {
    errors.push(`${component.name}: productionPatterns must not be empty`)
  }
}

function validateRegistryCoverage(
  options: ShowcaseValidationOptions,
  componentNames: string[],
  errors: string[],
  warnings: string[],
): void {
  const registryComponentNames = options.registryComponentNames?.slice().sort()

  if (!registryComponentNames) return

  assertNoDuplicates(errors, 'registryComponentNames', registryComponentNames)

  const componentNameSet = new Set(componentNames)
  const registryNameSet = new Set(registryComponentNames)

  for (const name of registryComponentNames) {
    if (!componentNameSet.has(name)) {
      errors.push(
        `registry component "${name}" is missing from showcaseComponents`,
      )
    }
  }

  for (const name of componentNames) {
    if (!registryNameSet.has(name)) {
      warnings.push(
        `showcase component "${name}" is missing from registry; will be added in future phases`,
      )
    }
  }
}

export function validateShowcaseMetadata(
  options: ShowcaseValidationOptions = {},
): ShowcaseValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const componentNames = showcaseComponents.map(component => component.name)
  const componentRoutePaths = showcaseComponents.map(
    component => component.routePath,
  )
  const routePaths = showcaseRoutes.map(route => route.path)
  const iconNames = showcaseIcons.map(icon => icon.name)
  const themeNames = showcaseThemes.map(theme => theme.name)
  const tokenNames = semanticTokens.map(token => String(token))

  assertNoDuplicates(errors, 'showcaseComponents', componentNames)
  assertNoDuplicates(errors, 'component route paths', componentRoutePaths)
  assertNoDuplicates(errors, 'showcaseRoutes', routePaths)
  assertNoDuplicates(errors, 'showcaseIcons', iconNames)
  assertNoDuplicates(errors, 'showcaseThemes', themeNames)
  assertNoDuplicates(errors, 'semanticTokens', tokenNames)

  const context = {
    iconNames: new Set(iconNames),
    tokenNames: new Set(tokenNames),
  }

  for (const component of showcaseComponents) {
    validateComponent(component, errors, warnings, context)
  }

  validateRegistryCoverage(options, componentNames, errors, warnings)

  for (const deferred of deferredComponents) {
    if (componentNames.includes(deferred)) {
      errors.push(
        `deferred component "${deferred}" must not appear in showcaseComponents`,
      )
    }

    if (routePaths.includes(`/components/${deferred}`)) {
      errors.push(
        `deferred component "${deferred}" must not have a showcase route`,
      )
    }
  }

  for (const token of semanticTokens) {
    if (!token || token.trim() === '') {
      errors.push('semanticTokens must not contain empty values')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
