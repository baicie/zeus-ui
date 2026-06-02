import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface PackageJsonLike {
  name?: string
  private?: boolean
  scripts?: Record<string, string>
  sideEffects?: boolean | string[]
  exports?: Record<string, unknown>
  peerDependencies?: Record<string, string>
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

  if (isPrimitive) {
    validatePrimitivePackage(packageJsonPath, pkg, errors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

function validatePrimitivePackage(
  packageJsonPath: string,
  pkg: PackageJsonLike,
  errors: string[],
): void {
  const packageDir = packageJsonPath.replace(/[/\\]package\.json$/, '')

  if (!existsSync(join(packageDir, 'rollup.config.mjs'))) {
    errors.push(`${pkg.name}: primitive package must have rollup.config.mjs`)
  } else {
    validatePrimitiveRollupConfig(packageDir, pkg, errors)
  }

  if (
    !pkg.scripts ||
    !pkg.scripts.build ||
    !pkg.scripts.build.includes('rollup -c')
  ) {
    errors.push(
      `${pkg.name}: primitive package build script must use rollup -c`,
    )
  }

  if (!pkg.peerDependencies || !pkg.peerDependencies['@zeus-js/runtime-dom']) {
    errors.push(
      `${pkg.name}: primitive package must peer depend on @zeus-js/runtime-dom`,
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

function validatePrimitiveRollupConfig(
  packageDir: string,
  pkg: PackageJsonLike,
  errors: string[],
): void {
  const config = readFileSync(join(packageDir, 'rollup.config.mjs'), 'utf8')
  const usesSharedConfig = hasCreatePrimitiveRollupConfigImport(config)
  const usesZeusOutputs =
    config.includes('@zeus-js/bundler-plugin') &&
    config.includes('@zeus-js/output-wc') &&
    config.includes('@zeus-js/output-react-wrapper') &&
    config.includes('@zeus-js/output-vue-wrapper')

  if (!usesSharedConfig && !usesZeusOutputs) {
    errors.push(
      `${pkg.name}: primitive rollup config must use Zeus web-c output pipeline`,
    )
  }
}

function hasCreatePrimitiveRollupConfigImport(config: string): boolean {
  return /import\s*\{\s*createPrimitiveRollupConfig\s*\}\s*from\s*['"](?:\.\.\/)+scripts\/rollup\/createPrimitiveRollupConfig\.mjs['"]/.test(
    config,
  )
}
