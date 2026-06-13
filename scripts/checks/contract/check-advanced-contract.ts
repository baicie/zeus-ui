import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import pc from 'picocolors'

interface PackageJsonLike {
  name?: string
  private?: boolean
  description?: string
  scripts?: Record<string, string>
  sideEffects?: boolean | string[]
  exports?: Record<string, unknown>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  repository?:
    | string
    | {
        type?: string
        url?: string
        directory?: string
      }
}

const root = process.cwd()

const requiredWorkspaceFiles = [
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'packages/advanced/README.md',
  'docs/design/zeus-ui-advanced-components.md',
  'scripts/commands/build.ts',
  'scripts/checks/build/check-package-exports.ts',
  'scripts/checks/build/check-build-output.ts',
  'scripts/checks/package-rules.ts',
  'scripts/release/workspace.ts',
]

function toForwardSlash(value: string): string {
  return value.replace(/\\/g, '/')
}

function readText(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function readJson<T>(path: string): T {
  return JSON.parse(readText(path)) as T
}

function fileExists(path: string, errors: string[]): boolean {
  if (!existsSync(resolve(root, path))) {
    errors.push(`Missing required file: ${path}`)
    return false
  }

  return true
}

function mustContain(
  path: string,
  requiredContents: string[],
  errors: string[],
): void {
  const source = readText(path)

  for (const text of requiredContents) {
    if (!source.includes(text)) {
      errors.push(`${path} must contain ${JSON.stringify(text)}`)
    }
  }
}

function mustNotContain(
  path: string,
  forbiddenContents: string[],
  errors: string[],
): void {
  const source = readText(path)

  for (const text of forbiddenContents) {
    if (source.includes(text)) {
      errors.push(`${path} must not contain ${JSON.stringify(text)}`)
    }
  }
}

function countOccurrences(source: string, text: string): number {
  return source.split(text).length - 1
}

function checkWorkspaceRegistration(errors: string[]): void {
  for (const file of requiredWorkspaceFiles) {
    fileExists(file, errors)
  }

  mustContain('pnpm-workspace.yaml', ["'packages/advanced/*'"], errors)

  mustContain(
    'tsconfig.json',
    ['"packages/advanced/*/src"', '"packages/advanced/*/__tests__"'],
    errors,
  )

  mustContain(
    'scripts/commands/build.ts',
    [
      "type PackageKind = 'package' | 'primitive' | 'advanced'",
      "{ dir: 'packages/advanced', kind: 'advanced' }",
      "return pkg.kind === 'primitive' || pkg.kind === 'advanced'",
      "'advanced': 1",
    ],
    errors,
  )

  mustContain(
    'scripts/checks/build/check-build-output.ts',
    ["'packages/advanced'"],
    errors,
  )

  mustContain(
    'scripts/checks/build/check-package-exports.ts',
    ["'packages/advanced'"],
    errors,
  )

  const exportsCheck = readText('scripts/checks/build/check-package-exports.ts')
  const packageRootsCount = countOccurrences(
    exportsCheck,
    'const packageRoots =',
  )

  if (packageRootsCount !== 1) {
    errors.push(
      `scripts/checks/build/check-package-exports.ts must declare packageRoots exactly once, found ${packageRootsCount}`,
    )
  }

  mustContain(
    'scripts/release/workspace.ts',
    [
      "export type WorkspacePackageKind = 'package' | 'primitive' | 'advanced'",
      "{ dir: 'packages/advanced', kind: 'advanced' }",
      'isAdvanced: boolean',
      "isAdvanced: kind === 'advanced'",
    ],
    errors,
  )

  mustNotContain(
    'scripts/release/workspace.ts',
    [
      "if (packageRoot === 'packages/primitives') return 'primitive'",
      "if (packageRoot === 'packages/advanced') return 'advanced'",
    ],
    errors,
  )

  mustContain(
    'scripts/checks/package-rules.ts',
    [
      "type ComponentPackageKind = 'primitive' | 'advanced'",
      "const isAdvanced = rel.startsWith('packages/advanced/')",
      'validateAdvancedPackageStructure',
      'advanced package must contain src/core/',
      'advanced package must contain src/components/',
    ],
    errors,
  )
}

function checkDocs(errors: string[]): void {
  mustContain(
    'packages/advanced/README.md',
    [
      '# Advanced Components',
      'packages/advanced/*',
      'headless-first',
      '@zeus-web/virtual',
      '@zeus-web/chat',
      '@zeus-web/data-grid',
      '@zeus-web/agent-console',
    ],
    errors,
  )

  mustContain(
    'docs/design/zeus-ui-advanced-components.md',
    [
      '# Zeus UI 高级组件设计与路线图',
      'packages/advanced/*',
      '@zeus-web/virtual',
      '@zeus-web/chat',
      '@zeus-web/data-grid',
      '@zeus-web/agent-console',
      'AG Grid',
      'RevoGrid',
      'ChatGPT',
      'Web Component 是第一等产物',
    ],
    errors,
  )
}

function collectAdvancedPackageJsonFiles(): string[] {
  const advancedRoot = resolve(root, 'packages/advanced')

  if (!existsSync(advancedRoot)) {
    return []
  }

  const result: string[] = []

  for (const entry of readdirSync(advancedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const packageJsonPath = resolve(advancedRoot, entry.name, 'package.json')

    if (existsSync(packageJsonPath)) {
      result.push(packageJsonPath)
    }
  }

  return result.sort()
}

function getExportKeys(pkg: PackageJsonLike): string[] {
  return pkg.exports && typeof pkg.exports === 'object'
    ? Object.keys(pkg.exports)
    : []
}

function checkAdvancedPackages(errors: string[]): void {
  const advancedPackages = collectAdvancedPackageJsonFiles()

  for (const packageJsonPath of advancedPackages) {
    const rel = toForwardSlash(relative(root, packageJsonPath))
    const pkg = readJson<PackageJsonLike>(rel)
    const packageDir = packageJsonPath.replace(/[/\\]package\.json$/, '')
    const packageRelDir = toForwardSlash(relative(root, packageDir))

    if (pkg.private) continue

    if (!pkg.name?.startsWith('@zeus-web/')) {
      errors.push(`${rel}: advanced package name must start with @zeus-web/`)
    }

    if (!pkg.description) {
      errors.push(`${pkg.name}: advanced package must have description`)
    }

    if (
      !pkg.scripts?.build ||
      !pkg.scripts.build.includes('rolldown -c ../../../rolldown.config.ts')
    ) {
      errors.push(
        `${pkg.name}: advanced package build script must use shared rolldown.config.ts`,
      )
    }

    if (!pkg.scripts?.check) {
      errors.push(`${pkg.name}: advanced package must have check script`)
    }

    if (!pkg.scripts?.test) {
      errors.push(`${pkg.name}: advanced package must have test script`)
    }

    if (!pkg.peerDependencies?.['@zeus-js/zeus']) {
      errors.push(
        `${pkg.name}: advanced package must peer depend on @zeus-js/zeus`,
      )
    }

    if (pkg.dependencies?.['@zeus-web/zeus-compat'] !== 'workspace:*') {
      errors.push(
        `${pkg.name}: advanced package must depend on @zeus-web/zeus-compat workspace:*`,
      )
    }

    if (!Array.isArray(pkg.sideEffects)) {
      errors.push(`${pkg.name}: advanced package sideEffects must be string[]`)
    }

    const exportKeys = getExportKeys(pkg)

    for (const key of [
      '.',
      './wc',
      './react',
      './vue',
      './vue/global',
      './custom-elements.json',
      './zeus.components.json',
    ]) {
      if (!exportKeys.includes(key)) {
        errors.push(`${pkg.name}: advanced package must export ${key}`)
      }
    }

    for (const requiredPath of [
      'src/index.ts',
      'src/types.ts',
      'src/core',
      'src/components',
    ]) {
      if (!existsSync(join(packageDir, requiredPath))) {
        errors.push(`${pkg.name}: missing ${packageRelDir}/${requiredPath}`)
      }
    }

    for (const forbiddenPath of [
      'src/wc.ts',
      'src/react.ts',
      'src/vue.ts',
      'rolldown.config.ts',
      'rolldown.config.mjs',
    ]) {
      if (existsSync(join(packageDir, forbiddenPath))) {
        errors.push(
          `${pkg.name}: must not contain ${packageRelDir}/${forbiddenPath}`,
        )
      }
    }

    const repository =
      typeof pkg.repository === 'object' ? pkg.repository : undefined

    if (repository && repository.directory !== packageRelDir) {
      errors.push(`${pkg.name}: repository.directory must be ${packageRelDir}`)
    }
  }
}

function main(): void {
  const errors: string[] = []

  checkWorkspaceRegistration(errors)
  checkDocs(errors)
  checkAdvancedPackages(errors)

  if (errors.length > 0) {
    console.error(pc.red('Advanced workspace contract check failed:'))

    for (const error of errors) {
      console.error(`  ${pc.red('✘')} ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Advanced workspace contract looks good.'))
}

main()
