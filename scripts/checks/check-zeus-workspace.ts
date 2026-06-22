import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

import { execa } from 'execa'
import pc from 'picocolors'
import ts from 'typescript'

import { validatePackageRules } from './package-rules'

const root = process.cwd()
const packageRoots = ['packages', 'packages/primitives', 'packages/advanced']

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function readPkg(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, file), 'utf8'))
}

function listPackageJsons(): string[] {
  const files: string[] = []

  for (const rel of packageRoots) {
    const abs = join(root, rel)

    if (!existsSync(abs)) {
      continue
    }

    for (const name of readdirSync(abs)) {
      const file = join(abs, name, 'package.json')

      if (existsSync(file)) {
        files.push(file)
      }
    }
  }

  return files.sort()
}

function slash(value: string): string {
  return value.replace(/\\/g, '/')
}

// ---------------------------------------------------------------------------
// check:package-exports
// ---------------------------------------------------------------------------

function checkPackageExports(errors: string[]): void {
  for (const file of listPackageJsons()) {
    const result = validatePackageRules(root, file)

    for (const error of result.errors) {
      errors.push(`[package-rules] ${error}`)
    }

    if (!result.valid) {
      errors.push(
        `${slash(relative(root, file))}: invalid exports or package rules`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// check:zeus-baseline
// ---------------------------------------------------------------------------

function checkZeusBaseline(errors: string[]): void {
  const rootPkg = readPkg('package.json')
  const fields = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
  ] as const
  const exactVersionRE =
    /^\d+\.\d+\.\d+(?:-[\da-z]+(?:[.-][\da-z]+)*)?(?:\+[\da-z]+(?:[.-][\da-z]+)*)?$/i

  const zeusDeps: Array<{ field: string; name: string; version: string }> = []

  for (const field of fields) {
    const deps = (rootPkg[field] as Record<string, string>) ?? {}

    for (const [name, version] of Object.entries(deps)) {
      if (!name.startsWith('@zeus-js/')) {
        continue
      }

      zeusDeps.push({
        field,
        name,
        version,
      })
    }
  }

  if (zeusDeps.length === 0) {
    errors.push(
      'Root package.json must declare at least one @zeus-js/* dependency.',
    )
    return
  }

  for (const dep of zeusDeps) {
    if (/-canary(?:[.-]|$)/.test(dep.version)) {
      errors.push(
        `${dep.field}.${dep.name} must not use a canary version: ${dep.version}`,
      )
    }

    if (!exactVersionRE.test(dep.version)) {
      errors.push(
        `${dep.field}.${dep.name} must use an exact version: ${dep.version}`,
      )
    }
  }

  const versions = new Set(zeusDeps.map(dep => dep.version))

  if (versions.size > 1) {
    errors.push(
      `Root @zeus-js/* deps must use one baseline version: ${[...versions].join(
        ', ',
      )}`,
    )
    return
  }

  const baseline = [...versions][0]
  const versionParts = /^\d+\.\d+\.\d+/
    .exec(baseline)?.[0]
    ?.split('.')
    .map(Number)

  if (!versionParts) {
    errors.push(`Invalid Zeus baseline version: ${baseline}`)
    return
  }

  const upperBound =
    versionParts[0] === 0
      ? `<0.${versionParts[1] + 1}.0`
      : `<${versionParts[0] + 1}.0.0`
  const expectedPeer = `>=${baseline} ${upperBound}`

  for (const file of listPackageJsons()) {
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
      name?: string
      private?: boolean
      peerDependencies?: Record<string, string>
    }

    if (pkg.private || !pkg.peerDependencies?.['@zeus-js/zeus']) {
      continue
    }

    const actual = pkg.peerDependencies['@zeus-js/zeus']

    if (actual !== expectedPeer) {
      errors.push(
        `${pkg.name ?? slash(relative(root, file))}: @zeus-js/zeus peer must be "${expectedPeer}", got "${actual}"`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// check:zeus-imports
// ---------------------------------------------------------------------------

const checkedRoots = [
  'packages/zeus-compat',
  'packages/primitives',
  'packages/advanced',
  'packages/headless',
  'packages/react',
  'packages/vue',
  'packages/themes',
  'packages/utils',
  'packages/registry',
  'packages/cli',
]

export function isAllowedZeusImport(file: string, specifier: string): boolean {
  const rel = slash(file)

  if (!specifier.startsWith('@zeus-js/')) {
    return true
  }

  if (isZeusCompatFile(rel)) {
    return (
      specifier === '@zeus-js/zeus' ||
      specifier === '@zeus-js/zeus/capabilities' ||
      specifier === '@zeus-js/runtime-dom'
    )
  }

  if (isComponentSourceFile(rel)) {
    return specifier === '@zeus-js/zeus'
  }

  if (isComponentContractTestFile(rel)) {
    return specifier === '@zeus-js/component-analyzer'
  }

  return false
}

export function getZeusImportViolationMessage(
  file: string,
  specifier: string,
): string {
  return `${file}: do not import ${specifier} directly. Use @zeus-web/zeus-compat instead.`
}

function isZeusCompatFile(file: string): boolean {
  return file.startsWith('packages/zeus-compat/')
}

function isComponentSourceFile(file: string): boolean {
  return (
    isComponentPackageFile(file) &&
    file.includes('/src/') &&
    /\.(?:ts|tsx|mts|cts)$/.test(file)
  )
}

function isComponentContractTestFile(file: string): boolean {
  return (
    isComponentPackageFile(file) &&
    file.includes('/__tests__/') &&
    /\.(?:test|spec)\.(?:ts|tsx|mts|cts)$/.test(file)
  )
}

function isComponentPackageFile(file: string): boolean {
  return (
    file.startsWith('packages/primitives/') ||
    file.startsWith('packages/advanced/') ||
    file.startsWith('packages/headless/')
  )
}

function collectTypeScriptFiles(dir: string): string[] {
  const files: string[] = []

  if (!existsSync(dir)) {
    return files
  }

  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)

    if (statSync(abs).isDirectory()) {
      if (name === 'dist' || name === 'node_modules') {
        continue
      }

      files.push(...collectTypeScriptFiles(abs))
      continue
    }

    if (/\.(?:ts|tsx|mts|cts)$/.test(name)) {
      files.push(abs)
    }
  }

  return files
}

export function collectImportSpecifiers(
  file: string,
  source: string,
): string[] {
  const specifiers: string[] = []
  const srcFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text)
    }

    ts.forEachChild(node, visit)
  }

  visit(srcFile)

  return specifiers
}

async function checkZeusImports(errors: string[]): Promise<void> {
  for (const relRoot of checkedRoots) {
    for (const file of collectTypeScriptFiles(join(root, relRoot))) {
      const rel = slash(relative(root, file))
      const source = readFileSync(file, 'utf8')
      const specifiers = collectImportSpecifiers(rel, source)

      for (const specifier of specifiers) {
        if (!specifier.startsWith('@zeus-js/')) {
          continue
        }

        if (isAllowedZeusImport(rel, specifier)) {
          continue
        }

        errors.push(getZeusImportViolationMessage(rel, specifier))
      }
    }
  }
}

// ---------------------------------------------------------------------------
// check:build-output
// ---------------------------------------------------------------------------

async function checkBuildOutput(errors: string[]): Promise<void> {
  const pkgMap = new Map<string, { dir: string; exports?: unknown }>()

  for (const file of listPackageJsons()) {
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
      name?: string
      private?: boolean
      exports?: unknown
    }

    if (pkg.private || !pkg.name || !pkg.exports) {
      continue
    }

    pkgMap.set(pkg.name, {
      dir: dirname(file),
      exports: pkg.exports,
    })
  }

  const targets: Array<{ pkg: string; dir: string; target: string }> = []

  for (const [pkgName, pkg] of pkgMap) {
    const collect = (value: unknown): void => {
      if (
        typeof value === 'string' &&
        value.startsWith('./') &&
        !value.includes('*')
      ) {
        targets.push({
          pkg: pkgName,
          dir: pkg.dir,
          target: value,
        })
        return
      }

      if (Array.isArray(value)) {
        value.forEach(collect)
        return
      }

      if (value && typeof value === 'object') {
        Object.values(value as Record<string, unknown>).forEach(collect)
      }
    }

    collect(pkg.exports)
  }

  const dtsFiles: string[] = []

  for (const { pkg, dir, target } of targets) {
    const abs = join(dir, target)

    if (!existsSync(abs)) {
      errors.push(`${pkg} export missing: ${target}`)
      continue
    }

    if (target.endsWith('.d.ts')) {
      dtsFiles.push(slash(relative(root, abs)))
    }
  }

  if (dtsFiles.length === 0) {
    return
  }

  const result = await execa(
    'pnpm',
    [
      'exec',
      'tsc',
      ...dtsFiles,
      '--ignoreConfig',
      '--noEmit',
      '--module',
      'ESNext',
      '--moduleResolution',
      'bundler',
      '--target',
      'ES2016',
      '--jsx',
      'preserve',
      '--types',
      'node',
      '--skipLibCheck',
    ],
    {
      cwd: root,
      reject: false,
    },
  )

  if (result.exitCode !== 0) {
    errors.push('Generated dts files are invalid')
  }
}

// ---------------------------------------------------------------------------
// check:workspace-overrides
// ---------------------------------------------------------------------------

function checkWorkspaceOverrides(errors: string[]): void {
  const source = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')
  const patterns = [
    {
      label: 'local @zeus-js link/file override',
      re: /^\s*['"]?@zeus-js\/[^'":\s]+['"]?\s*:\s*['"]?(?:link:|file:)/m,
    },
    {
      label: 'absolute local link/file path',
      re: /(?:link:|file:)(?:[a-zA-Z]:[\\/]|\/(?:Users|home|mnt)\/)/,
    },
  ]

  for (const { label, re } of patterns) {
    if (re.test(source)) {
      errors.push(`pnpm-workspace.yaml contains forbidden ${label}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function runZeusWorkspaceCheck(): Promise<string[]> {
  const errors: string[] = []

  checkPackageExports(errors)
  checkZeusBaseline(errors)
  await checkZeusImports(errors)
  await checkBuildOutput(errors)
  checkWorkspaceOverrides(errors)

  return errors
}

async function main(): Promise<void> {
  const errors = await runZeusWorkspaceCheck()

  if (errors.length > 0) {
    console.error(pc.red('Zeus workspace check failed:'))

    for (const error of errors) {
      console.error(`  - ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Zeus workspace check passed.'))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
