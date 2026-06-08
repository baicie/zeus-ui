import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

import { execa } from 'execa'

const root = process.cwd()

interface PackageJsonLike {
  name?: string
  private?: boolean
  exports?: unknown
}

interface ExportTarget {
  packageName: string
  packageDir: string
  target: string
}

function toForwardSlash(value: string): string {
  return value.replace(/\\/g, '/')
}

function listPackageJsonFiles(): string[] {
  const files: string[] = []

  for (const rel of ['packages', 'packages/primitives']) {
    const abs = join(root, rel)

    if (!existsSync(abs)) continue

    for (const name of readdirSync(abs)) {
      const file = join(abs, name, 'package.json')

      if (existsSync(file)) {
        files.push(file)
      }
    }
  }

  return files.sort()
}

function collectExportTargets(value: unknown, targets: Set<string>): void {
  if (typeof value === 'string') {
    if (value.startsWith('./') && !value.includes('*')) {
      targets.add(value)
    }

    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectExportTargets(item, targets)
    }

    return
  }

  if (!value || typeof value !== 'object') return

  for (const nested of Object.values(value)) {
    collectExportTargets(nested, targets)
  }
}

function listExportTargets(): ExportTarget[] {
  const result: ExportTarget[] = []

  for (const packageJsonFile of listPackageJsonFiles()) {
    const pkg = JSON.parse(
      readFileSync(packageJsonFile, 'utf8'),
    ) as PackageJsonLike

    if (pkg.private || !pkg.name || !pkg.exports) continue

    const packageDir = dirname(packageJsonFile)
    const targets = new Set<string>()

    collectExportTargets(pkg.exports, targets)

    for (const target of targets) {
      result.push({
        packageName: pkg.name,
        packageDir,
        target,
      })
    }
  }

  return result.sort((a, b) => {
    const packageCompare = a.packageName.localeCompare(b.packageName)

    if (packageCompare !== 0) return packageCompare

    return a.target.localeCompare(b.target)
  })
}

async function main(): Promise<void> {
  let hasError = false
  const dtsFiles = new Set<string>()

  for (const item of listExportTargets()) {
    const absoluteTarget = join(item.packageDir, item.target)
    const relativeTarget = toForwardSlash(relative(root, absoluteTarget))

    if (!existsSync(absoluteTarget)) {
      console.error(
        `[build-output] ${item.packageName} export target is missing: ${relativeTarget}`,
      )
      hasError = true
      continue
    }

    if (absoluteTarget.endsWith('.d.ts')) {
      dtsFiles.add(relativeTarget)
    }
  }

  if (dtsFiles.size > 0) {
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
      console.error('[build-output] generated dts files are invalid')

      if (result.stdout) {
        console.error(result.stdout)
      }

      if (result.stderr) {
        console.error(result.stderr)
      }

      hasError = true
    }
  }

  if (hasError) {
    process.exit(1)
  }

  console.log('Build output looks good.')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
