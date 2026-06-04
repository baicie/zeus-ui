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

  return files
}

function collectExportTargets(
  value: unknown,
  targets: Set<string>,
  packageDir: string,
): void {
  if (typeof value === 'string') {
    if (value.startsWith('./') && !value.includes('*')) {
      targets.add(value)
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectExportTargets(item, targets, packageDir)
    }
    return
  }

  if (!value || typeof value !== 'object') return

  for (const nested of Object.values(value)) {
    collectExportTargets(nested, targets, packageDir)
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

    collectExportTargets(pkg.exports, targets, packageDir)

    for (const target of targets) {
      const absoluteTarget = join(packageDir, target)
      if (!existsSync(absoluteTarget)) continue

      result.push({
        packageName: pkg.name,
        packageDir,
        target,
      })
    }
  }

  return result
}

async function main(): Promise<void> {
  let hasError = false
  const dtsFiles: string[] = []

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
      dtsFiles.push(relativeTarget)
    }
  }

  if (!hasError && dtsFiles.length > 0) {
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
        '--skipLibCheck',
        'true',
        '--types',
        'node',
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
