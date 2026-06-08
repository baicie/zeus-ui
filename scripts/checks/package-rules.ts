import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface PackageJsonLike {
  name?: string
  private?: boolean
  scripts?: Record<string, string>
  sideEffects?: boolean | string[]
  exports?: Record<string, unknown>
  peerDependencies?: Record<string, string>
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

export interface PackageRuleResult {
  valid: boolean
  errors: string[]
}

function toForwardSlash(p: string): string {
  return p.replace(/\\/g, '/')
}

export function validatePackageRules(
  root: string,
  packageJsonPath: string,
): PackageRuleResult {
  const errors: string[] = []
  const pkg = JSON.parse(
    readFileSync(packageJsonPath, 'utf8'),
  ) as PackageJsonLike
  const rel = toForwardSlash(relative(root, packageJsonPath))
  const isPrimitive = rel.startsWith('packages/primitives/')
  const isCompat = rel.startsWith('packages/zeus-compat/')

  if (pkg.private) {
    return {
      valid: true,
      errors,
    }
  }

  if (!pkg.name || !pkg.name.startsWith('@zeus-web/')) {
    errors.push(`${rel}: package name must start with @zeus-web/`)
  }

  if (!pkg.exports) {
    errors.push(`${pkg.name}: missing exports`)
  }

  validateZeusDependencyBoundary(pkg, errors, {
    allowPrimitiveRuntimeDependencies: isPrimitive,
  })

  if (isPrimitive) {
    validatePrimitivePackage(packageJsonPath, pkg, errors)
  }

  if (isCompat) {
    validateCompatPackage(packageJsonPath, pkg, errors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

function validateZeusDependencyBoundary(
  pkg: PackageJsonLike,
  errors: string[],
  options: {
    allowPrimitiveRuntimeDependencies: boolean
  },
): void {
  const allowedPrimitiveRuntimeDependencies = new Set([
    '@zeus-js/runtime-dom',
    '@zeus-js/web-c-runtime',
  ])

  const allowedToolingDependencies = new Set(['@zeus-js/output-icons'])

  for (const field of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
  ] as const) {
    const dependencies = pkg[field] ?? {}

    for (const name of Object.keys(dependencies)) {
      if (!name.startsWith('@zeus-js/')) continue

      const isAllowedPeer =
        field === 'peerDependencies' && name === '@zeus-js/zeus'
      const isAllowedPrimitiveRuntimeDependency =
        options.allowPrimitiveRuntimeDependencies &&
        field === 'dependencies' &&
        allowedPrimitiveRuntimeDependencies.has(name)
      const isAllowedToolingDependency =
        field === 'dependencies' && allowedToolingDependencies.has(name)

      if (
        isAllowedPeer ||
        isAllowedPrimitiveRuntimeDependency ||
        isAllowedToolingDependency
      ) {
        continue
      }

      errors.push(
        `${pkg.name}: must not declare ${field}.${name}; consume Zeus through peerDependencies.@zeus-js/zeus or generated primitive runtime dependencies`,
      )
    }
  }
}

function validatePrimitivePackage(
  packageJsonPath: string,
  pkg: PackageJsonLike,
  errors: string[],
): void {
  const packageDir = packageJsonPath.replace(/[/\\]package\.json$/, '')

  validatePrimitiveRolldownConfig(packageDir, pkg, errors)

  if (
    !pkg.scripts ||
    !pkg.scripts.build ||
    !pkg.scripts.build.includes('rolldown -c ../../../rolldown.config.ts')
  ) {
    errors.push(
      `${pkg.name}: primitive package build script must use shared rolldown.config.ts`,
    )
  }

  if (!pkg.peerDependencies || !pkg.peerDependencies['@zeus-js/zeus']) {
    errors.push(
      `${pkg.name}: primitive package must peer depend on @zeus-js/zeus`,
    )
  }

  if (
    !pkg.dependencies ||
    pkg.dependencies['@zeus-web/zeus-compat'] !== 'workspace:*'
  ) {
    errors.push(
      `${pkg.name}: primitive package must depend on @zeus-web/zeus-compat workspace:*`,
    )
  }

  for (const key of [
    '.',
    './wc',
    './react',
    './vue',
    './custom-elements.json',
    './zeus.components.json',
  ]) {
    if (!pkg.exports || !(key in pkg.exports)) {
      errors.push(`${pkg.name}: primitive package must export ${key}`)
    }
  }

  if (!Array.isArray(pkg.sideEffects)) {
    errors.push(`${pkg.name}: primitive package sideEffects must be string[]`)
  } else {
    const hasWcSideEffect = pkg.sideEffects.some(item =>
      item.includes('dist/wc'),
    )
    if (!hasWcSideEffect) {
      errors.push(
        `${pkg.name}: primitive package sideEffects must include dist/wc entry`,
      )
    }
  }

  for (const forbidden of ['src/wc.ts', 'src/react.ts', 'src/vue.ts']) {
    if (existsSync(join(packageDir, forbidden))) {
      errors.push(
        `${pkg.name}: primitive package must not hand-write ${forbidden}; use @zeus-js/output-* instead`,
      )
    }
  }
}

function validatePrimitiveRolldownConfig(
  packageDir: string,
  pkg: PackageJsonLike,
  errors: string[],
): void {
  if (existsSync(join(packageDir, 'rolldown.config.ts'))) {
    errors.push(
      `${pkg.name}: primitive package must use root rolldown.config.ts instead of local rolldown.config.ts`,
    )
  }

  if (existsSync(join(packageDir, 'rolldown.config.mjs'))) {
    errors.push(
      `${pkg.name}: primitive package must use root rolldown.config.ts instead of local rolldown.config.mjs`,
    )
  }

  const configPath = join(packageDir, '../../../rolldown.config.ts')

  if (!existsSync(configPath)) {
    errors.push(`${pkg.name}: missing root rolldown.config.ts`)
    return
  }

  const config = readFileSync(configPath, 'utf8')
  const usesSharedConfig = hasCreatePrimitiveRolldownConfigImport(config)
  const usesZeusOutputs =
    config.includes('@zeus-js/bundler-plugin/rolldown') &&
    config.includes('@zeus-js/output-wc') &&
    config.includes('@zeus-js/output-react-wrapper') &&
    config.includes('@zeus-js/output-vue-wrapper')

  if (!usesSharedConfig && !usesZeusOutputs) {
    errors.push(
      `${pkg.name}: primitive rolldown config must use Zeus web-c output pipeline`,
    )
  }
}

function hasCreatePrimitiveRolldownConfigImport(config: string): boolean {
  return /import\s*\{\s*createPrimitiveRolldownConfig\s*\}\s*from\s*['"](?:\.\/|(?:\.\.\/)+)scripts\/rolldown\/createPrimitiveRolldownConfig\.mjs['"]/.test(
    config,
  )
}

function validateCompatPackage(
  _packageJsonPath: string,
  pkg: PackageJsonLike,
  errors: string[],
): void {
  if (!pkg.peerDependencies || !pkg.peerDependencies['@zeus-js/zeus']) {
    errors.push(`${pkg.name}: must peer depend on @zeus-js/zeus`)
  }

  for (const key of ['.', './capabilities']) {
    if (!pkg.exports || !(key in pkg.exports)) {
      errors.push(`${pkg.name}: must export ${key}`)
    }
  }
}
