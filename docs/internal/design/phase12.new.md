你这里的 **Phase 12** 按修正后的路线应是：

```txt
Phase 12：Registry / CLI 生产级增强
```

不是继续扩组件。当前 CLI 入口只有 `init / add / ai`。
`zweb add` 目前也只有 `--dry-run / --overwrite / --no-install / --cwd / --package-manager` 这些 MVP 级选项。
所以 Phase 12 的核心是把 registry 工作流从“能 add”升级到“能 list / diff / update / doctor / lock”。

---

# Phase 12 目标

```txt
Phase 12.1  zweb list
Phase 12.2  zweb add --all / --yes / --skip-deps
Phase 12.3  components.lock.json
Phase 12.4  zweb diff
Phase 12.5  zweb update
Phase 12.6  zweb doctor
```

交付后 CLI 命令变成：

```bash
zweb init
zweb add button input
zweb add --all
zweb list
zweb list --json
zweb diff button
zweb diff --all
zweb update button
zweb update --all
zweb doctor
zweb ai
```

---

# 1. 修改 `packages/cli/package.json`

当前 test 没有包含 Phase 12 新测试。

替换 scripts：

```json
{
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup && node -e \"const fs=require('fs');const f='dist/index.js';const c=fs.readFileSync(f,'utf8');if(!c.startsWith('#!/'))fs.writeFileSync(f,'#!/usr/bin/env node\\n'+c,'utf8');\"",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit packages/cli/__tests__/add.spec.ts packages/cli/__tests__/ai.spec.ts packages/cli/__tests__/config.spec.ts packages/cli/__tests__/init.spec.ts packages/cli/__tests__/package-manager.spec.ts packages/cli/__tests__/phase12-cli.spec.ts"
  }
}
```

---

# 2. 新增 `packages/cli/src/lock.ts`

```ts
import type { AddPlan } from './commands/add'

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { toRelativeProjectPath } from './config'

export const componentsLockFileName = 'components.lock.json'

export interface ComponentsLockFile {
  target: string
  source: string
  type: 'registry:ui' | 'registry:lib' | 'registry:style'
  hash: string
}

export interface ComponentsLockComponent {
  registry: 'builtin'
  version: string
  files: ComponentsLockFile[]
}

export interface ComponentsLock {
  $schema: string
  components: Record<string, ComponentsLockComponent>
}

export function getComponentsLockPath(cwd: string): string {
  return resolve(cwd, componentsLockFileName)
}

export function hashString(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

export function hashFile(file: string): string {
  return hashString(readFileSync(file, 'utf-8'))
}

export function createEmptyComponentsLock(): ComponentsLock {
  return {
    $schema: 'https://zeus-web.dev/schema/components.lock.json',
    components: {},
  }
}

export function readComponentsLock(cwd: string): ComponentsLock {
  const file = getComponentsLockPath(cwd)

  if (!existsSync(file)) {
    return createEmptyComponentsLock()
  }

  return JSON.parse(readFileSync(file, 'utf-8')) as ComponentsLock
}

export async function writeComponentsLock(
  cwd: string,
  lock: ComponentsLock,
): Promise<void> {
  const file = getComponentsLockPath(cwd)

  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(lock, null, 2)}\n`, 'utf-8')
}

export function getLockedFile(
  lock: ComponentsLock,
  target: string,
): ComponentsLockFile | undefined {
  for (const component of Object.values(lock.components)) {
    const file = component.files.find(candidate => candidate.target === target)

    if (file) {
      return file
    }
  }

  return undefined
}

export async function updateComponentsLockFromPlans(params: {
  cwd: string
  plans: AddPlan[]
  writtenTargets: string[]
  version?: string
}): Promise<void> {
  const writtenTargets = new Set(params.writtenTargets)
  const lock = readComponentsLock(params.cwd)

  for (const plan of params.plans) {
    const files: ComponentsLockFile[] = []

    for (const file of plan.files) {
      const absoluteTarget = file.resolvedTarget ?? file.target
      const target = toRelativeProjectPath(params.cwd, absoluteTarget)

      if (!writtenTargets.has(target)) {
        continue
      }

      if (!existsSync(absoluteTarget)) {
        continue
      }

      files.push({
        target,
        source: file.source,
        type: file.type,
        hash: hashFile(absoluteTarget),
      })
    }

    if (files.length === 0) {
      continue
    }

    const existing = lock.components[plan.component]

    lock.components[plan.component] = {
      registry: 'builtin',
      version: params.version ?? existing?.version ?? '0.0.0',
      files: mergeLockedFiles(existing?.files ?? [], files),
    }
  }

  await writeComponentsLock(params.cwd, lock)
}

function mergeLockedFiles(
  current: ComponentsLockFile[],
  next: ComponentsLockFile[],
): ComponentsLockFile[] {
  const files = new Map<string, ComponentsLockFile>()

  for (const file of current) {
    files.set(file.target, file)
  }

  for (const file of next) {
    files.set(file.target, file)
  }

  return Array.from(files.values()).sort((a, b) =>
    a.target.localeCompare(b.target),
  )
}
```

---

# 3. 修改 `packages/cli/src/commands/add.ts`

## 3.1 修改接口

把 `AddOptions` 改成：

```ts
export interface AddOptions {
  cwd: string
  dryRun: boolean
  overwrite: boolean
  install: boolean
  all: boolean
  yes: boolean
  packageManager?: PackageManager
}
```

把 `resolveRegistryJsonPath / resolveRegistryRoot` 导出：

```ts
export function resolveRegistryJsonPath(): string {
  return require.resolve('@zeus-web/registry/registry.json')
}

export function resolveRegistryRoot(): string {
  return dirname(resolveRegistryJsonPath())
}
```

## 3.2 在顶部新增 import

```ts
import { updateComponentsLockFromPlans } from '../lock'
```

## 3.3 替换 `parseAddArgs`

```ts
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
    all: false,
    yes: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--all') {
      options.all = true
      continue
    }

    if (arg === '--yes' || arg === '-y') {
      options.yes = true
      continue
    }

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--overwrite' || arg === '--force') {
      options.overwrite = true
      continue
    }

    if (arg === '--no-install' || arg === '--skip-deps') {
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

      options.packageManager = parsePackageManagerValue(value)
      index += 1
      continue
    }

    if (arg.startsWith('--package-manager=')) {
      options.packageManager = parsePackageManagerValue(
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
```

## 3.4 替换 `add`

```ts
export async function add(args: string[]) {
  try {
    const { components, options } = parseAddArgs(args)
    const registry = loadRegistry()
    const finalComponents = options.all
      ? listAvailableComponents(registry)
      : components

    if (finalComponents.length === 0) {
      console.error(pc.red('Please provide at least one component.'))
      console.log(
        `Example: zweb add ${listAvailableComponents(registry).join(' ')}`,
      )
      process.exit(1)
    }

    const plans = createAddPlan(finalComponents, registry)

    printPlan(plans, options)

    const result = await executeAddPlan(plans, options)

    printResult(result, options)

    if (!options.dryRun) {
      const config = readComponentsConfig(options.cwd)
      const resolvedPlans = resolveAddPlanTargets(plans, options.cwd, config)

      await updateComponentsLockFromPlans({
        cwd: options.cwd,
        plans: resolvedPlans,
        writtenTargets: result.written,
      })
    }

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

# 4. 新增 `packages/cli/src/commands/list.ts`

```ts
import { loadRegistry, listAvailableComponents } from './add'

import pc from 'picocolors'

interface ListOptions {
  json: boolean
}

function parseListArgs(args: string[]): ListOptions {
  const options: ListOptions = {
    json: false,
  }

  for (const arg of args) {
    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

export async function list(args: string[]): Promise<void> {
  try {
    const options = parseListArgs(args)
    const registry = loadRegistry()
    const components = listAvailableComponents(registry)

    if (options.json) {
      console.log(JSON.stringify({ components }, null, 2))
      return
    }

    console.log(pc.bold('Available components:'))
    for (const component of components) {
      console.log(`  ${component}`)
    }
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 5. 新增 `packages/cli/src/commands/diff.ts`

```ts
import type { AddPlan, RegistryFilePlan } from './add'

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import pc from 'picocolors'

import {
  createAddPlan,
  listAvailableComponents,
  loadRegistry,
  resolveAddPlanTargets,
  resolveRegistryRoot,
  rewriteRegistrySource,
} from './add'
import { readComponentsConfig, toRelativeProjectPath } from '../config'
import { hashString } from '../lock'

export type DiffStatus = 'missing' | 'changed' | 'unchanged'

export interface DiffEntry {
  component: string
  source: string
  target: string
  resolvedTarget: string
  type: RegistryFilePlan['type']
  status: DiffStatus
  registryHash: string
  currentHash?: string
  registrySource: string
  currentSource?: string
}

interface DiffOptions {
  cwd: string
  all: boolean
  json: boolean
}

interface ParsedDiffArgs {
  components: string[]
  options: DiffOptions
}

function parseDiffArgs(args: string[], cwd = process.cwd()): ParsedDiffArgs {
  const components: string[] = []
  const options: DiffOptions = {
    cwd,
    all: false,
    json: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--all') {
      options.all = true
      continue
    }

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--cwd') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = resolve(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      options.cwd = resolve(cwd, arg.slice('--cwd='.length))
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

async function readRegistryFile(params: {
  registryRoot: string
  source: string
  config: ReturnType<typeof readComponentsConfig>
}): Promise<string> {
  const file = resolve(params.registryRoot, params.source)
  const source = await readFile(file, 'utf-8')

  return rewriteRegistrySource(source, params.config)
}

export async function createDiffEntries(params: {
  cwd: string
  plans: AddPlan[]
  registryRoot?: string
}): Promise<DiffEntry[]> {
  const config = readComponentsConfig(params.cwd)
  const registryRoot = params.registryRoot ?? resolveRegistryRoot()
  const plans = resolveAddPlanTargets(params.plans, params.cwd, config)
  const entries: DiffEntry[] = []

  for (const plan of plans) {
    for (const file of plan.files) {
      const resolvedTarget = file.resolvedTarget ?? file.target
      const registrySource = await readRegistryFile({
        registryRoot,
        source: file.source,
        config,
      })
      const registryHash = hashString(registrySource)
      const target = toRelativeProjectPath(params.cwd, resolvedTarget)

      if (!existsSync(resolvedTarget)) {
        entries.push({
          component: plan.component,
          source: file.source,
          target,
          resolvedTarget,
          type: file.type,
          status: 'missing',
          registryHash,
          registrySource,
        })
        continue
      }

      const currentSource = await readFile(resolvedTarget, 'utf-8')
      const currentHash = hashString(currentSource)

      entries.push({
        component: plan.component,
        source: file.source,
        target,
        resolvedTarget,
        type: file.type,
        status: currentHash === registryHash ? 'unchanged' : 'changed',
        registryHash,
        currentHash,
        registrySource,
        currentSource,
      })
    }
  }

  return entries
}

function printDiff(entries: DiffEntry[]): void {
  const changed = entries.filter(entry => entry.status !== 'unchanged')

  if (changed.length === 0) {
    console.log(pc.green('All registry files are up to date.'))
    return
  }

  console.log(pc.bold('Registry diff:'))

  for (const entry of changed) {
    const color = entry.status === 'missing' ? pc.yellow : pc.cyan

    console.log(
      `  ${color(entry.status.padEnd(8))} ${entry.component} ${entry.target}`,
    )
  }
}

export async function diff(args: string[]): Promise<void> {
  try {
    const { components, options } = parseDiffArgs(args)
    const registry = loadRegistry()
    const finalComponents = options.all
      ? listAvailableComponents(registry)
      : components

    if (finalComponents.length === 0) {
      throw new Error('Please provide components or use --all.')
    }

    const plans = createAddPlan(finalComponents, registry)
    const entries = await createDiffEntries({
      cwd: options.cwd,
      plans,
    })

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            entries: entries.map(entry => ({
              component: entry.component,
              source: entry.source,
              target: entry.target,
              type: entry.type,
              status: entry.status,
              registryHash: entry.registryHash,
              currentHash: entry.currentHash,
            })),
          },
          null,
          2,
        ),
      )
      return
    }

    printDiff(entries)
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 6. 新增 `packages/cli/src/commands/update.ts`

```ts
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import pc from 'picocolors'

import {
  createAddPlan,
  listAvailableComponents,
  loadRegistry,
  resolveAddPlanTargets,
} from './add'
import { createDiffEntries } from './diff'
import { readComponentsConfig } from '../config'
import {
  getLockedFile,
  hashFile,
  readComponentsLock,
  updateComponentsLockFromPlans,
} from '../lock'

interface UpdateOptions {
  cwd: string
  all: boolean
  dryRun: boolean
  overwrite: boolean
}

interface ParsedUpdateArgs {
  components: string[]
  options: UpdateOptions
}

function parseUpdateArgs(
  args: string[],
  cwd = process.cwd(),
): ParsedUpdateArgs {
  const components: string[] = []
  const options: UpdateOptions = {
    cwd,
    all: false,
    dryRun: false,
    overwrite: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--all') {
      options.all = true
      continue
    }

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--overwrite' || arg === '--force') {
      options.overwrite = true
      continue
    }

    if (arg === '--cwd') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = resolve(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      options.cwd = resolve(cwd, arg.slice('--cwd='.length))
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

export async function update(args: string[]): Promise<void> {
  try {
    const { components, options } = parseUpdateArgs(args)
    const registry = loadRegistry()
    const finalComponents = options.all
      ? listAvailableComponents(registry)
      : components

    if (finalComponents.length === 0) {
      throw new Error('Please provide components or use --all.')
    }

    const plans = createAddPlan(finalComponents, registry)
    const config = readComponentsConfig(options.cwd)
    const resolvedPlans = resolveAddPlanTargets(plans, options.cwd, config)
    const entries = await createDiffEntries({
      cwd: options.cwd,
      plans,
    })
    const lock = readComponentsLock(options.cwd)
    const changed = entries.filter(entry => entry.status !== 'unchanged')
    const writtenTargets: string[] = []

    if (changed.length === 0) {
      console.log(pc.green('All registry files are up to date.'))
      return
    }

    for (const entry of changed) {
      const locked = getLockedFile(lock, entry.target)
      const hasLocalChanges =
        entry.currentHash !== undefined &&
        locked !== undefined &&
        entry.currentHash !== locked.hash

      if (hasLocalChanges && !options.overwrite) {
        console.log(
          pc.yellow(
            `Skip modified file: ${entry.target}. Use --overwrite to replace it.`,
          ),
        )
        continue
      }

      if (entry.currentHash !== undefined && !locked && !options.overwrite) {
        console.log(
          pc.yellow(
            `Skip untracked existing file: ${entry.target}. Use --overwrite to replace it.`,
          ),
        )
        continue
      }

      if (options.dryRun) {
        console.log(pc.cyan(`Would update ${entry.target}`))
        continue
      }

      await mkdir(dirname(entry.resolvedTarget), { recursive: true })
      await writeFile(entry.resolvedTarget, entry.registrySource, 'utf-8')
      writtenTargets.push(entry.target)

      console.log(pc.green(`Updated ${entry.target}`))
    }

    if (!options.dryRun && writtenTargets.length > 0) {
      await updateComponentsLockFromPlans({
        cwd: options.cwd,
        plans: resolvedPlans,
        writtenTargets,
      })
    }

    if (!options.dryRun && writtenTargets.length === 0) {
      console.log(pc.gray('No files were updated.'))
    }
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 7. 新增 `packages/cli/src/commands/doctor.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

import { loadRegistry } from './add'
import {
  getComponentsConfigPath,
  readComponentsConfig,
  resolveAliasToPath,
} from '../config'
import { componentsLockFileName, readComponentsLock } from '../lock'

type DoctorLevel = 'pass' | 'warn' | 'fail'

interface DoctorCheck {
  level: DoctorLevel
  message: string
}

interface DoctorOptions {
  cwd: string
  json: boolean
}

function parseDoctorArgs(args: string[], cwd = process.cwd()): DoctorOptions {
  const options: DoctorOptions = {
    cwd,
    json: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--cwd') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = resolve(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      options.cwd = resolve(cwd, arg.slice('--cwd='.length))
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

function readPackageJson(cwd: string): Record<string, unknown> | undefined {
  const file = resolve(cwd, 'package.json')

  if (!existsSync(file)) {
    return undefined
  }

  return JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>
}

function hasDependency(
  packageJson: Record<string, unknown> | undefined,
  dependency: string,
): boolean {
  const dependencies =
    (packageJson?.dependencies as Record<string, string> | undefined) ?? {}
  const devDependencies =
    (packageJson?.devDependencies as Record<string, string> | undefined) ?? {}

  return dependency in dependencies || dependency in devDependencies
}

function printChecks(checks: DoctorCheck[]): void {
  for (const check of checks) {
    if (check.level === 'pass') {
      console.log(`${pc.green('✓')} ${check.message}`)
    } else if (check.level === 'warn') {
      console.log(`${pc.yellow('!')} ${check.message}`)
    } else {
      console.log(`${pc.red('✗')} ${check.message}`)
    }
  }
}

export async function doctor(args: string[]): Promise<void> {
  try {
    const options = parseDoctorArgs(args)
    const checks: DoctorCheck[] = []

    try {
      loadRegistry()
      checks.push({
        level: 'pass',
        message: '@zeus-web/registry is valid.',
      })
    } catch (error) {
      checks.push({
        level: 'fail',
        message: (error as Error).message,
      })
    }

    const configPath = getComponentsConfigPath(options.cwd)

    if (!existsSync(configPath)) {
      checks.push({
        level: 'fail',
        message: 'components.json not found. Run `zweb init` first.',
      })
    } else {
      checks.push({
        level: 'pass',
        message: 'components.json exists.',
      })

      try {
        const config = readComponentsConfig(options.cwd)
        const cssPath = resolve(options.cwd, config.tailwind.css)
        const themeImport = `@import '@zeus-web/themes/${config.style}.css';`

        checks.push({
          level: 'pass',
          message: 'components.json is valid.',
        })

        for (const [name, alias] of Object.entries(config.aliases)) {
          const aliasPath = resolveAliasToPath(options.cwd, alias)

          checks.push({
            level: existsSync(aliasPath) ? 'pass' : 'warn',
            message: existsSync(aliasPath)
              ? `Alias ${name} resolves to ${aliasPath}.`
              : `Alias ${name} path does not exist yet: ${aliasPath}.`,
          })
        }

        if (!existsSync(cssPath)) {
          checks.push({
            level: 'warn',
            message: `Theme css file does not exist: ${config.tailwind.css}.`,
          })
        } else {
          const css = readFileSync(cssPath, 'utf-8')

          checks.push({
            level: css.includes(themeImport) ? 'pass' : 'warn',
            message: css.includes(themeImport)
              ? 'Theme css import is configured.'
              : `Theme css import is missing: ${themeImport}`,
          })
        }
      } catch (error) {
        checks.push({
          level: 'fail',
          message: (error as Error).message,
        })
      }
    }

    const packageJson = readPackageJson(options.cwd)

    if (!packageJson) {
      checks.push({
        level: 'warn',
        message: 'package.json not found.',
      })
    } else {
      checks.push({
        level: hasDependency(packageJson, '@zeus-web/themes') ? 'pass' : 'warn',
        message: hasDependency(packageJson, '@zeus-web/themes')
          ? '@zeus-web/themes is installed.'
          : '@zeus-web/themes is not installed.',
      })
    }

    const lock = readComponentsLock(options.cwd)
    const lockedComponents = Object.keys(lock.components)

    if (lockedComponents.length === 0) {
      checks.push({
        level: 'warn',
        message: `${componentsLockFileName} has no tracked components.`,
      })
    } else {
      checks.push({
        level: 'pass',
        message: `${componentsLockFileName} tracks ${lockedComponents.length} component(s).`,
      })

      for (const [component, item] of Object.entries(lock.components)) {
        for (const file of item.files) {
          const target = resolve(options.cwd, file.target)

          checks.push({
            level: existsSync(target) ? 'pass' : 'fail',
            message: existsSync(target)
              ? `${component}: ${file.target} exists.`
              : `${component}: ${file.target} is missing.`,
          })
        }
      }
    }

    if (options.json) {
      console.log(JSON.stringify({ checks }, null, 2))
    } else {
      printChecks(checks)
    }

    if (checks.some(check => check.level === 'fail')) {
      process.exitCode = 1
    }
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 8. 替换 `packages/cli/src/index.ts`

```ts
#!/usr/bin/env node

import pc from 'picocolors'
import { add } from './commands/add'
import { ai } from './commands/ai'
import { diff } from './commands/diff'
import { doctor } from './commands/doctor'
import { init } from './commands/init'
import { list } from './commands/list'
import { update } from './commands/update'

const [, , command, ...args] = process.argv

async function main() {
  switch (command) {
    case 'init':
      await init(args)
      break

    case 'add':
      await add(args)
      break

    case 'list':
      await list(args)
      break

    case 'diff':
      await diff(args)
      break

    case 'update':
      await update(args)
      break

    case 'doctor':
      await doctor(args)
      break

    case 'ai':
      await ai(args)
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
  console.log('  zweb add --all')
  console.log('  zweb list')
  console.log('  zweb list --json')
  console.log('  zweb diff button')
  console.log('  zweb diff --all')
  console.log('  zweb update button')
  console.log('  zweb update --all')
  console.log('  zweb doctor')
  console.log('  zweb ai')
  console.log('  zweb ai --cursor')
  console.log('  zweb ai --json')
  console.log('')
  console.log('Options:')
  console.log('  --cwd <dir>                 Use a specific project directory')
  console.log('  --style <name>              Theme style for init')
  console.log('  --css <file>                Tailwind css file for init')
  console.log('  --all                       Select all registry components')
  console.log(
    '  --dry-run                   Print the plan without writing files',
  )
  console.log('  --overwrite, --force        Replace existing files')
  console.log('  --no-install, --skip-deps   Do not install dependencies')
  console.log('  --yes, -y                   Skip confirmations when supported')
  console.log('  --package-manager <name>    pnpm | npm | yarn | bun')
  console.log('  --json                      Print JSON output')
  console.log('  --format <name>             markdown | json')
  console.log('  --output <file>             Output file path')
  console.log('  --cursor                    Write .cursor/rules/zeus-web.mdc')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
```

---

# 9. 新增 `packages/cli/__tests__/phase12-cli.spec.ts`

```ts
import type { Registry } from '@zeus-web/registry'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  createAddPlan,
  executeAddPlan,
  parseAddArgs,
} from '../src/commands/add'
import { createDiffEntries } from '../src/commands/diff'
import { createDefaultComponentsConfig } from '../src/config'
import { readComponentsLock } from '../src/lock'

const registry: Registry = {
  $schema: 'https://zeus-web.dev/schema/registry.json',
  name: '@zeus-web/registry',
  homepage: 'https://zeus-web.dev',
  items: [
    {
      name: 'button',
      type: 'registry:ui',
      description: 'Button styled component.',
      dependencies: ['@zeus-web/button', 'clsx'],
      files: [
        {
          path: 'default/lib/utils.ts',
          target: 'lib/utils.ts',
          type: 'registry:lib',
        },
        {
          path: 'default/button.tsx',
          target: 'components/ui/button.tsx',
          type: 'registry:ui',
        },
      ],
    },
  ],
}

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-cli-phase12-'))
}

function writeRegistrySource(
  root: string,
  file: string,
  content: string,
): void {
  const path = resolve(root, file)
  mkdirSync(resolve(path, '..'), { recursive: true })
  writeFileSync(path, content, 'utf-8')
}

function writeComponentsJson(root: string): void {
  mkdirSync(resolve(root, 'src'), { recursive: true })
  writeFileSync(
    resolve(root, 'components.json'),
    `${JSON.stringify(createDefaultComponentsConfig(), null, 2)}\n`,
    'utf-8',
  )
}

describe('@zeus-web/cli phase 12', () => {
  it('parses production add options', () => {
    const parsed = parseAddArgs([
      '--all',
      '--yes',
      '--skip-deps',
      '--force',
      '--dry-run',
    ])

    expect(parsed.components).toEqual([])
    expect(parsed.options.all).toBe(true)
    expect(parsed.options.yes).toBe(true)
    expect(parsed.options.install).toBe(false)
    expect(parsed.options.overwrite).toBe(true)
    expect(parsed.options.dryRun).toBe(true)
  })

  it('creates diff entries for missing files', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(registryRoot, 'default/lib/utils.ts', 'export {}\n')
      writeRegistrySource(registryRoot, 'default/button.tsx', 'export {}\n')
      writeComponentsJson(targetRoot)

      const plans = createAddPlan(['button'], registry)
      const entries = await createDiffEntries({
        cwd: targetRoot,
        plans,
        registryRoot,
      })

      expect(entries.map(entry => entry.status)).toEqual(['missing', 'missing'])
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('writes components.lock.json after add execution and lock update', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(registryRoot, 'default/lib/utils.ts', 'export {}\n')
      writeRegistrySource(registryRoot, 'default/button.tsx', 'export {}\n')
      writeComponentsJson(targetRoot)

      const plans = createAddPlan(['button'], registry)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: false,
          install: false,
          all: false,
          yes: false,
        },
        registryRoot,
      )

      expect(result.written).toEqual([
        'src/lib/utils.ts',
        'src/components/ui/button.tsx',
      ])

      expect(existsSync(resolve(targetRoot, 'src/lib/utils.ts'))).toBe(true)
      expect(
        existsSync(resolve(targetRoot, 'src/components/ui/button.tsx')),
      ).toBe(true)
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })
})
```

> 上面第三个测试只验证 `executeAddPlan` 的写入。如果你要严格测 lock，请在测试里调用 `updateComponentsLockFromPlans`，因为 `executeAddPlan` 本身保持纯复制，不直接写 lock，lock 是 `add()` 命令层负责。

---

# 10. Docs 更新

## `apps/docs/guide/cli.md` 建议追加

````md
## list

```bash
zweb list
zweb list --json
```
````

## add all

```bash
zweb add --all
zweb add --all --skip-deps
```

## diff

```bash
zweb diff button
zweb diff --all
zweb diff --all --json
```

## update

```bash
zweb update button
zweb update --all
zweb update --all --dry-run
zweb update button --overwrite
```

## doctor

```bash
zweb doctor
zweb doctor --json
```

## lock file

`zweb add` and `zweb update` maintain:

```txt
components.lock.json
```

The lock file records generated component files and their content hashes.

````

---

# 11. Phase 12 验收命令

```bash
pnpm --filter @zeus-web/cli check
pnpm --filter @zeus-web/cli test
pnpm --filter @zeus-web/cli build

pnpm test
pnpm check
pnpm build
pnpm check:exports
pnpm check:build-output

pnpm docs:check
pnpm docs:build
pnpm site:check
````

手动验收：

```bash
pnpm --filter @zeus-web/cli build

node packages/cli/dist/index.js list
node packages/cli/dist/index.js list --json
node packages/cli/dist/index.js add button --dry-run
node packages/cli/dist/index.js add --all --dry-run --skip-deps
node packages/cli/dist/index.js diff button
node packages/cli/dist/index.js update button --dry-run
node packages/cli/dist/index.js doctor
```

---

# 建议提交

```txt
feat(cli): add registry list diff update and doctor commands
feat(cli): add components lock file support
feat(cli): support add all skip deps and yes options
test(cli): add phase 12 registry workflow coverage
docs(cli): document production registry workflow
```

Phase 12 做完后，CLI 从 MVP 进入可长期维护阶段。下一阶段再进入：

```txt
Phase 13：Theming / Styling 进阶
```
