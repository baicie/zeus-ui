import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { execa } from 'execa'
import pc from 'picocolors'

import { getImplementedShowcasePackageNames } from '../../examples/showcase-shared/src/implemented'

interface Options {
  dryRun: boolean
  printOnly: boolean
  includeIcons: boolean
  force: boolean
}

function readOptions(argv: string[]): Options {
  return {
    dryRun: argv.includes('--dry-run'),
    printOnly: argv.includes('--print'),
    includeIcons: !argv.includes('--no-icons'),
    force: argv.includes('--force'),
  }
}

type ShowcasePackageKind = 'package' | 'primitive' | 'advanced'

function discoverPackages(): { name: string; kind: ShowcasePackageKind }[] {
  const roots: Array<{ dir: string; kind: ShowcasePackageKind }> = [
    { dir: 'packages', kind: 'package' },
    { dir: 'packages/primitives', kind: 'primitive' },
    { dir: 'packages/advanced', kind: 'advanced' },
  ]
  const packages: { name: string; kind: ShowcasePackageKind }[] = []

  for (const { dir, kind } of roots) {
    const abs = join(process.cwd(), dir)
    if (!existsSync(abs)) continue
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pkgFile = join(abs, entry.name, 'package.json')
      if (!existsSync(pkgFile)) continue

      const pkgJson = JSON.parse(readFileSync(pkgFile, 'utf8')) as {
        name: string
      }
      packages.push({ name: pkgJson.name, kind })
    }
  }

  return packages
}

function createBuildTargetNames(options: Options): string[] {
  const packages = getImplementedShowcasePackageNames()

  const foundationPackages = options.includeIcons
    ? ['@zeus-web/themes', '@zeus-web/icons']
    : ['@zeus-web/themes']

  /**
   * Native showcase consumes @zeus-web/ui directly.
   *
   * @zeus-web/ui is not part of implemented showcase primitives, because it is
   * the package-owned styled Web-C entry layer. It must be built before native
   * showcase check/build/test can resolve its package exports.
   *
   * @zeus-web/zeus-compat is consumed by docs playground and must also be
   * built so that vitepress can resolve its package exports during build.
   */
  const nativeShowcasePackages = ['@zeus-web/ui', '@zeus-web/zeus-compat']
  const advancedShowcasePackages = [
    '@zeus-web/virtual',
    '@zeus-web/chat',
    '@zeus-web/data-grid',
    '@zeus-web/agent-console',
    '@zeus-web/revogrid-adapter',
  ]

  return [
    ...foundationPackages,
    ...packages,
    ...nativeShowcasePackages,
    ...advancedShowcasePackages,
  ]
}

function createPnpmArgs(options: Options): string[] {
  const packageNames = createBuildTargetNames(options)
  const filters = packageNames.flatMap(packageName => ['--filter', packageName])

  return ['-w', ...filters, 'build']
}

async function buildPackage(
  pkg: string,
  kind: ShowcasePackageKind,
  options: Options,
): Promise<void> {
  if (kind === 'primitive' || kind === 'advanced') {
    const pkgDir = join(
      process.cwd(),
      kind === 'primitive' ? 'packages/primitives' : 'packages/advanced',
      pkg.replace('@zeus-web/', ''),
    )
    const indexPath = join(pkgDir, 'dist', 'index.js')

    if (!options.force && existsSync(indexPath)) {
      return
    }

    await execa('rolldown', ['-c', '../../../rolldown.config.ts'], {
      cwd: pkgDir,
      stdio: 'inherit',
    })
    return
  }

  const pkgDir = join(process.cwd(), 'packages', pkg.replace('@zeus-web/', ''))
  const indexPath = join(pkgDir, 'dist', 'index.js')

  if (!options.force && existsSync(indexPath)) {
    return
  }

  await execa('pnpm', ['run', 'build'], {
    cwd: pkgDir,
    stdio: 'inherit',
  })
}

async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2))

  if (options.printOnly || options.dryRun) {
    const args = createPnpmArgs(options)
    console.log(`pnpm ${args.join(' ')}`)
    return
  }

  const allPackages = discoverPackages()
  const targets = createBuildTargetNames(options)

  console.log(
    pc.cyan(`Building showcase dependencies (${targets.length} packages)...`),
  )

  for (const pkg of targets) {
    const pkgInfo = allPackages.find(p => p.name === pkg)
    const kind = pkgInfo?.kind ?? 'package'
    process.stdout.write(`  ${pc.bold(pkg)} ... `)
    try {
      await buildPackage(pkg, kind, options)
      process.stdout.write(`${pc.green('✓')}\n`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stdout.write(`${pc.red('✘')}\n`)
      console.error(`    ${pc.red(msg)}`)
      process.exit(1)
    }
  }

  console.log(pc.green('Showcase dependencies built successfully.'))
}

main().catch(error => {
  console.error(pc.red('Failed to build showcase dependencies.'))
  console.error(error)
  process.exit(1)
})
