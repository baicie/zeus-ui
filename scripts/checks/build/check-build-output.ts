import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import pc from 'picocolors'

const ROOT = process.cwd()

type PackageKind = 'package' | 'primitive' | 'advanced'

interface PackageInfo {
  name: string
  dir: string
  kind: PackageKind
  exportTargets: string[]
}

const WORKSPACE_ROOTS: Array<{ dir: string; kind: PackageKind }> = [
  { dir: 'packages', kind: 'package' },
  { dir: 'packages/primitives', kind: 'primitive' },
  { dir: 'packages/advanced', kind: 'advanced' },
]

const componentRequiredOutputs = [
  'dist/wc/index.js',
  'dist/wc/index.d.ts',
  'dist/wc/auto.js',
  'dist/react/index.js',
  'dist/react/index.d.ts',
  'dist/vue/index.js',
  'dist/vue/index.d.ts',
  'dist/vue/global.d.ts',
  'dist/custom-elements.json',
  'dist/zeus.components.json',
]

function toForwardSlash(value: string): string {
  return value.replace(/\\/g, '/')
}

function collectExportTargets(value: unknown, targets: Set<string>): void {
  if (typeof value === 'string') {
    if (value.startsWith('./') && !value.includes('*')) {
      targets.add(value.slice(2))
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) collectExportTargets(item, targets)
    return
  }

  if (!value || typeof value !== 'object') return

  for (const nested of Object.values(value)) {
    collectExportTargets(nested, targets)
  }
}

function readPackageInfo(dir: string, kind: PackageKind): PackageInfo | undefined {
  const file = join(dir, 'package.json')

  if (!existsSync(file)) return undefined

  const json = JSON.parse(readFileSync(file, 'utf8')) as {
    name?: string
    private?: boolean
    exports?: unknown
  }

  if (!json.name || json.private) return undefined

  const exportTargets = new Set<string>()

  if (json.exports) {
    collectExportTargets(json.exports, exportTargets)
  }

  return {
    name: json.name,
    dir,
    kind,
    exportTargets: Array.from(exportTargets),
  }
}

function discoverPackages(): PackageInfo[] {
  const result: PackageInfo[] = []

  for (const rootInfo of WORKSPACE_ROOTS) {
    const abs = join(ROOT, rootInfo.dir)

    if (!existsSync(abs)) continue

    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue

      const info = readPackageInfo(join(abs, entry.name), rootInfo.kind)

      if (info) {
        result.push(info)
      }
    }
  }

  return result.sort((a, b) => {
    const weight: Record<PackageKind, number> = {
      primitive: 0,
      advanced: 1,
      package: 2,
    }

    const kindCompare = weight[a.kind] - weight[b.kind]
    if (kindCompare !== 0) return kindCompare

    return a.name.localeCompare(b.name)
  })
}

function isComponentPackage(pkg: PackageInfo): boolean {
  return pkg.kind === 'primitive' || pkg.kind === 'advanced'
}

function checkExists(pkg: PackageInfo, rel: string, errors: string[]): void {
  const abs = join(pkg.dir, rel)

  if (!existsSync(abs)) {
    errors.push(`${pkg.name}: missing ${toForwardSlash(relative(pkg.dir, abs))}`)
    return
  }

  const stat = statSync(abs)

  if (!stat.isFile() && !stat.isDirectory()) {
    errors.push(`${pkg.name}: invalid output ${rel}`)
  }
}

function checkComponentPackage(pkg: PackageInfo, errors: string[]): void {
  for (const rel of componentRequiredOutputs) {
    checkExists(pkg, rel, errors)
  }
}

function checkRegularPackage(pkg: PackageInfo, errors: string[]): void {
  const distDir = join(pkg.dir, 'dist')

  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    errors.push(`${pkg.name}: missing dist/ output directory`)
    return
  }

  for (const rel of pkg.exportTargets) {
    checkExists(pkg, rel, errors)
  }
}

function main(): void {
  const errors: string[] = []
  const packages = discoverPackages()

  for (const pkg of packages) {
    if (isComponentPackage(pkg)) {
      checkComponentPackage(pkg, errors)
    } else {
      checkRegularPackage(pkg, errors)
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
    pc.green(`Build output looks good. (${packages.length} packages checked)`),
  )
}

main()
