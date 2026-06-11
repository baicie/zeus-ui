import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import pc from 'picocolors'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const uiRoot = resolve(__dirname, '..')

function resolve(...parts: string[]): string {
  let p = parts[0]
  for (let i = 1; i < parts.length; i++) p = join(p, parts[i])
  return p
}

function log(msg: string) {
  console.log(`${pc.cyan('[link:zeus-js]')} ${msg}`)
}

function scanInstalledZeusPackages(root: string) {
  const scopedDir = join(root, 'node_modules', '@zeus-js')
  if (!existsSync(scopedDir)) return []

  const pkgs: Array<{ name: string; dir: string }> = []
  for (const name of readdirSync(scopedDir)) {
    const pkgDir = join(scopedDir, name)
    if (!existsSync(join(pkgDir, 'package.json'))) continue
    pkgs.push({ name: `@zeus-js/${name}`, dir: pkgDir })
  }
  return pkgs
}

async function main() {
  log(`zeus-ui root: ${uiRoot}`)

  const installed = scanInstalledZeusPackages(uiRoot)
  if (installed.length === 0) {
    log('未找到任何已安装的 @zeus-js/* 包，请先运行 pnpm install')
    return
  }

  log(`找到 ${installed.length} 个已安装的 @zeus-js/* 包:`)
  for (const pkg of installed) {
    log(`  ${pkg.name}`)
  }

  const uiNodeModules = join(uiRoot, 'node_modules')
  let linked = 0
  let failed = 0

  for (const pkg of installed) {
    const targetDir = join(uiNodeModules, pkg.name)

    log(`  ${pc.green('LINK')}  ${pkg.name}`)

    try {
      rmSync(targetDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }

    try {
      await execa('pnpm', ['link', pkg.name, '--global'], {
        cwd: uiRoot,
        stdio: 'inherit',
      })
      linked++
    } catch {
      log(
        `  ${pc.red('FAIL')}  ${
          pkg.name
        }: 全局未找到该包，请确认已在 zeus 仓库执行 pnpm link --global`,
      )
      failed++
    }
  }

  console.log('')
  log(`完成: linked=${linked} failed=${failed}`)
  log('提示: 运行 "pnpm unlink:zeus-js && pnpm install" 可恢复 npm 依赖')
}

main()
