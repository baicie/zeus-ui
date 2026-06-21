可以。这里的 **Phase 0** 我建议定义为：

```txt id="c5i66k"
Phase 0: Advanced Workspace Contract

目标不是实现 chat / virtual / data-grid，而是把 packages/advanced/* 变成仓库里的一等工作区类型：
  1. workspace 识别
  2. tsconfig 识别
  3. build 识别
  4. check:exports 识别
  5. check:build-output 识别
  6. release workspace 识别
  7. package rules 识别 advanced 包
  8. 新增 check:advanced-contract
  9. 固化 advanced 包规范
```

当前 `feat/advanced-workspace` 已经有基础改造：`pnpm-workspace.yaml` 已包含 `packages/advanced/*`，根 `tsconfig` 也已经包含 advanced 的 `src` 和 `__tests__`。 构建脚本也已经有 `PackageKind = 'package' | 'primitive' | 'advanced'`，并把 `primitive / advanced` 都视为组件包走共享 `rolldown.config.ts`。

但是当前还有两个必须在 Phase 0 修掉的问题：

```txt id="unjsai"
1. scripts/checks/build/check-package-exports.ts 里 packageRoots 重复声明，会直接 TS 报错。
2. scripts/release/workspace.ts 的 getWorkspacePackageKind 参数是对象，却拿对象和字符串比较，advanced/primitive kind 会判断错误。
```

第一个问题在当前文件第 8 和第 10 行能看到重复声明。 第二个问题在 release workspace 的 `getWorkspacePackageKind` 里，参数实际是 packageRoot 对象，但代码在和字符串比较。

下面给出 **Phase 0 的详细设计与完整代码**。

---

# Phase 0 详细设计

## 1. 包分类模型

仓库内包统一分三类：

```ts id="5s5mf9"
type WorkspacePackageKind = 'package' | 'primitive' | 'advanced'
```

含义：

```txt id="fqmw0l"
package:
  packages/* 下的普通基础设施包
  例如 cli / registry / ui / themes / ai / zeus-compat

primitive:
  packages/primitives/* 下的基础无样式组件
  例如 button / input / dialog / tabs

advanced:
  packages/advanced/* 下的高级组件
  例如 virtual / chat / data-grid / agent-console
```

## 2. advanced 包和 primitive 包的共同点

两者都应该：

```txt id="bycfhz"
1. 使用 root rolldown.config.ts
2. 由 @zeus-js/output-wc 生成 Web Component 产物
3. 由 @zeus-js/output-react-wrapper 生成 React wrapper
4. 由 @zeus-js/output-vue-wrapper 生成 Vue wrapper
5. 不手写 src/wc.ts / src/react.ts / src/vue.ts
6. 导出 ./wc / ./wc/auto / ./react / ./vue / ./vue/global
7. 导出 custom-elements.json 和 zeus.components.json
```

当前 primitive 包已经是这个结构，例如 `@zeus-web/button` 已导出 `.`、`./wc`、`./wc/auto`、`./react`、`./vue`、`./vue/global`、`./custom-elements.json` 和 `./zeus.components.json`。

## 3. advanced 包和 primitive 包的区别

```txt id="tg38ky"
primitive:
  基础控件
  小体积
  可进入 @zeus-web/react / @zeus-web/vue 聚合包

advanced:
  高阶能力组件
  默认独立安装
  不默认进入 @zeus-web/react / @zeus-web/vue / @zeus-web/headless 聚合包
  必须有 core/ 与 components/ 分层
  必须考虑大数据、高频更新、无框架使用
```

## 4. Phase 0 验收标准

执行：

```bash id="gashc7"
pnpm check
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm release:plan
```

必须通过。

---

# 需要修改 / 新增的完整代码

## 1. 修改 `package.json`

在 `scripts` 里新增：

```json id="9gk6us"
"check:advanced-contract": "tsx scripts/checks/contract/check-advanced-contract.ts"
```

同时把现有：

```json id="3mjqg1"
"check:product-contract": "tsx scripts/checks/contract/check-product-contract.ts"
```

改成：

```json id="cp7raq"
"check:product-contract": "tsx scripts/checks/contract/check-product-contract.ts && pnpm check:advanced-contract"
```

推荐最终相关脚本为：

```json id="f1v05y"
{
  "check:component-coverage": "tsx scripts/checks/registry/check-component-coverage.ts",
  "check:showcase-metadata": "tsx scripts/checks/examples/check-showcase-metadata.ts",
  "check:showcase-implementation": "tsx scripts/checks/examples/check-showcase-implementation.ts",
  "check:product-layers": "tsx scripts/checks/contract/check-product-layers.ts",
  "check:ui-package": "tsx scripts/checks/contract/check-ui-package.ts",
  "check:advanced-contract": "tsx scripts/checks/contract/check-advanced-contract.ts",
  "check:product-contract": "tsx scripts/checks/contract/check-product-contract.ts && pnpm check:advanced-contract"
}
```

这样所有调用 `pnpm check:product-contract` 的地方都会顺带校验 advanced workspace。目前根脚本里 `showcase:ci:metadata` 和 `site:check` 都已经依赖 `check:product-contract`。

---

## 2. 修改 `scripts/checks/build/check-package-exports.ts`

当前这个文件有重复 `packageRoots`。直接替换为下面完整代码：

```ts id="rpl1dx"
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { validatePackageRules } from '../package-rules'

const root = process.cwd()

const packageRoots = ['packages', 'packages/primitives', 'packages/advanced']

function listPackageJsonFiles(): string[] {
  const files: string[] = []

  for (const rel of packageRoots) {
    const abs = join(root, rel)

    if (!existsSync(abs)) continue

    for (const name of readdirSync(abs)) {
      const file = join(abs, name, 'package.json')

      if (existsSync(file)) {
        files.push(file)
      }
    }
  }

  return files.sort()
}

let hasError = false

for (const file of listPackageJsonFiles()) {
  const result = validatePackageRules(root, file)

  for (const error of result.errors) {
    console.error(`[package-rules] ${error}`)
  }

  if (!result.valid) {
    hasError = true
  }
}

if (hasError) {
  process.exit(1)
}

console.log('All packages have valid exports and package rules.')
```

---

## 3. 修改 `scripts/release/workspace.ts`

当前 `getWorkspacePackageKind()` 判断是错的。直接替换为下面完整代码：

```ts id="ei8mhm"
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

export interface PackageJsonLike {
  name?: string
  private?: boolean
  version?: string
  description?: string
  license?: string
  type?: string
  files?: string[]
  exports?: Record<string, unknown>
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, Record<string, unknown>>
  repository?:
    | string
    | {
        type?: string
        url?: string
        directory?: string
      }
  publishConfig?: {
    access?: string
    provenance?: boolean
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type WorkspacePackageKind = 'package' | 'primitive' | 'advanced'

export interface WorkspacePackage {
  name: string
  version: string
  dir: string
  relativeDir: string
  packageJsonPath: string
  packageJson: PackageJsonLike
  kind: WorkspacePackageKind
  isPrimitive: boolean
  isAdvanced: boolean
  isPrivate: boolean
}

export const packageRoots = [
  { dir: 'packages', kind: 'package' },
  { dir: 'packages/primitives', kind: 'primitive' },
  { dir: 'packages/advanced', kind: 'advanced' },
] as const

export const repositoryUrl = 'https://github.com/baicie/zeus-ui.git'

function toForwardSlash(value: string): string {
  return value.replace(/\\/g, '/')
}

function readPackageJson(file: string): PackageJsonLike {
  return JSON.parse(readFileSync(file, 'utf-8')) as PackageJsonLike
}

export function listWorkspacePackages(
  root = process.cwd(),
): WorkspacePackage[] {
  const result: WorkspacePackage[] = []

  for (const packageRoot of packageRoots) {
    const absoluteRoot = resolve(root, packageRoot.dir)

    if (!existsSync(absoluteRoot)) continue

    for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue

      const packageJsonPath = resolve(absoluteRoot, entry.name, 'package.json')

      if (!existsSync(packageJsonPath)) continue

      const packageJson = readPackageJson(packageJsonPath)

      if (!packageJson.name) {
        throw new Error(`${packageJsonPath} missing package name`)
      }

      const dir = resolve(absoluteRoot, entry.name)
      const kind = packageRoot.kind

      result.push({
        name: packageJson.name,
        version: packageJson.version ?? '0.0.0',
        dir,
        relativeDir: toForwardSlash(relative(root, dir)),
        packageJsonPath,
        packageJson,
        kind,
        isPrimitive: kind === 'primitive',
        isAdvanced: kind === 'advanced',
        isPrivate: Boolean(packageJson.private),
      })
    }
  }

  return result.sort((a, b) => {
    const weight: Record<WorkspacePackageKind, number> = {
      primitive: 0,
      advanced: 1,
      package: 2,
    }

    const kindCompare = weight[a.kind] - weight[b.kind]

    if (kindCompare !== 0) return kindCompare

    return a.name.localeCompare(b.name)
  })
}

export function listPublishablePackages(
  root = process.cwd(),
): WorkspacePackage[] {
  return listWorkspacePackages(root).filter(pkg => !pkg.isPrivate)
}

export function getPackageByName(
  name: string,
  root = process.cwd(),
): WorkspacePackage | undefined {
  return listWorkspacePackages(root).find(pkg => pkg.name === name)
}

export function getUniqueVersions(packages: WorkspacePackage[]): string[] {
  return Array.from(new Set(packages.map(pkg => pkg.version))).sort()
}

export function getPackageDirectory(
  root: string,
  pkg: WorkspacePackage,
): string {
  return toForwardSlash(relative(root, pkg.dir))
}
```

---

## 4. 修改 `scripts/checks/package-rules.ts`

这个文件目前只识别 primitive，不识别 advanced。直接替换为下面完整代码：

```ts id="mw58co"
import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface PackageJsonLike {
  name?: string
  private?: boolean
  scripts?: Record<string, string>
  sideEffects?: boolean | string[]
  exports?: Record<string, unknown>
  peerDependencies?: Record<string, string>
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

export interface PackageRuleResult {
  valid: boolean
  errors: string[]
}

type ComponentPackageKind = 'primitive' | 'advanced'

function toForwardSlash(p: string): string {
  return p.replace(/\\/g, '/')
}

export function validatePackageRules(
  root: string,
  packageJsonPath: string,
): PackageRuleResult {
  const errors: string[] = []
  const pkg = JSON.parse(
    readFileSync(packageJsonPath, 'utf8'),
  ) as PackageJsonLike
  const rel = toForwardSlash(relative(root, packageJsonPath))
  const isPrimitive = rel.startsWith('packages/primitives/')
  const isAdvanced = rel.startsWith('packages/advanced/')
  const isCompat = rel.startsWith('packages/zeus-compat/')

  if (pkg.private) {
    return {
      valid: true,
      errors,
    }
  }

  if (!pkg.name || !pkg.name.startsWith('@zeus-web/')) {
    errors.push(`${rel}: package name must start with @zeus-web/`)
  }

  if (!pkg.exports) {
    errors.push(`${pkg.name}: missing exports`)
  }

  validateZeusDependencyBoundary(pkg, errors, {
    allowComponentRuntimeDependencies: isPrimitive || isAdvanced,
  })

  if (isPrimitive) {
    validateComponentPackage(packageJsonPath, pkg, 'primitive', errors)
  }

  if (isAdvanced) {
    validateComponentPackage(packageJsonPath, pkg, 'advanced', errors)
    validateAdvancedPackageStructure(packageJsonPath, pkg, errors)
  }

  if (isCompat) {
    validateCompatPackage(packageJsonPath, pkg, errors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

function validateZeusDependencyBoundary(
  pkg: PackageJsonLike,
  errors: string[],
  options: {
    allowComponentRuntimeDependencies: boolean
  },
): void {
  const allowedComponentRuntimeDependencies = new Set([
    '@zeus-js/runtime-dom',
    '@zeus-js/web-c-runtime',
  ])

  const allowedToolingDependencies = new Set(['@zeus-js/output-icons'])

  for (const field of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
  ] as const) {
    const dependencies = pkg[field] ?? {}

    for (const name of Object.keys(dependencies)) {
      if (!name.startsWith('@zeus-js/')) continue

      const isAllowedPeer =
        field === 'peerDependencies' && name === '@zeus-js/zeus'
      const isAllowedComponentRuntimeDependency =
        options.allowComponentRuntimeDependencies &&
        field === 'dependencies' &&
        allowedComponentRuntimeDependencies.has(name)
      const isAllowedToolingDependency =
        field === 'dependencies' && allowedToolingDependencies.has(name)

      if (
        isAllowedPeer ||
        isAllowedComponentRuntimeDependency ||
        isAllowedToolingDependency
      ) {
        continue
      }

      errors.push(
        `${pkg.name}: must not declare ${field}.${name}; consume Zeus through peerDependencies.@zeus-js/zeus or generated component runtime dependencies`,
      )
    }
  }
}

function validateComponentPackage(
  packageJsonPath: string,
  pkg: PackageJsonLike,
  kind: ComponentPackageKind,
  errors: string[],
): void {
  const packageDir = packageJsonPath.replace(/[/\\]package\.json$/, '')
  const label = kind === 'primitive' ? 'primitive package' : 'advanced package'

  validateSharedRolldownConfig(packageDir, pkg, label, errors)

  if (
    !pkg.scripts ||
    !pkg.scripts.build ||
    !pkg.scripts.build.includes('rolldown -c ../../../rolldown.config.ts')
  ) {
    errors.push(
      `${pkg.name}: ${label} build script must use shared rolldown.config.ts`,
    )
  }

  if (!pkg.peerDependencies || !pkg.peerDependencies['@zeus-js/zeus']) {
    errors.push(`${pkg.name}: ${label} must peer depend on @zeus-js/zeus`)
  }

  if (
    !pkg.dependencies ||
    pkg.dependencies['@zeus-web/zeus-compat'] !== 'workspace:*'
  ) {
    errors.push(
      `${pkg.name}: ${label} must depend on @zeus-web/zeus-compat workspace:*`,
    )
  }

  for (const key of [
    '.',
    './wc',
    './wc/auto',
    './react',
    './vue',
    './vue/global',
    './custom-elements.json',
    './zeus.components.json',
  ]) {
    if (!pkg.exports || !(key in pkg.exports)) {
      errors.push(`${pkg.name}: ${label} must export ${key}`)
    }
  }

  if (!Array.isArray(pkg.sideEffects)) {
    errors.push(`${pkg.name}: ${label} sideEffects must be string[]`)
  } else {
    const hasWcSideEffect = pkg.sideEffects.some(item =>
      item.includes('dist/wc'),
    )

    if (!hasWcSideEffect) {
      errors.push(
        `${pkg.name}: ${label} sideEffects must include dist/wc entry`,
      )
    }
  }

  for (const forbidden of ['src/wc.ts', 'src/react.ts', 'src/vue.ts']) {
    if (existsSync(join(packageDir, forbidden))) {
      errors.push(
        `${pkg.name}: ${label} must not hand-write ${forbidden}; use @zeus-js/output-* instead`,
      )
    }
  }
}

function validateAdvancedPackageStructure(
  packageJsonPath: string,
  pkg: PackageJsonLike,
  errors: string[],
): void {
  const packageDir = packageJsonPath.replace(/[/\\]package\.json$/, '')

  const srcDir = join(packageDir, 'src')
  const indexFile = join(srcDir, 'index.ts')
  const typesFile = join(srcDir, 'types.ts')
  const coreDir = join(srcDir, 'core')
  const componentsDir = join(srcDir, 'components')

  if (!existsSync(indexFile)) {
    errors.push(`${pkg.name}: advanced package must contain src/index.ts`)
  }

  if (!existsSync(typesFile)) {
    errors.push(`${pkg.name}: advanced package must contain src/types.ts`)
  }

  if (!existsSync(coreDir)) {
    errors.push(`${pkg.name}: advanced package must contain src/core/`)
  }

  if (!existsSync(componentsDir)) {
    errors.push(`${pkg.name}: advanced package must contain src/components/`)
  }
}

function validateSharedRolldownConfig(
  packageDir: string,
  pkg: PackageJsonLike,
  label: string,
  errors: string[],
): void {
  if (existsSync(join(packageDir, 'rolldown.config.ts'))) {
    errors.push(
      `${pkg.name}: ${label} must use root rolldown.config.ts instead of local rolldown.config.ts`,
    )
  }

  if (existsSync(join(packageDir, 'rolldown.config.mjs'))) {
    errors.push(
      `${pkg.name}: ${label} must use root rolldown.config.ts instead of local rolldown.config.mjs`,
    )
  }

  const configPath = join(packageDir, '../../../rolldown.config.ts')

  if (!existsSync(configPath)) {
    errors.push(`${pkg.name}: missing root rolldown.config.ts`)
    return
  }

  const config = readFileSync(configPath, 'utf8')
  const usesSharedConfig = hasCreatePrimitiveRolldownConfigImport(config)
  const usesZeusOutputs =
    config.includes('@zeus-js/bundler-plugin/rolldown') &&
    config.includes('@zeus-js/output-wc') &&
    config.includes('@zeus-js/output-react-wrapper') &&
    config.includes('@zeus-js/output-vue-wrapper')

  if (!usesSharedConfig && !usesZeusOutputs) {
    errors.push(
      `${pkg.name}: ${label} rolldown config must use Zeus web-c output pipeline`,
    )
  }
}

function hasCreatePrimitiveRolldownConfigImport(config: string): boolean {
  return /import\s*\{\s*createPrimitiveRolldownConfig\s*\}\s*from\s*['"](?:\.\/|(?:\.\.\/)+)scripts\/rolldown\/createPrimitiveRolldownConfig(?:\.mjs|\.ts)['"]/.test(
    config,
  )
}

function validateCompatPackage(
  _packageJsonPath: string,
  pkg: PackageJsonLike,
  errors: string[],
): void {
  if (!pkg.peerDependencies || !pkg.peerDependencies['@zeus-js/zeus']) {
    errors.push(`${pkg.name}: must peer depend on @zeus-js/zeus`)
  }

  for (const key of ['.', './capabilities']) {
    if (!pkg.exports || !(key in pkg.exports)) {
      errors.push(`${pkg.name}: must export ${key}`)
    }
  }
}
```

---

## 5. 新增 `scripts/checks/contract/check-advanced-contract.ts`

这是 Phase 0 的核心。新增完整文件：

```ts id="r9zi6x"
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import pc from 'picocolors'

interface PackageJsonLike {
  name?: string
  private?: boolean
  description?: string
  scripts?: Record<string, string>
  sideEffects?: boolean | string[]
  exports?: Record<string, unknown>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  repository?:
    | string
    | {
        type?: string
        url?: string
        directory?: string
      }
}

const root = process.cwd()

const requiredWorkspaceFiles = [
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'packages/advanced/README.md',
  'docs/design/zeus-ui-advanced-components.md',
  'scripts/commands/build.ts',
  'scripts/checks/build/check-package-exports.ts',
  'scripts/checks/build/check-build-output.ts',
  'scripts/checks/package-rules.ts',
  'scripts/release/workspace.ts',
]

function toForwardSlash(value: string): string {
  return value.replace(/\\/g, '/')
}

function readText(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function readJson<T>(path: string): T {
  return JSON.parse(readText(path)) as T
}

function fileExists(path: string, errors: string[]): boolean {
  if (!existsSync(resolve(root, path))) {
    errors.push(`Missing required file: ${path}`)
    return false
  }

  return true
}

function mustContain(
  path: string,
  requiredContents: string[],
  errors: string[],
): void {
  const source = readText(path)

  for (const text of requiredContents) {
    if (!source.includes(text)) {
      errors.push(`${path} must contain ${JSON.stringify(text)}`)
    }
  }
}

function mustNotContain(
  path: string,
  forbiddenContents: string[],
  errors: string[],
): void {
  const source = readText(path)

  for (const text of forbiddenContents) {
    if (source.includes(text)) {
      errors.push(`${path} must not contain ${JSON.stringify(text)}`)
    }
  }
}

function countOccurrences(source: string, text: string): number {
  return source.split(text).length - 1
}

function checkWorkspaceRegistration(errors: string[]): void {
  for (const file of requiredWorkspaceFiles) {
    fileExists(file, errors)
  }

  mustContain('pnpm-workspace.yaml', ["'packages/advanced/*'"], errors)

  mustContain(
    'tsconfig.json',
    ['"packages/advanced/*/src"', '"packages/advanced/*/__tests__"'],
    errors,
  )

  mustContain(
    'scripts/commands/build.ts',
    [
      "type PackageKind = 'package' | 'primitive' | 'advanced'",
      "{ dir: 'packages/advanced', kind: 'advanced' }",
      "return pkg.kind === 'primitive' || pkg.kind === 'advanced'",
      "'advanced': 1",
    ],
    errors,
  )

  mustContain(
    'scripts/checks/build/check-build-output.ts',
    ["'packages/advanced'"],
    errors,
  )

  mustContain(
    'scripts/checks/build/check-package-exports.ts',
    ["'packages/advanced'"],
    errors,
  )

  const exportsCheck = readText('scripts/checks/build/check-package-exports.ts')
  const packageRootsCount = countOccurrences(
    exportsCheck,
    'const packageRoots =',
  )

  if (packageRootsCount !== 1) {
    errors.push(
      `scripts/checks/build/check-package-exports.ts must declare packageRoots exactly once, found ${packageRootsCount}`,
    )
  }

  mustContain(
    'scripts/release/workspace.ts',
    [
      "export type WorkspacePackageKind = 'package' | 'primitive' | 'advanced'",
      "{ dir: 'packages/advanced', kind: 'advanced' }",
      'isAdvanced: boolean',
      "isAdvanced: kind === 'advanced'",
    ],
    errors,
  )

  mustNotContain(
    'scripts/release/workspace.ts',
    [
      "if (packageRoot === 'packages/primitives') return 'primitive'",
      "if (packageRoot === 'packages/advanced') return 'advanced'",
    ],
    errors,
  )

  mustContain(
    'scripts/checks/package-rules.ts',
    [
      "type ComponentPackageKind = 'primitive' | 'advanced'",
      "const isAdvanced = rel.startsWith('packages/advanced/')",
      'validateAdvancedPackageStructure',
      'advanced package must contain src/core/',
      'advanced package must contain src/components/',
    ],
    errors,
  )
}

function checkDocs(errors: string[]): void {
  mustContain(
    'packages/advanced/README.md',
    [
      '# Advanced Components',
      'packages/advanced/*',
      'headless-first',
      '@zeus-web/virtual',
      '@zeus-web/chat',
      '@zeus-web/data-grid',
      '@zeus-web/agent-console',
    ],
    errors,
  )

  mustContain(
    'docs/design/zeus-ui-advanced-components.md',
    [
      '# Zeus UI 高级组件设计与路线图',
      'packages/advanced/*',
      '@zeus-web/virtual',
      '@zeus-web/chat',
      '@zeus-web/data-grid',
      '@zeus-web/agent-console',
      'AG Grid',
      'RevoGrid',
      'ChatGPT',
      'Web Component 是第一等产物',
    ],
    errors,
  )
}

function collectAdvancedPackageJsonFiles(): string[] {
  const advancedRoot = resolve(root, 'packages/advanced')

  if (!existsSync(advancedRoot)) {
    return []
  }

  const result: string[] = []

  for (const entry of readdirSync(advancedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const packageJsonPath = resolve(advancedRoot, entry.name, 'package.json')

    if (existsSync(packageJsonPath)) {
      result.push(packageJsonPath)
    }
  }

  return result.sort()
}

function getExportKeys(pkg: PackageJsonLike): string[] {
  return pkg.exports && typeof pkg.exports === 'object'
    ? Object.keys(pkg.exports)
    : []
}

function checkAdvancedPackages(errors: string[]): void {
  const advancedPackages = collectAdvancedPackageJsonFiles()

  for (const packageJsonPath of advancedPackages) {
    const rel = toForwardSlash(relative(root, packageJsonPath))
    const pkg = readJson<PackageJsonLike>(rel)
    const packageDir = packageJsonPath.replace(/[/\\]package\.json$/, '')
    const packageRelDir = toForwardSlash(relative(root, packageDir))

    if (pkg.private) continue

    if (!pkg.name?.startsWith('@zeus-web/')) {
      errors.push(`${rel}: advanced package name must start with @zeus-web/`)
    }

    if (!pkg.description) {
      errors.push(`${pkg.name}: advanced package must have description`)
    }

    if (
      !pkg.scripts?.build ||
      !pkg.scripts.build.includes('rolldown -c ../../../rolldown.config.ts')
    ) {
      errors.push(
        `${pkg.name}: advanced package build script must use shared rolldown.config.ts`,
      )
    }

    if (!pkg.scripts?.check) {
      errors.push(`${pkg.name}: advanced package must have check script`)
    }

    if (!pkg.scripts?.test) {
      errors.push(`${pkg.name}: advanced package must have test script`)
    }

    if (!pkg.peerDependencies?.['@zeus-js/zeus']) {
      errors.push(
        `${pkg.name}: advanced package must peer depend on @zeus-js/zeus`,
      )
    }

    if (pkg.dependencies?.['@zeus-web/zeus-compat'] !== 'workspace:*') {
      errors.push(
        `${pkg.name}: advanced package must depend on @zeus-web/zeus-compat workspace:*`,
      )
    }

    if (!Array.isArray(pkg.sideEffects)) {
      errors.push(`${pkg.name}: advanced package sideEffects must be string[]`)
    }

    const exportKeys = getExportKeys(pkg)

    for (const key of [
      '.',
      './wc',
      './wc/auto',
      './react',
      './vue',
      './vue/global',
      './custom-elements.json',
      './zeus.components.json',
    ]) {
      if (!exportKeys.includes(key)) {
        errors.push(`${pkg.name}: advanced package must export ${key}`)
      }
    }

    for (const requiredPath of [
      'src/index.ts',
      'src/types.ts',
      'src/core',
      'src/components',
    ]) {
      if (!existsSync(join(packageDir, requiredPath))) {
        errors.push(`${pkg.name}: missing ${packageRelDir}/${requiredPath}`)
      }
    }

    for (const forbiddenPath of [
      'src/wc.ts',
      'src/react.ts',
      'src/vue.ts',
      'rolldown.config.ts',
      'rolldown.config.mjs',
    ]) {
      if (existsSync(join(packageDir, forbiddenPath))) {
        errors.push(
          `${pkg.name}: must not contain ${packageRelDir}/${forbiddenPath}`,
        )
      }
    }

    const repository =
      typeof pkg.repository === 'object' ? pkg.repository : undefined

    if (repository && repository.directory !== packageRelDir) {
      errors.push(`${pkg.name}: repository.directory must be ${packageRelDir}`)
    }
  }
}

function main(): void {
  const errors: string[] = []

  checkWorkspaceRegistration(errors)
  checkDocs(errors)
  checkAdvancedPackages(errors)

  if (errors.length > 0) {
    console.error(pc.red('Advanced workspace contract check failed:'))

    for (const error of errors) {
      console.error(`  ${pc.red('✘')} ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Advanced workspace contract looks good.'))
}

main()
```

---

## 6. 新增 `packages/advanced/.gitkeep`

因为 `packages/advanced` 目录在没有实际高级组件包时可能为空。为了让目录稳定存在，新增：

```txt id="o3nr7t"
packages/advanced/.gitkeep
```

内容为空即可。

如果你已经有 `packages/advanced/README.md`，也可以不加 `.gitkeep`。但我建议加上，避免后续 README 被调整时目录丢失。

---

## 7. 新增 `docs/design/advanced-package-template.md`

Phase 0 不实现真实组件，但应该把高级组件包模板固化。新增完整文档：

````md id="jb1k0x"
# 高级组件包模板

本文档定义 `packages/advanced/*` 下高级组件包的最小结构。

## 目录结构

```txt
packages/advanced/<name>/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    core/
      index.ts
    components/
      <name>.tsx
  __tests__/
    <name>.spec.ts
```

## package.json 模板

```json
{
  "name": "@zeus-web/<name>",
  "type": "module",
  "version": "0.0.0",
  "description": "Headless <name> advanced component for Zeus Web.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/baicie/zeus-ui.git",
    "directory": "packages/advanced/<name>"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "sideEffects": ["./dist/wc/index.js", "./dist/wc/*.js", "./dist/**/*.css"],
  "exports": {
    ".": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc/auto": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/auto.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js"
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue/index.js"
    },
    "./vue/global": {
      "types": "./dist/vue/global.d.ts"
    },
    "./custom-elements.json": {
      "default": "./dist/custom-elements.json"
    },
    "./zeus.components.json": {
      "default": "./dist/zeus.components.json"
    }
  },
  "files": ["dist"],
  "scripts": {
    "dev": "rolldown -c ../../../rolldown.config.ts --watch",
    "build": "rimraf dist && rolldown -c ../../../rolldown.config.ts",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../../.. --project unit packages/advanced/<name>/__tests__/<name>.spec.ts"
  },
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.5 <0.2.0",
    "react": ">=18 || >=19",
    "vue": ">=3"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    },
    "vue": {
      "optional": true
    }
  },
  "dependencies": {
    "@zeus-js/runtime-dom": "0.1.0-beta.5",
    "@zeus-js/web-c-runtime": "0.2.0",
    "@zeus-web/zeus-compat": "workspace:*"
  }
}
```

## src/index.ts 模板

```ts
export * from './types'
export * from './components/<name>'
```

## src/types.ts 模板

```ts
export interface <PascalName>Props {
  disabled?: boolean
}

export interface <PascalName>Element extends HTMLElement {
  focus: () => void
}
```

## src/core/index.ts 模板

```ts
export interface <PascalName>State {
  disabled: boolean
}

export function create<P extends <PascalName>State>(state: P): P {
  return state
}
```

## src/components/<name>.tsx 模板

```tsx
import type { DefineElementContext } from '@zeus-js/zeus'
import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

import type { <PascalName>Element, <PascalName>Props } from '../types'

function setup(
  props: <PascalName>Props,
  ctx: DefineElementContext<<PascalName>Element>,
) {
  ctx.expose({
    focus(): void {
      ctx.host.focus()
    },
  })

  return (
    <Host
      data-slot="<name>-root"
      data-disabled={() => (props.disabled ? '' : undefined)}
    >
      <div part="root" data-slot="<name>">
        <Slot />
      </div>
    </Host>
  )
}

export const <PascalName> = defineElement<<PascalName>Props, <PascalName>Element>(
  'zw-<name>',
  {
    shadow: false,
    props: {
      disabled: prop(Boolean, {
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless <name> advanced component.',
    },
  },
  setup,
)
```

## 约束

高级组件包必须：

1. 使用 `packages/advanced/<name>`。
2. 使用共享 `../../../rolldown.config.ts`。
3. 不手写 `src/wc.ts`、`src/react.ts`、`src/vue.ts`。
4. `src/core` 放纯 TypeScript engine。
5. `src/components` 放 Zeus Web Component。
6. Web Component 是第一等产物。
7. React/Vue wrapper 只能做薄适配。
````

---

# Phase 0 后的分支状态应该是

```txt id="8m2szi"
feat/advanced-workspace
  pnpm-workspace.yaml
  tsconfig.json
  package.json
  scripts/commands/build.ts
  scripts/checks/build/check-package-exports.ts
  scripts/checks/build/check-build-output.ts
  scripts/checks/package-rules.ts
  scripts/checks/contract/check-advanced-contract.ts
  scripts/release/workspace.ts
  packages/advanced/README.md
  packages/advanced/.gitkeep
  docs/design/zeus-ui-advanced-components.md
  docs/design/advanced-package-template.md
```

---

# 执行顺序

```bash id="ctuxgy"
git checkout feat/advanced-workspace

pnpm check
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm release:plan
```

如果通过，Phase 0 才算完成。

---

# Phase 0 完成后的下一步

Phase 1 才开始做真实包：

```txt id="flb4ek"
packages/advanced/virtual
  @zeus-web/virtual
```

不要在 Phase 0 里提前做 `chat` 或 `data-grid`，否则会把“工作区契约”和“组件实现”混在一个 PR 里，后续 review 会很乱。

一句话：**Phase 0 只做 advanced workspace 的工程契约，修掉当前分支已有的重复声明和 release kind 判断问题，并新增 `check:advanced-contract` 把规则锁死。**
