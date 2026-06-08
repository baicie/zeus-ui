import type { PackageJsonLike, WorkspacePackage } from '../release/workspace'
import { existsSync } from 'node:fs'

import { join, resolve } from 'node:path'

import pc from 'picocolors'
import {
  getUniqueVersions,
  listPublishablePackages,
  repositoryUrl,
} from '../release/workspace'

interface Options {
  allowZero: boolean
  strict: boolean
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    allowZero: false,
    strict: false,
  }

  for (const arg of args) {
    if (arg === '--allow-zero') {
      options.allowZero = true
      continue
    }

    if (arg === '--strict') {
      options.strict = true
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

function isSemverLike(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i.test(version)
}

function hasExport(pkg: PackageJsonLike, key: string): boolean {
  return Boolean(pkg.exports && key in pkg.exports)
}

function hasFile(pkg: PackageJsonLike, file: string): boolean {
  return Array.isArray(pkg.files) && pkg.files.includes(file)
}

function hasDistTarget(pkg: WorkspacePackage, target: string): boolean {
  return existsSync(resolve(pkg.dir, target.replace(/^\.\//, '')))
}

function checkCommonPackage(
  pkg: WorkspacePackage,
  options: Options,
  errors: string[],
): void {
  const json = pkg.packageJson

  if (!pkg.name.startsWith('@zeus-web/')) {
    errors.push(`${pkg.name}: package name must start with @zeus-web/`)
  }

  if (!isSemverLike(pkg.version)) {
    errors.push(`${pkg.name}: invalid semver version ${pkg.version}`)
  }

  if (!options.allowZero && pkg.version === '0.0.0') {
    errors.push(`${pkg.name}: version must not be 0.0.0 for release`)
  }

  if (json.license !== 'MIT') {
    errors.push(`${pkg.name}: license must be MIT`)
  }

  if (!json.description) {
    errors.push(`${pkg.name}: description is required`)
  }

  if (!json.exports) {
    errors.push(`${pkg.name}: exports is required`)
  }

  if (!hasFile(json, 'dist')) {
    errors.push(`${pkg.name}: files must include dist`)
  }

  if (!json.scripts?.build) {
    errors.push(`${pkg.name}: scripts.build is required`)
  }

  if (!json.scripts?.check) {
    errors.push(`${pkg.name}: scripts.check is required`)
  }

  if (!existsSync(join(pkg.dir, 'dist'))) {
    errors.push(`${pkg.name}: dist is missing. Run pnpm build first.`)
  }

  if (options.strict) {
    const repository = json.repository

    if (
      !repository ||
      typeof repository === 'string' ||
      repository.url !== repositoryUrl ||
      repository.type !== 'git' ||
      !repository.directory
    ) {
      errors.push(
        `${pkg.name}: repository must be { type: "git", url: "${repositoryUrl}", directory }`,
      )
    }

    if (
      !json.publishConfig ||
      json.publishConfig.access !== 'public' ||
      json.publishConfig.provenance !== true
    ) {
      errors.push(
        `${pkg.name}: publishConfig must include { access: "public", provenance: true }`,
      )
    }
  }
}

function checkPrimitivePackage(pkg: WorkspacePackage, errors: string[]): void {
  for (const key of [
    '.',
    './wc',
    './react',
    './vue',
    './vue/global',
    './custom-elements.json',
    './zeus.components.json',
  ]) {
    if (!hasExport(pkg.packageJson, key)) {
      errors.push(`${pkg.name}: primitive package must export ${key}`)
    }
  }

  for (const target of [
    './dist/wc/index.js',
    './dist/wc/index.d.ts',
    './dist/react/index.js',
    './dist/react/index.d.ts',
    './dist/vue/index.js',
    './dist/vue/index.d.ts',
    './dist/vue/global.d.ts',
    './dist/custom-elements.json',
    './dist/zeus.components.json',
  ]) {
    if (!hasDistTarget(pkg, target)) {
      errors.push(`${pkg.name}: missing build output ${target}`)
    }
  }
}

function checkIconsPackage(pkg: WorkspacePackage, errors: string[]): void {
  for (const key of [
    '.',
    './react',
    './vue',
    './wc',
    './manifest.json',
    './svg/*',
  ]) {
    if (!hasExport(pkg.packageJson, key)) {
      errors.push(`${pkg.name}: icons package must export ${key}`)
    }
  }

  for (const target of [
    './dist/index.js',
    './dist/index.d.ts',
    './dist/react/index.js',
    './dist/react/index.d.ts',
    './dist/vue/index.js',
    './dist/vue/index.d.ts',
    './dist/wc/index.js',
    './dist/wc/index.d.ts',
    './dist/manifest.json',
    './dist/svg/check.svg',
  ]) {
    if (!hasDistTarget(pkg, target)) {
      errors.push(`${pkg.name}: missing build output ${target}`)
    }
  }
}

function checkCliPackage(pkg: WorkspacePackage, errors: string[]): void {
  if (!pkg.packageJson.bin || typeof pkg.packageJson.bin !== 'object') {
    errors.push(`${pkg.name}: CLI package must declare bin`)
    return
  }

  const bin = pkg.packageJson.bin as Record<string, string>

  if (bin.zweb !== './dist/index.js') {
    errors.push(`${pkg.name}: CLI bin.zweb must be ./dist/index.js`)
  }

  if (!hasDistTarget(pkg, './dist/index.js')) {
    errors.push(`${pkg.name}: missing dist/index.js`)
  }
}

function checkSpecificPackage(pkg: WorkspacePackage, errors: string[]): void {
  if (pkg.isPrimitive) {
    checkPrimitivePackage(pkg, errors)
  }

  if (pkg.name === '@zeus-web/icons') {
    checkIconsPackage(pkg, errors)
  }

  if (pkg.name === '@zeus-web/cli') {
    checkCliPackage(pkg, errors)
  }
}

function main(): void {
  const options = parseOptions(process.argv.slice(2))
  const packages = listPublishablePackages()
  const errors: string[] = []

  if (packages.length === 0) {
    errors.push('No publishable packages found.')
  }

  const versions = getUniqueVersions(packages)

  if (versions.length > 1) {
    errors.push(
      `All publishable packages must have the same version. Found: ${versions.join(', ')}`,
    )
  }

  for (const pkg of packages) {
    checkCommonPackage(pkg, options, errors)
    checkSpecificPackage(pkg, errors)
  }

  if (errors.length > 0) {
    console.error(pc.red('Release readiness check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(
    pc.green(
      `Release readiness check passed for ${packages.length} publishable package(s).`,
    ),
  )
}

try {
  main()
} catch (error) {
  console.error(pc.red((error as Error).message))
  process.exit(1)
}
