import type {
  ComponentCatalogItem,
  ComponentCategory,
  ComponentCategoryDefinition,
} from '../../../apps/docs/.vitepress/data/component-catalog'
import type {
  PlaygroundSource,
  PlaygroundSourceSet,
} from '../../../apps/docs/.vitepress/data/playground-sources'
import type { GeneratedDoc } from '../../docs/component-docs'

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

import {
  componentCatalog,
  componentCategories,
} from '../../../apps/docs/.vitepress/data/component-catalog'
import { playgroundSources } from '../../../apps/docs/.vitepress/data/playground-sources'
import { componentCategoryGroups } from '../../../apps/docs/.vitepress/data/site'
import {
  createComponentDocsContext,
  generateComponentDocs,
} from '../../docs/component-docs'

interface PackageJson {
  name?: string
  private?: boolean
  exports?: Record<string, unknown>
  devDependencies?: Record<string, string>
}

interface ComponentPackage {
  name: string
  componentName: string
  packageGroup: ComponentCatalogItem['packageGroup']
  exports: Record<string, unknown>
}

interface FrameworkContract {
  exportPath: string
  label: string
  sourceKey: keyof PlaygroundSourceSet
  sourcePath: (packageName: string) => string
}

interface SidebarItem {
  link?: string
  items?: readonly SidebarItem[]
}

type PlaygroundSources = Partial<Record<string, PlaygroundSourceSet>>

export interface PlaygroundContractOptions {
  catalog?: readonly ComponentCatalogItem[]
  categories?: readonly ComponentCategoryDefinition[]
  sources?: PlaygroundSources
  generatedDocs?: readonly GeneratedDoc[]
  sidebarItems?: readonly SidebarItem[]
  runtimeSource?: string
}

export interface PlaygroundContractResult {
  valid: boolean
  errors: string[]
  componentCount: number
  categoryCount: number
  packageNames: string[]
}

const componentPackageRoots = [
  {
    dir: 'packages/primitives',
    packageGroup: 'primitives',
  },
  {
    dir: 'packages/advanced',
    packageGroup: 'advanced',
  },
] as const

const validCategories: ComponentCategory[] = [
  'general',
  'layout',
  'navigation',
  'data-entry',
  'data-display',
  'feedback',
  'advanced',
]

const frameworkContracts: FrameworkContract[] = [
  {
    exportPath: './wc/auto',
    label: 'Web Component',
    sourceKey: 'webComponent',
    sourcePath: packageName => `${packageName}/wc/auto`,
  },
  {
    exportPath: './react',
    label: 'React',
    sourceKey: 'react',
    sourcePath: packageName => `${packageName}/react`,
  },
  {
    exportPath: './vue',
    label: 'Vue',
    sourceKey: 'vue',
    sourcePath: packageName => `${packageName}/vue`,
  },
]

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

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

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort()
}

function readComponentPackages(
  root: string,
  errors: string[],
): ComponentPackage[] {
  const packages: ComponentPackage[] = []

  for (const packageRoot of componentPackageRoots) {
    const absoluteRoot = resolve(root, packageRoot.dir)

    if (!existsSync(absoluteRoot)) continue

    for (const entry of readdirSync(absoluteRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue

      const packageJsonPath = resolve(absoluteRoot, entry.name, 'package.json')

      if (!existsSync(packageJsonPath)) continue

      let packageJson: PackageJson

      try {
        packageJson = readJson<PackageJson>(packageJsonPath)
      } catch (error) {
        errors.push(
          `Unable to read component package manifest "${packageJsonPath}": ${String(error)}`,
        )
        continue
      }

      if (packageJson.private) continue

      if (!packageJson.name) {
        errors.push(`${packageJsonPath} must declare a package name.`)
        continue
      }

      if (!packageJson.name.startsWith('@zeus-web/')) {
        errors.push(
          `${packageJsonPath} package name must start with "@zeus-web/".`,
        )
        continue
      }

      packages.push({
        name: packageJson.name,
        componentName: packageJson.name.slice('@zeus-web/'.length),
        packageGroup: packageRoot.packageGroup,
        exports: packageJson.exports || {},
      })
    }
  }

  return packages.sort((left, right) => left.name.localeCompare(right.name))
}

function pushDuplicateErrors(
  components: readonly ComponentCatalogItem[],
  errors: string[],
): void {
  for (const name of findDuplicates(
    components.map(component => component.name),
  )) {
    errors.push(`Duplicate component catalog name "${name}".`)
  }

  for (const packageName of findDuplicates(
    components.map(component => component.packageName),
  )) {
    errors.push(`Duplicate component catalog package name "${packageName}".`)
  }

  for (const route of findDuplicates(
    components.map(component => component.route),
  )) {
    errors.push(`Duplicate component catalog route "${route}".`)
  }
}

function checkDefinitionCoverage(
  packages: ComponentPackage[],
  components: readonly ComponentCatalogItem[],
  errors: string[],
): void {
  const packagesByName = new Map(packages.map(pkg => [pkg.name, pkg]))
  const componentsByPackage = new Map<string, ComponentCatalogItem>(
    components.map(component => [component.packageName, component]),
  )

  for (const pkg of packages) {
    if (!componentsByPackage.has(pkg.name)) {
      errors.push(`Missing component catalog entry for ${pkg.name}.`)
    }
  }

  for (const component of components) {
    const pkg = packagesByName.get(component.packageName)

    if (!pkg) {
      errors.push(
        `Component catalog entry "${component.name}" has no matching public component package.`,
      )
      continue
    }

    if (component.name !== pkg.componentName) {
      errors.push(
        `${component.packageName} catalog name must be "${pkg.componentName}".`,
      )
    }

    if (component.packageGroup !== pkg.packageGroup) {
      errors.push(
        `${component.packageName} packageGroup must be "${pkg.packageGroup}".`,
      )
    }

    const expectedRoute = `/components/${component.name}`

    if (component.route !== expectedRoute) {
      errors.push(
        `${component.packageName} canonical component route must be "${expectedRoute}".`,
      )
    }
  }
}

function checkCategories(
  components: readonly ComponentCatalogItem[],
  categories: readonly ComponentCategoryDefinition[],
  errors: string[],
): void {
  const validCategoryIds = new Set<string>(validCategories)
  const categoryIds = categories.map(category => category.id)

  for (const duplicate of findDuplicates(categoryIds)) {
    errors.push(`Duplicate component category "${duplicate}".`)
  }

  for (const category of categories) {
    if (!validCategoryIds.has(category.id)) {
      errors.push(`Unknown component category "${category.id}".`)
    }

    if (!components.some(component => component.category === category.id)) {
      errors.push(
        `Component category "${category.id}" must contain at least one component.`,
      )
    }
  }

  const definedCategories = new Set<string>(categoryIds)

  for (const component of components) {
    if (!validCategoryIds.has(component.category)) {
      errors.push(
        `${component.packageName} uses unknown component category "${component.category}".`,
      )
      continue
    }

    if (!definedCategories.has(component.category)) {
      errors.push(
        `${component.packageName} category "${component.category}" has no category definition.`,
      )
    }
  }
}

function getSupportedFrameworks(pkg: ComponentPackage): FrameworkContract[] {
  return frameworkContracts.filter(
    framework => framework.exportPath in pkg.exports,
  )
}

function getSourceKeys(sources: PlaygroundSourceSet): string[] {
  return Object.keys(sources)
    .filter(key => Boolean(Reflect.get(sources, key)))
    .sort()
}

function checkSource(
  pkg: ComponentPackage,
  framework: FrameworkContract,
  source: PlaygroundSource | undefined,
  errors: string[],
): void {
  if (!source) {
    errors.push(
      `${pkg.name} is missing its "${framework.sourceKey}" Playground source.`,
    )
    return
  }

  const expectedPath = framework.sourcePath(pkg.name)

  if (!source.code.includes(expectedPath)) {
    errors.push(
      `${pkg.name} "${framework.sourceKey}" Playground source must reference "${expectedPath}".`,
    )
  }

  if (source.label !== framework.label) {
    errors.push(
      `${pkg.name} "${framework.sourceKey}" Playground source label must be "${framework.label}".`,
    )
  }
}

function checkFrameworkSources(
  packages: ComponentPackage[],
  components: readonly ComponentCatalogItem[],
  sourcesByComponent: PlaygroundSources,
  errors: string[],
): void {
  const packagesByName = new Map(packages.map(pkg => [pkg.name, pkg]))
  const componentNames = new Set(components.map(component => component.name))

  for (const sourceName of Object.keys(sourcesByComponent)) {
    if (!componentNames.has(sourceName)) {
      errors.push(
        `Playground sources for "${sourceName}" have no matching definition.`,
      )
    }
  }

  for (const component of components) {
    const pkg = packagesByName.get(component.packageName)
    if (!pkg) continue

    const sources = sourcesByComponent[component.name]

    if (!sources) {
      errors.push(`${component.packageName} is missing Playground sources.`)
      continue
    }

    const supported = getSupportedFrameworks(pkg)
    const expectedKeys = supported.map(framework => framework.sourceKey).sort()
    const sourceKeys = getSourceKeys(sources)

    if (
      expectedKeys.length !== sourceKeys.length ||
      expectedKeys.some((key, index) => key !== sourceKeys[index])
    ) {
      errors.push(
        `${pkg.name} Playground framework sources must match package exports exactly: expected [${expectedKeys.join(', ')}], received [${sourceKeys.join(', ')}].`,
      )
    }

    for (const framework of supported) {
      checkSource(pkg, framework, sources[framework.sourceKey], errors)
    }
  }
}

function expectedDocPath(component: ComponentCatalogItem): string {
  return `apps/docs/components/${component.name}.md`
}

function expectedPlaygroundMarkup(component: ComponentCatalogItem): string {
  if (component.name === 'data-grid') return '<DataGridPlayground />'

  return `<ComponentPlayground name="${component.name}" />`
}

function loadGeneratedDocs(
  root: string,
  override: readonly GeneratedDoc[] | undefined,
  errors: string[],
): readonly GeneratedDoc[] {
  if (override) return override

  try {
    return generateComponentDocs(createComponentDocsContext(root), root)
  } catch (error) {
    errors.push(`Unable to generate component docs: ${String(error)}`)
    return []
  }
}

function checkGeneratedComponentDocs(
  root: string,
  components: readonly ComponentCatalogItem[],
  generatedDocs: readonly GeneratedDoc[],
  errors: string[],
): void {
  const generatedComponentDocs = generatedDocs.filter(
    doc =>
      doc.path.startsWith('apps/docs/components/') &&
      doc.path !== 'apps/docs/components/index.md',
  )
  const generatedPaths = generatedComponentDocs.map(doc => doc.path)
  const expectedPaths = components.map(expectedDocPath)

  for (const duplicate of findDuplicates(generatedPaths)) {
    errors.push(`Duplicate generated component doc path "${duplicate}".`)
  }

  for (const path of unique(generatedPaths)) {
    if (!expectedPaths.includes(path)) {
      errors.push(`Generated component doc "${path}" has no catalog entry.`)
    }
  }

  for (const component of components) {
    const path = expectedDocPath(component)
    const generatedDoc = generatedComponentDocs.find(doc => doc.path === path)

    if (!generatedDoc) {
      errors.push(
        `Missing generated component doc for ${component.packageName}: ${path}.`,
      )
      continue
    }

    const expectedMarkup = expectedPlaygroundMarkup(component)

    if (!generatedDoc.content.includes(expectedMarkup)) {
      errors.push(`${path} must render "${expectedMarkup}".`)
    }

    const absolutePath = resolve(root, path)

    if (!existsSync(absolutePath)) {
      errors.push(`Missing generated component file: ${path}.`)
      continue
    }

    const current = readFileSync(absolutePath, 'utf-8')

    if (!current.includes(expectedMarkup)) {
      errors.push(`${path} must contain "${expectedMarkup}".`)
    }
  }
}

function findMarkdownFiles(directory: string): string[] {
  if (!existsSync(directory)) return []

  return readdirSync(directory, {
    withFileTypes: true,
  }).flatMap(entry => {
    const path = resolve(directory, entry.name)

    if (entry.isDirectory()) return findMarkdownFiles(path)
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : []
  })
}

function checkLegacyPlaygroundDocs(root: string, errors: string[]): void {
  const docsRoot = resolve(root, 'apps/docs')
  const playgroundRoot = resolve(docsRoot, 'playground')

  for (const path of findMarkdownFiles(playgroundRoot)) {
    const relativePath = relative(root, path).split('\\').join('/')

    errors.push(`Legacy Playground markdown must be removed: ${relativePath}.`)
  }
}

function checkDocsDependencies(
  root: string,
  packages: ComponentPackage[],
  errors: string[],
): void {
  const path = resolve(root, 'apps/docs/package.json')

  if (!existsSync(path)) {
    errors.push('Missing docs package manifest: apps/docs/package.json.')
    return
  }

  let packageJson: PackageJson

  try {
    packageJson = readJson<PackageJson>(path)
  } catch (error) {
    errors.push(`Unable to read apps/docs/package.json: ${String(error)}`)
    return
  }

  const dependencies = packageJson.devDependencies || {}

  for (const pkg of packages) {
    if (dependencies[pkg.name] !== 'workspace:*') {
      errors.push(
        `apps/docs/package.json must depend on "${pkg.name}" using "workspace:*".`,
      )
    }
  }
}

function checkSidebar(
  components: readonly ComponentCatalogItem[],
  sidebarItems: readonly SidebarItem[],
  errors: string[],
): void {
  const expectedRoutes = new Set<string>(
    components.map(component => component.route),
  )
  const componentRoutes = flattenSidebarLinks(sidebarItems).filter(
    link => link !== '/components/',
  )

  for (const component of components) {
    const count = componentRoutes.filter(
      route => route === component.route,
    ).length

    if (count !== 1) {
      errors.push(
        `Component sidebar must contain "${component.route}" exactly once; received ${count}.`,
      )
    }
  }

  for (const route of unique(componentRoutes)) {
    if (!expectedRoutes.has(route)) {
      errors.push(`Component sidebar route "${route}" has no catalog entry.`)
    }
  }
}

function flattenSidebarLinks(items: readonly SidebarItem[]): string[] {
  return items.flatMap(item => {
    const ownLink = item.link ? [item.link] : []
    const childLinks = item.items ? flattenSidebarLinks(item.items) : []

    return ownLink.concat(childLinks)
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function propertyPattern(name: string): string {
  const escaped = escapeRegExp(name)
  return `(?:${escaped}|['"]${escaped}['"])`
}

function hasExplicitLoader(
  runtimeSource: string,
  name: string,
  importPath: string,
): boolean {
  const expression = new RegExp(
    `${propertyPattern(name)}\\s*:\\s*\\(\\)\\s*=>\\s*import\\(\\s*['"]${escapeRegExp(importPath)}['"]\\s*\\)`,
  )

  return expression.test(runtimeSource)
}

function hasImportCall(runtimeSource: string, importPath: string): boolean {
  const expression = new RegExp(
    `import\\(\\s*['"]${escapeRegExp(importPath)}['"]\\s*\\)`,
  )

  return expression.test(runtimeSource)
}

function checkRuntime(
  root: string,
  components: readonly ComponentCatalogItem[],
  runtimeSourceOverride: string | undefined,
  errors: string[],
): void {
  const runtimePath =
    'apps/docs/.vitepress/theme/components/ComponentPlayground.vue'
  const absoluteRuntimePath = resolve(root, runtimePath)
  let runtimeSource = runtimeSourceOverride

  if (runtimeSource === undefined) {
    if (!existsSync(absoluteRuntimePath)) {
      errors.push(`Missing Playground runtime: ${runtimePath}.`)
      return
    }

    runtimeSource = readFileSync(absoluteRuntimePath, 'utf-8')

    const dataGridPath = resolve(
      root,
      'apps/docs/.vitepress/theme/components/DataGridPlayground.vue',
    )

    if (existsSync(dataGridPath)) {
      runtimeSource += `\n${readFileSync(dataGridPath, 'utf-8')}`
    }
  }

  for (const component of components) {
    const componentEntry = `${component.packageName}/wc/auto`
    const hasComponentLoader =
      hasExplicitLoader(runtimeSource, component.name, componentEntry) ||
      (component.name === 'data-grid' &&
        hasImportCall(runtimeSource, componentEntry))

    if (!hasComponentLoader) {
      errors.push(
        `${component.packageName} must have an explicit runtime loader for "${componentEntry}".`,
      )
    }

    if (component.name === 'data-grid') continue

    const demoEntry = `./playgrounds/demos/${component.name}-demo.vue`

    if (!hasExplicitLoader(runtimeSource, component.name, demoEntry)) {
      errors.push(
        `${component.packageName} must have an explicit demo loader for "${demoEntry}".`,
      )
    }

    if (
      runtimeSourceOverride === undefined &&
      !existsSync(
        resolve(
          root,
          'apps/docs/.vitepress/theme/components/playgrounds/demos',
          `${component.name}-demo.vue`,
        ),
      )
    ) {
      errors.push(
        `Missing Playground demo for ${component.packageName}: ${demoEntry}.`,
      )
    }
  }
}

export function checkPlaygroundContract(
  root = process.cwd(),
  options: PlaygroundContractOptions = {},
): PlaygroundContractResult {
  const errors: string[] = []
  const components =
    options.catalog === undefined ? componentCatalog : options.catalog
  const categories =
    options.categories === undefined ? componentCategories : options.categories
  const sources =
    options.sources === undefined ? playgroundSources : options.sources
  const packages = readComponentPackages(root, errors)
  const generatedDocs = loadGeneratedDocs(root, options.generatedDocs, errors)
  const sidebarItems =
    options.sidebarItems === undefined
      ? componentCategoryGroups
      : options.sidebarItems

  pushDuplicateErrors(components, errors)
  checkDefinitionCoverage(packages, components, errors)
  checkCategories(components, categories, errors)
  checkFrameworkSources(packages, components, sources, errors)
  checkGeneratedComponentDocs(root, components, generatedDocs, errors)
  checkLegacyPlaygroundDocs(root, errors)
  checkDocsDependencies(root, packages, errors)
  checkSidebar(components, sidebarItems, errors)
  checkRuntime(root, components, options.runtimeSource, errors)

  return {
    valid: errors.length === 0,
    errors,
    componentCount: components.length,
    categoryCount: categories.length,
    packageNames: packages.map(pkg => pkg.name),
  }
}
