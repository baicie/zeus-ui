import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import pc from 'picocolors'

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

// packages/zeus-compat is the ONLY package allowed to import @zeus-js/zeus.
// It must NOT import @zeus-js/runtime-dom or @zeus-js/signal directly.
const zeusCompatRoot = 'packages/zeus-compat'

// Forbidden everywhere — zeus-ui packages must not bypass the compat layer.
const hardForbiddenImports = ['@zeus-js/runtime-dom', '@zeus-js/signal']

// Forbidden everywhere except zeus-compat files (which use @zeus-js/zeus directly).
const downstreamForbiddenImports = [
  '@zeus-js/zeus',
  '@zeus-js/zeus/capabilities',
]

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

function isCompatFile(rel: string): boolean {
  return rel.startsWith(zeusCompatRoot)
}

function checkFile(rel: string, source: string): void {
  const isCompat = isCompatFile(rel)

  for (const specifier of hardForbiddenImports) {
    if (importsFrom(source, specifier)) {
      hasError = true
      // zeus-compat uses @zeus-js/zeus; downstream uses @zeus-web/zeus-compat.
      const suggestion = isCompat
        ? 'Use @zeus-js/zeus instead'
        : 'Use @zeus-web/zeus-compat instead'
      console.error(
        pc.red(`${rel}: do not import ${specifier} directly. ${suggestion}.`),
      )
    }
  }

  // Only check @zeus-js/zeus imports in downstream packages.
  if (!isCompat) {
    for (const specifier of downstreamForbiddenImports) {
      if (importsFrom(source, specifier)) {
        hasError = true
        console.error(
          pc.red(
            `${rel}: do not import ${specifier} directly. Use @zeus-web/zeus-compat instead.`,
          ),
        )
      }
    }
  }
}

function importsFrom(source: string, specifier: string): boolean {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const staticImport = new RegExp(`from\\s+['"]${escaped}['"]`)
  const bareImport = new RegExp(`import\\s+['"]${escaped}['"]`)

  return staticImport.test(source) || bareImport.test(source)
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
