下面给 **Phase 15：Testing / Release / 0.1.0** 的详细设计与完整代码。

当前状态：

- 根脚本已经有 `test / build / check:exports / check:build-output / release / release:dry / ci-publish` 等命令。
- 但 `release.ts` 仍然是早期 scaffold，只处理根目录 `.`，没有真正支持 `packages/*` 和 `packages/primitives/*` 多包发布。
- `publish.ts` 也是同样问题，只发根包。
- CI 目前 build job 跑了 baseline/workspace/import/type/build/export/build-output，但没有把 docs/site/release readiness 作为最终 release gate。
- test workflow 有 unit、windows unit、build、lint/check，但 e2e job 实际只跑了 `pnpm build`。

Phase 15 的目标不是继续加功能，而是把项目推进到 **可发 0.1.0-beta / 0.1.0** 的状态。

---

# Phase 15 目标

```txt
Phase 15：Testing / Release / 0.1.0

15.1 Release package discovery
  - 统一扫描 packages/*
  - 统一扫描 packages/primitives/*
  - 跳过 private package
  - 输出 publishable packages

15.2 Release readiness gate
  - package name/version/license/files/exports 检查
  - dist 产物检查
  - repository / publishConfig 检查
  - 版本一致性检查
  - icons/react/vue/wc/svg exports 检查
  - primitives 多端 exports 检查

15.3 Version packages
  - 一键把所有 public packages 版本改成 0.1.0-beta.x / 0.1.0
  - 写入 repository.directory
  - 写入 publishConfig.access/provenance

15.4 Release plan
  - 输出本次会发布哪些包
  - 支持 --json
  - 支持 --tag beta/latest
  - 支持 --check-npm 检查 npm 是否已存在

15.5 Publish
  - 多包顺序发布
  - 支持 --dry-run
  - 支持 --tag beta/latest
  - 支持 --skip-existing
  - 使用 pnpm publish，保留 workspace publish 替换能力

15.6 CI / GitHub Actions
  - CI 增加 site:check
  - CI 增加 release:verify --allow-zero
  - release workflow 支持 workflow_dispatch
```

---

# 1. 修改根 `package.json`

在 scripts 里追加和替换相关 release 脚本：

```json
{
  "scripts": {
    "release": "tsx scripts/commands/release.ts",
    "release:dry": "tsx scripts/commands/release.ts --dry-run",
    "release:plan": "tsx scripts/commands/release-plan.ts",
    "release:verify": "tsx scripts/checks/check-release-readiness.ts",
    "version:packages": "tsx scripts/commands/version-packages.ts",
    "ci-publish": "tsx scripts/commands/publish.ts"
  }
}
```

如果保留已有脚本，只需要把 `release:dry` 从 `--dry` 改成 `--dry-run`，并新增 `release:plan / release:verify / version:packages`。

---

# 2. 新增 `scripts/release/workspace.ts`

```ts
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

export interface WorkspacePackage {
  name: string
  version: string
  dir: string
  relativeDir: string
  packageJsonPath: string
  packageJson: PackageJsonLike
  isPrimitive: boolean
  isPrivate: boolean
}

export const packageRoots = ['packages', 'packages/primitives'] as const

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
    const absoluteRoot = resolve(root, packageRoot)

    if (!existsSync(absoluteRoot)) continue

    for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue

      const packageJsonPath = resolve(absoluteRoot, entry.name, 'package.json')

      if (!existsSync(packageJsonPath)) continue

      const packageJson = readPackageJson(packageJsonPath)

      if (!packageJson.name) {
        throw new Error(`${packageJsonPath} missing package name`)
      }

      result.push({
        name: packageJson.name,
        version: packageJson.version ?? '0.0.0',
        dir: resolve(absoluteRoot, entry.name),
        relativeDir: toForwardSlash(
          relative(root, resolve(absoluteRoot, entry.name)),
        ),
        packageJsonPath,
        packageJson,
        isPrimitive: packageRoot === 'packages/primitives',
        isPrivate: Boolean(packageJson.private),
      })
    }
  }

  return result.sort((a, b) => {
    if (a.isPrimitive !== b.isPrimitive) {
      return a.isPrimitive ? -1 : 1
    }

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

# 3. 新增 `scripts/checks/check-release-readiness.ts`

这个脚本是 Phase 15 的核心 gate。

```ts
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

import pc from 'picocolors'

import {
  getUniqueVersions,
  listPublishablePackages,
  repositoryUrl,
  type PackageJsonLike,
  type WorkspacePackage,
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
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)
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

  if (!hasFile(json, 'dist')) {
    errors.push(`${pkg.name}: files must include dist`)
  }

  if (!json.scripts?.build) {
    errors.push(`${pkg.name}: scripts.build is required`)
  }

  if (!json.scripts?.check) {
    errors.push(`${pkg.name}: scripts.check is required`)
  }

  if (!existsSync(join(pkg.dir, 'dist'))) {
    errors.push(`${pkg.name}: dist is missing. Run pnpm build first.`)
  }

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

  if (errors.length > 0) {
    console.error(pc.red('Release readiness check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(
    pc.green(
      `Release readiness check passed for ${packages.length} publishable package(s).`,
    ),
  )
}

try {
  main()
} catch (error) {
  console.error(pc.red((error as Error).message))
  process.exit(1)
}
```

说明：

```txt
CI 中用：
  pnpm release:verify --allow-zero

真正发版前用：
  pnpm release:verify --strict
```

---

# 4. 新增 `scripts/commands/version-packages.ts`

这个脚本用于统一升级版本并写入发布元数据。

```ts
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

import pc from 'picocolors'

import {
  listPublishablePackages,
  repositoryUrl,
  type PackageJsonLike,
  type WorkspacePackage,
} from '../release/workspace'

interface Options {
  version: string
  dryRun: boolean
}

function parseOptions(args: string[]): Options {
  let version = ''
  let dryRun = false

  for (const arg of args) {
    if (arg === '--dry-run' || arg === '--dry') {
      dryRun = true
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (!version) {
      version = arg
      continue
    }

    throw new Error(`Unexpected argument: ${arg}`)
  }

  if (!version) {
    throw new Error('Usage: pnpm version:packages <version> [--dry-run]')
  }

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid semver version: ${version}`)
  }

  return {
    version,
    dryRun,
  }
}

function sortPackageJson(pkg: PackageJsonLike): PackageJsonLike {
  const preferredKeys = [
    'name',
    'type',
    'version',
    'description',
    'license',
    'repository',
    'publishConfig',
    'sideEffects',
    'exports',
    'bin',
    'files',
    'scripts',
    'peerDependencies',
    'peerDependenciesMeta',
    'dependencies',
    'devDependencies',
    'optionalDependencies',
  ]

  const result: PackageJsonLike = {}

  for (const key of preferredKeys) {
    if (key in pkg) {
      result[key] = pkg[key]
    }
  }

  for (const key of Object.keys(pkg).sort()) {
    if (!(key in result)) {
      result[key] = pkg[key]
    }
  }

  return result
}

function updatePackageJson(
  pkg: WorkspacePackage,
  version: string,
): PackageJsonLike {
  return sortPackageJson({
    ...pkg.packageJson,
    version,
    repository: {
      type: 'git',
      url: repositoryUrl,
      directory: pkg.relativeDir,
    },
    publishConfig: {
      ...(pkg.packageJson.publishConfig ?? {}),
      access: 'public',
      provenance: true,
    },
  })
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const packages = listPublishablePackages()

  for (const pkg of packages) {
    const before = readFileSync(pkg.packageJsonPath, 'utf-8')
    const nextJson = updatePackageJson(pkg, options.version)
    const next = `${JSON.stringify(nextJson, null, 2)}\n`

    if (before === next) {
      console.log(pc.gray(`unchanged ${pkg.name}`))
      continue
    }

    if (options.dryRun) {
      console.log(pc.cyan(`would update ${pkg.name} -> ${options.version}`))
      continue
    }

    await writeFile(pkg.packageJsonPath, next, 'utf-8')
    console.log(pc.green(`updated ${pkg.name} -> ${options.version}`))
  }
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
```

---

# 5. 新增 `scripts/commands/release-plan.ts`

```ts
import { execa } from 'execa'
import pc from 'picocolors'

import {
  getUniqueVersions,
  listPublishablePackages,
} from '../release/workspace'

interface Options {
  json: boolean
  tag: string
  checkNpm: boolean
}

interface ReleasePlanItem {
  name: string
  version: string
  directory: string
  npmExists?: boolean
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    json: false,
    tag: 'latest',
    checkNpm: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--check-npm') {
      options.checkNpm = true
      continue
    }

    if (arg === '--tag') {
      const value = args[index + 1]
      if (!value) throw new Error('--tag requires a value')
      options.tag = value
      index += 1
      continue
    }

    if (arg.startsWith('--tag=')) {
      const value = arg.slice('--tag='.length)
      if (!value) throw new Error('--tag requires a value')
      options.tag = value
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

async function npmVersionExists(
  name: string,
  version: string,
): Promise<boolean> {
  const result = await execa('npm', ['view', `${name}@${version}`, 'version'], {
    reject: false,
  })

  return result.exitCode === 0
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const packages = listPublishablePackages()
  const versions = getUniqueVersions(packages)

  if (versions.length !== 1) {
    throw new Error(
      `Release plan requires one shared version. Found: ${versions.join(', ')}`,
    )
  }

  const items: ReleasePlanItem[] = []

  for (const pkg of packages) {
    items.push({
      name: pkg.name,
      version: pkg.version,
      directory: pkg.relativeDir,
      npmExists: options.checkNpm
        ? await npmVersionExists(pkg.name, pkg.version)
        : undefined,
    })
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          version: versions[0],
          tag: options.tag,
          packages: items,
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(pc.bold(`Release plan: ${versions[0]} (${options.tag})`))
  console.log('')

  for (const item of items) {
    const status =
      item.npmExists === undefined
        ? ''
        : item.npmExists
          ? pc.yellow(' already exists')
          : pc.green(' new')

    console.log(
      `  ${item.name}@${item.version}  ${pc.gray(item.directory)}${status}`,
    )
  }

  console.log('')
  console.log(pc.green(`${items.length} package(s) in release plan.`))
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
```

---

# 6. 替换 `scripts/commands/publish.ts`

当前 publish 只处理根目录，不适合 monorepo。

```ts
import { execa } from 'execa'
import pc from 'picocolors'

import {
  getUniqueVersions,
  listPublishablePackages,
  type WorkspacePackage,
} from '../release/workspace'

interface Options {
  dryRun: boolean
  tag: string
  skipExisting: boolean
  provenance: boolean
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    dryRun: false,
    tag: 'latest',
    skipExisting: true,
    provenance: true,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run' || arg === '--dry') {
      options.dryRun = true
      continue
    }

    if (arg === '--skip-existing') {
      options.skipExisting = true
      continue
    }

    if (arg === '--no-skip-existing') {
      options.skipExisting = false
      continue
    }

    if (arg === '--no-provenance') {
      options.provenance = false
      continue
    }

    if (arg === '--tag') {
      const value = args[index + 1]
      if (!value) throw new Error('--tag requires a value')
      options.tag = value
      index += 1
      continue
    }

    if (arg.startsWith('--tag=')) {
      const value = arg.slice('--tag='.length)
      if (!value) throw new Error('--tag requires a value')
      options.tag = value
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

async function npmVersionExists(pkg: WorkspacePackage): Promise<boolean> {
  const result = await execa(
    'npm',
    ['view', `${pkg.name}@${pkg.version}`, 'version'],
    {
      reject: false,
    },
  )

  return result.exitCode === 0
}

function createPublishArgs(pkg: WorkspacePackage, options: Options): string[] {
  const args = [
    '--filter',
    pkg.name,
    'publish',
    '--access',
    'public',
    '--tag',
    options.tag,
    '--no-git-checks',
  ]

  if (options.provenance && !options.dryRun) {
    args.push('--provenance')
  }

  if (options.dryRun) {
    args.push('--dry-run')
  }

  return args
}

async function publishPackage(
  pkg: WorkspacePackage,
  options: Options,
): Promise<void> {
  if (options.skipExisting) {
    const exists = await npmVersionExists(pkg)

    if (exists) {
      console.log(pc.yellow(`skip existing ${pkg.name}@${pkg.version}`))
      return
    }
  }

  const args = createPublishArgs(pkg, options)

  console.log(pc.cyan(`pnpm ${args.join(' ')}`))

  await execa('pnpm', args, {
    stdio: 'inherit',
    env: {
      ...process.env,
    },
  })

  console.log(pc.green(`published ${pkg.name}@${pkg.version}`))
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const packages = listPublishablePackages()
  const versions = getUniqueVersions(packages)

  if (versions.length !== 1) {
    throw new Error(
      `Publish requires one shared version. Found: ${versions.join(', ')}`,
    )
  }

  if (
    !options.dryRun &&
    !process.env.NODE_AUTH_TOKEN &&
    !process.env.NPM_TOKEN
  ) {
    throw new Error('NODE_AUTH_TOKEN or NPM_TOKEN is required for publish.')
  }

  console.log(
    pc.bold(
      `Publishing ${packages.length} package(s) version ${versions[0]} with tag ${options.tag}${options.dryRun ? ' (dry-run)' : ''}`,
    ),
  )

  for (const pkg of packages) {
    await publishPackage(pkg, options)
  }
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
```

---

# 7. 替换 `scripts/commands/release.ts`

这个脚本不直接发布，只做本地 release gate。真正发布走 `publish.ts` 或 GitHub Actions。

```ts
import { execa } from 'execa'
import pc from 'picocolors'

interface Options {
  dryRun: boolean
  tag: string
  strict: boolean
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    dryRun: false,
    tag: 'latest',
    strict: true,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run' || arg === '--dry') {
      options.dryRun = true
      continue
    }

    if (arg === '--no-strict') {
      options.strict = false
      continue
    }

    if (arg === '--tag') {
      const value = args[index + 1]
      if (!value) throw new Error('--tag requires a value')
      options.tag = value
      index += 1
      continue
    }

    if (arg.startsWith('--tag=')) {
      const value = arg.slice('--tag='.length)
      if (!value) throw new Error('--tag requires a value')
      options.tag = value
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

async function run(command: string, args: string[]): Promise<void> {
  console.log(pc.cyan(`${command} ${args.join(' ')}`))

  await execa(command, args, {
    stdio: 'inherit',
  })
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))

  await run('pnpm', ['format-check'])
  await run('pnpm', ['lint'])
  await run('pnpm', ['test'])
  await run('pnpm', ['check'])
  await run('pnpm', ['build'])
  await run('pnpm', ['check:exports'])
  await run('pnpm', ['check:build-output'])
  await run('pnpm', ['site:check'])

  await run('pnpm', [
    'release:verify',
    ...(options.strict ? ['--strict'] : ['--allow-zero']),
  ])

  await run('pnpm', [
    'release:plan',
    '--tag',
    options.tag,
    ...(options.dryRun ? [] : ['--check-npm']),
  ])

  if (options.dryRun) {
    await run('pnpm', ['ci-publish', '--dry-run', '--tag', options.tag])
    console.log(pc.green('Release dry-run passed.'))
    return
  }

  console.log(
    pc.green(
      'Release checks passed. Run `pnpm ci-publish --tag <tag>` to publish.',
    ),
  )
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
```

---

# 8. 修改 `.github/workflows/ci.yml`

当前 CI build job 没有跑 `site:check` 和 release readiness。

替换为：

```yaml
name: CI

on:
  push:
    branches:
      - '**'
    tags-ignore:
      - 'v*'
  pull_request:
    branches:
      - main
      - minor

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    if: ${{ ! startsWith(github.event.head_commit.message, 'release:') && (github.event_name == 'push' || github.event.pull_request.head.repo.full_name != github.repository) }}
    uses: ./.github/workflows/test.yml

  build:
    runs-on: ubuntu-latest
    env:
      PUPPETEER_SKIP_DOWNLOAD: 'true'
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version-file: .node-version
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm check:zeus-baseline
      - run: pnpm check:workspace-overrides
      - run: pnpm check:zeus-imports
      - run: pnpm check
      - run: pnpm build
      - run: pnpm check:exports
      - run: pnpm check:build-output
      - run: pnpm site:check
      - run: pnpm release:verify --allow-zero
```

---

# 9. 修改 `.github/workflows/test.yml`

当前 e2e job 只是 `pnpm build`。

建议替换为：

```yaml
name: test

on: workflow_call

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  unit-test:
    runs-on: ubuntu-latest
    env:
      PUPPETEER_SKIP_DOWNLOAD: 'true'
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version-file: .node-version
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test-unit

  unit-test-windows:
    runs-on: windows-latest
    env:
      PUPPETEER_SKIP_DOWNLOAD: 'true'
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version-file: .node-version
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test-unit

  e2e-test:
    runs-on: ubuntu-latest
    env:
      PUPPETEER_SKIP_DOWNLOAD: 'true'
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version-file: .node-version
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm site:check
      - run: pnpm check:build-output

  lint-and-test-dts:
    runs-on: ubuntu-latest
    env:
      PUPPETEER_SKIP_DOWNLOAD: 'true'
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version-file: .node-version
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run format-check
      - run: pnpm run check
```

---

# 10. 新增 `.github/workflows/release.yml`

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version, for example 0.1.0-beta.0 or 0.1.0'
        required: true
        type: string
      tag:
        description: 'npm dist-tag'
        required: true
        default: beta
        type: choice
        options:
          - beta
          - latest
      dry_run:
        description: 'Run publish with --dry-run'
        required: true
        default: true
        type: boolean

permissions:
  contents: read
  id-token: write

concurrency:
  group: release-${{ github.event.inputs.version }}
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    env:
      PUPPETEER_SKIP_DOWNLOAD: 'true'
      NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v5
        with:
          node-version-file: .node-version
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - run: pnpm install --frozen-lockfile

      - name: Version packages
        run: pnpm version:packages ${{ github.event.inputs.version }}

      - run: pnpm format-check
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm check
      - run: pnpm build
      - run: pnpm check:exports
      - run: pnpm check:build-output
      - run: pnpm site:check
      - run: pnpm release:verify --strict
      - run: pnpm release:plan --tag ${{ github.event.inputs.tag }} --check-npm

      - name: Publish dry-run
        if: ${{ github.event.inputs.dry_run == 'true' }}
        run: pnpm ci-publish --dry-run --tag ${{ github.event.inputs.tag }}

      - name: Publish
        if: ${{ github.event.inputs.dry_run != 'true' }}
        run: pnpm ci-publish --tag ${{ github.event.inputs.tag }}
```

---

# 11. 新增 `docs/internal/release.md`

````md
# Release Guide

## 0. Release scope

Zeus Web is released as a multi-package workspace.

Package roots:

```txt
packages/*
packages/primitives/*
```
````

Private packages are skipped.

## 1. Pick a version

For beta:

```bash
pnpm version:packages 0.1.0-beta.0
```

For stable:

```bash
pnpm version:packages 0.1.0
```

## 2. Run release checks

```bash
pnpm release --dry-run --tag beta
```

Stable:

```bash
pnpm release --dry-run --tag latest
```

## 3. Inspect release plan

```bash
pnpm release:plan --tag beta --check-npm
```

JSON:

```bash
pnpm release:plan --tag beta --check-npm --json
```

## 4. Publish

Dry-run:

```bash
pnpm ci-publish --dry-run --tag beta
```

Publish beta:

```bash
NODE_AUTH_TOKEN=xxx pnpm ci-publish --tag beta
```

Publish stable:

```bash
NODE_AUTH_TOKEN=xxx pnpm ci-publish --tag latest
```

## 5. GitHub Actions

Use the `Release` workflow.

Inputs:

```txt
version: 0.1.0-beta.0
tag: beta
dry_run: true
```

After dry-run passes, run again with:

```txt
dry_run: false
```

## 6. Required gates

Before publish, all of these must pass:

```bash
pnpm format-check
pnpm lint
pnpm test
pnpm check
pnpm build
pnpm check:exports
pnpm check:build-output
pnpm site:check
pnpm release:verify --strict
```

## 7. NPM token

GitHub Actions requires:

```txt
NPM_TOKEN
```

The release workflow also enables provenance through `id-token: write`.

````

---

# 12. 建议补测试：`scripts/checks/__tests__/release-workspace.spec.ts`

```ts
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  getUniqueVersions,
  listPublishablePackages,
  listWorkspacePackages,
} from '../../release/workspace'

describe('release workspace discovery', () => {
  it('discovers workspace packages', () => {
    const packages = listWorkspacePackages()

    expect(packages.length).toBeGreaterThan(0)
    expect(packages.some(pkg => pkg.name === '@zeus-web/cli')).toBe(true)
    expect(packages.some(pkg => pkg.name === '@zeus-web/icons')).toBe(true)
    expect(packages.some(pkg => pkg.name === '@zeus-web/button')).toBe(true)
  })

  it('discovers publishable packages', () => {
    const packages = listPublishablePackages()

    expect(packages.length).toBeGreaterThan(0)
    expect(packages.every(pkg => !pkg.isPrivate)).toBe(true)
    expect(packages.every(pkg => pkg.name.startsWith('@zeus-web/'))).toBe(true)
  })

  it('keeps package json paths valid', () => {
    for (const pkg of listWorkspacePackages()) {
      expect(existsSync(pkg.packageJsonPath)).toBe(true)
      expect(pkg.packageJsonPath).toBe(resolve(pkg.dir, 'package.json'))
    }
  })

  it('can read unique versions', () => {
    const versions = getUniqueVersions(listPublishablePackages())

    expect(versions.length).toBeGreaterThan(0)
  })
})
````

---

# 13. Phase 15 验收命令

普通 CI：

```bash
pnpm format-check
pnpm lint
pnpm test
pnpm check
pnpm build
pnpm check:exports
pnpm check:build-output
pnpm site:check
pnpm release:verify --allow-zero
```

发 beta 前：

```bash
pnpm version:packages 0.1.0-beta.0
pnpm release --dry-run --tag beta
pnpm release:plan --tag beta --check-npm
pnpm ci-publish --dry-run --tag beta
```

真正发 beta：

```bash
NODE_AUTH_TOKEN=xxx pnpm ci-publish --tag beta
```

发 stable：

```bash
pnpm version:packages 0.1.0
pnpm release --dry-run --tag latest
pnpm ci-publish --dry-run --tag latest
NODE_AUTH_TOKEN=xxx pnpm ci-publish --tag latest
```

---

# 14. 建议提交

```txt
feat(release): add multi-package release workspace discovery
feat(release): add release readiness gate
feat(release): add workspace versioning command
feat(release): add release plan and multi-package publish command
ci: add release workflow
ci: run site and release readiness checks
docs: add release guide
test(release): cover workspace package discovery
```

Phase 15 完成后，项目就具备了从 `mvp` 进入 `0.1.0-beta.x / 0.1.0` 的发布闭环。
