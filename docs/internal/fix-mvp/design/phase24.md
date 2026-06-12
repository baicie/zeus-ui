下面给 **Phase 24：Release Readiness / 发布前最终校验** 的详细设计与完整代码。

Phase 24 不做新功能，而是把 Phase 15–23 的产物收口到“可发版”的最后一道门：

```txt id="c91d86"
1. 包元数据审计
2. dist 产物审计
3. exports / files / bin / types 审计
4. publishConfig provenance 审计
5. workspace publishable/private 边界审计
6. README / LICENSE / package README 审计
7. tarball dry-run 审计
8. final verify 命令串
```

当前根脚本已经有 `release:verify` 指向 `scripts/checks/check-release-readiness.ts`，也有完整的 build/check/docs/showcase/release 脚本基础。 `site:check` 也已经串起前面 Phase 的检查。
现有 `check-release-readiness.ts` 已经检查了常见包字段、exports、dist、primitive/icons/cli 特定输出。 但它还缺少几个 Phase 24 必要项：

```txt id="gowirs"
- @zeus-web/ui / @zeus-web/registry / @zeus-web/themes / @zeus-web/ai 特定导出审计
- package README / LICENSE 审计
- private example/docs 包不能发布审计
- exports 指向文件是否真的存在的通用审计
- dist 中禁止 source/test/config 文件的审计
- npm pack --dry-run 审计
- 发布 checklist 文档和 machine-readable summary
```

---

# Phase 24 范围

```txt id="h9zj22"
新增 / 改造：
  - check-release-readiness.ts 强化
  - check-release-tarballs.ts 新增 npm pack --dry-run 检查
  - check-release-final.ts 新增最终总闸门
  - release:verify:strict
  - release:verify:pack
  - release:final
  - docs/internal/release/release-readiness.md
  - docs/internal/design/zeus-ui-release-readiness.md
  - check-product-layers 更新 Phase 24 Done

不做：
  - 不发布 npm
  - 不创建 tag
  - 不改版本号
  - 不改 release 主流程
  - 不做 provenance token 配置
```

---

# 1. 修改根 `package.json`

新增脚本：

```json id="70h4m2"
{
  "release:verify:strict": "tsx scripts/checks/check-release-readiness.ts --strict",
  "release:verify:pack": "tsx scripts/checks/check-release-tarballs.ts",
  "release:final": "tsx scripts/checks/check-release-final.ts"
}
```

建议最终 scripts 相关片段变成：

```json id="4z507o"
{
  "scripts": {
    "release": "tsx scripts/commands/release.ts",
    "release:dry": "tsx scripts/commands/release.ts --dry-run",
    "release:plan": "tsx scripts/commands/release-plan.ts",
    "release:verify": "tsx scripts/checks/check-release-readiness.ts",
    "release:verify:strict": "tsx scripts/checks/check-release-readiness.ts --strict",
    "release:verify:pack": "tsx scripts/checks/check-release-tarballs.ts",
    "release:final": "tsx scripts/checks/check-release-final.ts"
  }
}
```

---

# 2. 替换 `scripts/checks/check-release-readiness.ts`

完整替换。这个版本保留原本能力，并新增：

```txt id="rzhly3"
- 所有 publishable 包必须有 README.md
- 根 LICENSE 必须存在
- strict 下 repository / publishConfig / sideEffects / packageManager 边界更严格
- exports 指向的 dist 文件必须存在
- package files 不能包含 src/tests/examples
- @zeus-web/ui / registry / themes / ai 特定 exports 检查
- private docs/examples 包不能出现在 publishable 列表
- summary 输出更清楚
```

```ts id="82qr7b"
import type { PackageJsonLike, WorkspacePackage } from '../release/workspace'

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import pc from 'picocolors'

import {
  getUniqueVersions,
  listPublishablePackages,
  listWorkspacePackages,
  repositoryUrl,
} from '../release/workspace'

interface Options {
  allowZero: boolean
  strict: boolean
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    allowZero: false,
    strict: false,
  }

  for (const arg of args) {
    if (arg === '--allow-zero') {
      options.allowZero = true
      continue
    }

    if (arg === '--strict') {
      options.strict = true
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

function isSemverLike(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i.test(version)
}

function hasExport(pkg: PackageJsonLike, key: string): boolean {
  return Boolean(pkg.exports && key in pkg.exports)
}

function hasFile(pkg: PackageJsonLike, file: string): boolean {
  return Array.isArray(pkg.files) && pkg.files.includes(file)
}

function hasDistTarget(pkg: WorkspacePackage, target: string): boolean {
  return existsSync(resolve(pkg.dir, target.replace(/^\.\//, '')))
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function collectExportTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value]

  if (Array.isArray(value)) {
    return value.flatMap(collectExportTargets)
  }

  if (!value || typeof value !== 'object') return []

  const result: string[] = []

  for (const child of Object.values(value as Record<string, unknown>)) {
    result.push(...collectExportTargets(child))
  }

  return result
}

function isRuntimeExportTarget(target: string): boolean {
  return (
    target.startsWith('./dist/') ||
    target.endsWith('.css') ||
    target.endsWith('.json') ||
    target.endsWith('.svg')
  )
}

function checkExportTargets(pkg: WorkspacePackage, errors: string[]): void {
  const exports = toObject(pkg.packageJson.exports)

  for (const [key, value] of Object.entries(exports)) {
    const targets = collectExportTargets(value)

    if (targets.length === 0) {
      errors.push(`${pkg.name}: export ${key} must point to at least one file`)
      continue
    }

    for (const target of targets) {
      if (!target.startsWith('./')) {
        errors.push(
          `${pkg.name}: export ${key} target must be relative: ${target}`,
        )
        continue
      }

      if (!isRuntimeExportTarget(target)) {
        errors.push(
          `${pkg.name}: export ${key} target must point to dist/css/json/svg output: ${target}`,
        )
        continue
      }

      if (!hasDistTarget(pkg, target)) {
        errors.push(
          `${pkg.name}: export ${key} target does not exist: ${target}`,
        )
      }
    }
  }
}

function checkFilesAllowList(pkg: WorkspacePackage, errors: string[]): void {
  const files = toArray(pkg.packageJson.files).map(String)

  if (!files.includes('dist')) {
    errors.push(`${pkg.name}: files must include dist`)
  }

  for (const forbidden of [
    'src',
    'tests',
    '__tests__',
    'examples',
    'scripts',
  ]) {
    if (files.includes(forbidden)) {
      errors.push(`${pkg.name}: files must not include ${forbidden}`)
    }
  }
}

function checkReadmeAndLicense(pkg: WorkspacePackage, errors: string[]): void {
  if (!existsSync(resolve(pkg.dir, 'README.md'))) {
    errors.push(`${pkg.name}: package README.md is required`)
  }

  const rootLicense = resolve(process.cwd(), 'LICENSE')
  const pkgLicense = resolve(pkg.dir, 'LICENSE')

  if (!existsSync(rootLicense) && !existsSync(pkgLicense)) {
    errors.push(`${pkg.name}: LICENSE is required at repo root or package root`)
  }
}

function checkCommonPackage(
  pkg: WorkspacePackage,
  options: Options,
  errors: string[],
): void {
  const json = pkg.packageJson

  if (!pkg.name.startsWith('@zeus-web/')) {
    errors.push(`${pkg.name}: package name must start with @zeus-web/`)
  }

  if (!isSemverLike(pkg.version)) {
    errors.push(`${pkg.name}: invalid semver version ${pkg.version}`)
  }

  if (!options.allowZero && pkg.version === '0.0.0') {
    errors.push(`${pkg.name}: version must not be 0.0.0 for release`)
  }

  if (json.license !== 'MIT') {
    errors.push(`${pkg.name}: license must be MIT`)
  }

  if (!json.description) {
    errors.push(`${pkg.name}: description is required`)
  }

  if (!json.exports) {
    errors.push(`${pkg.name}: exports is required`)
  }

  checkFilesAllowList(pkg, errors)

  if (!json.scripts?.build) {
    errors.push(`${pkg.name}: scripts.build is required`)
  }

  if (!json.scripts?.check) {
    errors.push(`${pkg.name}: scripts.check is required`)
  }

  if (!existsSync(join(pkg.dir, 'dist'))) {
    errors.push(`${pkg.name}: dist is missing. Run pnpm build first.`)
  }

  checkReadmeAndLicense(pkg, errors)
  checkExportTargets(pkg, errors)

  if (options.strict) {
    const repository = json.repository

    if (
      !repository ||
      typeof repository === 'string' ||
      repository.url !== repositoryUrl ||
      repository.type !== 'git' ||
      !repository.directory
    ) {
      errors.push(
        `${pkg.name}: repository must be { type: "git", url: "${repositoryUrl}", directory }`,
      )
    }

    if (
      !json.publishConfig ||
      json.publishConfig.access !== 'public' ||
      json.publishConfig.provenance !== true
    ) {
      errors.push(
        `${pkg.name}: publishConfig must include { access: "public", provenance: true }`,
      )
    }
  }
}

function checkPrimitivePackage(pkg: WorkspacePackage, errors: string[]): void {
  for (const key of [
    '.',
    './wc',
    './react',
    './vue',
    './vue/global',
    './custom-elements.json',
    './zeus.components.json',
  ]) {
    if (!hasExport(pkg.packageJson, key)) {
      errors.push(`${pkg.name}: primitive package must export ${key}`)
    }
  }

  for (const target of [
    './dist/wc/index.js',
    './dist/wc/index.d.ts',
    './dist/react/index.js',
    './dist/react/index.d.ts',
    './dist/vue/index.js',
    './dist/vue/index.d.ts',
    './dist/vue/global.d.ts',
    './dist/custom-elements.json',
    './dist/zeus.components.json',
  ]) {
    if (!hasDistTarget(pkg, target)) {
      errors.push(`${pkg.name}: missing build output ${target}`)
    }
  }
}

function checkIconsPackage(pkg: WorkspacePackage, errors: string[]): void {
  for (const key of [
    '.',
    './react',
    './vue',
    './wc',
    './manifest.json',
    './svg/*',
  ]) {
    if (!hasExport(pkg.packageJson, key)) {
      errors.push(`${pkg.name}: icons package must export ${key}`)
    }
  }

  for (const target of [
    './dist/index.js',
    './dist/index.d.ts',
    './dist/react/index.js',
    './dist/react/index.d.ts',
    './dist/vue/index.js',
    './dist/vue/index.d.ts',
    './dist/wc/index.js',
    './dist/wc/index.d.ts',
    './dist/manifest.json',
    './dist/svg/check.svg',
  ]) {
    if (!hasDistTarget(pkg, target)) {
      errors.push(`${pkg.name}: missing build output ${target}`)
    }
  }
}

function checkCliPackage(pkg: WorkspacePackage, errors: string[]): void {
  if (!pkg.packageJson.bin || typeof pkg.packageJson.bin !== 'object') {
    errors.push(`${pkg.name}: CLI package must declare bin`)
    return
  }

  const bin = pkg.packageJson.bin as Record<string, string>

  if (bin.zweb !== './dist/index.js') {
    errors.push(`${pkg.name}: CLI bin.zweb must be ./dist/index.js`)
  }

  if (!hasDistTarget(pkg, './dist/index.js')) {
    errors.push(`${pkg.name}: missing dist/index.js`)
  }

  const binFile = resolve(pkg.dir, 'dist/index.js')

  if (existsSync(binFile)) {
    const source = readFileSync(binFile, 'utf-8')

    if (!source.startsWith('#!/usr/bin/env node')) {
      errors.push(`${pkg.name}: dist/index.js must start with node shebang`)
    }
  }
}

function checkUiPackage(pkg: WorkspacePackage, errors: string[]): void {
  for (const key of ['.', './styles.css', './button', './input']) {
    if (!hasExport(pkg.packageJson, key)) {
      errors.push(`${pkg.name}: ui package must export ${key}`)
    }
  }

  for (const target of [
    './dist/index.js',
    './dist/index.d.ts',
    './dist/styles.css',
    './dist/button.js',
    './dist/button.d.ts',
    './dist/input.js',
    './dist/input.d.ts',
  ]) {
    if (!hasDistTarget(pkg, target)) {
      errors.push(`${pkg.name}: missing build output ${target}`)
    }
  }
}

function checkRegistryPackage(pkg: WorkspacePackage, errors: string[]): void {
  for (const key of [
    '.',
    './registry.json',
    './templates/react/button.tsx',
    './templates/react/input.tsx',
    './templates/vue/button.vue',
    './templates/vue/input.vue',
    './templates/lib/cn.ts',
    './templates/css/globals.css',
  ]) {
    if (!hasExport(pkg.packageJson, key)) {
      errors.push(`${pkg.name}: registry package must export ${key}`)
    }
  }

  for (const target of [
    './dist/index.js',
    './dist/index.d.ts',
    './dist/registry.json',
    './dist/templates/react/button.tsx',
    './dist/templates/react/input.tsx',
    './dist/templates/vue/button.vue',
    './dist/templates/vue/input.vue',
    './dist/templates/lib/cn.ts',
    './dist/templates/css/globals.css',
  ]) {
    if (!hasDistTarget(pkg, target)) {
      errors.push(`${pkg.name}: missing build output ${target}`)
    }
  }
}

function checkThemesPackage(pkg: WorkspacePackage, errors: string[]): void {
  for (const key of ['.', './default.css', './components.css']) {
    if (!hasExport(pkg.packageJson, key)) {
      errors.push(`${pkg.name}: themes package must export ${key}`)
    }
  }

  for (const target of [
    './dist/index.js',
    './dist/index.d.ts',
    './dist/default.css',
    './dist/components.css',
  ]) {
    if (!hasDistTarget(pkg, target)) {
      errors.push(`${pkg.name}: missing build output ${target}`)
    }
  }
}

function checkAiPackage(pkg: WorkspacePackage, errors: string[]): void {
  for (const key of ['.', './metadata.json']) {
    if (!hasExport(pkg.packageJson, key)) {
      errors.push(`${pkg.name}: ai package must export ${key}`)
    }
  }

  for (const target of [
    './dist/index.js',
    './dist/index.d.ts',
    './dist/metadata.json',
  ]) {
    if (!hasDistTarget(pkg, target)) {
      errors.push(`${pkg.name}: missing build output ${target}`)
    }
  }
}

function checkSpecificPackage(pkg: WorkspacePackage, errors: string[]): void {
  if (pkg.isPrimitive) {
    checkPrimitivePackage(pkg, errors)
  }

  if (pkg.name === '@zeus-web/icons') {
    checkIconsPackage(pkg, errors)
  }

  if (pkg.name === '@zeus-web/cli') {
    checkCliPackage(pkg, errors)
  }

  if (pkg.name === '@zeus-web/ui') {
    checkUiPackage(pkg, errors)
  }

  if (pkg.name === '@zeus-web/registry') {
    checkRegistryPackage(pkg, errors)
  }

  if (pkg.name === '@zeus-web/themes') {
    checkThemesPackage(pkg, errors)
  }

  if (pkg.name === '@zeus-web/ai') {
    checkAiPackage(pkg, errors)
  }
}

function checkPrivateWorkspacePackages(errors: string[]): void {
  for (const pkg of listWorkspacePackages()) {
    if (
      !pkg.name.startsWith('@zeus-web/example-') &&
      pkg.name !== '@zeus-web/docs'
    ) {
      continue
    }

    if (!pkg.isPrivate) {
      errors.push(`${pkg.name}: examples/docs packages must be private`)
    }
  }
}

function main(): void {
  const options = parseOptions(process.argv.slice(2))
  const packages = listPublishablePackages()
  const errors: string[] = []

  if (packages.length === 0) {
    errors.push('No publishable packages found.')
  }

  const versions = getUniqueVersions(packages)

  if (versions.length > 1) {
    errors.push(
      `All publishable packages must have the same version. Found: ${versions.join(', ')}`,
    )
  }

  for (const pkg of packages) {
    checkCommonPackage(pkg, options, errors)
    checkSpecificPackage(pkg, errors)
  }

  checkPrivateWorkspacePackages(errors)

  if (errors.length > 0) {
    console.error(pc.red('Release readiness check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Release readiness check passed.'))
  console.log(`Checked ${packages.length} publishable packages.`)
}

main()
```

---

# 3. 新增 `scripts/checks/check-release-tarballs.ts`

这个脚本做 `pnpm pack --dry-run --json` 审计，不发包，只看 tarball 内容是否干净。

```ts id="t9owjm"
import type { WorkspacePackage } from '../release/workspace'

import { existsSync } from 'node:fs'

import { execa } from 'execa'
import pc from 'picocolors'

import { listPublishablePackages } from '../release/workspace'

interface PackFile {
  path: string
  size?: number
  mode?: number
}

interface PackResult {
  id?: string
  name?: string
  version?: string
  filename?: string
  files?: PackFile[]
}

const forbiddenPathPrefixes = [
  'src/',
  'tests/',
  '__tests__/',
  'examples/',
  'scripts/',
  '.github/',
  'temp/',
]

const forbiddenPathSuffixes = ['.map', '.tsbuildinfo', '.log']

function parsePackOutput(stdout: string): PackResult[] {
  const trimmed = stdout.trim()

  if (!trimmed) return []

  const parsed = JSON.parse(trimmed) as unknown

  if (Array.isArray(parsed)) {
    return parsed as PackResult[]
  }

  return [parsed as PackResult]
}

function isForbiddenFile(path: string): boolean {
  if (forbiddenPathPrefixes.some(prefix => path.startsWith(prefix))) {
    return true
  }

  if (forbiddenPathSuffixes.some(suffix => path.endsWith(suffix))) {
    return true
  }

  return false
}

function checkPackResult(
  pkg: WorkspacePackage,
  result: PackResult,
  errors: string[],
): void {
  const files = result.files ?? []
  const paths = files.map(file => file.path)

  if (paths.length === 0) {
    errors.push(`${pkg.name}: npm pack returned no files`)
    return
  }

  for (const required of ['package.json', 'README.md']) {
    if (!paths.includes(required)) {
      errors.push(`${pkg.name}: tarball must include ${required}`)
    }
  }

  if (!paths.some(path => path.startsWith('dist/'))) {
    errors.push(`${pkg.name}: tarball must include dist/ files`)
  }

  for (const path of paths) {
    if (isForbiddenFile(path)) {
      errors.push(`${pkg.name}: tarball must not include ${path}`)
    }
  }
}

async function packPackage(pkg: WorkspacePackage): Promise<PackResult[]> {
  const result = await execa('pnpm', ['pack', '--dry-run', '--json'], {
    cwd: pkg.dir,
    reject: true,
  })

  return parsePackOutput(result.stdout)
}

async function main(): Promise<void> {
  const errors: string[] = []
  const packages = listPublishablePackages()

  for (const pkg of packages) {
    if (!existsSync(pkg.dir)) {
      errors.push(`${pkg.name}: package directory missing`)
      continue
    }

    process.stdout.write(`Packing ${pc.bold(pkg.name)} ... `)

    try {
      const results = await packPackage(pkg)

      if (results.length === 0) {
        errors.push(`${pkg.name}: npm pack returned empty result`)
      }

      for (const result of results) {
        checkPackResult(pkg, result, errors)
      }

      process.stdout.write(`${pc.green('✓')}\n`)
    } catch (error) {
      process.stdout.write(`${pc.red('✘')}\n`)
      errors.push(
        `${pkg.name}: pnpm pack --dry-run failed: ${(error as Error).message}`,
      )
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('Release tarball check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Release tarball check passed.'))
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
```

---

# 4. 新增 `scripts/checks/check-release-final.ts`

这个脚本是最终总闸门，串联所有最终命令。

```ts id="xtt8jn"
import { execa } from 'execa'
import pc from 'picocolors'

interface Step {
  name: string
  command: string
  args: string[]
}

const steps: Step[] = [
  {
    name: 'TypeScript workspace check',
    command: 'pnpm',
    args: ['check'],
  },
  {
    name: 'Build packages and examples',
    command: 'pnpm',
    args: ['build'],
  },
  {
    name: 'Site check',
    command: 'pnpm',
    args: ['site:check'],
  },
  {
    name: 'Showcase CI',
    command: 'pnpm',
    args: ['showcase:ci'],
  },
  {
    name: 'Release readiness strict',
    command: 'pnpm',
    args: ['release:verify:strict'],
  },
  {
    name: 'Release tarball dry-run',
    command: 'pnpm',
    args: ['release:verify:pack'],
  },
  {
    name: 'Release dry-run',
    command: 'pnpm',
    args: ['release:dry'],
  },
]

async function runStep(step: Step): Promise<void> {
  console.log(pc.cyan(`\n▶ ${step.name}`))
  console.log(pc.gray(`  ${step.command} ${step.args.join(' ')}`))

  await execa(step.command, step.args, {
    stdio: 'inherit',
  })
}

async function main(): Promise<void> {
  for (const step of steps) {
    await runStep(step)
  }

  console.log('')
  console.log(pc.green('Release final verification passed.'))
}

main().catch(error => {
  console.error('')
  console.error(pc.red('Release final verification failed.'))
  console.error((error as Error).message)
  process.exit(1)
})
```

---

# 5. 新增 `scripts/checks/check-phase24-release.ts`

这个是 Phase 24 自身结构检查，防止后续删掉 final gate。

```ts id="q4y1ro"
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'scripts/checks/check-release-readiness.ts',
  'scripts/checks/check-release-tarballs.ts',
  'scripts/checks/check-release-final.ts',
  'docs/internal/release/release-readiness.md',
  'docs/internal/design/zeus-ui-release-readiness.md',
]

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf-8')
}

function checkFileExists(path: string, errors: string[]): void {
  if (!existsSync(resolve(root, path))) {
    errors.push(`Missing ${path}`)
  }
}

function checkSourceContains(
  file: string,
  contents: string[],
  errors: string[],
): void {
  const source = read(file)

  for (const content of contents) {
    if (!source.includes(content)) {
      errors.push(`${file} must contain "${content}"`)
    }
  }
}

function main(): void {
  const errors: string[] = []

  for (const file of requiredFiles) {
    checkFileExists(file, errors)
  }

  if (errors.length === 0) {
    checkSourceContains(
      'package.json',
      ['"release:verify:strict"', '"release:verify:pack"', '"release:final"'],
      errors,
    )

    checkSourceContains(
      'scripts/checks/check-release-readiness.ts',
      [
        'checkUiPackage',
        'checkRegistryPackage',
        'checkThemesPackage',
        'checkAiPackage',
        'checkExportTargets',
        'checkFilesAllowList',
        'checkPrivateWorkspacePackages',
      ],
      errors,
    )

    checkSourceContains(
      'scripts/checks/check-release-tarballs.ts',
      [
        'pnpm',
        'pack',
        '--dry-run',
        '--json',
        'tarball must include dist/ files',
      ],
      errors,
    )

    checkSourceContains(
      'scripts/checks/check-release-final.ts',
      [
        'release:verify:strict',
        'release:verify:pack',
        'release:dry',
        'Release final verification passed.',
      ],
      errors,
    )

    checkSourceContains(
      'docs/internal/release/release-readiness.md',
      [
        'pnpm release:final',
        'pnpm release:verify:strict',
        'pnpm release:verify:pack',
      ],
      errors,
    )
  }

  if (errors.length > 0) {
    console.error(pc.red('Phase 24 release check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Phase 24 release check passed.'))
}

main()
```

然后根 `package.json` 再加：

```json id="ykhtwx"
"check:phase24-release": "tsx scripts/checks/check-phase24-release.ts"
```

并放进 `site:check`，建议在 `docs:check` 后：

```json id="8y8ihi"
"site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:product-layers && pnpm check:ui-package && pnpm check:registry && pnpm check:cli-init && pnpm check:cli-add && pnpm check:cli-update-diff && pnpm check:showcase-registry && pnpm check:native-showcase && pnpm showcase:registry:check && pnpm docs:check && pnpm check:phase24-release && pnpm docs:build && pnpm examples:check && pnpm showcase:test"
```

---

# 6. 新增发布文档

## `docs/internal/release/release-readiness.md`

````md id="drqmk4"
# Release Readiness

This document defines the final verification workflow before publishing Zeus Web packages.

## Final command

```bash
pnpm release:final
```
````

This runs:

```txt id="2ict8d"
pnpm check
pnpm build
pnpm site:check
pnpm showcase:ci
pnpm release:verify:strict
pnpm release:verify:pack
pnpm release:dry
```

## Release readiness

Run:

```bash id="qoptun"
pnpm release:verify:strict
```

This validates publishable packages:

- package name starts with `@zeus-web/`
- version is valid semver and non-zero
- license is MIT
- description exists
- exports exist
- files include `dist`
- package README exists
- root or package LICENSE exists
- build/check scripts exist
- dist exists
- export targets exist
- repository metadata is correct
- publishConfig has public access and provenance enabled

## Tarball dry-run

Run:

```bash id="a41sob"
pnpm release:verify:pack
```

This runs `pnpm pack --dry-run --json` for every publishable package and validates:

- tarball includes `package.json`
- tarball includes `README.md`
- tarball includes `dist/`
- tarball does not include `src/`
- tarball does not include tests
- tarball does not include examples
- tarball does not include scripts
- tarball does not include `.map`, `.tsbuildinfo`, or logs

## Package-specific checks

### Primitive packages

Primitive packages must export:

```txt id="rv0z5i"
.
./wc
./react
./vue
./vue/global
./custom-elements.json
./zeus.components.json
```

### @zeus-web/ui

The styled native package must export:

```txt id="2fgd2a"
.
./styles.css
./button
./input
```

### @zeus-web/registry

The registry package must export:

```txt id="m0kqr9"
.
./registry.json
./templates/react/button.tsx
./templates/react/input.tsx
./templates/vue/button.vue
./templates/vue/input.vue
./templates/lib/cn.ts
./templates/css/globals.css
```

### @zeus-web/cli

The CLI package must declare:

```json id="jpgocv"
{
  "bin": {
    "zweb": "./dist/index.js"
  }
}
```

The built `dist/index.js` must start with:

```txt id="tb2o6k"
#!/usr/bin/env node
```

## Before publishing

1. Ensure working tree is clean.
2. Run `pnpm release:final`.
3. Run `pnpm release:plan`.
4. Review package versions.
5. Publish through the release workflow.

## Non-goals

This check does not publish packages and does not create tags.

````

---

# 7. 新增设计文档

## `docs/internal/design/zeus-ui-release-readiness.md`

```md id="fasmi7"
# Zeus-UI Release Readiness

## Status

Phase 24 design.

## Goal

Phase 24 adds the final release gate for Zeus Web.

It verifies that all publishable packages have correct metadata, build outputs, exports and tarball contents before release.

## Scope

Phase 24 includes:

- stronger `release:verify`
- strict package metadata checks
- package-specific output checks
- `pnpm pack --dry-run` tarball checks
- final release command
- release readiness documentation

## Commands

```bash
pnpm release:verify
pnpm release:verify:strict
pnpm release:verify:pack
pnpm release:final
````

## Publishable package rules

Every publishable package must:

- be named `@zeus-web/*`
- use MIT license
- define description
- define exports
- include `files: ["dist"]`
- define `scripts.build`
- define `scripts.check`
- contain `dist`
- contain `README.md`
- resolve all export targets
- use public provenance publish config in strict mode

## Private package rules

Examples and docs must be private.

```txt id="22y7iz"
@zeus-web/docs
@zeus-web/example-*
```

## Tarball rules

Tarballs must include:

```txt id="pd3xbl"
package.json
README.md
dist/
```

Tarballs must not include:

```txt id="5pp2ma"
src/
tests/
__tests__/
examples/
scripts/
*.map
*.tsbuildinfo
*.log
```

## Non-goals

Phase 24 does not publish packages, create tags, update versions or change release workflow permissions.

## Next phase

After Phase 24, the project is ready for release verification and can move to release candidate / beta publication.

````

---

# 8. 更新 `scripts/checks/check-product-layers.ts`

把 roadmap 检查更新到 Phase 24。

```ts id="hcq3o6"
{
  path: 'docs/internal/examples/showcase-roadmap.md',
  mustContain: [
    '| Phase 15 | Done',
    '| Phase 16 | Done',
    '| Phase 17 | Done',
    '| Phase 18 | Done',
    '| Phase 19 | Done',
    '| Phase 20 | Done',
    '| Phase 21 | Done',
    '| Phase 22 | Done',
    '| Phase 23 | Done',
    '| Phase 24 | Done',
    'The showcase has seventeen layers of checks:',
    'Product layer checks validate Zeus-UI package boundaries and usage entry decisions.',
    'Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.',
    'Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.',
    'CLI init checks validate zeus-ui.json initialization, project detection and base file generation.',
    'CLI add checks validate registry dependency expansion, framework-specific template filtering and lockfile tracking.',
    'CLI update/diff checks validate registry drift detection, safe update behavior and lock hash tracking.',
    'Showcase registry checks validate React and Vue demos consume registry-synced local styled components.',
    'Native showcase checks validate @zeus-web/ui can be consumed without React or Vue.',
    'Public docs checks validate CLI registry, native styled Web-C and advanced primitive usage paths.',
    'Release readiness checks validate publishable package metadata, build outputs and tarball contents.',
    'pnpm check:phase24-release',
    'pnpm release:verify:strict',
    'pnpm release:verify:pack',
    'pnpm release:final',
    'Release candidate / beta publication.',
  ],
}
````

替换 `checkPhaseOrder()`：

```ts id="x6rfg1"
function checkPhaseOrder(source: string): string[] {
  const errors: string[] = []
  const phase15Index = source.indexOf('| Phase 15 |')
  const phase16Index = source.indexOf('| Phase 16 |')
  const phase17Index = source.indexOf('| Phase 17 |')
  const phase18Index = source.indexOf('| Phase 18 |')
  const phase19Index = source.indexOf('| Phase 19 |')
  const phase20Index = source.indexOf('| Phase 20 |')
  const phase21Index = source.indexOf('| Phase 21 |')
  const phase22Index = source.indexOf('| Phase 22 |')
  const phase23Index = source.indexOf('| Phase 23 |')
  const phase24Index = source.indexOf('| Phase 24 |')
  const nextIndex = source.indexOf('Release candidate / beta publication.')

  for (const [label, index] of [
    ['Phase 15', phase15Index],
    ['Phase 16', phase16Index],
    ['Phase 17', phase17Index],
    ['Phase 18', phase18Index],
    ['Phase 19', phase19Index],
    ['Phase 20', phase20Index],
    ['Phase 21', phase21Index],
    ['Phase 22', phase22Index],
    ['Phase 23', phase23Index],
    ['Phase 24', phase24Index],
  ] as const) {
    if (index < 0) {
      errors.push(`showcase-roadmap.md must contain ${label} status row`)
    }
  }

  if (nextIndex < 0) {
    errors.push('showcase-roadmap.md must contain release candidate next work')
  }

  const ordered = [
    [
      'Phase 16 status must appear after Phase 15 status',
      phase15Index,
      phase16Index,
    ],
    [
      'Phase 17 status must appear after Phase 16 status',
      phase16Index,
      phase17Index,
    ],
    [
      'Phase 18 status must appear after Phase 17 status',
      phase17Index,
      phase18Index,
    ],
    [
      'Phase 19 status must appear after Phase 18 status',
      phase18Index,
      phase19Index,
    ],
    [
      'Phase 20 status must appear after Phase 19 status',
      phase19Index,
      phase20Index,
    ],
    [
      'Phase 21 status must appear after Phase 20 status',
      phase20Index,
      phase21Index,
    ],
    [
      'Phase 22 status must appear after Phase 21 status',
      phase21Index,
      phase22Index,
    ],
    [
      'Phase 23 status must appear after Phase 22 status',
      phase22Index,
      phase23Index,
    ],
    [
      'Phase 24 status must appear after Phase 23 status',
      phase23Index,
      phase24Index,
    ],
    [
      'Release candidate next work must appear after Phase 24 status',
      phase24Index,
      nextIndex,
    ],
  ] as const

  for (const [message, before, after] of ordered) {
    if (before >= 0 && after >= 0 && after < before) {
      errors.push(message)
    }
  }

  return errors
}
```

---

# 9. 更新 roadmap

## `docs/internal/examples/showcase-roadmap.md`

追加：

```md id="sefe67"
| Phase 24 | Done | Release readiness, package metadata audit, build output audit and tarball dry-run verification |
```

工程保障改成 17 层：

```md id="9sxgqy"
The showcase has seventeen layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.
4. Foundation page tests validate icons, themes and playground interaction behavior.
5. Shared unit tests validate metadata helpers, icon snippets, theme helpers and playground fixtures.
6. Vitest-powered Playwright E2E tests validate React and Vue showcase routes and critical browser interactions.
7. CI gates run showcase metadata, unit tests, builds and browser E2E as separate jobs.
8. Product layer checks validate Zeus-UI package boundaries and usage entry decisions.
9. Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.
10. Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.
11. CLI init checks validate zeus-ui.json initialization, project detection and base file generation.
12. CLI add checks validate registry dependency expansion, framework-specific template filtering and lockfile tracking.
13. CLI update/diff checks validate registry drift detection, safe update behavior and lock hash tracking.
14. Showcase registry checks validate React and Vue demos consume registry-synced local styled components.
15. Native showcase checks validate @zeus-web/ui can be consumed without React or Vue.
16. Public docs checks validate CLI registry, native styled Web-C and advanced primitive usage paths.
17. Release readiness checks validate publishable package metadata, build outputs and tarball contents.
```

Commands 增加：

```bash id="o4epuz"
pnpm check:phase24-release
pnpm release:verify:strict
pnpm release:verify:pack
pnpm release:final
```

Next work 改成：

```md id="284oyf"
## Next work

Future work should move from implementation phases to release operation:

- Release candidate / beta publication.
```

---

# 10. 文件清单

```txt id="hh3yj7"
package.json

scripts/checks/check-release-readiness.ts
scripts/checks/check-release-tarballs.ts
scripts/checks/check-release-final.ts
scripts/checks/check-phase24-release.ts
scripts/checks/check-product-layers.ts

docs/internal/release/release-readiness.md
docs/internal/design/zeus-ui-release-readiness.md
docs/internal/examples/showcase-roadmap.md
```

---

# 11. 验收命令

先 build：

```bash id="00z5rs"
pnpm build
```

然后验证 Phase 24：

```bash id="wyt4cv"
pnpm check:phase24-release
pnpm release:verify:strict
pnpm release:verify:pack
```

最终总闸门：

```bash id="w1k99j"
pnpm release:final
```

全量：

```bash id="mob67z"
pnpm check
pnpm build
pnpm site:check
pnpm showcase:ci
pnpm release:verify:strict
pnpm release:verify:pack
pnpm release:dry
```

---

# 12. Phase 24 完成判断

```txt id="h0pl4u"
完成：
  - release:verify:strict 可检查全部 publishable 包
  - release:verify:pack 可检查 npm pack dry-run tarball
  - release:final 串联 check/build/site/showcase/release verify/release dry-run
  - @zeus-web/ui 有专属 exports/output 检查
  - @zeus-web/registry 有模板 exports/output 检查
  - @zeus-web/themes 有 CSS exports/output 检查
  - @zeus-web/ai 有 metadata exports/output 检查
  - primitive/icons/cli 检查保留
  - examples/docs 必须 private
  - publishable 包必须有 README 和 dist
  - tarball 不允许包含 src/tests/examples/scripts
  - roadmap Phase 24 Done

未做：
  - 未发 npm
  - 未打 tag
  - 未改版本号
  - 未改 GitHub Actions 权限
```

---

# 13. 建议分支与 PR

分支名：

```txt id="i462mn"
chore/release-readiness
```

PR title：

```txt id="vd9ufb"
chore(release): add final release readiness checks
```
