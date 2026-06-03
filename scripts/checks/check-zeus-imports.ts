import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import pc from 'picocolors'

const root = process.cwd()

const checkedRoots = [
  'packages/primitives',
  'packages/headless',
  'packages/react',
  'packages/vue',
  'packages/themes',
  'packages/utils',
  'packages/registry',
  'packages/cli',
]

const allowedFiles = new Set([
  'packages/zeus-compat/src/index.ts',
  'packages/zeus-compat/src/capabilities.ts',
])

const forbiddenImports = [
  '@zeus-js/runtime-dom',
  '@zeus-js/signal',
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

for (const relRoot of checkedRoots) {
  const absRoot = join(root, relRoot)

  for (const file of walk(absRoot)) {
    const rel = toSlash(relative(root, file))

    if (allowedFiles.has(rel)) continue

    const source = readFileSync(file, 'utf8')

    for (const specifier of forbiddenImports) {
      const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const staticImport = new RegExp(`from\\s+['"]${escaped}['"]`)
      const bareImport = new RegExp(`import\\s+['"]${escaped}['"]`)

      if (staticImport.test(source) || bareImport.test(source)) {
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

if (hasError) process.exit(1)

console.log(pc.green('Zeus import boundary check passed.'))
