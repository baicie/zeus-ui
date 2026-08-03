import type { WorkspacePackage } from '../../release/workspace'

import { existsSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { execa } from 'execa'
import pc from 'picocolors'
import ts from 'typescript'

import { listPublishablePackages } from '../../release/workspace'

interface PackFile {
  path: string
  size?: number
  mode?: number
}

interface PackResult {
  id?: string
  name?: string
  version?: string
  filename?: string
  files?: PackFile[]
}

interface ComponentManifestRecord {
  tag?: string
  name?: string
  props?: Record<string, unknown>
  slots?: Record<string, unknown>
}

interface ComponentManifest {
  components?: ComponentManifestRecord[]
}

const forbiddenPathPrefixes = [
  'src/',
  'tests/',
  '__tests__/',
  'examples/',
  'scripts/',
  '.github/',
  'temp/',
]

const forbiddenPathSuffixes = ['.tsbuildinfo', '.log']
const nodeBuiltinModules = new Set(builtinModules)

function parsePackOutput(stdout: string): PackResult[] {
  const trimmed = stdout.trim()
  if (!trimmed) return []

  const parsed = JSON.parse(trimmed) as unknown
  return Array.isArray(parsed)
    ? (parsed as PackResult[])
    : [parsed as PackResult]
}

function isForbiddenFile(path: string): boolean {
  return (
    forbiddenPathPrefixes.some(prefix => path.startsWith(prefix)) ||
    forbiddenPathSuffixes.some(suffix => path.endsWith(suffix))
  )
}

function normalizePackageName(specifier: string): string | undefined {
  if (
    specifier.startsWith('node:') ||
    specifier.startsWith('.') ||
    isAbsolute(specifier)
  ) {
    return undefined
  }

  if (specifier.startsWith('@')) {
    return specifier.split('/').slice(0, 2).join('/')
  }

  const packageName = specifier.split('/')[0]

  return nodeBuiltinModules.has(packageName) ? undefined : packageName
}

function collectStaticModuleSpecifiers(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  )
  const specifiers: string[] = []

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

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text)
    }

    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal.text)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return specifiers
}

export function validateTarballDependencies(
  pkg: WorkspacePackage,
  filePaths: string[],
): string[] {
  const declaredDependencies = new Set(
    Object.keys(pkg.packageJson.dependencies ?? {})
      .concat(Object.keys(pkg.packageJson.peerDependencies ?? {}))
      .concat(Object.keys(pkg.packageJson.optionalDependencies ?? {})),
  )
  const errors: string[] = []

  for (const path of filePaths) {
    if (!path.startsWith('dist/')) continue
    if (!path.endsWith('.js') && !path.endsWith('.d.ts')) continue

    const source = readFileSync(resolve(pkg.dir, path), 'utf8')
    const packageNames = new Set(
      collectStaticModuleSpecifiers(path, source)
        .map(normalizePackageName)
        .filter((name): name is string => Boolean(name)),
    )

    for (const packageName of packageNames) {
      if (declaredDependencies.has(packageName)) continue

      errors.push(
        `${pkg.name}: ${path} imports undeclared dependency ${packageName}`,
      )
    }
  }

  return errors
}

export function validateReactNamedSlotProps(
  pkg: WorkspacePackage,
  filePaths: string[],
): string[] {
  const manifestPath = filePaths.find(
    path => path === 'dist/zeus.components.json',
  )

  if (!manifestPath) return []

  const manifest = JSON.parse(
    readFileSync(resolve(pkg.dir, manifestPath), 'utf8'),
  ) as ComponentManifest
  const errors: string[] = []

  for (const component of manifest.components ?? []) {
    const propNames = new Set(Object.keys(component.props ?? {}))

    for (const slotName of Object.keys(component.slots ?? {})) {
      if (slotName === 'default' || !propNames.has(slotName)) continue

      errors.push(
        `${pkg.name}: ${component.tag || component.name || 'unknown component'} uses ${slotName} as both a prop and React named slot`,
      )
    }
  }

  return errors
}

function checkPackResult(
  pkg: WorkspacePackage,
  result: PackResult,
  errors: string[],
): void {
  const files = result.files ?? []
  const paths = files.map(file => file.path)

  if (paths.length === 0) {
    errors.push(`${pkg.name}: npm pack returned no files`)
    return
  }

  if (!paths.includes('package.json')) {
    errors.push(`${pkg.name}: tarball must include package.json`)
  }

  if (!paths.some(path => path.startsWith('dist/'))) {
    errors.push(`${pkg.name}: tarball must include dist/ files`)
  }

  for (const path of paths) {
    if (isForbiddenFile(path)) {
      errors.push(`${pkg.name}: tarball must not include ${path}`)
    }
  }

  errors.push(...validateTarballDependencies(pkg, paths))
  errors.push(...validateReactNamedSlotProps(pkg, paths))
}

async function packPackage(pkg: WorkspacePackage): Promise<PackResult[]> {
  const result = await execa('pnpm', ['pack', '--dry-run', '--json'], {
    cwd: pkg.dir,
    reject: true,
  })

  return parsePackOutput(result.stdout)
}

async function main(): Promise<void> {
  const errors: string[] = []
  const packages = listPublishablePackages()

  for (const pkg of packages) {
    if (!existsSync(pkg.dir)) {
      errors.push(`${pkg.name}: package directory missing`)
      continue
    }

    process.stdout.write(`Packing ${pc.bold(pkg.name)} ... `)

    try {
      const results = await packPackage(pkg)

      if (results.length === 0) {
        errors.push(`${pkg.name}: npm pack returned empty result`)
      }

      for (const result of results) {
        checkPackResult(pkg, result, errors)

        for (const file of result.files ?? []) {
          if (file.path.endsWith('.map') && !file.path.startsWith('dist/')) {
            errors.push(
              `${pkg.name}: sourcemap must be inside dist/: ${file.path}`,
            )
          }
        }
      }

      process.stdout.write(`${pc.green('✓')}\n`)
    } catch (error) {
      process.stdout.write(`${pc.red('✘')}\n`)
      errors.push(
        `${pkg.name}: pnpm pack --dry-run failed: ${(error as Error).message}`,
      )
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('Release tarball check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Release tarball check passed.'))
}

const entryPath = process.argv[1]

if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  main().catch(error => {
    console.error(pc.red((error as Error).message))
    process.exit(1)
  })
}
