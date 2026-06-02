import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pc from 'picocolors'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const uiRoot = resolve(__dirname, '..')

function resolve(...parts: string[]): string {
  let p = parts[0]
  for (let i = 1; i < parts.length; i++) p = join(p, parts[i])
  return p
}

function log(msg: string) {
  console.log(`${pc.cyan('[unlink:zeus-js]')} ${msg}`)
}

const UI_PACKAGES = [
  '@zeus-js/bundler-plugin',
  '@zeus-js/compiler',
  '@zeus-js/component-analyzer',
  '@zeus-js/component-dts',
  '@zeus-js/output-css',
  '@zeus-js/output-icons',
  '@zeus-js/output-react-wrapper',
  '@zeus-js/output-vue-wrapper',
  '@zeus-js/output-wc',
  '@zeus-js/preset-component-library',
  '@zeus-js/runtime-dom',
  '@zeus-js/shared',
  '@zeus-js/signal',
  '@zeus-js/vite-plugin',
]

async function main() {
  log(`zeus-ui root: ${uiRoot}`)

  const uiNodeModules = join(uiRoot, 'node_modules')
  let removed = 0

  for (const pkgName of UI_PACKAGES) {
    const pkgDir = join(uiNodeModules, pkgName)
    if (!existsSync(pkgDir)) continue

    log(`  ${pc.red('REMOVE')} ${pkgName}`)
    try {
      rmSync(pkgDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    removed++
  }

  console.log('')
  log(`已移除 ${removed} 个本地链接。运行 "pnpm install" 重新安装 npm 依赖。`)
}

main()
