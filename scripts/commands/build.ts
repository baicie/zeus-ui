import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { execa } from 'execa'
import pc from 'picocolors'

const ROOT = process.cwd()

/* ------------------------------------------------------------------ */
/*  types & discovery                                                 */
/* ------------------------------------------------------------------ */

interface PkgInfo {
  shortName: string
  fullName: string
  dir: string
  /** Primitives are built via `rolldown` from the top-level config. */
  isPrimitive: boolean
}

function discoverPackages(): PkgInfo[] {
  const pkgs: PkgInfo[] = []

  const roots: Array<{ dir: string; isPrimitive: boolean }> = [
    { dir: 'packages', isPrimitive: false },
    { dir: 'packages/primitives', isPrimitive: true },
  ]

  for (const { dir, isPrimitive } of roots) {
    const abs = join(ROOT, dir)
    if (!existsSync(abs)) continue
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pkgFile = join(abs, entry.name, 'package.json')
      if (!existsSync(pkgFile)) continue

      const pkgJson = JSON.parse(readFileSync(pkgFile, 'utf8')) as {
        name: string
      }
      const shortName = pkgJson.name.replace(/^@zeus-web\//, '')

      pkgs.push({
        shortName,
        fullName: pkgJson.name,
        dir: join(abs, entry.name),
        isPrimitive,
      })
    }
  }

  return pkgs.sort((a, b) => {
    // Primitives first (they are dependencies of non-primitive packages)
    if (a.isPrimitive !== b.isPrimitive) {
      return a.isPrimitive ? -1 : 1
    }
    return a.shortName.localeCompare(b.shortName)
  })
}

/* ------------------------------------------------------------------ */
/*  build runners                                                     */
/* ------------------------------------------------------------------ */

async function buildFull(pkg: PkgInfo): Promise<void> {
  if (pkg.isPrimitive) {
    const indexPath = join(pkg.dir, 'dist', 'index.js')
    if (existsSync(indexPath)) {
      return
    }
    await execa('rolldown', ['-c', '../../../rolldown.config.ts'], {
      cwd: pkg.dir,
      stdio: 'inherit',
    })
  } else {
    const indexPath = join(pkg.dir, 'dist', 'index.js')
    if (existsSync(indexPath)) {
      return
    }
    await execa('pnpm', ['run', 'build'], {
      cwd: pkg.dir,
      stdio: 'inherit',
    })
  }
}

async function buildDeclarations(pkg: PkgInfo): Promise<void> {
  if (pkg.isPrimitive) {
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
  } else {
    // tsup-based packages: --dts already produces declarations alongside the bundle
    await buildFull(pkg)
  }
}

/* ------------------------------------------------------------------ */
/*  helpers                                                           */
/* ------------------------------------------------------------------ */

function logSection(title: string) {
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
  const cleanArgs = args.filter((a, i) => a !== '-t' && args[i - 1] !== '-t')
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
    targets = [pkg]
  } else {
    targets = allPkgs
  }

  /* ---- run ---- */

  const label = targetType === 'dts' ? '类型声明' : '完整构建'
  logSection(`${label} (${targets.length} 个包)`)

  for (const pkg of targets) {
    const kindLabel = pkg.isPrimitive ? 'primitive' : 'package'
    process.stdout.write(`\n  [${kindLabel}] ${pc.bold(pkg.shortName)} ... `)

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
