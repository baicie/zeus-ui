下面给 **Phase 7：CLI Init + Config + Install MVP** 的详细设计与完整代码。

基于当前 `mvp`，Phase 6 的 `zweb add` 已经具备从 `@zeus-web/registry/registry.json` 读取 registry、生成 add plan、复制文件、支持 `--dry-run / --overwrite / --cwd` 的能力。

但现在 `zweb init` 还只是简单写死 `components.json`，不支持 `--cwd / --style / --css / --overwrite`，也不会创建 global css 或安装主题依赖。

# Phase 7 目标

```txt
Phase 7：CLI Init + Config + Install MVP

目标：
1. zweb init 生成 components.json。
2. zweb init 支持 --cwd、--style、--css、--overwrite、--no-install。
3. zweb init 自动创建 tailwind css 文件，并写入 @zeus-web/themes/<style>.css。
4. zweb init 自动安装 @zeus-web/themes。
5. zweb add 读取 components.json。
6. zweb add 根据 aliases.lib / aliases.ui 解析复制目标。
7. zweb add 支持自动安装 dependencies。
8. zweb add 支持 --no-install 和 --package-manager。
9. 自动检测 pnpm / npm / yarn / bun。
10. 保持 --dry-run 不写文件、不安装依赖。
```

Phase 7 不做：

```txt
不自动改 tailwind.config。
不自动改 tsconfig paths。
不做远程 registry。
不做 Vue registry。
不做 interactive prompt。
```

---

# 1. 文件变更总览

```txt
修改：
  packages/cli/package.json
  packages/cli/src/index.ts
  packages/cli/src/commands/init.ts
  packages/cli/src/commands/add.ts
  packages/cli/__tests__/add.spec.ts

新增：
  packages/cli/src/config.ts
  packages/cli/src/package-manager.ts
  packages/cli/__tests__/config.spec.ts
  packages/cli/__tests__/init.spec.ts
  packages/cli/__tests__/package-manager.spec.ts
```

---

# 2. `packages/cli/package.json`

当前 CLI 依赖只有 `@zeus-web/registry` 和 `picocolors`。
Phase 7 需要读取 theme 元信息、安装依赖，所以加 `@zeus-web/themes` 和 `execa`。

```json
{
  "name": "@zeus-web/cli",
  "type": "module",
  "version": "0.0.0",
  "description": "CLI for Zeus Web.",
  "license": "MIT",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "bin": {
    "zweb": "./dist/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup && node -e \"const fs=require('fs');const f='dist/index.js';const c=fs.readFileSync(f,'utf8');if(!c.startsWith('#!/'))fs.writeFileSync(f,'#!/usr/bin/env node\\n'+c,'utf8');\"",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit packages/cli/__tests__/**/*.spec.ts"
  },
  "dependencies": {
    "@zeus-web/registry": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "execa": "^9.6.1",
    "picocolors": "^1.1.1"
  }
}
```

---

# 3. 新增 `packages/cli/src/config.ts`

```ts
import type { ThemeName } from '@zeus-web/themes'

import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import { isThemeName } from '@zeus-web/themes'

export interface ComponentsConfig {
  $schema: string
  framework: 'react'
  style: ThemeName
  tailwind: {
    css: string
    cssVariables: boolean
  }
  aliases: {
    components: string
    ui: string
    lib: string
  }
}

export interface CreateConfigOptions {
  style?: ThemeName
  css?: string
}

export const componentsConfigFileName = 'components.json'

export function createDefaultComponentsConfig(
  options: CreateConfigOptions = {},
): ComponentsConfig {
  return {
    $schema: 'https://zeus-web.dev/schema/components.json',
    framework: 'react',
    style: options.style ?? 'default',
    tailwind: {
      css: options.css ?? 'src/styles/globals.css',
      cssVariables: true,
    },
    aliases: {
      components: '@/components',
      ui: '@/components/ui',
      lib: '@/lib',
    },
  }
}

export function getComponentsConfigPath(cwd: string): string {
  return resolve(cwd, componentsConfigFileName)
}

export function readComponentsConfig(cwd: string): ComponentsConfig {
  const file = getComponentsConfigPath(cwd)

  if (!existsSync(file)) {
    throw new Error('components.json not found. Run `zweb init` first.')
  }

  const config = JSON.parse(readFileSync(file, 'utf-8')) as ComponentsConfig

  validateComponentsConfig(config)

  return config
}

export function validateComponentsConfig(config: ComponentsConfig): void {
  if (config.framework !== 'react') {
    throw new Error('Only framework "react" is supported in this phase.')
  }

  if (!isThemeName(config.style)) {
    throw new Error(`Unsupported style: ${String(config.style)}`)
  }

  if (!config.tailwind?.css) {
    throw new Error('components.json missing tailwind.css')
  }

  if (!config.aliases?.ui) {
    throw new Error('components.json missing aliases.ui')
  }

  if (!config.aliases?.lib) {
    throw new Error('components.json missing aliases.lib')
  }
}

export async function writeComponentsConfig(params: {
  cwd: string
  config: ComponentsConfig
  overwrite: boolean
}): Promise<'created' | 'skipped'> {
  const file = getComponentsConfigPath(params.cwd)

  if (existsSync(file) && !params.overwrite) {
    return 'skipped'
  }

  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(params.config, null, 2)}\n`, 'utf-8')

  return 'created'
}

function normalizeAlias(alias: string): string {
  if (alias.startsWith('@/')) {
    return alias.slice(2)
  }

  if (alias === '@') {
    return ''
  }

  return alias.replace(/^\.?\//, '')
}

export function resolveAliasToPath(cwd: string, alias: string): string {
  if (isAbsolute(alias)) {
    return alias
  }

  if (alias.startsWith('@/')) {
    const withoutPrefix = normalizeAlias(alias)
    const srcRoot = resolve(cwd, 'src')

    if (existsSync(srcRoot)) {
      return resolve(srcRoot, withoutPrefix)
    }

    return resolve(cwd, withoutPrefix)
  }

  return resolve(cwd, normalizeAlias(alias))
}

export function resolveRegistryTarget(
  cwd: string,
  config: ComponentsConfig,
  target: string,
): string {
  if (target === 'lib' || target.startsWith('lib/')) {
    const rest = target === 'lib' ? '' : target.slice('lib/'.length)
    return resolve(resolveAliasToPath(cwd, config.aliases.lib), rest)
  }

  if (target === 'components/ui' || target.startsWith('components/ui/')) {
    const rest =
      target === 'components/ui' ? '' : target.slice('components/ui/'.length)
    return resolve(resolveAliasToPath(cwd, config.aliases.ui), rest)
  }

  if (target === 'components' || target.startsWith('components/')) {
    const rest =
      target === 'components' ? '' : target.slice('components/'.length)
    return resolve(resolveAliasToPath(cwd, config.aliases.components), rest)
  }

  return resolve(cwd, target)
}

export function toRelativeProjectPath(cwd: string, file: string): string {
  return relative(cwd, file).replace(/\\/g, '/')
}

export async function ensureThemeCss(params: {
  cwd: string
  config: ComponentsConfig
  overwrite: boolean
}): Promise<'created' | 'updated' | 'skipped'> {
  const cssPath = resolve(params.cwd, params.config.tailwind.css)
  const themeImport = `@import '@zeus-web/themes/${params.config.style}.css';`

  if (existsSync(cssPath)) {
    const current = readFileSync(cssPath, 'utf-8')

    if (current.includes(themeImport)) {
      return 'skipped'
    }

    if (!params.overwrite) {
      const next = current.endsWith('\n')
        ? `${current}${themeImport}\n`
        : `${current}\n${themeImport}\n`

      await writeFile(cssPath, next, 'utf-8')
      return 'updated'
    }

    await writeFile(cssPath, `${themeImport}\n`, 'utf-8')
    return 'updated'
  }

  await mkdir(dirname(cssPath), { recursive: true })
  await writeFile(cssPath, `${themeImport}\n`, 'utf-8')

  return 'created'
}
```

---

# 4. 新增 `packages/cli/src/package-manager.ts`

```ts
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { execa } from 'execa'

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

export interface InstallDependenciesOptions {
  cwd: string
  packageManager?: PackageManager
  dependencies?: string[]
  devDependencies?: string[]
  dryRun?: boolean
}

export interface InstallCommand {
  command: PackageManager
  args: string[]
}

export function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(resolve(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(resolve(cwd, 'bun.lockb'))) return 'bun'
  if (existsSync(resolve(cwd, 'bun.lock'))) return 'bun'
  if (existsSync(resolve(cwd, 'yarn.lock'))) return 'yarn'
  if (existsSync(resolve(cwd, 'package-lock.json'))) return 'npm'

  return 'pnpm'
}

export function createInstallCommand(params: {
  packageManager: PackageManager
  dependencies: string[]
  dev: boolean
}): InstallCommand | null {
  if (params.dependencies.length === 0) return null

  switch (params.packageManager) {
    case 'pnpm':
      return {
        command: 'pnpm',
        args: params.dev
          ? ['add', '-D', ...params.dependencies]
          : ['add', ...params.dependencies],
      }

    case 'npm':
      return {
        command: 'npm',
        args: params.dev
          ? ['install', '-D', ...params.dependencies]
          : ['install', ...params.dependencies],
      }

    case 'yarn':
      return {
        command: 'yarn',
        args: params.dev
          ? ['add', '-D', ...params.dependencies]
          : ['add', ...params.dependencies],
      }

    case 'bun':
      return {
        command: 'bun',
        args: params.dev
          ? ['add', '-d', ...params.dependencies]
          : ['add', ...params.dependencies],
      }

    default:
      return null
  }
}

export async function installDependencies(
  options: InstallDependenciesOptions,
): Promise<InstallCommand[]> {
  const packageManager =
    options.packageManager ?? detectPackageManager(options.cwd)

  const commands = [
    createInstallCommand({
      packageManager,
      dependencies: options.dependencies ?? [],
      dev: false,
    }),
    createInstallCommand({
      packageManager,
      dependencies: options.devDependencies ?? [],
      dev: true,
    }),
  ].filter((command): command is InstallCommand => Boolean(command))

  if (options.dryRun) {
    return commands
  }

  for (const command of commands) {
    await execa(command.command, command.args, {
      cwd: options.cwd,
      stdio: 'inherit',
    })
  }

  return commands
}
```

---

# 5. 替换 `packages/cli/src/commands/init.ts`

```ts
import type { PackageManager } from '../package-manager'

import { isAbsolute, resolve } from 'node:path'

import { themeNames, type ThemeName } from '@zeus-web/themes'
import pc from 'picocolors'

import {
  createDefaultComponentsConfig,
  ensureThemeCss,
  writeComponentsConfig,
} from '../config'
import { installDependencies } from '../package-manager'

interface InitOptions {
  cwd: string
  style: ThemeName
  css: string
  overwrite: boolean
  install: boolean
  packageManager?: PackageManager
}

interface ParsedInitArgs {
  options: InitOptions
}

function parsePackageManager(value: string): PackageManager {
  if (
    value === 'pnpm' ||
    value === 'npm' ||
    value === 'yarn' ||
    value === 'bun'
  ) {
    return value
  }

  throw new Error(`Unsupported package manager: ${value}`)
}

function parseThemeName(value: string): ThemeName {
  if ((themeNames as readonly string[]).includes(value)) {
    return value as ThemeName
  }

  throw new Error(
    `Unsupported style: ${value}. Available styles: ${themeNames.join(', ')}`,
  )
}

export function parseInitArgs(
  args: string[],
  cwd = process.cwd(),
): ParsedInitArgs {
  const options: InitOptions = {
    cwd,
    style: 'default',
    css: 'src/styles/globals.css',
    overwrite: false,
    install: true,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--overwrite') {
      options.overwrite = true
      continue
    }

    if (arg === '--no-install') {
      options.install = false
      continue
    }

    if (arg === '--cwd') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      continue
    }

    if (arg === '--style') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--style requires a theme name')
      }

      options.style = parseThemeName(value)
      index += 1
      continue
    }

    if (arg.startsWith('--style=')) {
      options.style = parseThemeName(arg.slice('--style='.length))
      continue
    }

    if (arg === '--css') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--css requires a file path')
      }

      options.css = value
      index += 1
      continue
    }

    if (arg.startsWith('--css=')) {
      const value = arg.slice('--css='.length)

      if (!value) {
        throw new Error('--css requires a file path')
      }

      options.css = value
      continue
    }

    if (arg === '--package-manager') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--package-manager requires a value')
      }

      options.packageManager = parsePackageManager(value)
      index += 1
      continue
    }

    if (arg.startsWith('--package-manager=')) {
      options.packageManager = parsePackageManager(
        arg.slice('--package-manager='.length),
      )
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return {
    options,
  }
}

export async function init(args: string[]) {
  try {
    const { options } = parseInitArgs(args)
    const config = createDefaultComponentsConfig({
      style: options.style,
      css: options.css,
    })

    const configResult = await writeComponentsConfig({
      cwd: options.cwd,
      config,
      overwrite: options.overwrite,
    })

    if (configResult === 'created') {
      console.log(pc.green('Created components.json'))
    } else {
      console.log(
        pc.yellow(
          'components.json already exists. Use --overwrite to replace it.',
        ),
      )
    }

    const cssResult = await ensureThemeCss({
      cwd: options.cwd,
      config,
      overwrite: false,
    })

    if (cssResult === 'created') {
      console.log(pc.green(`Created ${config.tailwind.css}`))
    } else if (cssResult === 'updated') {
      console.log(pc.green(`Updated ${config.tailwind.css}`))
    } else {
      console.log(
        pc.gray(`${config.tailwind.css} already includes theme import.`),
      )
    }

    if (options.install) {
      await installDependencies({
        cwd: options.cwd,
        packageManager: options.packageManager,
        dependencies: ['@zeus-web/themes'],
      })
    } else {
      console.log(pc.bold('Install dependencies:'))
      console.log('  pnpm add @zeus-web/themes')
    }
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 6. 替换 `packages/cli/src/commands/add.ts`

这个版本在 Phase 6 基础上补：

```txt
1. 读取 components.json。
2. 根据 aliases.ui / aliases.lib 解析复制路径。
3. 自动安装 dependencies。
4. 支持 --no-install / --package-manager。
5. dry-run 不写文件也不安装。
```

```ts
import type {
  Registry,
  RegistryItem,
  RegistryItemFile,
} from '@zeus-web/registry'
import type { ComponentsConfig } from '../config'
import type { PackageManager } from '../package-manager'

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import { validateRegistry } from '@zeus-web/registry'
import pc from 'picocolors'

import {
  readComponentsConfig,
  resolveRegistryTarget,
  toRelativeProjectPath,
} from '../config'
import { installDependencies } from '../package-manager'

export interface RegistryFilePlan {
  source: string
  target: string
  resolvedTarget?: string
  type: 'registry:ui' | 'registry:lib' | 'registry:style'
}

export interface AddPlan {
  component: string
  dependencies: string[]
  devDependencies: string[]
  files: RegistryFilePlan[]
}

export interface AddOptions {
  cwd: string
  dryRun: boolean
  overwrite: boolean
  install: boolean
  packageManager?: PackageManager
}

export interface AddExecutionResult {
  planned: string[]
  written: string[]
  skipped: string[]
  dependencies: string[]
  devDependencies: string[]
}

interface ParsedAddArgs {
  components: string[]
  options: AddOptions
}

type CopyResult = 'planned' | 'written' | 'skipped'

const require = createRequire(import.meta.url)

function resolveRegistryJsonPath(): string {
  return require.resolve('@zeus-web/registry/registry.json')
}

function resolveRegistryRoot(): string {
  return dirname(resolveRegistryJsonPath())
}

function createInvalidRegistryError(errors: string[]): Error {
  return new Error(
    [
      'Invalid @zeus-web/registry/registry.json:',
      ...errors.map(error => `- ${error}`),
    ].join('\n'),
  )
}

function assertValidRegistry(registry: Registry): void {
  const result = validateRegistry(registry)

  if (!result.valid) {
    throw createInvalidRegistryError(result.errors)
  }
}

export function loadRegistry(): Registry {
  const registry = require('@zeus-web/registry/registry.json') as Registry

  assertValidRegistry(registry)

  return registry
}

function toFilePlan(file: RegistryItemFile): RegistryFilePlan {
  return {
    source: file.path,
    target: file.target,
    type: file.type,
  }
}

function toAddPlan(item: RegistryItem): AddPlan {
  return {
    component: item.name,
    dependencies: item.dependencies ?? [],
    devDependencies: item.devDependencies ?? [],
    files: item.files.map(toFilePlan),
  }
}

function findRegistryItem(registry: Registry, component: string): RegistryItem {
  const item = registry.items.find(entry => entry.name === component)

  if (!item) {
    throw new Error(`Unknown component: ${component}`)
  }

  return item
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort()
}

function dedupePlans(plans: AddPlan[]): AddPlan[] {
  return plans.map(plan => {
    const files = new Map<string, RegistryFilePlan>()

    for (const file of plan.files) {
      files.set(file.target, file)
    }

    return {
      ...plan,
      dependencies: uniqueSorted(plan.dependencies),
      devDependencies: uniqueSorted(plan.devDependencies),
      files: Array.from(files.values()),
    }
  })
}

export function listAvailableComponents(registry = loadRegistry()): string[] {
  assertValidRegistry(registry)

  return registry.items
    .filter(item => item.type === 'registry:ui')
    .map(item => item.name)
}

export function createAddPlan(
  components: string[],
  registry = loadRegistry(),
): AddPlan[] {
  assertValidRegistry(registry)

  const plans = components.map(component => {
    const item = findRegistryItem(registry, component)

    return toAddPlan(item)
  })

  return dedupePlans(plans)
}

export function resolveAddPlanTargets(
  plans: AddPlan[],
  cwd: string,
  config: ComponentsConfig,
): AddPlan[] {
  return plans.map(plan => ({
    ...plan,
    files: plan.files.map(file => ({
      ...file,
      resolvedTarget: resolveRegistryTarget(cwd, config, file.target),
    })),
  }))
}

export function createCombinedInstallPlan(plans: AddPlan[]): {
  dependencies: string[]
  devDependencies: string[]
} {
  return {
    dependencies: uniqueSorted(plans.flatMap(plan => plan.dependencies)),
    devDependencies: uniqueSorted(plans.flatMap(plan => plan.devDependencies)),
  }
}

function parsePackageManager(value: string): PackageManager {
  if (
    value === 'pnpm' ||
    value === 'npm' ||
    value === 'yarn' ||
    value === 'bun'
  ) {
    return value
  }

  throw new Error(`Unsupported package manager: ${value}`)
}

export function parseAddArgs(
  args: string[],
  cwd = process.cwd(),
): ParsedAddArgs {
  const components: string[] = []
  const options: AddOptions = {
    cwd,
    dryRun: false,
    overwrite: false,
    install: true,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--overwrite') {
      options.overwrite = true
      continue
    }

    if (arg === '--no-install') {
      options.install = false
      continue
    }

    if (arg === '--cwd') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      continue
    }

    if (arg === '--package-manager') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--package-manager requires a value')
      }

      options.packageManager = parsePackageManager(value)
      index += 1
      continue
    }

    if (arg.startsWith('--package-manager=')) {
      options.packageManager = parsePackageManager(
        arg.slice('--package-manager='.length),
      )
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }

    components.push(arg)
  }

  return {
    components,
    options,
  }
}

function assertSafeTarget(cwd: string, target: string): string {
  const absoluteTarget = resolve(cwd, target)
  const relativeTarget = relative(cwd, absoluteTarget).replace(/\\/g, '/')

  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith('../') ||
    isAbsolute(relativeTarget)
  ) {
    throw new Error(`Refusing to write outside cwd: ${target}`)
  }

  return absoluteTarget
}

async function copyRegistryFile(params: {
  registryRoot: string
  cwd: string
  file: RegistryFilePlan
  dryRun: boolean
  overwrite: boolean
}): Promise<CopyResult> {
  const sourcePath = resolve(params.registryRoot, params.file.source)
  const rawTarget = params.file.resolvedTarget ?? params.file.target
  const targetPath = assertSafeTarget(params.cwd, rawTarget)

  if (!existsSync(sourcePath)) {
    throw new Error(
      `Registry source file does not exist: ${params.file.source}`,
    )
  }

  if (existsSync(targetPath) && !params.overwrite) {
    return 'skipped'
  }

  if (params.dryRun) {
    return 'planned'
  }

  await mkdir(dirname(targetPath), { recursive: true })

  const source = await readFile(sourcePath, 'utf-8')
  await writeFile(targetPath, source, 'utf-8')

  return 'written'
}

export async function executeAddPlan(
  plans: AddPlan[],
  options: AddOptions,
  registryRoot = resolveRegistryRoot(),
): Promise<AddExecutionResult> {
  const config = readComponentsConfig(options.cwd)
  const resolvedPlans = resolveAddPlanTargets(plans, options.cwd, config)

  const planned: string[] = []
  const written: string[] = []
  const skipped: string[] = []
  const seenTargets = new Set<string>()

  for (const plan of resolvedPlans) {
    for (const file of plan.files) {
      const targetPath = file.resolvedTarget ?? file.target
      const displayTarget = toRelativeProjectPath(options.cwd, targetPath)

      if (seenTargets.has(targetPath)) {
        continue
      }

      seenTargets.add(targetPath)

      const result = await copyRegistryFile({
        registryRoot,
        cwd: options.cwd,
        file,
        dryRun: options.dryRun,
        overwrite: options.overwrite,
      })

      if (result === 'planned') {
        planned.push(displayTarget)
      } else if (result === 'written') {
        written.push(displayTarget)
      } else {
        skipped.push(displayTarget)
      }
    }
  }

  const installPlan = createCombinedInstallPlan(plans)

  return {
    planned,
    written,
    skipped,
    dependencies: installPlan.dependencies,
    devDependencies: installPlan.devDependencies,
  }
}

function printPlan(plans: AddPlan[], options: AddOptions): void {
  for (const plan of plans) {
    console.log(pc.green(`Add ${plan.component}`))

    if (plan.dependencies.length > 0) {
      console.log(`Dependencies: ${plan.dependencies.join(', ')}`)
    }

    if (plan.devDependencies.length > 0) {
      console.log(`Dev dependencies: ${plan.devDependencies.join(', ')}`)
    }

    console.log('Files:')

    for (const file of plan.files) {
      console.log(`  ${file.source} -> ${file.target}`)
    }
  }

  if (options.dryRun) {
    console.log(pc.gray('Dry run enabled. No files will be written.'))
  }

  if (!options.overwrite) {
    console.log(
      pc.gray(
        'Existing files will be skipped. Use --overwrite to replace them.',
      ),
    )
  }
}

function printResult(result: AddExecutionResult): void {
  if (result.planned.length > 0) {
    console.log(pc.cyan('Planned files:'))

    for (const file of result.planned) {
      console.log(`  ${file}`)
    }
  }

  if (result.written.length > 0) {
    console.log(pc.green('Written files:'))

    for (const file of result.written) {
      console.log(`  ${file}`)
    }
  }

  if (result.skipped.length > 0) {
    console.log(pc.yellow('Skipped existing files:'))

    for (const file of result.skipped) {
      console.log(`  ${file}`)
    }
  }

  if (result.dependencies.length > 0) {
    console.log('')
    console.log(pc.bold('Install dependencies:'))
    console.log(`  pnpm add ${result.dependencies.join(' ')}`)
  }

  if (result.devDependencies.length > 0) {
    console.log('')
    console.log(pc.bold('Install dev dependencies:'))
    console.log(`  pnpm add -D ${result.devDependencies.join(' ')}`)
  }
}

export async function add(args: string[]) {
  try {
    const { components, options } = parseAddArgs(args)

    if (components.length === 0) {
      console.error(pc.red('Please provide at least one component.'))
      console.log(`Example: zweb add ${listAvailableComponents().join(' ')}`)
      process.exit(1)
    }

    const plans = createAddPlan(components)

    printPlan(plans, options)

    const result = await executeAddPlan(plans, options)

    printResult(result)

    if (options.install && !options.dryRun) {
      await installDependencies({
        cwd: options.cwd,
        packageManager: options.packageManager,
        dependencies: result.dependencies,
        devDependencies: result.devDependencies,
      })
    }
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 7. 替换 `packages/cli/src/index.ts`

```ts
#!/usr/bin/env node

import pc from 'picocolors'
import { add } from './commands/add'
import { init } from './commands/init'

const [, , command, ...args] = process.argv

async function main() {
  switch (command) {
    case 'init':
      await init(args)
      break

    case 'add':
      await add(args)
      break

    case undefined:
    case '-h':
    case '--help':
      printHelp()
      break

    default:
      console.error(pc.red(`Unknown command: ${command}`))
      printHelp()
      process.exit(1)
  }
}

function printHelp() {
  console.log(`\n${pc.bold('zweb')} - Zeus Web CLI\n`)
  console.log('Usage:')
  console.log('  zweb init')
  console.log('  zweb init --style slate --css src/styles/globals.css')
  console.log('  zweb add button')
  console.log('  zweb add button input dialog')
  console.log('')
  console.log('Options:')
  console.log('  --cwd <dir>                 Use a specific project directory')
  console.log('  --style <name>              Theme style for init')
  console.log('  --css <file>                Tailwind css file for init')
  console.log(
    '  --dry-run                   Print the plan without writing files',
  )
  console.log('  --overwrite                 Replace existing files')
  console.log('  --no-install                Do not install dependencies')
  console.log('  --package-manager <name>    pnpm | npm | yarn | bun')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
```

---

# 8. 测试

## `packages/cli/__tests__/package-manager.spec.ts`

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  createInstallCommand,
  detectPackageManager,
} from '../src/package-manager'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-pm-'))
}

describe('@zeus-web/cli package manager', () => {
  it('detects pnpm by lockfile', async () => {
    const cwd = await createTempDir()

    try {
      writeFileSync(resolve(cwd, 'pnpm-lock.yaml'), '', 'utf-8')
      expect(detectPackageManager(cwd)).toBe('pnpm')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('detects npm by lockfile', async () => {
    const cwd = await createTempDir()

    try {
      writeFileSync(resolve(cwd, 'package-lock.json'), '{}\n', 'utf-8')
      expect(detectPackageManager(cwd)).toBe('npm')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('falls back to pnpm', async () => {
    const cwd = await createTempDir()

    try {
      expect(detectPackageManager(cwd)).toBe('pnpm')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('creates install commands', () => {
    expect(
      createInstallCommand({
        packageManager: 'pnpm',
        dependencies: ['a', 'b'],
        dev: false,
      }),
    ).toEqual({
      command: 'pnpm',
      args: ['add', 'a', 'b'],
    })

    expect(
      createInstallCommand({
        packageManager: 'npm',
        dependencies: ['a'],
        dev: true,
      }),
    ).toEqual({
      command: 'npm',
      args: ['install', '-D', 'a'],
    })
  })
})
```

## `packages/cli/__tests__/config.spec.ts`

```ts
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  createDefaultComponentsConfig,
  ensureThemeCss,
  resolveAliasToPath,
  resolveRegistryTarget,
  writeComponentsConfig,
} from '../src/config'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-config-'))
}

describe('@zeus-web/cli config', () => {
  it('creates default components config', () => {
    const config = createDefaultComponentsConfig({
      style: 'slate',
      css: 'app/globals.css',
    })

    expect(config).toMatchObject({
      framework: 'react',
      style: 'slate',
      tailwind: {
        css: 'app/globals.css',
        cssVariables: true,
      },
      aliases: {
        ui: '@/components/ui',
        lib: '@/lib',
      },
    })
  })

  it('writes components.json', async () => {
    const cwd = await createTempDir()

    try {
      const result = await writeComponentsConfig({
        cwd,
        config: createDefaultComponentsConfig(),
        overwrite: false,
      })

      expect(result).toBe('created')
      expect(existsSync(resolve(cwd, 'components.json'))).toBe(true)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('resolves @ alias into src when src exists', async () => {
    const cwd = await createTempDir()

    try {
      mkdirSync(resolve(cwd, 'src'), { recursive: true })

      expect(resolveAliasToPath(cwd, '@/components/ui')).toBe(
        resolve(cwd, 'src/components/ui'),
      )
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('resolves registry target using config aliases', async () => {
    const cwd = await createTempDir()

    try {
      mkdirSync(resolve(cwd, 'src'), { recursive: true })

      const config = createDefaultComponentsConfig()

      expect(
        resolveRegistryTarget(cwd, config, 'components/ui/button.tsx'),
      ).toBe(resolve(cwd, 'src/components/ui/button.tsx'))

      expect(resolveRegistryTarget(cwd, config, 'lib/utils.ts')).toBe(
        resolve(cwd, 'src/lib/utils.ts'),
      )
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('creates theme css file', async () => {
    const cwd = await createTempDir()

    try {
      const config = createDefaultComponentsConfig({
        style: 'zinc',
        css: 'src/styles/globals.css',
      })

      const result = await ensureThemeCss({
        cwd,
        config,
        overwrite: false,
      })

      expect(result).toBe('created')
      expect(
        readFileSync(resolve(cwd, 'src/styles/globals.css'), 'utf-8'),
      ).toBe("@import '@zeus-web/themes/zinc.css';\n")
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
```

## `packages/cli/__tests__/init.spec.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { parseInitArgs } from '../src/commands/init'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-init-'))
}

describe('@zeus-web/cli init', () => {
  it('parses init options', () => {
    const parsed = parseInitArgs(
      [
        '--cwd',
        'demo',
        '--style',
        'slate',
        '--css',
        'app/globals.css',
        '--overwrite',
        '--no-install',
        '--package-manager',
        'npm',
      ],
      '/repo',
    )

    expect(parsed.options).toEqual({
      cwd: resolve('/repo', 'demo'),
      style: 'slate',
      css: 'app/globals.css',
      overwrite: true,
      install: false,
      packageManager: 'npm',
    })
  })

  it('rejects unsupported style', () => {
    expect(() => parseInitArgs(['--style', 'bad'])).toThrow(
      'Unsupported style: bad',
    )
  })
})
```

## 更新 `packages/cli/__tests__/add.spec.ts`

核心调整：测试里需要写入 `components.json`，然后断言 target 根据 alias 解析到 `src/components/ui` 和 `src/lib`。

在现有测试文件里增加 helper：

```ts
import { createDefaultComponentsConfig } from '../src/config'

function writeComponentsJson(root: string): void {
  mkdirSync(resolve(root, 'src'), { recursive: true })
  writeFileSync(
    resolve(root, 'components.json'),
    `${JSON.stringify(createDefaultComponentsConfig(), null, 2)}\n`,
    'utf-8',
  )
}
```

把所有调用 `executeAddPlan(... targetRoot ...)` 前补：

```ts
writeComponentsJson(targetRoot)
```

然后把复制断言从：

```ts
resolve(targetRoot, 'lib/utils.ts')
resolve(targetRoot, 'components/ui/button.tsx')
```

改为：

```ts
resolve(targetRoot, 'src/lib/utils.ts')
resolve(targetRoot, 'src/components/ui/button.tsx')
```

dry-run 断言改成：

```ts
expect(result.planned).toEqual([
  'src/lib/utils.ts',
  'src/components/ui/button.tsx',
])
expect(result.written).toEqual([])
```

dedupe 断言改成：

```ts
expect(result.written).toEqual([
  'src/lib/utils.ts',
  'src/components/ui/input.tsx',
  'src/components/ui/button.tsx',
])
```

---

# 9. 使用效果

初始化：

```bash
zweb init --style slate --css src/styles/globals.css
```

生成：

```txt
components.json
src/styles/globals.css
```

`components.json`：

```json
{
  "$schema": "https://zeus-web.dev/schema/components.json",
  "framework": "react",
  "style": "slate",
  "tailwind": {
    "css": "src/styles/globals.css",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib"
  }
}
```

添加组件：

```bash
zweb add button input
```

写入：

```txt
src/lib/utils.ts
src/components/ui/button.tsx
src/components/ui/input.tsx
```

并自动安装：

```bash
pnpm add @zeus-web/button @zeus-web/input class-variance-authority clsx tailwind-merge
```

dry-run：

```bash
zweb add button --dry-run
```

不会写文件，也不会安装依赖。

---

# 10. Phase 7 验收命令

```bash
pnpm --filter @zeus-web/cli check
pnpm --filter @zeus-web/cli test
pnpm --filter @zeus-web/cli build

pnpm check
pnpm test
pnpm check:exports
pnpm build
pnpm check:build-output
```

验收标准：

```txt
1. zweb init 能创建 components.json。
2. zweb init 能创建并写入 theme css import。
3. zweb init 能安装 @zeus-web/themes。
4. zweb add 读取 components.json。
5. zweb add 根据 aliases.ui / aliases.lib 复制到正确路径。
6. zweb add 自动安装 registry dependencies。
7. --no-install 能跳过安装。
8. --dry-run 不写文件、不安装依赖。
9. --package-manager 能指定 pnpm/npm/yarn/bun。
```

建议提交：

```txt
feat(cli): initialize components config and theme css
feat(cli): resolve registry targets from components aliases
feat(cli): install dependencies for init and add commands
test(cli): cover init config package manager and alias resolution
```
