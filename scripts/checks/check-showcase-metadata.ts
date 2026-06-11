import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

import {
  semanticTokens,
  showcaseIcons,
  showcaseThemes,
  validateShowcaseMetadata,
} from '../../examples/showcase-shared/src'
import { iconMetadata, iconNames } from '../../packages/icons/src'
import {
  semanticColorTokens,
  themeModeNames,
  themeModeRegistry,
  themeNames,
} from '../../packages/themes/src'

interface RegistryItem {
  name: string
  type: string
}

interface Registry {
  items: RegistryItem[]
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf-8')) as T
}

function readRegistryComponentNames(): string[] {
  const registry = readJson<Registry>(
    resolve(process.cwd(), 'packages/registry/registry.json'),
  )

  return registry.items
    .filter(item => item.type === 'registry:ui')
    .map(item => item.name)
    .sort()
}

function validateShowcaseIconCoverage(): string[] {
  const errors: string[] = []
  const showcaseIconNames = showcaseIcons.map(icon => icon.name)
  const showcaseIconNameSet = new Set(showcaseIconNames)
  const packageIconNameSet = new Set<string>(iconNames)

  for (const icon of showcaseIcons) {
    if (!packageIconNameSet.has(icon.name)) {
      errors.push(
        `showcaseIcons contains "${icon.name}" but @zeus-web/icons does not export it.`,
      )
      continue
    }

    const packageIcon = iconMetadata[icon.name]

    if (packageIcon.category !== icon.category) {
      errors.push(
        `showcaseIcons "${icon.name}" category must be "${packageIcon.category}", got "${icon.category}".`,
      )
    }

    for (const tag of packageIcon.tags) {
      if (!icon.tags.includes(tag)) {
        errors.push(
          `showcaseIcons "${icon.name}" is missing package icon tag "${tag}".`,
        )
      }
    }
  }

  for (const iconName of iconNames) {
    if (!showcaseIconNameSet.has(iconName)) {
      errors.push(
        `@zeus-web/icons exports "${iconName}" but showcaseIcons does not include it.`,
      )
    }
  }

  return errors
}

function validateShowcaseThemeCoverage(): string[] {
  const errors: string[] = []
  const showcaseThemeNames = showcaseThemes.map(theme => theme.name)
  const showcaseTokenNames = semanticTokens.map(token => String(token))

  if (JSON.stringify(showcaseThemeNames) !== JSON.stringify(themeNames)) {
    errors.push(
      `showcaseThemes must match @zeus-web/themes themeNames. Expected ${themeNames.join(
        ', ',
      )}, got ${showcaseThemeNames.join(', ')}.`,
    )
  }

  if (
    JSON.stringify(showcaseTokenNames) !== JSON.stringify(semanticColorTokens)
  ) {
    errors.push(
      `semanticTokens must match @zeus-web/themes semanticColorTokens.`,
    )
  }

  for (const themeName of themeNames) {
    for (const mode of themeModeNames) {
      const colors = themeModeRegistry[themeName][mode].colors

      for (const token of semanticColorTokens) {
        if (!colors[token]) {
          errors.push(
            `themeModeRegistry.${themeName}.${mode} is missing token "${token}".`,
          )
        }
      }
    }
  }

  return errors
}

const result = validateShowcaseMetadata({
  registryComponentNames: readRegistryComponentNames(),
})

const iconCoverageErrors = validateShowcaseIconCoverage()
const themeCoverageErrors = validateShowcaseThemeCoverage()

for (const warning of result.warnings) {
  console.log(pc.yellow(`warning: ${warning}`))
}

if (
  !result.valid ||
  iconCoverageErrors.length > 0 ||
  themeCoverageErrors.length > 0
) {
  for (const error of result.errors) {
    console.error(pc.red(`error: ${error}`))
  }

  for (const error of iconCoverageErrors) {
    console.error(pc.red(`error: ${error}`))
  }

  for (const error of themeCoverageErrors) {
    console.error(pc.red(`error: ${error}`))
  }

  process.exit(1)
}

console.log(pc.green('Showcase metadata check passed.'))
