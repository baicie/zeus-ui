下面给 **Phase 19：CLI add 组件安装闭环** 的详细设计与完整代码。

Phase 19 的目标是让：

```bash
zweb add button
zweb add input
zweb add button input
```

真正可用。

它必须做到：

```txt
1. 读取 zeus-ui.json
2. 读取 @zeus-web/registry
3. 递归展开 registryDependencies
4. 按 framework 过滤 React/Vue 模板
5. 重写模板里的 @/lib/cn alias
6. 写入目标文件
7. 支持 --dry-run
8. 支持 --overwrite
9. 记录 zeus-ui.lock.json
10. 输出需要安装的 npm dependencies
```

当前 CLI 已经有 `add.ts`，但历史逻辑存在两个关键风险：`registryDependencies` 没有完整展开、模板没有按 framework 严格过滤，容易出现 `zweb add button` 不生成 `cn/globals` 或 React 项目写入 Vue 文件的问题。Phase 19 直接把这块收口。

---

# Phase 19 范围

```txt
新增 / 改造：
  - zweb add 完整组件安装
  - registry dependency 展开
  - React/Vue 文件过滤
  - dry-run plan 输出
  - overwrite 冲突处理
  - lock 文件 zeus-ui.lock.json
  - add 单测
  - check-cli-add 脚本
  - roadmap Phase 19 Done

不做：
  - 不做 update/diff 三方合并
  - 不切 showcase 到 registry usage
  - 不做远程 registry
  - 不做交互式选择 UI
  - 不自动执行 pnpm add，Phase 19 只输出安装命令，可通过 --install 执行
```

---

# 1. 修改根 `package.json`

新增：

```json
"check:cli-add": "tsx scripts/checks/check-cli-add.ts"
```

并接入 `site:check`。

```json
{
  "scripts": {
    "check:component-coverage": "tsx scripts/checks/check-component-coverage.ts",
    "check:showcase-metadata": "tsx scripts/checks/check-showcase-metadata.ts",
    "check:showcase-implementation": "tsx scripts/checks/check-showcase-implementation.ts",
    "check:product-layers": "tsx scripts/checks/check-product-layers.ts",
    "check:ui-package": "tsx scripts/checks/check-ui-package.ts",
    "check:registry": "tsx scripts/checks/check-registry.ts",
    "check:cli-init": "tsx scripts/checks/check-cli-init.ts",
    "check:cli-add": "tsx scripts/checks/check-cli-add.ts",
    "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:product-layers && pnpm check:ui-package && pnpm check:registry && pnpm check:cli-init && pnpm check:cli-add && pnpm docs:check && pnpm docs:build && pnpm examples:check && pnpm showcase:test"
  }
}
```

---

# 2. 新增 `packages/cli/src/lock.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export interface ComponentsLockFile {
  version: 1
  components: Record<
    string,
    {
      files: string[]
      dependencies: string[]
      registryDependencies: string[]
      updatedAt: string
    }
  >
}

export const componentsLockFileName = 'zeus-ui.lock.json'

export function getComponentsLockPath(cwd: string): string {
  return resolve(cwd, componentsLockFileName)
}

export function createEmptyComponentsLock(): ComponentsLockFile {
  return {
    version: 1,
    components: {},
  }
}

export function readComponentsLock(cwd: string): ComponentsLockFile {
  const file = getComponentsLockPath(cwd)

  if (!existsSync(file)) {
    return createEmptyComponentsLock()
  }

  const lock = JSON.parse(readFileSync(file, 'utf-8')) as ComponentsLockFile

  if (lock.version !== 1) {
    throw new Error(
      `Unsupported ${componentsLockFileName} version: ${lock.version}`,
    )
  }

  return lock
}

export async function writeComponentsLock(
  cwd: string,
  lock: ComponentsLockFile,
): Promise<void> {
  const file = getComponentsLockPath(cwd)

  await mkdir(dirname(file), {
    recursive: true,
  })

  await writeFile(file, `${JSON.stringify(lock, null, 2)}\n`, 'utf-8')
}
```

---

# 3. 替换 `packages/cli/src/commands/add.ts`

```ts
import type {
  Registry,
  RegistryFile,
  RegistryFramework,
  RegistryItem,
} from '@zeus-web/registry'
import type { ComponentsConfig } from '../config'
import type { PackageManager } from '../package-manager'

import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'

import { findRegistryItem, validateRegistry } from '@zeus-web/registry'
import pc from 'picocolors'

import {
  readComponentsConfig,
  resolveRegistryTarget,
  toRelativeProjectPath,
} from '../config'
import {
  createInstallCommands,
  formatInstallCommands,
  installDependencies,
} from '../package-manager'
import { readRegistryAsset } from '../registry-assets'
import { readComponentsLock, writeComponentsLock } from '../lock'

interface AddOptions {
  cwd: string
  dryRun: boolean
  overwrite: boolean
  install: boolean
  packageManager?: PackageManager
}

interface ParsedAddArgs {
  components: string[]
  options: AddOptions
}

interface RegistryFilePlan {
  source: string
  target: string
  absoluteTarget: string
  component: string
  framework: RegistryFramework
  action: 'create' | 'overwrite' | 'skip'
}

interface AddPlan {
  component: string
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFilePlan[]
}

interface AddResult {
  written: string[]
  skipped: string[]
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
    install: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      options.dryRun = true
      options.install = false
      continue
    }

    if (arg === '--overwrite' || arg === '--force') {
      options.overwrite = true
      continue
    }

    if (arg === '--install') {
      options.install = true
      continue
    }

    if (arg === '--no-install') {
      options.install = false
      continue
    }

    if (arg === '--cwd') {
      const value = args[index + 1]
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      continue
    }

    if (arg === '--package-manager') {
      const value = args[index + 1]
      if (!value) throw new Error('--package-manager requires a value')
      options.packageManager = parsePackageManager(value)
      index += 1
      continue
    }

    if (arg.startsWith('--package-manager=')) {
      const value = arg.slice('--package-manager='.length)
      if (!value) throw new Error('--package-manager requires a value')
      options.packageManager = parsePackageManager(value)
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

export function loadRegistry(): Registry {
  const source = readRegistryAsset('registry.json')
  return JSON.parse(source) as Registry
}

function assertValidRegistry(registry: Registry): void {
  const result = validateRegistry(registry)

  if (!result.valid) {
    throw new Error(`Invalid registry:\n${result.errors.join('\n')}`)
  }
}

function getComponentItems(registry: Registry): RegistryItem[] {
  return registry.items.filter(item => item.type === 'component')
}

export function listAvailableComponents(registry = loadRegistry()): string[] {
  assertValidRegistry(registry)

  return getComponentItems(registry).map(item => item.name)
}

function assertComponentExists(registry: Registry, name: string): RegistryItem {
  const item = findRegistryItem(registry, name)

  if (!item) {
    const available = listAvailableComponents(registry).join(', ')
    throw new Error(
      `Unknown component "${name}". Available components: ${available}`,
    )
  }

  return item
}

function collectRegistryItems(params: {
  registry: Registry
  name: string
  collected: Map<string, RegistryItem>
  visiting: string[]
}): void {
  const { registry, name, collected, visiting } = params

  if (collected.has(name)) return

  if (visiting.includes(name)) {
    throw new Error(
      `Circular registry dependency: ${[...visiting, name].join(' -> ')}`,
    )
  }

  const item = assertComponentExistsOrRegistryDependency(registry, name)

  for (const dependency of item.registryDependencies) {
    collectRegistryItems({
      registry,
      name: dependency,
      collected,
      visiting: [...visiting, name],
    })
  }

  collected.set(item.name, item)
}

function assertComponentExistsOrRegistryDependency(
  registry: Registry,
  name: string,
): RegistryItem {
  const item = findRegistryItem(registry, name)

  if (!item) {
    const available = registry.items.map(entry => entry.name).join(', ')
    throw new Error(
      `Unknown registry item "${name}". Available items: ${available}`,
    )
  }

  return item
}

function shouldIncludeFileForFramework(
  file: RegistryFile,
  framework: ComponentsConfig['framework'],
): boolean {
  return file.framework === 'shared' || file.framework === framework
}

function normalizeImportAlias(alias: string): string {
  if (alias.endsWith('/')) return alias.slice(0, -1)
  return alias
}

export function rewriteRegistrySource(
  source: string,
  config: ComponentsConfig,
): string {
  const libAlias = normalizeImportAlias(config.aliases.lib)
  const uiAlias = normalizeImportAlias(config.aliases.ui)
  const stylesAlias = normalizeImportAlias(config.aliases.styles)

  return source
    .replace(/@\/lib\/cn/g, `${libAlias}/cn`)
    .replace(/@\/lib\/utils/g, `${libAlias}/utils`)
    .replace(/@\/components\/ui/g, uiAlias)
    .replace(/@\/styles/g, stylesAlias)
}

function createFilePlan(params: {
  cwd: string
  config: ComponentsConfig
  item: RegistryItem
  file: RegistryFile
  overwrite: boolean
}): RegistryFilePlan {
  const absoluteTarget = resolveRegistryTarget(
    params.cwd,
    params.config,
    params.file.target,
  )

  const exists = existsSync(absoluteTarget)

  return {
    source: params.file.source,
    target: toRelativeProjectPath(params.cwd, absoluteTarget),
    absoluteTarget,
    component: params.item.name,
    framework: params.file.framework,
    action: exists ? (params.overwrite ? 'overwrite' : 'skip') : 'create',
  }
}

function toAddPlan(params: {
  cwd: string
  config: ComponentsConfig
  item: RegistryItem
  overwrite: boolean
}): AddPlan {
  return {
    component: params.item.name,
    dependencies: [...params.item.dependencies],
    registryDependencies: [...params.item.registryDependencies],
    files: params.item.files
      .filter(file =>
        shouldIncludeFileForFramework(file, params.config.framework),
      )
      .map(file =>
        createFilePlan({
          cwd: params.cwd,
          config: params.config,
          item: params.item,
          file,
          overwrite: params.overwrite,
        }),
      ),
  }
}

function dedupePlans(plans: AddPlan[]): AddPlan[] {
  const byComponent = new Map<string, AddPlan>()

  for (const plan of plans) {
    const existing = byComponent.get(plan.component)

    if (!existing) {
      byComponent.set(plan.component, plan)
      continue
    }

    byComponent.set(plan.component, {
      component: plan.component,
      dependencies: Array.from(
        new Set([...existing.dependencies, ...plan.dependencies]),
      ),
      registryDependencies: Array.from(
        new Set([
          ...existing.registryDependencies,
          ...plan.registryDependencies,
        ]),
      ),
      files: dedupeFilePlans([...existing.files, ...plan.files]),
    })
  }

  return Array.from(byComponent.values())
}

function dedupeFilePlans(files: RegistryFilePlan[]): RegistryFilePlan[] {
  const byTarget = new Map<string, RegistryFilePlan>()

  for (const file of files) {
    byTarget.set(file.target, file)
  }

  return Array.from(byTarget.values())
}

export function createAddPlan(params: {
  components: string[]
  registry?: Registry
  cwd?: string
  config?: ComponentsConfig
  overwrite?: boolean
}): AddPlan[] {
  const registry = params.registry ?? loadRegistry()
  assertValidRegistry(registry)

  if (params.components.length === 0) {
    throw new Error(
      `No components provided. Available components: ${listAvailableComponents(registry).join(', ')}`,
    )
  }

  const cwd = params.cwd ?? process.cwd()
  const config = params.config ?? readComponentsConfig(cwd)
  const overwrite = params.overwrite ?? false

  const collected = new Map<string, RegistryItem>()

  for (const component of params.components) {
    const item = assertComponentExists(registry, component)

    if (item.type !== 'component') {
      throw new Error(`"${component}" is not a component registry item`)
    }

    collectRegistryItems({
      registry,
      name: component,
      collected,
      visiting: [],
    })
  }

  return dedupePlans(
    Array.from(collected.values()).map(item =>
      toAddPlan({
        cwd,
        config,
        item,
        overwrite,
      }),
    ),
  )
}

function flattenDependencies(plans: AddPlan[]): string[] {
  const dependencies = new Set<string>()

  for (const plan of plans) {
    for (const dependency of plan.dependencies) {
      dependencies.add(dependency)
    }
  }

  return Array.from(dependencies)
}

function flattenFiles(plans: AddPlan[]): RegistryFilePlan[] {
  return dedupeFilePlans(plans.flatMap(plan => plan.files))
}

function printAddPlan(params: {
  plans: AddPlan[]
  dependencies: string[]
  options: AddOptions
}): void {
  console.log(pc.bold('Add plan:'))

  for (const file of flattenFiles(params.plans)) {
    const action =
      file.action === 'create'
        ? pc.green('CREATE')
        : file.action === 'overwrite'
          ? pc.yellow('OVERWRITE')
          : pc.gray('SKIP')

    console.log(`  ${action} ${file.target}`)
  }

  if (params.dependencies.length > 0) {
    console.log(pc.bold('Dependencies:'))
    for (const dependency of params.dependencies) {
      console.log(`  ${dependency}`)
    }

    const commands = createInstallCommands({
      cwd: params.options.cwd,
      packageManager: params.options.packageManager,
      dependencies: params.dependencies,
    })

    console.log(pc.bold('Install command:'))
    for (const command of formatInstallCommands(commands)) {
      console.log(`  ${command}`)
    }
  }
}

async function writeFilePlan(params: {
  cwd: string
  config: ComponentsConfig
  file: RegistryFilePlan
  overwrite: boolean
}): Promise<'written' | 'skipped'> {
  if (existsSync(params.file.absoluteTarget) && !params.overwrite) {
    return 'skipped'
  }

  const raw = readRegistryAsset(params.file.source)
  const source = rewriteRegistrySource(raw, params.config)

  await mkdir(dirname(params.file.absoluteTarget), {
    recursive: true,
  })

  await writeFile(params.file.absoluteTarget, source, 'utf-8')

  return 'written'
}

async function writePlans(params: {
  cwd: string
  config: ComponentsConfig
  plans: AddPlan[]
  overwrite: boolean
}): Promise<AddResult> {
  const written: string[] = []
  const skipped: string[] = []

  for (const file of flattenFiles(params.plans)) {
    const result = await writeFilePlan({
      cwd: params.cwd,
      config: params.config,
      file,
      overwrite: params.overwrite,
    })

    if (result === 'written') written.push(file.target)
    else skipped.push(file.target)
  }

  return {
    written,
    skipped,
  }
}

async function updateLock(params: {
  cwd: string
  plans: AddPlan[]
  writtenTargets: string[]
}): Promise<void> {
  const lock = readComponentsLock(params.cwd)
  const writtenTargets = new Set(params.writtenTargets)
  const updatedAt = new Date().toISOString()

  for (const plan of params.plans) {
    const files = plan.files
      .filter(file => writtenTargets.has(file.target))
      .map(file => file.target)

    if (files.length === 0) continue

    lock.components[plan.component] = {
      files,
      dependencies: plan.dependencies,
      registryDependencies: plan.registryDependencies,
      updatedAt,
    }
  }

  await writeComponentsLock(params.cwd, lock)
}

function printWriteResult(result: AddResult): void {
  for (const file of result.written) {
    console.log(pc.green(`Created ${file}`))
  }

  for (const file of result.skipped) {
    console.log(
      pc.yellow(`Skipped existing ${file}. Use --overwrite to replace it.`),
    )
  }
}

export async function add(args: string[]) {
  try {
    const parsed = parseAddArgs(args)
    const config = readComponentsConfig(parsed.options.cwd)
    const registry = loadRegistry()

    const plans = createAddPlan({
      components: parsed.components,
      registry,
      cwd: parsed.options.cwd,
      config,
      overwrite: parsed.options.overwrite,
    })

    const dependencies = flattenDependencies(plans)

    if (parsed.options.dryRun) {
      printAddPlan({
        plans,
        dependencies,
        options: parsed.options,
      })
      return
    }

    const result = await writePlans({
      cwd: parsed.options.cwd,
      config,
      plans,
      overwrite: parsed.options.overwrite,
    })

    printWriteResult(result)

    await updateLock({
      cwd: parsed.options.cwd,
      plans,
      writtenTargets: result.written,
    })

    if (dependencies.length > 0) {
      if (parsed.options.install) {
        await installDependencies({
          cwd: parsed.options.cwd,
          packageManager: parsed.options.packageManager,
          dependencies,
        })
      } else {
        const commands = createInstallCommands({
          cwd: parsed.options.cwd,
          packageManager: parsed.options.packageManager,
          dependencies,
        })

        console.log(pc.bold('Install dependencies:'))
        for (const command of formatInstallCommands(commands)) {
          console.log(`  ${command}`)
        }
      }
    }
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 4. 修改 `packages/cli/src/index.ts`

确保 help 文案包含 Phase 19 用法。

在 `printHelp()` 里调整为：

```ts
function printHelp() {
  console.log('Zeus Web CLI')
  console.log('')
  console.log('Usage:')
  console.log('  zweb init')
  console.log('  zweb init --framework react')
  console.log('  zweb init --framework vue')
  console.log('  zweb init --style slate --css src/styles/zeus.css')
  console.log('  zweb init --dry-run')
  console.log('  zweb add button')
  console.log('  zweb add button input')
  console.log('  zweb add button --dry-run')
  console.log('  zweb add button --overwrite')
  console.log('  zweb add button --install')
  console.log('  zweb list')
  console.log('  zweb diff')
  console.log('  zweb update-theme --radius lg --motion reduced')
  console.log('  zweb remove-theme')
  console.log('  zweb icon add check')
  console.log('  zweb ai context')
  console.log('')
  console.log('Options:')
  console.log('  --framework <name>          react | vue')
  console.log('  --style <name>              Theme name')
  console.log('  --css <path>                CSS file to update')
  console.log('  --cwd <path>                Project directory')
  console.log(
    '  --dry-run                   Print changes without writing files',
  )
  console.log('  --overwrite, --force        Replace existing files')
  console.log('  --install                   Install npm dependencies')
  console.log('  --package-manager <name>    pnpm | npm | yarn | bun')
}
```

---

# 5. 修改 `packages/cli/package.json`

新增 `test:add`：

```json
{
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup && node -e \"const fs=require('fs');const f='dist/index.js';const c=fs.readFileSync(f,'utf8');if(!c.startsWith('#!'))fs.writeFileSync(f,'#!/usr/bin/env node\\n'+c,'utf8');\"",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit packages/cli/__tests__/add.spec.ts packages/cli/__tests__/ai.spec.ts packages/cli/__tests__/config.spec.ts packages/cli/__tests__/init.spec.ts packages/cli/__tests__/package-manager.spec.ts packages/cli/__tests__/phase12-cli.spec.ts packages/cli/__tests__/phase13-theme.spec.ts packages/cli/__tests__/phase14-icons.spec.ts",
    "test:init": "vitest --root ../.. --project unit packages/cli/__tests__/init.spec.ts",
    "test:add": "vitest --root ../.. --project unit packages/cli/__tests__/add.spec.ts"
  }
}
```

---

# 6. 替换 `packages/cli/__tests__/add.spec.ts`

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  parseAddArgs,
  createAddPlan,
  rewriteRegistrySource,
} from '../src/commands/add'
import {
  createDefaultComponentsConfig,
  getComponentsConfigPath,
} from '../src/config'
import { readComponentsLock } from '../src/lock'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-cli-add-'))
}

function writeConfig(root: string, framework: 'react' | 'vue' = 'react') {
  const config = createDefaultComponentsConfig({
    framework,
    typescript: true,
    srcDir: 'src',
  })

  mkdirSync(root, { recursive: true })
  writeFileSync(
    getComponentsConfigPath(root),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf-8',
  )

  return config
}

const registry = {
  schemaVersion: 1,
  name: '@zeus-web/registry',
  version: '0.0.0',
  items: [
    {
      name: 'cn',
      type: 'utility',
      description: 'cn helper',
      frameworks: ['shared'],
      dependencies: [],
      registryDependencies: [],
      files: [
        {
          framework: 'shared',
          source: 'templates/lib/cn.ts',
          target: 'lib/cn.ts',
        },
      ],
    },
    {
      name: 'globals',
      type: 'style',
      description: 'global css',
      frameworks: ['shared'],
      dependencies: [],
      registryDependencies: [],
      files: [
        {
          framework: 'shared',
          source: 'templates/css/globals.css',
          target: 'styles/zeus.css',
        },
      ],
    },
    {
      name: 'button',
      type: 'component',
      description: 'button',
      frameworks: ['react', 'vue'],
      dependencies: ['@zeus-web/button'],
      registryDependencies: ['cn', 'globals'],
      files: [
        {
          framework: 'react',
          source: 'templates/react/button.tsx',
          target: 'components/ui/button.tsx',
        },
        {
          framework: 'vue',
          source: 'templates/vue/button.vue',
          target: 'components/ui/button.vue',
        },
      ],
    },
    {
      name: 'input',
      type: 'component',
      description: 'input',
      frameworks: ['react', 'vue'],
      dependencies: ['@zeus-web/input'],
      registryDependencies: ['cn', 'globals'],
      files: [
        {
          framework: 'react',
          source: 'templates/react/input.tsx',
          target: 'components/ui/input.tsx',
        },
        {
          framework: 'vue',
          source: 'templates/vue/input.vue',
          target: 'components/ui/input.vue',
        },
      ],
    },
  ],
} as const

describe('@zeus-web/cli add', () => {
  it('parses add args', () => {
    expect(
      parseAddArgs(
        [
          'button',
          'input',
          '--dry-run',
          '--overwrite',
          '--cwd',
          'demo',
          '--package-manager',
          'npm',
        ],
        '/repo',
      ),
    ).toEqual({
      components: ['button', 'input'],
      options: {
        cwd: resolve('/repo', 'demo'),
        dryRun: true,
        overwrite: true,
        install: false,
        packageManager: 'npm',
      },
    })
  })

  it('rejects unknown options', () => {
    expect(() => parseAddArgs(['button', '--bad'])).toThrow('Unknown option')
  })

  it('requires components', async () => {
    const root = await createTempDir()

    try {
      const config = writeConfig(root)

      expect(() =>
        createAddPlan({
          components: [],
          registry,
          cwd: root,
          config,
        }),
      ).toThrow('No components provided')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('expands registry dependencies before the component', async () => {
    const root = await createTempDir()

    try {
      const config = writeConfig(root)

      const plans = createAddPlan({
        components: ['button'],
        registry,
        cwd: root,
        config,
      })

      expect(plans.map(plan => plan.component)).toEqual([
        'cn',
        'globals',
        'button',
      ])

      expect(
        plans.flatMap(plan => plan.files.map(file => file.target)),
      ).toEqual([
        'src/lib/cn.ts',
        'src/styles/zeus.css',
        'src/components/ui/button.tsx',
      ])

      expect(plans.flatMap(plan => plan.dependencies)).toEqual([
        '@zeus-web/button',
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('filters files by React framework', async () => {
    const root = await createTempDir()

    try {
      const config = writeConfig(root, 'react')

      const plans = createAddPlan({
        components: ['button'],
        registry,
        cwd: root,
        config,
      })

      const files = plans.flatMap(plan => plan.files.map(file => file.target))

      expect(files).toContain('src/components/ui/button.tsx')
      expect(files).not.toContain('src/components/ui/button.vue')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('filters files by Vue framework', async () => {
    const root = await createTempDir()

    try {
      const config = writeConfig(root, 'vue')

      const plans = createAddPlan({
        components: ['button'],
        registry,
        cwd: root,
        config,
      })

      const files = plans.flatMap(plan => plan.files.map(file => file.target))

      expect(files).toContain('src/components/ui/button.vue')
      expect(files).not.toContain('src/components/ui/button.tsx')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('dedupes shared registry dependencies', async () => {
    const root = await createTempDir()

    try {
      const config = writeConfig(root)

      const plans = createAddPlan({
        components: ['button', 'input'],
        registry,
        cwd: root,
        config,
      })

      expect(plans.map(plan => plan.component)).toEqual([
        'cn',
        'globals',
        'button',
        'input',
      ])

      const files = plans.flatMap(plan => plan.files.map(file => file.target))

      expect(files.filter(file => file === 'src/lib/cn.ts')).toHaveLength(1)
      expect(files.filter(file => file === 'src/styles/zeus.css')).toHaveLength(
        1,
      )
      expect(files).toContain('src/components/ui/button.tsx')
      expect(files).toContain('src/components/ui/input.tsx')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('marks existing files as skipped by default', async () => {
    const root = await createTempDir()

    try {
      const config = writeConfig(root)
      mkdirSync(resolve(root, 'src/components/ui'), { recursive: true })
      writeFileSync(
        resolve(root, 'src/components/ui/button.tsx'),
        'custom',
        'utf-8',
      )

      const plans = createAddPlan({
        components: ['button'],
        registry,
        cwd: root,
        config,
      })

      const buttonFile = plans
        .flatMap(plan => plan.files)
        .find(file => file.target === 'src/components/ui/button.tsx')

      expect(buttonFile?.action).toBe('skip')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('marks existing files as overwrite when requested', async () => {
    const root = await createTempDir()

    try {
      const config = writeConfig(root)
      mkdirSync(resolve(root, 'src/components/ui'), { recursive: true })
      writeFileSync(
        resolve(root, 'src/components/ui/button.tsx'),
        'custom',
        'utf-8',
      )

      const plans = createAddPlan({
        components: ['button'],
        registry,
        cwd: root,
        config,
        overwrite: true,
      })

      const buttonFile = plans
        .flatMap(plan => plan.files)
        .find(file => file.target === 'src/components/ui/button.tsx')

      expect(buttonFile?.action).toBe('overwrite')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rewrites template aliases', () => {
    const config = createDefaultComponentsConfig({
      framework: 'react',
    })

    expect(
      rewriteRegistrySource(
        [
          "import { cn } from '@/lib/cn'",
          "import { Button } from '@/components/ui/button'",
          "import '@/styles/zeus.css'",
        ].join('\n'),
        {
          ...config,
          aliases: {
            components: '@app/components',
            ui: '@app/components/ui',
            lib: '@app/lib',
            styles: '@app/styles',
          },
        },
      ),
    ).toContain("import { cn } from '@app/lib/cn'")
  })

  it('reads empty lock when lock file does not exist', async () => {
    const root = await createTempDir()

    try {
      expect(readComponentsLock(root)).toEqual({
        version: 1,
        components: {},
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
```

---

# 7. 新增 `scripts/checks/check-cli-add.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'packages/cli/src/commands/add.ts',
  'packages/cli/src/lock.ts',
  'packages/cli/__tests__/add.spec.ts',
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
      'packages/cli/src/commands/add.ts',
      [
        'collectRegistryItems',
        'registryDependencies',
        'shouldIncludeFileForFramework',
        'rewriteRegistrySource',
        'resolveRegistryTarget',
        'readComponentsConfig',
        'readComponentsLock',
        'writeComponentsLock',
        '--dry-run',
        '--overwrite',
        '--install',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/src/lock.ts',
      [
        'zeus-ui.lock.json',
        'readComponentsLock',
        'writeComponentsLock',
        'createEmptyComponentsLock',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/__tests__/add.spec.ts',
      [
        'expands registry dependencies before the component',
        'filters files by React framework',
        'filters files by Vue framework',
        'dedupes shared registry dependencies',
        'marks existing files as skipped by default',
        'marks existing files as overwrite when requested',
      ],
      errors,
    )

    checkSourceContains('packages/cli/package.json', ['"test:add"'], errors)
  }

  if (errors.length > 0) {
    console.error(pc.red('CLI add check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('CLI add check passed.'))
}

main()
```

---

# 8. 更新 `scripts/checks/check-product-layers.ts`

把 roadmap 相关检查更新到 Phase 19。

```ts
{
  path: 'docs/internal/examples/showcase-roadmap.md',
  mustContain: [
    '| Phase 15 | Done   | Product layering contract for primitives, themes, native styled Web-C, registry, CLI and showcase usage          |',
    '| Phase 16 | Done   | Native styled Web-C package with styled button and input entrypoints                                             |',
    '| Phase 17 | Done   | Registry foundation with React and Vue button/input templates                                                    |',
    '| Phase 18 | Done   | CLI init command with zeus-ui.json, project detection, cn utility and styles initialization                       |',
    '| Phase 19 | Done   | CLI add command with registry dependency expansion, framework filtering, file writing and lockfile tracking       |',
    'The showcase has twelve layers of checks:',
    'Product layer checks validate Zeus-UI package boundaries and usage entry decisions.',
    'Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.',
    'Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.',
    'CLI init checks validate zeus-ui.json initialization, project detection and base file generation.',
    'CLI add checks validate registry dependency expansion, framework-specific template filtering and lockfile tracking.',
    'pnpm check:product-layers',
    'pnpm check:ui-package',
    'pnpm check:registry',
    'pnpm check:cli-init',
    'pnpm check:cli-add',
    'Phase 20: Switch React and Vue showcase to registry-installed styled usage.',
  ],
}
```

替换 `checkPhaseOrder`：

```ts
function checkPhaseOrder(source: string): string[] {
  const errors: string[] = []
  const phase15Index = source.indexOf('| Phase 15 |')
  const phase16Index = source.indexOf('| Phase 16 |')
  const phase17Index = source.indexOf('| Phase 17 |')
  const phase18Index = source.indexOf('| Phase 18 |')
  const phase19Index = source.indexOf('| Phase 19 |')
  const phase20Index = source.indexOf('Phase 20:')

  if (phase15Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 15 status row')
  }

  if (phase16Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 16 status row')
  }

  if (phase17Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 17 status row')
  }

  if (phase18Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 18 status row')
  }

  if (phase19Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 19 status row')
  }

  if (phase20Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 20 next work')
  }

  if (phase15Index >= 0 && phase16Index >= 0 && phase16Index < phase15Index) {
    errors.push('Phase 16 status must appear after Phase 15 status')
  }

  if (phase16Index >= 0 && phase17Index >= 0 && phase17Index < phase16Index) {
    errors.push('Phase 17 status must appear after Phase 16 status')
  }

  if (phase17Index >= 0 && phase18Index >= 0 && phase18Index < phase17Index) {
    errors.push('Phase 18 status must appear after Phase 17 status')
  }

  if (phase18Index >= 0 && phase19Index >= 0 && phase19Index < phase18Index) {
    errors.push('Phase 19 status must appear after Phase 18 status')
  }

  if (phase19Index >= 0 && phase20Index >= 0 && phase20Index < phase19Index) {
    errors.push('Phase 20 next work must appear after Phase 19 status')
  }

  return errors
}
```

---

# 9. 新增设计文档 `docs/internal/design/zeus-ui-cli-add.md`

````md
# Zeus-UI CLI Add

## Status

Phase 19 design.

This document defines the `zweb add` command.

## Goal

`zweb add` installs registry components into a user project.

Example:

```bash
zweb add button
zweb add button input
zweb add button --dry-run
zweb add button --overwrite
```
````

## Inputs

`zweb add` reads:

```txt
zeus-ui.json
@zeus-web/registry
```

The project must run `zweb init` first.

## Registry dependency expansion

If the user runs:

```bash
zweb add button
```

The CLI must also install registry dependencies:

```txt
cn
globals
button
```

This ensures generated component templates do not reference missing files.

## Framework filtering

The registry may contain both React and Vue templates.

The CLI must only install files matching the current project framework from `zeus-ui.json`.

For React:

```txt
components/ui/button.tsx
```

For Vue:

```txt
components/ui/button.vue
```

It must not install both frameworks into one project.

## File writing

Default behavior:

- create missing files
- skip existing files
- print skipped files
- suggest `--overwrite`

Overwrite behavior:

```bash
zweb add button --overwrite
```

replaces existing files.

## Dry run

Dry-run prints:

```txt
CREATE src/lib/cn.ts
CREATE src/styles/zeus.css
CREATE src/components/ui/button.tsx
Dependencies:
  @zeus-web/button
```

without writing files.

## Lockfile

The CLI writes:

```txt
zeus-ui.lock.json
```

It records:

- installed component
- written files
- npm dependencies
- registry dependencies
- update timestamp

## Dependency installation

Phase 19 prints install commands by default.

With `--install`, it may run the package manager.

## Non-goals

Phase 19 does not implement:

- update
- diff
- three-way merge
- remote registry
- interactive component picker
- showcase registry sync

## Next phase

Phase 20 should switch React and Vue showcase to registry-installed styled usage.

````

---

# 10. 更新 roadmap

## `docs/internal/examples/showcase-roadmap.md`

追加：

```md
| Phase 19 | Done   | CLI add command with registry dependency expansion, framework filtering, file writing and lockfile tracking       |
````

工程保障改成 12 层：

```md
The showcase has twelve layers of checks:

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
```

Commands 增加：

```bash
pnpm check:cli-add
pnpm --filter @zeus-web/cli test:add
```

Next work 改成：

```md
## Next work

Future phases should switch showcase to real registry usage:

- Phase 20: Switch React and Vue showcase to registry-installed styled usage.
- Phase 21: Add native showcase for @zeus-web/ui.
- Phase 22: Rewrite public docs around CLI, native styled Web-C and advanced primitive usage.
```

---

# 11. 文件清单

```txt
package.json
scripts/checks/check-cli-add.ts
scripts/checks/check-product-layers.ts

packages/cli/src/commands/add.ts
packages/cli/src/lock.ts
packages/cli/src/index.ts
packages/cli/package.json
packages/cli/__tests__/add.spec.ts

docs/internal/design/zeus-ui-cli-add.md
docs/internal/examples/showcase-roadmap.md
```

---

# 12. 验收命令

```bash
pnpm check:cli-add
pnpm --filter @zeus-web/cli check
pnpm --filter @zeus-web/cli test:add
pnpm --filter @zeus-web/cli test
pnpm --filter @zeus-web/cli build
```

手工验证：

```bash
# React project
node packages/cli/dist/index.js init --framework react --cwd /tmp/zeus-react --overwrite
node packages/cli/dist/index.js add button --cwd /tmp/zeus-react --dry-run

# 预期输出：
# CREATE src/lib/cn.ts
# CREATE src/styles/zeus.css
# CREATE src/components/ui/button.tsx
# 不应该出现 button.vue

node packages/cli/dist/index.js add button --cwd /tmp/zeus-react

# Vue project
node packages/cli/dist/index.js init --framework vue --cwd /tmp/zeus-vue --overwrite
node packages/cli/dist/index.js add button --cwd /tmp/zeus-vue --dry-run

# 预期输出：
# CREATE src/lib/cn.ts
# CREATE src/styles/zeus.css
# CREATE src/components/ui/button.vue
# 不应该出现 button.tsx
```

全量：

```bash
pnpm check
pnpm build
pnpm site:check
pnpm showcase:ci
pnpm release:verify --allow-zero
```

---

# 13. Phase 19 完成判断

```txt
完成：
  - zweb add button 可展开 cn/globals/button
  - zweb add input 可展开 cn/globals/input
  - zweb add button input 可去重 cn/globals
  - React 项目只写 .tsx
  - Vue 项目只写 .vue
  - 已存在文件默认 skip
  - --overwrite 可覆盖
  - --dry-run 不写文件
  - zeus-ui.lock.json 记录写入结果
  - 输出 npm install command
  - site:check 接入 check:cli-add

未做：
  - 没有 update/diff merge
  - 没有 showcase 切 registry
  - 没有远程 registry
```

---

# 14. 建议分支与 PR

分支名：

```txt
feat/cli-add
```

PR title：

```txt
feat(cli): add registry component installation
```
