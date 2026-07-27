import type { PlaygroundComponent } from '../../../apps/docs/.vitepress/data/playground-manifest'
import type {
  PlaygroundSource,
  PlaygroundSourceSet,
} from '../../../apps/docs/.vitepress/data/playground-sources'
import type { GeneratedDoc } from '../../docs/component-docs'

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { playgroundComponents } from '../../../apps/docs/.vitepress/data/playground-manifest'
import { playgroundSources } from '../../../apps/docs/.vitepress/data/playground-sources'
import { playgroundItems } from '../../../apps/docs/.vitepress/data/site'
import { generatePlaygroundDocs } from '../../docs/playground-docs'

interface PackageJson {
  name?: string
  private?: boolean
  exports?: Record<string, unknown>
  devDependencies?: Record<string, string>
}

interface ComponentPackage {
  name: string
  componentName: string
  group: PlaygroundComponent['group']
  exports: Record<string, unknown>
}

interface FrameworkContract {
  exportPath: string
  label: string
  sourceKey: keyof PlaygroundSourceSet
  sourcePath: (packageName: string) => string
}

interface SidebarItem {
  link: string
}

type PlaygroundSources = Partial<Record<string, PlaygroundSourceSet>>

export interface PlaygroundContractOptions {
  components?: readonly PlaygroundComponent[]
  sources?: PlaygroundSources
  generatedDocs?: readonly GeneratedDoc[]
  sidebarItems?: readonly SidebarItem[]
  runtimeSource?: string
}

export interface PlaygroundContractResult {
  valid: boolean
  errors: string[]
  componentCount: number
  packageNames: string[]
}

const componentPackageRoots = [
  {
    dir: 'packages/primitives',
    group: 'primitives',
  },
  {
    dir: 'packages/advanced',
    group: 'advanced',
  },
] as const

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
        group: packageRoot.group,
        exports: packageJson.exports || {},
      })
    }
  }

  return packages.sort((left, right) => left.name.localeCompare(right.name))
}

function pushDuplicateErrors(
  components: readonly PlaygroundComponent[],
  errors: string[],
): void {
  for (const name of findDuplicates(
    components.map(component => component.name),
  )) {
    errors.push(`Duplicate Playground definition name "${name}".`)
  }

  for (const packageName of findDuplicates(
    components.map(component => component.packageName),
  )) {
    errors.push(`Duplicate Playground package name "${packageName}".`)
  }

  for (const route of findDuplicates(
    components.map(component => component.route),
  )) {
    errors.push(`Duplicate Playground route "${route}".`)
  }
}

function checkDefinitionCoverage(
  packages: ComponentPackage[],
  components: readonly PlaygroundComponent[],
  errors: string[],
): void {
  const packagesByName = new Map(packages.map(pkg => [pkg.name, pkg]))
  const componentsByPackage = new Map<string, PlaygroundComponent>(
    components.map(component => [component.packageName, component]),
  )

  for (const pkg of packages) {
    if (!componentsByPackage.has(pkg.name)) {
      errors.push(`Missing Playground definition for ${pkg.name}.`)
    }
  }

  for (const component of components) {
    const pkg = packagesByName.get(component.packageName)

    if (!pkg) {
      errors.push(
        `Playground definition "${component.name}" has no matching public component package.`,
      )
      continue
    }

    if (component.name !== pkg.componentName) {
      errors.push(
        `${component.packageName} Playground name must be "${pkg.componentName}".`,
      )
    }

    if (component.group !== pkg.group) {
      errors.push(
        `${component.packageName} Playground group must be "${pkg.group}".`,
      )
    }

    const expectedRoute = `/playground/${component.name}/`

    if (component.route !== expectedRoute) {
      errors.push(
        `${component.packageName} Playground route must be "${expectedRoute}".`,
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
  components: readonly PlaygroundComponent[],
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

function expectedDocPath(component: PlaygroundComponent): string {
  return `apps/docs/playground/${component.name}/index.md`
}

function expectedPlaygroundMarkup(component: PlaygroundComponent): string {
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
    return generatePlaygroundDocs(root)
  } catch (error) {
    errors.push(`Unable to generate Playground docs: ${String(error)}`)
    return []
  }
}

function checkGeneratedRoutes(
  root: string,
  components: readonly PlaygroundComponent[],
  generatedDocs: readonly GeneratedDoc[],
  errors: string[],
): void {
  const generatedPlaygroundDocs = generatedDocs.filter(doc =>
    doc.path.startsWith('apps/docs/playground/'),
  )
  const generatedPaths = generatedPlaygroundDocs.map(doc => doc.path)
  const expectedPaths = components.map(expectedDocPath)

  for (const duplicate of findDuplicates(generatedPaths)) {
    errors.push(`Duplicate generated Playground path "${duplicate}".`)
  }

  for (const path of unique(generatedPaths)) {
    if (!expectedPaths.includes(path)) {
      errors.push(`Generated Playground route "${path}" has no definition.`)
    }
  }

  for (const component of components) {
    const path = expectedDocPath(component)
    const generatedDoc = generatedPlaygroundDocs.find(doc => doc.path === path)

    if (!generatedDoc) {
      errors.push(
        `Missing generated Playground route for ${component.packageName}: ${path}.`,
      )
      continue
    }

    const expectedMarkup = expectedPlaygroundMarkup(component)

    if (!generatedDoc.content.includes(expectedMarkup)) {
      errors.push(`${path} must render "${expectedMarkup}".`)
    }

    const absolutePath = resolve(root, path)

    if (!existsSync(absolutePath)) {
      errors.push(`Missing generated Playground file: ${path}.`)
      continue
    }

    const current = readFileSync(absolutePath, 'utf-8')

    if (!current.includes(expectedMarkup)) {
      errors.push(`${path} must contain "${expectedMarkup}".`)
    }
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
  components: readonly PlaygroundComponent[],
  sidebarItems: readonly SidebarItem[],
  errors: string[],
): void {
  const expectedRoutes = new Set<string>(
    components.map(component => component.route),
  )
  const componentRoutes = sidebarItems
    .map(item => item.link)
    .filter(link => link !== '/playground/')

  for (const component of components) {
    const count = componentRoutes.filter(
      route => route === component.route,
    ).length

    if (count !== 1) {
      errors.push(
        `Playground sidebar must contain "${component.route}" exactly once; received ${count}.`,
      )
    }
  }

  for (const route of unique(componentRoutes)) {
    if (!expectedRoutes.has(route)) {
      errors.push(`Playground sidebar route "${route}" has no definition.`)
    }
  }
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
  components: readonly PlaygroundComponent[],
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
    options.components === undefined ? playgroundComponents : options.components
  const sources =
    options.sources === undefined ? playgroundSources : options.sources
  const packages = readComponentPackages(root, errors)
  const generatedDocs = loadGeneratedDocs(root, options.generatedDocs, errors)
  const sidebarItems =
    options.sidebarItems === undefined ? playgroundItems : options.sidebarItems

  pushDuplicateErrors(components, errors)
  checkDefinitionCoverage(packages, components, errors)
  checkFrameworkSources(packages, components, sources, errors)
  checkGeneratedRoutes(root, components, generatedDocs, errors)
  checkDocsDependencies(root, packages, errors)
  checkSidebar(components, sidebarItems, errors)
  checkRuntime(root, components, options.runtimeSource, errors)

  return {
    valid: errors.length === 0,
    errors,
    componentCount: components.length,
    packageNames: packages.map(pkg => pkg.name),
  }
}
