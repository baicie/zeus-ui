import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

interface PackageJson {
  name?: string
  private?: boolean
  exports?: Record<string, unknown>
  main?: string
  types?: string
}

const root = process.cwd()

function listPackageJsonFiles() {
  const files: string[] = []

  const roots = ['packages', 'packages/primitives']

  for (const rel of roots) {
    const abs = join(root, rel)
    if (!existsSync(abs)) continue

    for (const name of readdirSync(abs)) {
      const file = join(abs, name, 'package.json')
      if (existsSync(file)) {
        files.push(file)
      }
    }
  }

  return files
}

let hasError = false

for (const file of listPackageJsonFiles()) {
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as PackageJson

  if (pkg.private) continue

  if (!pkg.name?.startsWith('@zeus-web/')) {
    console.error(`[exports] ${file}: package name must start with @zeus-web/`)
    hasError = true
  }

  if (!pkg.exports) {
    console.error(`[exports] ${pkg.name}: missing exports`)
    hasError = true
  }

  if (!pkg.types && !pkg.exports) {
    console.error(`[exports] ${pkg.name}: missing types or typed exports`)
    hasError = true
  }
}

if (hasError) {
  process.exit(1)
}

console.log('All packages have valid exports.')
