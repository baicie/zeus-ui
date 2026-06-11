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

function discoverPackages(): { name: string; isPrimitive: boolean }[] {
  const roots: Array<{ dir: string; isPrimitive: boolean }> = [
    { dir: 'packages', isPrimitive: false },
    { dir: 'packages/primitives', isPrimitive: true },
  ]
  const packages: { name: string; isPrimitive: boolean }[] = []

  for (const { dir, isPrimitive } of roots) {
    const abs = join(process.cwd(), dir)
    if (!existsSync(abs)) continue
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pkgFile = join(abs, entry.name, 'package.json')
      if (!existsSync(pkgFile)) continue

      const pkgJson = JSON.parse(readFileSync(pkgFile, 'utf8')) as {
        name: string
      }
      packages.push({ name: pkgJson.name, isPrimitive })
    }
  }

  return packages
}

function createPnpmArgs(options: Options): string[] {
  const packages = getImplementedShowcasePackageNames()

  const foundationPackages = options.includeIcons
    ? ['@zeus-web/themes', '@zeus-web/icons']
    : ['@zeus-web/themes']

  const packageNames = [...foundationPackages, ...packages]
  const filters = packageNames.flatMap(packageName => ['--filter', packageName])

  return ['-w', ...filters, 'build']
}

async function buildPackage(
  pkg: string,
  isPrimitive: boolean,
  options: Options,
): Promise<void> {
  if (isPrimitive) {
    const pkgDir = join(
      process.cwd(),
      'packages/primitives',
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

  const implementedPackages = getImplementedShowcasePackageNames()
  const allPackages = discoverPackages()

  const foundationPackages = options.includeIcons
    ? ['@zeus-web/themes', '@zeus-web/icons']
    : ['@zeus-web/themes']

  const targets = [...foundationPackages, ...implementedPackages]

  console.log(
    pc.cyan(`Building showcase dependencies (${targets.length} packages)...`),
  )

  for (const pkg of targets) {
    const pkgInfo = allPackages.find(p => p.name === pkg)
    const isPrimitive = pkgInfo?.isPrimitive ?? false
    process.stdout.write(`  ${pc.bold(pkg)} ... `)
    try {
      await buildPackage(pkg, isPrimitive, options)
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
