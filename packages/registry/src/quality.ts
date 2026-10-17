export type ComponentQualityLevel = 'experimental' | 'beta' | 'stable'

export interface ComponentQualityEvidence {
  behavior: string[]
  accessibility: string[]
  endToEnd: string[]
}

export interface ComponentQuality {
  name: string
  level: ComponentQualityLevel
  evidence: ComponentQualityEvidence
}

export interface ComponentQualityManifest {
  schemaVersion: 1
  components: ComponentQuality[]
}

export interface ComponentQualityValidationResult {
  valid: boolean
  errors: string[]
}

const qualityLevels = new Set<ComponentQualityLevel>([
  'experimental',
  'beta',
  'stable',
])

export function getComponentQuality(
  manifest: ComponentQualityManifest,
  name: string,
): ComponentQuality | undefined {
  return manifest.components.find(component => component.name === name)
}

export function validateComponentQualityManifest(
  manifest: ComponentQualityManifest,
  availableComponentNames: string[],
): ComponentQualityValidationResult {
  const errors: string[] = []
  const availableNames = new Set(availableComponentNames)
  const entries = new Map<string, ComponentQuality>()

  if (manifest.schemaVersion !== 1) {
    errors.push('quality.schemaVersion must be 1')
  }

  if (!Array.isArray(manifest.components)) {
    return { valid: false, errors: ['quality.components must be an array'] }
  }

  for (const component of manifest.components) {
    if (!component || typeof component !== 'object') {
      errors.push('quality component must be an object')
      continue
    }

    if (!component.name || typeof component.name !== 'string') {
      errors.push('quality component name is required')
      continue
    }

    if (entries.has(component.name)) {
      errors.push(`duplicate quality component: ${component.name}`)
    }
    entries.set(component.name, component)

    if (!availableNames.has(component.name)) {
      errors.push(`quality component has no package: ${component.name}`)
    }

    if (!qualityLevels.has(component.level)) {
      errors.push(
        `invalid quality level for ${component.name}: ${component.level}`,
      )
      continue
    }

    const evidence = component.evidence

    if (!evidence || typeof evidence !== 'object') {
      errors.push(`${component.name}: evidence is required`)
      continue
    }

    for (const category of ['behavior', 'accessibility', 'endToEnd'] as const) {
      const paths = evidence[category]

      if (!Array.isArray(paths)) {
        errors.push(`${component.name}: evidence.${category} must be an array`)
      } else if (
        paths.some(path => typeof path !== 'string' || path.trim().length === 0)
      ) {
        errors.push(
          `${component.name}: evidence.${category} paths must be non-empty strings`,
        )
      }
    }

    if (
      component.level !== 'experimental' &&
      Array.isArray(evidence.behavior) &&
      evidence.behavior.length === 0
    ) {
      errors.push(
        `${component.name}: ${component.level} requires behavior evidence`,
      )
    }

    if (
      (component.level === 'beta' || component.level === 'stable') &&
      Array.isArray(evidence.accessibility) &&
      evidence.accessibility.length === 0
    ) {
      errors.push(
        `${component.name}: ${component.level} requires accessibility evidence`,
      )
    }

    if (
      component.level === 'stable' &&
      Array.isArray(evidence.endToEnd) &&
      evidence.endToEnd.length === 0
    ) {
      errors.push(`${component.name}: stable requires end-to-end evidence`)
    }
  }

  for (const name of availableNames) {
    if (!entries.has(name)) {
      errors.push(`quality manifest missing component: ${name}`)
    }
  }

  for (const name of entries.keys()) {
    if (!availableNames.has(name)) {
      errors.push(`quality manifest includes unknown component: ${name}`)
    }
  }

  return { valid: errors.length === 0, errors }
}
