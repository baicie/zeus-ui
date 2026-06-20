import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { execa } from 'execa'
import pc from 'picocolors'

const ROOT = process.cwd()

/* ------------------------------------------------------------------ */
/*  types & discovery                                                 */
/* ------------------------------------------------------------------ */

type PackageKind = 'package' | 'primitive' | 'advanced'

interface PackageJson {
  name: string
  exports?: unknown
  private?: boolean
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

interface PkgInfo {
  shortName: string
  fullName: string
  dir: string
  /** Component packages are built via `rolldown` from the top-level config. */
  kind: PackageKind
  /** All non-component export target paths relative to package dir. */
  exportTargets: string[]
  /** Workspace packages that must be built before this package. */
  workspaceDependencyNames: string[]
}

function isComponentPackage(pkg: PkgInfo): boolean {
  return pkg.kind === 'primitive' || pkg.kind === 'advanced'
}

function collectExportTargets(value: unknown, targets: Set<string>): void {
  if (typeof value === 'string') {
    if (value.startsWith('./') && !value.includes('*')) {
      targets.add(value)
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

function isWorkspaceDependency(version: string): boolean {
  return version === 'workspace:*' || version.startsWith('workspace:')
}

function collectWorkspaceDependencyNames(pkgJson: PackageJson): string[] {
  const dependencyMaps = [
    pkgJson.dependencies,
    pkgJson.optionalDependencies,
  ].filter(Boolean) as Array<Record<string, string>>

  const dependencyNames = new Set<string>()

  for (const dependencyMap of dependencyMaps) {
    for (const [name, version] of Object.entries(dependencyMap)) {
      if (isWorkspaceDependency(version)) {
        dependencyNames.add(name)
      }
    }
  }

  return Array.from(dependencyNames).sort()
}

function comparePackageBaseOrder(a: PkgInfo, b: PkgInfo): number {
  const weight: Record<PackageKind, number> = {
    primitive: 0,
    advanced: 1,
    package: 2,
  }

  const kindCompare = weight[a.kind] - weight[b.kind]
  if (kindCompare !== 0) return kindCompare

  return a.shortName.localeCompare(b.shortName)
}

function sortPackagesByWorkspaceDependencies(pkgs: PkgInfo[]): PkgInfo[] {
  const byFullName = new Map<string, PkgInfo>()
  const byShortName = new Map<string, PkgInfo>()

  for (const pkg of pkgs) {
    byFullName.set(pkg.fullName, pkg)
    byShortName.set(pkg.shortName, pkg)
  }

  const sortedSeeds = [...pkgs].sort(comparePackageBaseOrder)
  const result: PkgInfo[] = []
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (pkg: PkgInfo, stack: string[]): void => {
    if (visited.has(pkg.fullName)) return

    if (visiting.has(pkg.fullName)) {
      const cycle = [...stack, pkg.fullName].join(' -> ')
      throw new Error(`workspace dependency cycle detected: ${cycle}`)
    }

    visiting.add(pkg.fullName)

    for (const dependencyName of pkg.workspaceDependencyNames) {
      const dependency =
        byFullName.get(dependencyName) ??
        byShortName.get(dependencyName.replace(/^@zeus-web\//, ''))

      if (!dependency || dependency.fullName === pkg.fullName) {
        continue
      }

      visit(dependency, [...stack, pkg.fullName])
    }

    visiting.delete(pkg.fullName)
    visited.add(pkg.fullName)
    result.push(pkg)
  }

  for (const pkg of sortedSeeds) {
    visit(pkg, [])
  }

  return result
}

function collectPackageClosure(pkg: PkgInfo, allPkgs: PkgInfo[]): PkgInfo[] {
  const byFullName = new Map<string, PkgInfo>()
  const byShortName = new Map<string, PkgInfo>()

  for (const item of allPkgs) {
    byFullName.set(item.fullName, item)
    byShortName.set(item.shortName, item)
  }

  const closure = new Set<string>()

  const visit = (item: PkgInfo): void => {
    if (closure.has(item.fullName)) return

    closure.add(item.fullName)

    for (const dependencyName of item.workspaceDependencyNames) {
      const dependency =
        byFullName.get(dependencyName) ??
        byShortName.get(dependencyName.replace(/^@zeus-web\//, ''))

      if (dependency) {
        visit(dependency)
      }
    }
  }

  visit(pkg)

  return sortPackagesByWorkspaceDependencies(
    allPkgs.filter(item => closure.has(item.fullName)),
  )
}

function discoverPackages(): PkgInfo[] {
  const pkgs: PkgInfo[] = []

  const roots: Array<{ dir: string; kind: PackageKind }> = [
    { dir: 'packages', kind: 'package' },
    { dir: 'packages/primitives', kind: 'primitive' },
    { dir: 'packages/advanced', kind: 'advanced' },
  ]

  for (const { dir, kind } of roots) {
    const abs = join(ROOT, dir)
    if (!existsSync(abs)) continue

    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue

      const pkgFile = join(abs, entry.name, 'package.json')
      if (!existsSync(pkgFile)) continue

      const pkgJson = JSON.parse(readFileSync(pkgFile, 'utf8')) as PackageJson

      if (pkgJson.private || !pkgJson.name) continue

      const shortName = pkgJson.name.replace(/^@zeus-web\//, '')
      const exportTargets = new Set<string>()

      if (pkgJson.exports) {
        collectExportTargets(pkgJson.exports, exportTargets)
      }

      pkgs.push({
        shortName,
        fullName: pkgJson.name,
        dir: join(abs, entry.name),
        kind,
        exportTargets: Array.from(exportTargets),
        workspaceDependencyNames: collectWorkspaceDependencyNames(pkgJson),
      })
    }
  }

  return sortPackagesByWorkspaceDependencies(pkgs)
}

/* ------------------------------------------------------------------ */
/*  build runners                                                     */
/* ------------------------------------------------------------------ */

async function buildFull(pkg: PkgInfo): Promise<void> {
  if (isComponentPackage(pkg)) {
    const indexPath = join(pkg.dir, 'dist', 'wc', 'index.js')
    if (existsSync(indexPath)) {
      return
    }

    await execa('rolldown', ['-c', '../../../rolldown.config.ts'], {
      cwd: pkg.dir,
      stdio: 'inherit',
    })

    return
  }

  // For non-component packages, check that ALL export targets exist
  // (e.g. ai exports both ./index and ./metadata.json)
  const missingTargets = pkg.exportTargets.filter(target => {
    return !existsSync(join(pkg.dir, target))
  })

  if (missingTargets.length === 0) {
    return
  }

  await execa('pnpm', ['run', 'build'], {
    cwd: pkg.dir,
    stdio: 'inherit',
  })
}

async function buildDeclarations(pkg: PkgInfo): Promise<void> {
  if (isComponentPackage(pkg)) {
    await execa(
      'tsc',
      [
        '-p',
        'tsconfig.json',
        '--emitDeclarationOnly',
        '--declaration',
        '--outDir',
        'dist',
        '--declarationDir',
        'dist',
        '--rootDir',
        'src',
      ],
      { cwd: pkg.dir, stdio: 'inherit' },
    )

    return
  }

  // tsup-based packages: --dts already produces declarations alongside the bundle
  await buildFull(pkg)
}

/* ------------------------------------------------------------------ */
/*  helpers                                                           */
/* ------------------------------------------------------------------ */

function logSection(title: string): void {
  console.log('')
  console.log(pc.bold(pc.cyan(`═══ ${title} ═══`)))
}

function resolveTarget(name: string, allPkgs: PkgInfo[]): PkgInfo | undefined {
  // Try exact match first (short name or full name)
  const exact = allPkgs.find(p => p.shortName === name || p.fullName === name)
  if (exact) return exact

  // Fuzzy match by prefix
  return allPkgs.find(p => p.shortName.startsWith(name))
}

/* ------------------------------------------------------------------ */
/*  main                                                              */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Parse -t <type>
  const tIndex = args.indexOf('-t')
  const targetType: 'dts' | undefined =
    tIndex >= 0 && tIndex + 1 < args.length
      ? args[tIndex + 1] === 'dts'
        ? 'dts'
        : undefined
      : undefined

  // Filter out -t and its value to find the package name
  const cleanArgs = args.filter((arg, index) => {
    return arg !== '-t' && args[index - 1] !== '-t'
  })

  const targetName = cleanArgs.length > 0 ? cleanArgs[0] : undefined

  const allPkgs = discoverPackages()

  /* ---- resolve target package(s) ---- */

  let targets: PkgInfo[]

  if (targetName) {
    const pkg = resolveTarget(targetName, allPkgs)

    if (!pkg) {
      const available = allPkgs.map(p => p.shortName).join(', ')
      console.error(
        `${pc.red(`✘ 未找到包 "${targetName}"`)}\n  可用包: ${available}`,
      )
      process.exit(1)
    }

    targets = collectPackageClosure(pkg, allPkgs)
  } else {
    targets = allPkgs
  }

  /* ---- run ---- */

  const label = targetType === 'dts' ? '类型声明' : '完整构建'
  logSection(`${label} (${targets.length} 个包)`)

  for (const pkg of targets) {
    process.stdout.write(`\n  [${pkg.kind}] ${pc.bold(pkg.shortName)} ... `)

    try {
      if (targetType === 'dts') {
        await buildDeclarations(pkg)
      } else {
        await buildFull(pkg)
      }

      process.stdout.write(`${pc.green('✓')}\n`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stdout.write(`${pc.red('✘')}\n`)
      console.error(`    ${pc.red(msg)}`)
      process.exit(1)
    }
  }

  logSection('完成')
}

main().catch((err: unknown) => {
  console.error(pc.red(`✘ ${err instanceof Error ? err.message : String(err)}`))
  process.exit(1)
})
