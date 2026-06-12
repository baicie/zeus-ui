import type { PackageJsonLike, WorkspacePackage } from '../release/workspace'

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import pc from 'picocolors'

import {
  getUniqueVersions,
  listPublishablePackages,
  listWorkspacePackages,
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

function hasDistTarget(pkg: WorkspacePackage, target: string): boolean {
  return existsSync(resolve(pkg.dir, target.replace(/^\.\//, '')))
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function collectExportTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value]

  if (Array.isArray(value)) {
    return value.flatMap(collectExportTargets)
  }

  if (!value || typeof value !== 'object') return []

  const result: string[] = []

  for (const child of Object.values(value as Record<string, unknown>)) {
    result.push(...collectExportTargets(child))
  }

  return result
}

function isRuntimeExportTarget(target: string): boolean {
  return (
    target.startsWith('./dist/') ||
    target.endsWith('.css') ||
    target.endsWith('.json') ||
    target.endsWith('.svg')
  )
}

function checkExportTargets(pkg: WorkspacePackage, errors: string[]): void {
  const exports = toObject(pkg.packageJson.exports)

  for (const [key, value] of Object.entries(exports)) {
    const targets = collectExportTargets(value)

    if (targets.length === 0) {
      errors.push(`${pkg.name}: export ${key} must point to at least one file`)
      continue
    }

    for (const target of targets) {
      if (!target.startsWith('./')) {
        errors.push(
          `${pkg.name}: export ${key} target must be relative: ${target}`,
        )
        continue
      }

      if (!isRuntimeExportTarget(target)) {
        errors.push(
          `${pkg.name}: export ${key} target must point to dist/css/json/svg output: ${target}`,
        )
        continue
      }

      if (!hasDistTarget(pkg, target)) {
        errors.push(
          `${pkg.name}: export ${key} target does not exist: ${target}`,
        )
      }
    }
  }
}

function checkFilesAllowList(pkg: WorkspacePackage, errors: string[]): void {
  const files = toArray(pkg.packageJson.files).map(String)

  if (!files.includes('dist')) {
    errors.push(`${pkg.name}: files must include dist`)
  }

  for (const forbidden of [
    'src',
    'tests',
    '__tests__',
    'examples',
    'scripts',
  ]) {
    if (files.includes(forbidden)) {
      errors.push(`${pkg.name}: files must not include ${forbidden}`)
    }
  }
}

function checkReadmeAndLicense(pkg: WorkspacePackage, errors: string[]): void {
  if (!existsSync(resolve(pkg.dir, 'README.md'))) {
    errors.push(`${pkg.name}: package README.md is required`)
  }

  const rootLicense = resolve(process.cwd(), 'LICENSE')
  const pkgLicense = resolve(pkg.dir, 'LICENSE')

  if (!existsSync(rootLicense) && !existsSync(pkgLicense)) {
    errors.push(`${pkg.name}: LICENSE is required at repo root or package root`)
  }
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

  checkFilesAllowList(pkg, errors)

  if (!json.scripts?.build) {
    errors.push(`${pkg.name}: scripts.build is required`)
  }

  if (!json.scripts?.check) {
    errors.push(`${pkg.name}: scripts.check is required`)
  }

  if (!existsSync(join(pkg.dir, 'dist'))) {
    errors.push(`${pkg.name}: dist is missing. Run pnpm build first.`)
  }

  checkReadmeAndLicense(pkg, errors)
  checkExportTargets(pkg, errors)

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

  const binFile = resolve(pkg.dir, 'dist/index.js')

  if (existsSync(binFile)) {
    const source = readFileSync(binFile, 'utf-8')

    if (!source.startsWith('#!/usr/bin/env node')) {
      errors.push(`${pkg.name}: dist/index.js must start with node shebang`)
    }
  }
}

function checkUiPackage(pkg: WorkspacePackage, errors: string[]): void {
  for (const key of ['.', './styles.css', './button', './input']) {
    if (!hasExport(pkg.packageJson, key)) {
      errors.push(`${pkg.name}: ui package must export ${key}`)
    }
  }

  for (const target of [
    './dist/index.js',
    './dist/index.d.ts',
    './dist/styles.css',
    './dist/button.js',
    './dist/button.d.ts',
    './dist/input.js',
    './dist/input.d.ts',
  ]) {
    if (!hasDistTarget(pkg, target)) {
      errors.push(`${pkg.name}: missing build output ${target}`)
    }
  }
}

function checkRegistryPackage(pkg: WorkspacePackage, errors: string[]): void {
  for (const key of [
    '.',
    './registry.json',
    './templates/react/button.tsx',
    './templates/react/input.tsx',
    './templates/vue/button.vue',
    './templates/vue/input.vue',
    './templates/lib/cn.ts',
    './templates/css/globals.css',
  ]) {
    if (!hasExport(pkg.packageJson, key)) {
      errors.push(`${pkg.name}: registry package must export ${key}`)
    }
  }

  for (const target of [
    './dist/index.js',
    './dist/index.d.ts',
    './dist/registry.json',
    './dist/templates/react/button.tsx',
    './dist/templates/react/input.tsx',
    './dist/templates/vue/button.vue',
    './dist/templates/vue/input.vue',
    './dist/templates/lib/cn.ts',
    './dist/templates/css/globals.css',
  ]) {
    if (!hasDistTarget(pkg, target)) {
      errors.push(`${pkg.name}: missing build output ${target}`)
    }
  }
}

function checkThemesPackage(pkg: WorkspacePackage, errors: string[]): void {
  for (const key of ['.', './default.css', './components.css']) {
    if (!hasExport(pkg.packageJson, key)) {
      errors.push(`${pkg.name}: themes package must export ${key}`)
    }
  }

  for (const target of [
    './dist/index.js',
    './dist/index.d.ts',
    './dist/default.css',
    './dist/components.css',
  ]) {
    if (!hasDistTarget(pkg, target)) {
      errors.push(`${pkg.name}: missing build output ${target}`)
    }
  }
}

function checkAiPackage(pkg: WorkspacePackage, errors: string[]): void {
  for (const key of ['.', './metadata.json']) {
    if (!hasExport(pkg.packageJson, key)) {
      errors.push(`${pkg.name}: ai package must export ${key}`)
    }
  }

  for (const target of [
    './dist/index.js',
    './dist/index.d.ts',
    './dist/metadata.json',
  ]) {
    if (!hasDistTarget(pkg, target)) {
      errors.push(`${pkg.name}: missing build output ${target}`)
    }
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

  if (pkg.name === '@zeus-web/ui') {
    checkUiPackage(pkg, errors)
  }

  if (pkg.name === '@zeus-web/registry') {
    checkRegistryPackage(pkg, errors)
  }

  if (pkg.name === '@zeus-web/themes') {
    checkThemesPackage(pkg, errors)
  }

  if (pkg.name === '@zeus-web/ai') {
    checkAiPackage(pkg, errors)
  }
}

function checkPrivateWorkspacePackages(errors: string[]): void {
  for (const pkg of listWorkspacePackages()) {
    if (
      !pkg.name.startsWith('@zeus-web/example-') &&
      pkg.name !== '@zeus-web/docs'
    ) {
      continue
    }

    if (!pkg.isPrivate) {
      errors.push(`${pkg.name}: examples/docs packages must be private`)
    }
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

  checkPrivateWorkspacePackages(errors)

  if (errors.length > 0) {
    console.error(pc.red('Release readiness check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Release readiness check passed.'))
  console.log(`Checked ${packages.length} publishable packages.`)
}

main()
