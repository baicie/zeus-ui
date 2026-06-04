import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import pc from 'picocolors'
import ts from 'typescript'

const root = process.cwd()

const checkedRoots = [
  'packages/zeus-compat',
  'packages/primitives',
  'packages/headless',
  'packages/react',
  'packages/vue',
  'packages/themes',
  'packages/utils',
  'packages/registry',
  'packages/cli',
]

const allowedZeusImports = new Map<string, ReadonlySet<string>>([
  ['packages/zeus-compat/src/index.ts', new Set(['@zeus-js/zeus'])],
  [
    'packages/zeus-compat/src/capabilities.ts',
    new Set(['@zeus-js/zeus/capabilities']),
  ],
  [
    'packages/zeus-compat/__tests__/contract.spec.ts',
    new Set(['@zeus-js/zeus/capabilities']),
  ],
  [
    'packages/zeus-compat/__tests__/canary-capabilities.spec.ts',
    new Set(['@zeus-js/zeus/capabilities']),
  ],
])

let hasError = false

function toSlash(value: string): string {
  return value.replace(/\\/g, '/')
}

function walk(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files

  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    const stat = statSync(abs)

    if (stat.isDirectory()) {
      if (name === 'dist' || name === 'node_modules') continue
      walk(abs, files)
      continue
    }

    if (/\.(?:ts|tsx|mts|cts)$/.test(name)) {
      files.push(abs)
    }
  }

  return files
}

function getScriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (file.endsWith('.mts')) return ts.ScriptKind.TS
  if (file.endsWith('.cts')) return ts.ScriptKind.TS
  return ts.ScriptKind.TS
}

function collectModuleSpecifiers(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(file),
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

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return specifiers
}

function checkFile(rel: string, source: string): void {
  const allowed = allowedZeusImports.get(rel) ?? new Set<string>()

  for (const specifier of collectModuleSpecifiers(rel, source)) {
    if (!specifier.startsWith('@zeus-js/')) continue
    if (allowed.has(specifier)) continue

    hasError = true
    console.error(
      pc.red(
        `${rel}: do not import ${specifier} directly. Use @zeus-web/zeus-compat instead.`,
      ),
    )
  }
}

for (const relRoot of checkedRoots) {
  const absRoot = join(root, relRoot)

  for (const file of walk(absRoot)) {
    const rel = toSlash(relative(root, file))
    const source = readFileSync(file, 'utf8')
    checkFile(rel, source)
  }
}

if (hasError) process.exit(1)

console.log(pc.green('Zeus import boundary check passed.'))
