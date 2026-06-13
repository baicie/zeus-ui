import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { validatePackageRules } from '../package-rules'

const root = process.cwd()
const packageRoots = ['packages', 'packages/primitives', 'packages/advanced']

const packageRoots = ['packages', 'packages/primitives', 'packages/advanced']

function listPackageJsonFiles() {
  const files: string[] = []

  for (const rel of packageRoots) {
    const abs = join(root, rel)
    if (!existsSync(abs)) continue

    for (const name of readdirSync(abs)) {
      const file = join(abs, name, 'package.json')
      if (existsSync(file)) files.push(file)
    }
  }

  return files
}

let hasError = false

for (const file of listPackageJsonFiles()) {
  const result = validatePackageRules(root, file)

  for (const error of result.errors) {
    console.error(`[package-rules] ${error}`)
  }

  if (!result.valid) {
    hasError = true
  }
}

if (hasError) {
  process.exit(1)
}

console.log('All packages have valid exports and package rules.')
