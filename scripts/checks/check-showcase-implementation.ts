import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

import {
  getImplementedShowcasePackageNames,
  getShowcaseDemoBatchName,
  implementedShowcaseComponentNames,
  showcaseDemoBatches,
} from '../../examples/showcase-shared/src/implemented'

const root = process.cwd()

const expectedBuildDepsScript =
  'pnpm -w exec tsx scripts/examples/build-showcase-deps.ts'

interface PackageJson {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function readPackageJson(path: string): PackageJson {
  const absolutePath = resolve(root, path)
  return JSON.parse(readFileSync(absolutePath, 'utf-8')) as PackageJson
}

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map(part => {
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('')
}

function checkNoDuplicateNames(): string[] {
  const seen = new Set<string>()
  const errors: string[] = []

  for (const name of implementedShowcaseComponentNames) {
    if (seen.has(name)) {
      errors.push(`Duplicate implemented showcase component name: ${name}`)
    }

    seen.add(name)
  }

  return errors
}

function checkBatchCoverage(): string[] {
  const errors: string[] = []

  for (const name of implementedShowcaseComponentNames) {
    if (!getShowcaseDemoBatchName(name)) {
      errors.push(`Missing demo batch for implemented component: ${name}`)
    }
  }

  const batchEntries: [string, readonly string[]][] = [
    ['p0', showcaseDemoBatches.p0],
    ['forms', showcaseDemoBatches.forms],
    ['visual', showcaseDemoBatches.visual],
    ['disclosure', showcaseDemoBatches.disclosure],
  ]
  for (const [batchName, names] of batchEntries) {
    if (names.length === 0) {
      errors.push(`Showcase demo batch "${batchName}" must not be empty.`)
    }
  }

  return errors
}

function checkDemoFiles(): string[] {
  const errors: string[] = []

  for (const name of implementedShowcaseComponentNames) {
    const batchName = getShowcaseDemoBatchName(name)

    if (!batchName) {
      continue
    }

    const componentFileName = `${toPascalCase(name)}DemoPage`
    const reactPath = resolve(
      root,
      `examples/react-showcase/src/demos/${batchName}/${componentFileName}.tsx`,
    )
    const vuePath = resolve(
      root,
      `examples/vue-showcase/src/demos/${batchName}/${componentFileName}.vue`,
    )

    if (!existsSync(reactPath)) {
      errors.push(
        `Missing React showcase demo for "${name}": examples/react-showcase/src/demos/${batchName}/${componentFileName}.tsx`,
      )
    }

    if (!existsSync(vuePath)) {
      errors.push(
        `Missing Vue showcase demo for "${name}": examples/vue-showcase/src/demos/${batchName}/${componentFileName}.vue`,
      )
    }
  }

  return errors
}

function checkPackageDeps(): string[] {
  const errors: string[] = []
  const packageNames = getImplementedShowcasePackageNames()

  const reactPackage = readPackageJson('examples/react-showcase/package.json')
  const vuePackage = readPackageJson('examples/vue-showcase/package.json')

  for (const packageName of packageNames) {
    if (!reactPackage.dependencies?.[packageName]) {
      errors.push(
        `examples/react-showcase/package.json is missing dependency "${packageName}".`,
      )
    }

    if (!vuePackage.dependencies?.[packageName]) {
      errors.push(
        `examples/vue-showcase/package.json is missing dependency "${packageName}".`,
      )
    }
  }

  if (!reactPackage.dependencies?.['@zeus-web/icons']) {
    errors.push(
      'examples/react-showcase/package.json is missing dependency "@zeus-web/icons".',
    )
  }

  return errors
}

function checkBuildDepsScripts(): string[] {
  const errors: string[] = []

  const reactPackage = readPackageJson('examples/react-showcase/package.json')
  const vuePackage = readPackageJson('examples/vue-showcase/package.json')

  if (reactPackage.scripts?.['build:deps'] !== expectedBuildDepsScript) {
    errors.push(
      `React showcase build:deps must be "${expectedBuildDepsScript}".`,
    )
  }

  if (vuePackage.scripts?.['build:deps'] !== expectedBuildDepsScript) {
    errors.push(`Vue showcase build:deps must be "${expectedBuildDepsScript}".`)
  }

  return errors
}

function checkRootScripts(): string[] {
  const errors: string[] = []
  const rootPackage = readPackageJson('package.json')

  if (
    rootPackage.scripts?.['check:showcase-implementation'] !==
    'tsx scripts/checks/check-showcase-implementation.ts'
  ) {
    errors.push(
      'Root package.json must define "check:showcase-implementation".',
    )
  }

  const siteCheck = rootPackage.scripts?.['site:check'] ?? ''

  if (!siteCheck.includes('pnpm check:showcase-implementation')) {
    errors.push(
      'Root package.json site:check must include "pnpm check:showcase-implementation".',
    )
  }

  return errors
}

function main(): void {
  const errors = [
    ...checkNoDuplicateNames(),
    ...checkBatchCoverage(),
    ...checkDemoFiles(),
    ...checkPackageDeps(),
    ...checkBuildDepsScripts(),
    ...checkRootScripts(),
  ]

  if (errors.length > 0) {
    console.error(pc.red('Showcase implementation check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Showcase implementation check passed.'))
}

main()
