import type { Registry, RegistryValidationResult } from './index'

export function validateRegistry(registry: Registry): RegistryValidationResult {
  const errors: string[] = []
  const itemNames = new Set<string>()

  if (registry.name !== '@zeus-web/registry') {
    errors.push('registry.name must be @zeus-web/registry')
  }

  if (!Array.isArray(registry.items)) {
    errors.push('registry.items must be an array')
    return {
      valid: false,
      errors,
    }
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
      if (!file.path) {
        errors.push(`registry item "${item.name}" has file without path`)
      }

      if (!file.target) {
        errors.push(`registry item "${item.name}" has file without target`)
      }

      if (!file.type) {
        errors.push(`registry item "${item.name}" has file without type`)
      }
    }

    if (item.type === 'registry:ui') {
      const expectedPrimitive = `@zeus-web/${item.name}`
      const dependencies = item.dependencies ?? []

      if (!dependencies.includes(expectedPrimitive)) {
        errors.push(
          `registry ui item "${item.name}" must depend on ${expectedPrimitive}`,
        )
      }

      if (!dependencies.includes('class-variance-authority')) {
        errors.push(
          `registry ui item "${item.name}" must depend on class-variance-authority`,
        )
      }

      if (!dependencies.includes('clsx')) {
        errors.push(`registry ui item "${item.name}" must depend on clsx`)
      }

      if (!dependencies.includes('tailwind-merge')) {
        errors.push(
          `registry ui item "${item.name}" must depend on tailwind-merge`,
        )
      }

      const hasUiFile = item.files.some(file =>
        file.target.startsWith('components/ui/'),
      )

      if (!hasUiFile) {
        errors.push(`registry ui item "${item.name}" must target components/ui`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
