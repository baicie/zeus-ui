import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { execa } from 'execa'
import pc from 'picocolors'

const ROOT = process.cwd()

/* ------------------------------------------------------------------ */
/*  helpers                                                           */
/* ------------------------------------------------------------------ */

interface PackageJson {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

/** Regex that matches a canary pre-release tag. */
const CANARY_REGEX = /\d+\.\d+\.\d+-canary\.\d{8}\.\d+\.\d+\.[a-f0-9]+/

/** Find the old canary version inside a semver string (exact or range). */
function findCanaryVersion(versionExpr: string): string | null {
  const m = CANARY_REGEX.exec(versionExpr)
  return m ? m[0] : null
}

/** Replace old canary inside a version expression with new one. */
function replaceInExpr(
  versionExpr: string,
  oldCanary: string,
  newCanary: string,
): string {
  return versionExpr.replace(oldCanary, newCanary)
}

/** List every package.json we care about (root + packages/* + packages/primitives/*). */
function listTargetFiles(): Array<{ file: string; label: string }> {
  const targets: Array<{ file: string; label: string }> = [
    { file: join(ROOT, 'package.json'), label: 'root' },
  ]

  const roots = ['packages', 'packages/primitives']
  for (const rel of roots) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) continue
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pkgFile = join(abs, entry.name, 'package.json')
      if (existsSync(pkgFile)) {
        targets.push({ file: pkgFile, label: relative(ROOT, pkgFile) })
      }
    }
  }

  return targets
}

/** Resolve the target canary version from npm registry. */
async function resolveLatestCanary(): Promise<string> {
  try {
    const { stdout } = await execa('npm', [
      'view',
      '@zeus-js/zeus',
      'versions',
      '--json',
    ])

    const versions: string[] = JSON.parse(stdout)
    const canaryVersions = versions.filter(v => v.includes('canary'))

    if (canaryVersions.length === 0) {
      throw new Error('未找到任何 canary 版本')
    }

    // npm returns versions in ascending order; the last one is the latest.
    const latest = canaryVersions[canaryVersions.length - 1]
    return latest
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`无法从 npm 获取最新 canary 版本: ${msg}`)
  }
}

/* ------------------------------------------------------------------ */
/*  main                                                              */
/* ------------------------------------------------------------------ */

interface Change {
  file: string
  field: string
  pkg: string
  oldExpr: string
  newExpr: string
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run') || args.includes('--dry')

  // Filter out flags to check for a version argument
  const versionArg = args.find(a => !a.startsWith('--'))

  let newVersion: string

  if (versionArg) {
    newVersion = versionArg
    if (!CANARY_REGEX.test(newVersion)) {
      console.error(
        `${pc.red('✘')} 版本号格式无效，应为：<major>.<minor>.<patch>-canary.<YYYYMMDD>.<build>.<commit>\n` +
          `  示例: 0.1.0-canary.20260606.14.1.abc12345`,
      )
      process.exit(1)
    }
  } else {
    console.log(
      `${pc.cyan('↻')} 正在从 npm 查询 @zeus-js/zeus 的最新 canary 版本...`,
    )
    try {
      newVersion = await resolveLatestCanary()
      console.log(`${pc.green('✔')} 最新 canary 版本: ${pc.bold(newVersion)}`)
    } catch (err: unknown) {
      console.error(
        `${pc.red('✘')} ${err instanceof Error ? err.message : String(err)}`,
      )
      process.exit(1)
    }
  }

  const targets = listTargetFiles()
  const changes: Change[] = []
  const depsFields = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
  ] as const

  for (const { file, label } of targets) {
    const raw = readFileSync(file, 'utf8')
    const pkg = JSON.parse(raw) as PackageJson
    let modified = raw

    for (const field of depsFields) {
      const deps = pkg[field]
      if (!deps) continue

      for (const [depName, versionExpr] of Object.entries(deps)) {
        if (!depName.startsWith('@zeus-js/')) continue

        const oldCanary = findCanaryVersion(versionExpr)
        if (!oldCanary) continue
        if (oldCanary === newVersion) continue

        const newExpr = replaceInExpr(versionExpr, oldCanary, newVersion)

        // Replace inside raw JSON string to preserve formatting
        const searchKey = `"${depName}": "${versionExpr}"`
        const replaceKey = `"${depName}": "${newExpr}"`
        if (modified.includes(searchKey)) {
          modified = modified.replace(searchKey, replaceKey)
          changes.push({
            file: label,
            field,
            pkg: depName,
            oldExpr: versionExpr,
            newExpr,
          })
        } else {
          console.warn(
            `${pc.yellow('⚠')} 无法在 ${label} 中找到 ${searchKey}，跳过`,
          )
        }
      }
    }

    if (!dryRun && modified !== raw) {
      writeFileSync(file, modified, 'utf8')
    }
  }

  /* ---- summary ---- */

  if (changes.length === 0) {
    console.log(
      `\n${pc.green('✔')} 未发现需要更新的 @zeus-js/* canary 版本引用`,
    )
    return
  }

  const action = dryRun ? '将更新' : '已更新'
  console.log(`\n${pc.green('✔')} ${action} ${changes.length} 处引用:\n`)

  for (const c of changes) {
    console.log(`  ${pc.cyan(c.file)}`)
    console.log(`    ${pc.dim(c.field)}  ${pc.bold(c.pkg)}`)
    console.log(`      ${pc.red(c.oldExpr)}`)
    console.log(`      ${pc.green(c.newExpr)}`)
    console.log('')
  }

  if (dryRun) {
    console.log(pc.yellow('提示: 移除 --dry-run 参数即可实际写入文件'))
  }
}

main().catch((err: unknown) => {
  console.error(
    `${pc.red('✘')} ${err instanceof Error ? err.message : String(err)}`,
  )
  process.exit(1)
})
