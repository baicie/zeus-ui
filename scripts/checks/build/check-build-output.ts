import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import pc from 'picocolors'

const ROOT = process.cwd()

const WORKSPACE_ROOTS = ['packages', 'packages/primitives', 'packages/advanced']

interface PackageInfo {
  name: string
  dir: string
  hasDist: boolean
}

function readPackageName(dir: string): string | undefined {
  const file = join(dir, 'package.json')
  if (!existsSync(file)) return undefined
  const json = JSON.parse(readFileSync(file, 'utf8')) as { name?: string }
  return json.name
}

function discoverPackages(): PackageInfo[] {
  const result: PackageInfo[] = []

  for (const rel of WORKSPACE_ROOTS) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) continue

    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = join(abs, entry.name)
      const distDir = join(dir, 'dist')
      const hasDist =
        existsSync(distDir) && statSync(distDir).isDirectory()
      const name = readPackageName(dir)
      if (!name) continue

      result.push({ name, dir, hasDist })
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name))
}

function main(): void {
  const errors: string[] = []
  const packages = discoverPackages()

  for (const pkg of packages) {
    if (!pkg.hasDist) {
      errors.push(`${pkg.name}: missing dist/ output directory`)
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('Build output check failed:'))
    for (const error of errors) {
      console.error(`  ${pc.red('-')} ${error}`)
    }
    process.exit(1)
  }

  console.log(
    pc.green(
      `Build output looks good. (${packages.length} packages, all have dist/)`,
    ),
  )
}

main()
