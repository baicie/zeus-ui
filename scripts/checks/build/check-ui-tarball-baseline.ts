/**
 * UI 包 tarball 矩阵、体积与样式隔离基线。
 *
 * 对每个 UI 包（`packages/primitives/*`、`packages/advanced/*`、`packages/themes`）
 * 执行 `pnpm pack --dry-run --json`：不写 tarball，只读取 npm 会打包的文件清单。
 * 记录：
 *
 * - tarball 文件数与 `dist/` 之外的文件（发现误打包源码）；
 * - `dist/**` 下 JS 的字节数与 gzip 体积，按 `wc` / `react` / `vue` / 共享 chunk 分组；
 * - CSS 体积；
 * - 样式隔离：`packages/themes/src/components.css` 的每条选择器都必须以 Zeus
 *   自定义元素标签（`zw-*`）或根级 token 选择器开头，不能出现裸元素选择器
 *   （`button`、`input`、`*`），否则引入主题会改到宿主页面的同名元素。
 *
 * 结果写入 `temp/ui-tarball-baseline.json`（`temp/` 已被 git 忽略），作为
 * PR-24 报告的数据来源与后续回归基线。
 *
 * 用法：`node --import tsx scripts/checks/build/check-ui-tarball-baseline.ts`
 */

import type { Dirent } from 'node:fs'

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

import { listPublishablePackages } from '../../release/workspace'

interface PackFile {
  path: string
}

interface PackResult {
  files?: PackFile[]
  size?: number
  unpackedSize?: number
}

interface Size {
  bytes: number
  gzip: number
}

interface PackageBaseline {
  css: Size
  files: number
  groups: Record<'react' | 'shared' | 'vue' | 'wc', Size>
  nonDistFiles: string[]
  tarballBytes?: number
  unpackedBytes?: number
}

const root = process.cwd()
const reportPath = resolve(root, 'temp/ui-tarball-baseline.json')

const emptySize = (): Size => ({ bytes: 0, gzip: 0 })

function isUiPackage(name: string, dir: string): boolean {
  return (
    name === '@zeus-web/themes' ||
    dir.includes(join('packages', 'primitives')) ||
    dir.includes(join('packages', 'advanced'))
  )
}

function groupOf(path: string): 'react' | 'shared' | 'vue' | 'wc' {
  if (path.includes('/react/')) return 'react'
  if (path.includes('/vue/')) return 'vue'
  if (path.includes('/wc/')) return 'wc'
  return 'shared'
}

function sizeOf(file: string): Size {
  const bytes = readFileSync(file)

  return { bytes: bytes.length, gzip: gzipSync(bytes).length }
}

function packDryRun(dir: string): PackResult {
  // `npm pack` reports tarball/unpacked sizes; `pnpm pack` does not.
  const stdout = execFileSync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const trimmed = stdout.trim()

  if (!trimmed) return {}

  const parsed = JSON.parse(trimmed) as PackResult | PackResult[]

  return Array.isArray(parsed) ? parsed[0] : parsed
}

function collectPackageBaseline(dir: string): PackageBaseline | undefined {
  const result = packDryRun(dir)
  const files = result.files ?? []

  if (files.length === 0) return undefined

  const baseline: PackageBaseline = {
    css: emptySize(),
    files: files.length,
    groups: {
      react: emptySize(),
      shared: emptySize(),
      vue: emptySize(),
      wc: emptySize(),
    },
    nonDistFiles: files
      .map(file => file.path)
      .filter(
        path =>
          !path.startsWith('dist/') &&
          path !== 'package.json' &&
          path !== 'README.md' &&
          path !== 'LICENSE',
      ),
    tarballBytes: result.size,
    unpackedBytes: result.unpackedSize,
  }

  for (const file of files) {
    if (!file.path.startsWith('dist/')) continue
    if (!file.path.endsWith('.js') && !file.path.endsWith('.css')) continue

    const size = sizeOf(join(dir, file.path))

    if (file.path.endsWith('.css')) {
      baseline.css.bytes += size.bytes
      baseline.css.gzip += size.gzip
      continue
    }

    const group = baseline.groups[groupOf(file.path)]

    group.bytes += size.bytes
    group.gzip += size.gzip
  }

  return baseline
}

/**
 * 组件样式只能作用于 Zeus 自定义元素；根级 token 选择器是唯一例外。
 */
const SELECTOR_ALLOWLIST = [
  /^zw-[a-z-]+/u,
  /^:root$/u,
  /^\.dark$/u,
  /^\[data-theme/u,
  /^\[data-mode/u,
]

/**
 * 取出 `components.css` 里所有样式规则的选择器。
 *
 * `@media` / `@supports` 里的规则同样会作用到页面，必须保留；
 * `@keyframes` 里的 `from` / `to` / `50%` 是帧选择器，不是元素选择器，整块跳过。
 */
export function collectSelectors(css: string): string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//gu, '')
  const selectors: string[] = []
  let buffer = ''

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]

    if (char === '{') {
      const prelude = buffer.trim().replace(/\s+/gu, ' ')

      buffer = ''

      if (/^@(?:-webkit-)?keyframes\b/u.test(prelude)) {
        index = skipBlock(source, index)
        continue
      }

      if (prelude.startsWith('@')) continue

      for (const part of prelude.split(',')) {
        const selector = part.trim()

        if (selector) selectors.push(selector)
      }

      continue
    }

    if (char === '}') {
      buffer = ''
      continue
    }

    buffer += char
  }

  return selectors
}

/** 返回 `start` 处 `{` 对应的 `}` 的下标。 */
function skipBlock(source: string, start: number): number {
  let depth = 0

  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1
    } else if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return source.length
}

function checkStyleIsolation(): string[] {
  const css = readFileSync(
    resolve(root, 'packages/themes/src/components.css'),
    'utf8',
  )

  return collectSelectors(css).filter(
    selector => !SELECTOR_ALLOWLIST.some(pattern => pattern.test(selector)),
  )
}

function listCssFiles(directory: string): string[] {
  const entries: Dirent[] = readdirSync(directory, { withFileTypes: true })

  return entries.flatMap(entry => {
    const file = join(directory, entry.name)

    if (entry.isDirectory()) return listCssFiles(file)

    return entry.name.endsWith('.css') ? [file] : []
  })
}

function main(): void {
  const packages = listPublishablePackages(root).filter(pkg =>
    isUiPackage(pkg.name, pkg.dir),
  )
  const baseline: Record<string, PackageBaseline> = {}

  for (const pkg of packages) {
    process.stdout.write(`Packing ${pkg.name} ... `)

    const entry = collectPackageBaseline(pkg.dir)

    if (!entry) {
      process.stdout.write('skipped (no dist)\n')
      continue
    }

    baseline[pkg.name] = entry
    process.stdout.write(
      `wc ${entry.groups.wc.gzip} B · react ${entry.groups.react.gzip} B · vue ${entry.groups.vue.gzip} B gzip\n`,
    )
  }

  const violations = checkStyleIsolation()
  const componentCss = listCssFiles(
    resolve(root, 'packages/themes/src/components'),
  ).map(file => ({
    file: file.replace(
      `${resolve(root, 'packages/themes/src/components')}/`,
      '',
    ),
    ...sizeOf(file),
  }))

  const report = {
    componentCss,
    generatedAt: new Date().toISOString(),
    node: process.version,
    packages: baseline,
    styleIsolation: {
      file: 'packages/themes/src/components.css',
      violations,
    },
  }

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

  if (violations.length > 0) {
    console.error(
      `\n样式隔离失败：以下选择器会作用到宿主页面\n${violations.join('\n')}`,
    )
    process.exit(1)
  }

  console.info(`\nbaseline written to ${reportPath}`)
}

const entryPath = process.argv[1]

if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  main()
}
