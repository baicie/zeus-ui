import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

interface PackageJsonLike {
  name?: string
  peerDependencies?: Record<string, string>
}

function toForwardSlash(value: string): string {
  return value.replace(/\\/g, '/')
}

function listPackageJsonFiles(): string[] {
  const files: string[] = []

  for (const rel of ['packages', 'packages/primitives']) {
    const abs = join(root, rel)

    if (!existsSync(abs)) continue

    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue

      const file = join(abs, entry.name, 'package.json')

      if (existsSync(file)) {
        files.push(file)
      }
    }
  }

  return files.sort()
}

const changedPackages: string[] = []

for (const file of listPackageJsonFiles()) {
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as PackageJsonLike
  const currentRange = pkg.peerDependencies?.['@zeus-js/zeus']

  if (!currentRange || currentRange === '*') continue

  pkg.peerDependencies!['@zeus-js/zeus'] = '*'

  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)

  changedPackages.push(pkg.name ?? toForwardSlash(relative(root, file)))
}

if (changedPackages.length === 0) {
  console.warn(
    pc.yellow('No workspace package required a Zeus peer-range relaxation.'),
  )
} else {
  console.log(
    pc.green(
      `Relaxed @zeus-js/zeus peer ranges for: ${changedPackages.join(', ')}`,
    ),
  )
}
