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
  const packagesDir = join(root, 'packages')

  if (existsSync(packagesDir)) {
    walkPackageJsonFiles(packagesDir, files)
  }

  return files.sort()
}

function walkPackageJsonFiles(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name)

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue
      }

      walkPackageJsonFiles(file, files)
      continue
    }

    if (entry.name === 'package.json') {
      files.push(file)
    }
  }
}

function shouldSkipDirectory(name: string): boolean {
  return (
    name === 'node_modules' ||
    name === 'dist' ||
    name === '.git' ||
    name === '.turbo' ||
    name === '.vitepress' ||
    name === '.next' ||
    name === 'coverage'
  )
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
