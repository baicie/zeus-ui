import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

import pc from 'picocolors'

type RegistryFramework = 'react' | 'vue' | 'native' | 'shared'
type RegistryItemType = 'component' | 'utility' | 'style'

interface RegistryFile {
  framework: RegistryFramework
  source: string
  target: string
}

interface RegistryItem {
  name: string
  type: RegistryItemType
  description: string
  frameworks: RegistryFramework[]
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

interface RegistryManifest {
  schemaVersion: 1
  name: string
  version: string
  items: RegistryItem[]
}

interface ShowcaseTarget {
  name: 'react' | 'vue'
  framework: 'react' | 'vue'
  root: string
}

interface PlannedFile {
  source: string
  target: string
  content: string
}

const root = process.cwd()

const registryPath = resolve(root, 'packages/registry/registry.json')
const registryTemplatesRoot = resolve(root, 'packages/registry')

const showcaseTargets: ShowcaseTarget[] = [
  {
    name: 'react',
    framework: 'react',
    root: 'examples/react-showcase',
  },
  {
    name: 'vue',
    framework: 'vue',
    root: 'examples/vue-showcase',
  },
]

const syncedComponents = ['button', 'input']

function hasArg(name: string): boolean {
  return process.argv.includes(name)
}

function toProjectPath(path: string): string {
  return relative(root, path).replace(/\\/g, '/')
}

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

function readRegistry(): RegistryManifest {
  return JSON.parse(readText(registryPath)) as RegistryManifest
}

function findRegistryItem(
  registry: RegistryManifest,
  name: string,
): RegistryItem {
  const item = registry.items.find(entry => entry.name === name)

  if (!item) {
    const available = registry.items.map(entry => entry.name).join(', ')
    throw new Error(`Unknown registry item "${name}". Available: ${available}`)
  }

  return item
}

function collectRegistryItems(params: {
  registry: RegistryManifest
  name: string
  collected: Map<string, RegistryItem>
  visiting: string[]
}) {
  const { registry, name, collected, visiting } = params

  if (collected.has(name)) return

  if (visiting.includes(name)) {
    throw new Error(
      `Circular registry dependency: ${[...visiting, name].join(' -> ')}`,
    )
  }

  const item = findRegistryItem(registry, name)

  for (const dependency of item.registryDependencies) {
    collectRegistryItems({
      registry,
      name: dependency,
      collected,
      visiting: [...visiting, name],
    })
  }

  collected.set(item.name, item)
}

function getSyncedRegistryItems(registry: RegistryManifest): RegistryItem[] {
  const collected = new Map<string, RegistryItem>()

  for (const component of syncedComponents) {
    collectRegistryItems({
      registry,
      name: component,
      collected,
      visiting: [],
    })
  }

  return Array.from(collected.values())
}

function shouldIncludeFile(
  target: ShowcaseTarget,
  file: RegistryFile,
): boolean {
  return file.framework === 'shared' || file.framework === target.framework
}

function createShowcaseConfig(target: ShowcaseTarget): string {
  return `${JSON.stringify(
    {
      $schema: 'https://zeus-web.dev/schema/zeus-ui.json',
      framework: target.framework,
      style: 'default',
      typescript: true,
      srcDir: 'src',
      theme: {
        radius: 'md',
        motion: 'normal',
        darkMode: 'class',
      },
      tailwind: {
        css: 'src/styles/zeus.css',
        cssVariables: true,
      },
      aliases: {
        components: '@/components',
        ui: '@/components/ui',
        lib: '@/lib',
        styles: '@/styles',
      },
    },
    null,
    2,
  )}\n`
}

function createShowcaseLock(
  target: ShowcaseTarget,
  items: RegistryItem[],
): string {
  const components: Record<
    string,
    {
      files: string[]
      dependencies: string[]
      registryDependencies: string[]
      updatedAt: string
    }
  > = {}

  for (const item of items) {
    const files = item.files
      .filter(file => shouldIncludeFile(target, file))
      .map(file => `src/${file.target}`)

    if (files.length === 0) continue

    components[item.name] = {
      files,
      dependencies: item.dependencies,
      registryDependencies: item.registryDependencies,
      updatedAt: 'showcase-registry-sync',
    }
  }

  return `${JSON.stringify(
    {
      version: 1,
      components,
    },
    null,
    2,
  )}\n`
}

function createPlannedFilesForTarget(
  registry: RegistryManifest,
  target: ShowcaseTarget,
): PlannedFile[] {
  const items = getSyncedRegistryItems(registry)
  const targetRoot = resolve(root, target.root)
  const planned: PlannedFile[] = [
    {
      source: 'generated:zeus-ui.json',
      target: resolve(targetRoot, 'zeus-ui.json'),
      content: createShowcaseConfig(target),
    },
    {
      source: 'generated:zeus-ui.lock.json',
      target: resolve(targetRoot, 'zeus-ui.lock.json'),
      content: createShowcaseLock(target, items),
    },
  ]

  for (const item of items) {
    for (const file of item.files) {
      if (!shouldIncludeFile(target, file)) continue

      const sourcePath = resolve(registryTemplatesRoot, file.source)
      const targetPath = resolve(targetRoot, 'src', file.target)

      planned.push({
        source: file.source,
        target: targetPath,
        content: readText(sourcePath),
      })
    }
  }

  return planned
}

function createPlannedFiles(registry: RegistryManifest): PlannedFile[] {
  return showcaseTargets.flatMap(target =>
    createPlannedFilesForTarget(registry, target),
  )
}

function checkPlannedFiles(planned: PlannedFile[]): string[] {
  const errors: string[] = []

  for (const file of planned) {
    if (!existsSync(file.target)) {
      errors.push(
        `Missing generated showcase registry file: ${toProjectPath(file.target)}`,
      )
      continue
    }

    const current = readText(file.target)

    if (current !== file.content) {
      errors.push(
        `Outdated showcase registry file: ${toProjectPath(file.target)}`,
      )
    }
  }

  return errors
}

async function writePlannedFiles(planned: PlannedFile[]) {
  for (const file of planned) {
    await mkdir(dirname(file.target), {
      recursive: true,
    })

    await writeFile(file.target, file.content, 'utf-8')

    console.log(`${pc.green('SYNC')} ${toProjectPath(file.target)}`)
  }
}

async function main() {
  const check = hasArg('--check')
  const registry = readRegistry()
  const planned = createPlannedFiles(registry)

  if (check) {
    const errors = checkPlannedFiles(planned)

    if (errors.length > 0) {
      console.error(pc.red('Showcase registry sync check failed:'))

      for (const error of errors) {
        console.error(`- ${error}`)
      }

      console.error('')
      console.error('Run:')
      console.error('  pnpm showcase:registry:sync')

      process.exit(1)
    }

    console.log(pc.green('Showcase registry files are up to date.'))
    return
  }

  await writePlannedFiles(planned)
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
