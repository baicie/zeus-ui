import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { execa } from 'execa'
import pc from 'picocolors'

const ROOT = process.cwd()

type PackageKind = 'package' | 'primitive' | 'advanced'
type BuildMode = 'full' | 'dts'

interface PackageJson {
  name?: string
  exports?: unknown
  private?: boolean
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

interface PkgInfo {
  shortName: string
  fullName: string
  dir: string
  kind: PackageKind
  exportTargets: string[]
  workspaceDependencyNames: string[]
  hasBuildScript: boolean
}

function isComponentPackage(pkg: PkgInfo): boolean {
  return pkg.kind === 'primitive' || pkg.kind === 'advanced'
}

function readPackageJson(file: string): PackageJson {
  return JSON.parse(readFileSync(file, 'utf8')) as PackageJson
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

  if (!value || typeof value !== 'object') {
    return
  }

  for (const nested of Object.values(value)) {
    collectExportTargets(nested, targets)
  }
}

function isWorkspaceDependency(version: string): boolean {
  return version === 'workspace:*' || version.startsWith('workspace:')
}

function collectWorkspaceDependencyNames(pkgJson: PackageJson): string[] {
  const dependencyNames = new Set<string>()

  for (const dependencyMap of [
    pkgJson.dependencies,
    pkgJson.devDependencies,
    pkgJson.optionalDependencies,
    pkgJson.peerDependencies,
  ]) {
    if (!dependencyMap) continue

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

  if (kindCompare !== 0) {
    return kindCompare
  }

  return a.shortName.localeCompare(b.shortName)
}

function createPackageIndexes(pkgs: PkgInfo[]): {
  byFullName: Map<string, PkgInfo>
  byShortName: Map<string, PkgInfo>
} {
  const byFullName = new Map<string, PkgInfo>()
  const byShortName = new Map<string, PkgInfo>()

  for (const pkg of pkgs) {
    byFullName.set(pkg.fullName, pkg)
    byShortName.set(pkg.shortName, pkg)
  }

  return {
    byFullName,
    byShortName,
  }
}

function resolveWorkspaceDependency(
  dependencyName: string,
  indexes: {
    byFullName: Map<string, PkgInfo>
    byShortName: Map<string, PkgInfo>
  },
): PkgInfo | undefined {
  return (
    indexes.byFullName.get(dependencyName) ??
    indexes.byShortName.get(dependencyName.replace(/^@zeus-web\//, ''))
  )
}

function sortPackagesByWorkspaceDependencies(pkgs: PkgInfo[]): PkgInfo[] {
  const indexes = createPackageIndexes(pkgs)
  const sortedSeeds = [...pkgs].sort(comparePackageBaseOrder)
  const result: PkgInfo[] = []
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (pkg: PkgInfo, stack: string[]): void => {
    if (visited.has(pkg.fullName)) {
      return
    }

    if (visiting.has(pkg.fullName)) {
      const cycle = [...stack, pkg.fullName].join(' -> ')
      throw new Error(`workspace dependency cycle detected: ${cycle}`)
    }

    visiting.add(pkg.fullName)

    for (const dependencyName of pkg.workspaceDependencyNames) {
      const dependency = resolveWorkspaceDependency(dependencyName, indexes)

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
  const indexes = createPackageIndexes(allPkgs)
  const closure = new Set<string>()

  const visit = (item: PkgInfo): void => {
    if (closure.has(item.fullName)) {
      return
    }

    closure.add(item.fullName)

    for (const dependencyName of item.workspaceDependencyNames) {
      const dependency = resolveWorkspaceDependency(dependencyName, indexes)

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
    {
      dir: 'packages',
      kind: 'package',
    },
    {
      dir: 'packages/primitives',
      kind: 'primitive',
    },
    {
      dir: 'packages/advanced',
      kind: 'advanced',
    },
  ]

  for (const { dir, kind } of roots) {
    const abs = join(ROOT, dir)

    if (!existsSync(abs)) {
      continue
    }

    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }

      const pkgFile = join(abs, entry.name, 'package.json')

      if (!existsSync(pkgFile)) {
        continue
      }

      const pkgJson = readPackageJson(pkgFile)

      if (pkgJson.private || !pkgJson.name) {
        continue
      }

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
        hasBuildScript: Boolean(pkgJson.scripts?.build),
      })
    }
  }

  return sortPackagesByWorkspaceDependencies(pkgs)
}

function hasAllExportTargets(pkg: PkgInfo): boolean {
  if (pkg.exportTargets.length === 0) {
    return false
  }

  return pkg.exportTargets.every(target => existsSync(join(pkg.dir, target)))
}

async function buildFull(pkg: PkgInfo): Promise<void> {
  if (hasAllExportTargets(pkg)) {
    return
  }

  if (!pkg.hasBuildScript) {
    throw new Error(
      `${pkg.fullName} has no build script and missing dist output`,
    )
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
      {
        cwd: pkg.dir,
        stdio: 'inherit',
      },
    )

    return
  }

  await buildFull(pkg)
}

function logSection(title: string): void {
  console.log('')
  console.log(pc.bold(pc.cyan(`═══ ${title} ═══`)))
}

function resolveTarget(name: string, allPkgs: PkgInfo[]): PkgInfo | undefined {
  const exact = allPkgs.find(pkg => {
    return pkg.shortName === name || pkg.fullName === name
  })

  if (exact) {
    return exact
  }

  return allPkgs.find(pkg => pkg.shortName.startsWith(name))
}

function parseBuildMode(args: string[]): BuildMode {
  const tIndex = args.indexOf('-t')

  if (tIndex < 0 || tIndex + 1 >= args.length) {
    return 'full'
  }

  return args[tIndex + 1] === 'dts' ? 'dts' : 'full'
}

function parseTargetName(args: string[]): string | undefined {
  const cleanArgs = args.filter((arg, index) => {
    return arg !== '-t' && args[index - 1] !== '-t'
  })

  return cleanArgs[0]
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const buildMode = parseBuildMode(args)
  const targetName = parseTargetName(args)
  const allPkgs = discoverPackages()

  let targets: PkgInfo[]

  if (targetName) {
    const pkg = resolveTarget(targetName, allPkgs)

    if (!pkg) {
      const available = allPkgs.map(item => item.shortName).join(', ')

      console.error(
        `${pc.red(`✘ 未找到包 "${targetName}"`)}\n  可用包: ${available}`,
      )

      process.exit(1)
    }

    targets = collectPackageClosure(pkg, allPkgs)
  } else {
    targets = allPkgs
  }

  const label = buildMode === 'dts' ? '类型声明' : '完整构建'

  logSection(`${label} (${targets.length} 个包)`)

  for (const pkg of targets) {
    process.stdout.write(`\n  [${pkg.kind}] ${pc.bold(pkg.shortName)} ... `)

    try {
      if (buildMode === 'dts') {
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
