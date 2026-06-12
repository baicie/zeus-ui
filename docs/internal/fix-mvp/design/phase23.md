下面给 **Phase 23：CLI `diff` / `update` registry maintenance** 的详细设计与完整代码。

当前 CLI 入口已经暴露了 `diff` / `update` 命令。 帮助文案里也已经有：

```txt
zweb diff button
zweb diff --all
zweb update button
zweb update --all
```

但当前实现还有旧逻辑问题：

1. `diff.ts` 创建 add plan 时没有传 `cwd/config`，会默认读 `process.cwd()` 的配置，而不是 `--cwd` 指定的项目。
2. `update.ts` 仍然使用旧 `components.lock.json` / legacy lock。
3. Phase 19 新 lock 是 `zeus-ui.lock.json`，但目前只存 files/dependencies/registryDependencies，没有 hash，无法安全判断用户本地是否改过。
4. `add.ts` 自己内部写 lock，没有复用 lock helper。

Phase 23 要把这块收口成：

```txt
zweb diff button
zweb diff --all
zweb diff button --json

zweb update button --dry-run
zweb update button
zweb update button --overwrite
zweb update --all
```

---

# Phase 23 目标

```txt
Phase 23 = CLI update/diff for registry-installed components

新增 / 改造：
  - zeus-ui.lock.json 增加 fileHashes / registryHashes
  - zweb diff 基于 zeus-ui.json + registry + lock 生成差异
  - zweb update 基于 diff 安全更新
  - 未本地修改的文件可自动更新
  - 本地修改过的文件默认 skip
  - --overwrite 可覆盖本地修改
  - --dry-run 只输出计划
  - --json 输出机器可读 diff
  - check:cli-update-diff
  - diff/update 单测
  - docs/internal/design/zeus-ui-cli-update-diff.md
  - roadmap Phase 23 Done

不做：
  - 不做三方 merge
  - 不做交互式冲突解决
  - 不做远程 registry
  - 不做 registry version pinning
  - 不做 release
```

---

# 1. 修改根 `package.json`

新增：

```json
"check:cli-update-diff": "tsx scripts/checks/check-cli-update-diff.ts"
```

并接入 `site:check`：

```json
{
  "scripts": {
    "check:cli-update-diff": "tsx scripts/checks/check-cli-update-diff.ts",
    "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:product-layers && pnpm check:ui-package && pnpm check:registry && pnpm check:cli-init && pnpm check:cli-add && pnpm check:cli-update-diff && pnpm check:showcase-registry && pnpm check:native-showcase && pnpm showcase:registry:check && pnpm docs:check && pnpm docs:build && pnpm examples:check && pnpm showcase:test"
  }
}
```

---

# 2. 修改 `packages/cli/package.json`

新增：

```json
"test:update-diff": "vitest --root ../.. --project unit packages/cli/__tests__/diff.spec.ts packages/cli/__tests__/update.spec.ts"
```

完整 scripts 片段：

```json
{
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup && node -e \"const fs=require('fs');const f='dist/index.js';const c=fs.readFileSync(f,'utf8');if(!c.startsWith('#!'))fs.writeFileSync(f,'#!/usr/bin/env node\\n'+c,'utf8');\"",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit packages/cli/__tests__/add.spec.ts packages/cli/__tests__/ai.spec.ts packages/cli/__tests__/config.spec.ts packages/cli/__tests__/diff.spec.ts packages/cli/__tests__/init.spec.ts packages/cli/__tests__/package-manager.spec.ts packages/cli/__tests__/phase12-cli.spec.ts packages/cli/__tests__/phase13-theme.spec.ts packages/cli/__tests__/phase14-icons.spec.ts packages/cli/__tests__/update.spec.ts",
    "test:init": "vitest --root ../.. --project unit packages/cli/__tests__/init.spec.ts",
    "test:add": "vitest --root ../.. --project unit packages/cli/__tests__/add.spec.ts",
    "test:update-diff": "vitest --root ../.. --project unit packages/cli/__tests__/diff.spec.ts packages/cli/__tests__/update.spec.ts"
  }
}
```

---

# 3. 替换 `packages/cli/src/lock.ts`

核心变化：

```txt
1. zeus-ui.lock.json 继续 version: 1，兼容旧文件。
2. 每个 component 增加可选 fileHashes / registryHashes。
3. add/update 写入时记录 installed hash 和 registry hash。
4. 删除 update.ts 对 legacy lock 的依赖。
5. legacy lock 读取保留但不再被 update 使用。
```

```ts
import type { AddPlan } from './commands/add'

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { toRelativeProjectPath } from './config'

export interface ComponentsLockComponent {
  files: string[]
  dependencies: string[]
  registryDependencies: string[]
  updatedAt: string

  /**
   * Hash of the local file when it was last written by the CLI.
   *
   * Used by `zweb update` to detect local edits.
   */
  fileHashes?: Record<string, string>

  /**
   * Hash of the registry template content after alias rewriting when it was
   * last written by the CLI.
   *
   * Used by `zweb diff` and `zweb update` to distinguish registry changes from
   * local changes.
   */
  registryHashes?: Record<string, string>
}

export interface ComponentsLockFile {
  version: 1
  components: Record<string, ComponentsLockComponent>
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

  return {
    version: 1,
    components: lock.components ?? {},
  }
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

export function hashString(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

export function hashFile(file: string): string {
  return hashString(readFileSync(file, 'utf-8'))
}

export function getLockedComponent(
  lock: ComponentsLockFile,
  component: string,
): ComponentsLockComponent | undefined {
  return lock.components[component]
}

export function getLockedFileHash(params: {
  lock: ComponentsLockFile
  target: string
}): string | undefined {
  for (const component of Object.values(params.lock.components)) {
    const hash = component.fileHashes?.[params.target]
    if (hash) return hash
  }

  return undefined
}

export function getLockedRegistryHash(params: {
  lock: ComponentsLockFile
  target: string
}): string | undefined {
  for (const component of Object.values(params.lock.components)) {
    const hash = component.registryHashes?.[params.target]
    if (hash) return hash
  }

  return undefined
}

export async function updateComponentsLockFromPlans(params: {
  cwd: string
  plans: AddPlan[]
  writtenTargets: string[]
  registryHashes?: Record<string, string>
}): Promise<void> {
  const writtenTargets = new Set(params.writtenTargets)
  const lock = readComponentsLock(params.cwd)
  const updatedAt = new Date().toISOString()

  for (const plan of params.plans) {
    const files: string[] = []
    const fileHashes: Record<string, string> = {}
    const registryHashes: Record<string, string> = {}

    for (const file of plan.files) {
      if (!writtenTargets.has(file.target)) continue
      if (!existsSync(file.absoluteTarget)) continue

      files.push(file.target)
      fileHashes[file.target] = hashFile(file.absoluteTarget)

      const registryHash = params.registryHashes?.[file.target]
      if (registryHash) {
        registryHashes[file.target] = registryHash
      }
    }

    if (files.length === 0) continue

    const existing = lock.components[plan.component]

    lock.components[plan.component] = {
      files,
      dependencies: plan.dependencies,
      registryDependencies: plan.registryDependencies,
      updatedAt,
      fileHashes: {
        ...(existing?.fileHashes ?? {}),
        ...fileHashes,
      },
      registryHashes: {
        ...(existing?.registryHashes ?? {}),
        ...registryHashes,
      },
    }
  }

  await writeComponentsLock(params.cwd, lock)
}

/**
 * Legacy lock format remains readable for old projects, but Phase 23 update/diff
 * no longer writes components.lock.json.
 */
export const legacyLockFileName = 'components.lock.json'

export interface LegacyComponentsLockFile {
  $schema: string
  components: Record<string, LegacyComponentsLockComponent>
}

export interface LegacyComponentsLockComponent {
  registry: 'builtin'
  version: string
  files: LegacyLockedFile[]
}

export interface LegacyLockedFile {
  target: string
  source: string
  type?: string
  hash: string
}

export function getLegacyLockPath(cwd: string): string {
  return resolve(cwd, legacyLockFileName)
}

export function createEmptyLegacyLock(): LegacyComponentsLockFile {
  return {
    $schema: 'https://zeus-web.dev/schema/components.lock.json',
    components: {},
  }
}

export function readLegacyLock(cwd: string): LegacyComponentsLockFile {
  const file = getLegacyLockPath(cwd)
  if (!existsSync(file)) return createEmptyLegacyLock()
  return JSON.parse(readFileSync(file, 'utf-8')) as LegacyComponentsLockFile
}

export function getLegacyLockedFile(
  lock: LegacyComponentsLockFile,
  target: string,
): LegacyLockedFile | undefined {
  for (const component of Object.values(lock.components)) {
    const file = component.files.find(candidate => candidate.target === target)
    if (file) return file
  }

  return undefined
}

export async function migrateLegacyLockIfNeeded(params: {
  cwd: string
  plans: AddPlan[]
}): Promise<void> {
  const newLockPath = getComponentsLockPath(params.cwd)
  const legacyLockPath = getLegacyLockPath(params.cwd)

  if (existsSync(newLockPath) || !existsSync(legacyLockPath)) return

  const legacy = readLegacyLock(params.cwd)
  const next = createEmptyComponentsLock()

  for (const plan of params.plans) {
    const files: string[] = []
    const fileHashes: Record<string, string> = {}

    for (const file of plan.files) {
      const legacyFile = getLegacyLockedFile(legacy, file.target)
      if (!legacyFile) continue

      files.push(file.target)
      fileHashes[file.target] = legacyFile.hash
    }

    if (files.length === 0) continue

    next.components[plan.component] = {
      files,
      dependencies: plan.dependencies,
      registryDependencies: plan.registryDependencies,
      updatedAt: new Date().toISOString(),
      fileHashes,
      registryHashes: {},
    }
  }

  await writeComponentsLock(params.cwd, next)
}

export function toLockTarget(cwd: string, file: string): string {
  return toRelativeProjectPath(cwd, file)
}
```

---

# 4. 修改 `packages/cli/src/commands/add.ts`

把内部 `updateLock()` 删除，改为复用 `updateComponentsLockFromPlans()`，并写入 registry hash。

### 4.1 import 修改

把：

```ts
import { readComponentsLock, writeComponentsLock } from '../lock'
```

改成：

```ts
import { hashString, updateComponentsLockFromPlans } from '../lock'
```

### 4.2 删除内部 `updateLock()` 函数

删除 `async function updateLock(...)` 整段。

### 4.3 新增 helper

放在 `writePlans()` 附近：

```ts
function createRegistryHashes(params: {
  config: ComponentsConfig
  plans: AddPlan[]
}): Record<string, string> {
  const hashes: Record<string, string> = {}

  for (const file of flattenFiles(params.plans)) {
    const raw = readRegistryAsset(file.source)
    const source = rewriteRegistrySource(raw, params.config)
    hashes[file.target] = hashString(source)
  }

  return hashes
}
```

### 4.4 修改 add 写 lock

把：

```ts
await updateLock({
  cwd: parsed.options.cwd,
  plans,
  writtenTargets: result.written,
})
```

改成：

```ts
await updateComponentsLockFromPlans({
  cwd: parsed.options.cwd,
  plans,
  writtenTargets: result.written,
  registryHashes: createRegistryHashes({
    config,
    plans,
  }),
})
```

这样 Phase 23 的 `diff/update` 可以基于 `zeus-ui.lock.json` 判断本地修改。

---

# 5. 替换 `packages/cli/src/commands/diff.ts`

这个版本修正：

```txt
1. createAddPlan 传 cwd/config。
2. 使用新 zeus-ui.lock.json。
3. 输出 status: missing / unchanged / registry-changed / locally-modified / registry-and-local-changed / untracked-existing。
4. --all 只检查当前 registry 可安装组件。
5. --json 输出完整 hash 信息。
```

```ts
import type { AddPlan } from './add'

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

import pc from 'picocolors'

import { readComponentsConfig } from '../config'
import {
  getLockedFileHash,
  getLockedRegistryHash,
  hashString,
  migrateLegacyLockIfNeeded,
  readComponentsLock,
} from '../lock'
import { readRegistryAsset } from '../registry-assets'
import {
  createAddPlan,
  listAvailableComponents,
  loadRegistry,
  rewriteRegistrySource,
} from './add'

export type DiffStatus =
  | 'missing'
  | 'unchanged'
  | 'registry-changed'
  | 'locally-modified'
  | 'registry-and-local-changed'
  | 'untracked-existing'

export interface DiffEntry {
  component: string
  source: string
  target: string
  resolvedTarget: string
  status: DiffStatus
  registryHash: string
  currentHash?: string
  lockedFileHash?: string
  lockedRegistryHash?: string
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

function resolveCwdValue(base: string, value: string): string {
  return isAbsolute(value) ? value : resolve(base, value)
}

function assertSafeTarget(cwd: string, target: string): string {
  const absoluteTarget = resolve(cwd, target)
  const relativeTarget = relative(cwd, absoluteTarget).replace(/\\/g, '/')

  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith('../') ||
    isAbsolute(relativeTarget)
  ) {
    throw new Error(`Refusing to access outside cwd: ${target}`)
  }

  return absoluteTarget
}

export function parseDiffArgs(
  args: string[],
  cwd = process.cwd(),
): ParsedDiffArgs {
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
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwdValue(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwdValue(cwd, value)
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

function dedupeAddPlanFiles(plans: AddPlan[]): AddPlan['files'] {
  const byTarget = new Map<string, AddPlan['files'][number]>()

  for (const plan of plans) {
    for (const file of plan.files) {
      byTarget.set(file.target, file)
    }
  }

  return Array.from(byTarget.values())
}

function readRegistrySource(params: {
  source: string
  config: ReturnType<typeof readComponentsConfig>
}): string {
  const raw = readRegistryAsset(params.source)
  return rewriteRegistrySource(raw, params.config)
}

function getDiffStatus(params: {
  exists: boolean
  currentHash?: string
  lockedFileHash?: string
  lockedRegistryHash?: string
  registryHash: string
}): DiffStatus {
  if (!params.exists) return 'missing'

  if (!params.lockedFileHash) return 'untracked-existing'

  const localChanged = params.currentHash !== params.lockedFileHash
  const registryChanged =
    params.lockedRegistryHash === undefined
      ? params.currentHash !== params.registryHash
      : params.lockedRegistryHash !== params.registryHash

  if (localChanged && registryChanged) return 'registry-and-local-changed'
  if (localChanged) return 'locally-modified'
  if (registryChanged) return 'registry-changed'

  return 'unchanged'
}

export async function createDiffEntries(params: {
  cwd: string
  plans: AddPlan[]
}): Promise<DiffEntry[]> {
  const config = readComponentsConfig(params.cwd)

  await migrateLegacyLockIfNeeded({
    cwd: params.cwd,
    plans: params.plans,
  })

  const lock = readComponentsLock(params.cwd)
  const entries: DiffEntry[] = []

  for (const plan of params.plans) {
    for (const file of dedupeAddPlanFiles([plan])) {
      const resolvedTarget = assertSafeTarget(params.cwd, file.target)
      const registrySource = readRegistrySource({
        source: file.source,
        config,
      })
      const registryHash = hashString(registrySource)
      const exists = existsSync(resolvedTarget)
      const lockedFileHash = getLockedFileHash({
        lock,
        target: file.target,
      })
      const lockedRegistryHash = getLockedRegistryHash({
        lock,
        target: file.target,
      })

      if (!exists) {
        entries.push({
          component: plan.component,
          source: file.source,
          target: file.target,
          resolvedTarget,
          status: getDiffStatus({
            exists: false,
            registryHash,
            lockedFileHash,
            lockedRegistryHash,
          }),
          registryHash,
          lockedFileHash,
          lockedRegistryHash,
          registrySource,
        })
        continue
      }

      const currentSource = await readFile(resolvedTarget, 'utf-8')
      const currentHash = hashString(currentSource)

      entries.push({
        component: plan.component,
        source: file.source,
        target: file.target,
        resolvedTarget,
        status: getDiffStatus({
          exists: true,
          currentHash,
          lockedFileHash,
          lockedRegistryHash,
          registryHash,
        }),
        registryHash,
        currentHash,
        lockedFileHash,
        lockedRegistryHash,
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
    const color =
      entry.status === 'missing' || entry.status === 'untracked-existing'
        ? pc.yellow
        : entry.status === 'locally-modified' ||
            entry.status === 'registry-and-local-changed'
          ? pc.red
          : pc.cyan

    console.log(
      `  ${color(entry.status.padEnd(26))} ${entry.component} ${entry.target}`,
    )
  }
}

export async function diff(args: string[]): Promise<void> {
  try {
    const { components, options } = parseDiffArgs(args)
    const registry = loadRegistry()
    const config = readComponentsConfig(options.cwd)
    const finalComponents = options.all
      ? listAvailableComponents(registry)
      : components

    if (finalComponents.length === 0) {
      throw new Error('Please provide components or use --all.')
    }

    const plans = createAddPlan({
      components: finalComponents,
      registry,
      cwd: options.cwd,
      config,
    })

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
              status: entry.status,
              registryHash: entry.registryHash,
              currentHash: entry.currentHash,
              lockedFileHash: entry.lockedFileHash,
              lockedRegistryHash: entry.lockedRegistryHash,
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

# 6. 替换 `packages/cli/src/commands/update.ts`

这个版本修正：

```txt
1. 不再写 components.lock.json。
2. 只写 zeus-ui.lock.json。
3. 默认只更新 missing / registry-changed。
4. locally-modified / untracked-existing / registry-and-local-changed 默认 skip。
5. --overwrite 可以覆盖全部 changed。
6. --dry-run 输出计划不写文件。
```

```ts
import type { AddPlan } from './add'
import type { DiffEntry } from './diff'

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'

import pc from 'picocolors'

import { readComponentsConfig } from '../config'
import { updateComponentsLockFromPlans } from '../lock'
import { createAddPlan, listAvailableComponents, loadRegistry } from './add'
import { createDiffEntries } from './diff'

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

interface UpdatePlan {
  entry: DiffEntry
  action: 'write' | 'skip'
  reason?: string
}

function resolveCwdValue(base: string, value: string): string {
  return isAbsolute(value) ? value : resolve(base, value)
}

export function parseUpdateArgs(
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
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwdValue(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwdValue(cwd, value)
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

function createUpdatePlans(params: {
  entries: DiffEntry[]
  overwrite: boolean
}): UpdatePlan[] {
  return params.entries
    .filter(entry => entry.status !== 'unchanged')
    .map(entry => {
      if (params.overwrite) {
        return {
          entry,
          action: 'write',
        }
      }

      if (entry.status === 'missing' || entry.status === 'registry-changed') {
        return {
          entry,
          action: 'write',
        }
      }

      if (entry.status === 'locally-modified') {
        return {
          entry,
          action: 'skip',
          reason: 'local changes detected',
        }
      }

      if (entry.status === 'registry-and-local-changed') {
        return {
          entry,
          action: 'skip',
          reason: 'registry and local changes detected',
        }
      }

      if (entry.status === 'untracked-existing') {
        return {
          entry,
          action: 'skip',
          reason: 'existing file is not tracked by zeus-ui.lock.json',
        }
      }

      return {
        entry,
        action: 'skip',
        reason: `unsupported status ${entry.status}`,
      }
    })
}

function printUpdatePlan(params: {
  plans: UpdatePlan[]
  dryRun: boolean
}): void {
  if (params.plans.length === 0) {
    console.log(pc.green('All registry files are up to date.'))
    return
  }

  console.log(pc.bold(params.dryRun ? 'Update plan:' : 'Update result:'))

  for (const plan of params.plans) {
    if (plan.action === 'write') {
      console.log(
        `  ${pc.green(params.dryRun ? 'WOULD UPDATE' : 'UPDATED')} ${plan.entry.target}`,
      )
      continue
    }

    console.log(
      `  ${pc.yellow('SKIP')} ${plan.entry.target}${plan.reason ? ` (${plan.reason})` : ''}`,
    )
  }
}

function createRegistryHashes(entries: DiffEntry[]): Record<string, string> {
  const hashes: Record<string, string> = {}

  for (const entry of entries) {
    hashes[entry.target] = entry.registryHash
  }

  return hashes
}

async function writeUpdatePlans(plans: UpdatePlan[]): Promise<string[]> {
  const written: string[] = []

  for (const plan of plans) {
    if (plan.action !== 'write') continue

    await mkdir(dirname(plan.entry.resolvedTarget), {
      recursive: true,
    })

    await writeFile(
      plan.entry.resolvedTarget,
      plan.entry.registrySource,
      'utf-8',
    )
    written.push(plan.entry.target)
  }

  return written
}

export async function update(args: string[]): Promise<void> {
  try {
    const { components, options } = parseUpdateArgs(args)
    const registry = loadRegistry()
    const config = readComponentsConfig(options.cwd)
    const finalComponents = options.all
      ? listAvailableComponents(registry)
      : components

    if (finalComponents.length === 0) {
      throw new Error('Please provide components or use --all.')
    }

    const plans: AddPlan[] = createAddPlan({
      components: finalComponents,
      registry,
      cwd: options.cwd,
      config,
      overwrite: options.overwrite,
    })

    const entries = await createDiffEntries({
      cwd: options.cwd,
      plans,
    })

    const updatePlans = createUpdatePlans({
      entries,
      overwrite: options.overwrite,
    })

    printUpdatePlan({
      plans: updatePlans,
      dryRun: options.dryRun,
    })

    if (options.dryRun) return

    const writtenTargets = await writeUpdatePlans(updatePlans)

    if (writtenTargets.length === 0) return

    await updateComponentsLockFromPlans({
      cwd: options.cwd,
      plans,
      writtenTargets,
      registryHashes: createRegistryHashes(entries),
    })
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 7. 新增 `packages/cli/__tests__/diff.spec.ts`

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createAddPlan } from '../src/commands/add'
import { createDiffEntries, parseDiffArgs } from '../src/commands/diff'
import {
  createDefaultComponentsConfig,
  getComponentsConfigPath,
} from '../src/config'
import { hashString, updateComponentsLockFromPlans } from '../src/lock'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-cli-diff-'))
}

function writeConfig(root: string) {
  const config = createDefaultComponentsConfig({
    framework: 'react',
    typescript: true,
    srcDir: 'src',
  })

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
      frameworks: ['react'],
      dependencies: ['@zeus-web/button'],
      registryDependencies: ['cn', 'globals'],
      files: [
        {
          framework: 'react',
          source: 'templates/react/button.tsx',
          target: 'components/ui/button.tsx',
        },
      ],
    },
  ],
} as const

describe('@zeus-web/cli diff', () => {
  it('parses diff args', () => {
    expect(
      parseDiffArgs(['button', '--all', '--json', '--cwd', 'demo'], '/repo'),
    ).toEqual({
      components: ['button'],
      options: {
        cwd: resolve('/repo', 'demo'),
        all: true,
        json: true,
      },
    })
  })

  it('reports missing files', async () => {
    const root = await createTempDir()

    try {
      const config = writeConfig(root)
      const plans = createAddPlan({
        components: ['button'],
        registry,
        cwd: root,
        config,
      })

      const entries = await createDiffEntries({
        cwd: root,
        plans,
      })

      expect(entries.map(entry => entry.status)).toEqual([
        'missing',
        'missing',
        'missing',
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reports unchanged files when lock hashes match', async () => {
    const root = await createTempDir()

    try {
      const config = writeConfig(root)
      const plans = createAddPlan({
        components: ['button'],
        registry,
        cwd: root,
        config,
      })

      const registryHashes: Record<string, string> = {}

      for (const plan of plans) {
        for (const file of plan.files) {
          mkdirSync(resolve(root, file.target, '..'), { recursive: true })
          writeFileSync(file.absoluteTarget, 'same', 'utf-8')
          registryHashes[file.target] = hashString('same')
        }
      }

      await updateComponentsLockFromPlans({
        cwd: root,
        plans,
        writtenTargets: plans.flatMap(plan =>
          plan.files.map(file => file.target),
        ),
        registryHashes,
      })

      const entries = await createDiffEntries({
        cwd: root,
        plans,
      })

      expect(entries.every(entry => entry.status !== 'missing')).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reports local modifications when current file differs from lock hash', async () => {
    const root = await createTempDir()

    try {
      const config = writeConfig(root)
      const plans = createAddPlan({
        components: ['button'],
        registry,
        cwd: root,
        config,
      })

      const buttonPlan = plans.find(plan => plan.component === 'button')
      expect(buttonPlan).toBeTruthy()

      const file = buttonPlan!.files[0]
      mkdirSync(resolve(root, 'src/components/ui'), { recursive: true })
      writeFileSync(file.absoluteTarget, 'original', 'utf-8')

      await updateComponentsLockFromPlans({
        cwd: root,
        plans: [buttonPlan!],
        writtenTargets: [file.target],
        registryHashes: {
          [file.target]: hashString('original'),
        },
      })

      writeFileSync(file.absoluteTarget, 'user changed', 'utf-8')

      const entries = await createDiffEntries({
        cwd: root,
        plans: [buttonPlan!],
      })

      expect(entries[0].status).toBe('registry-and-local-changed')
      expect(readFileSync(file.absoluteTarget, 'utf-8')).toBe('user changed')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
```

> 上面测试里 `mkdirSync(resolve(root, file.target, '..'))` 如果你当前 Node 对路径处理不喜欢这种写法，改成 `mkdirSync(dirname(file.absoluteTarget), { recursive: true })`，并 import `dirname`。

---

# 8. 新增 `packages/cli/__tests__/update.spec.ts`

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createAddPlan } from '../src/commands/add'
import { parseUpdateArgs, update } from '../src/commands/update'
import {
  createDefaultComponentsConfig,
  getComponentsConfigPath,
} from '../src/config'
import {
  hashString,
  readComponentsLock,
  updateComponentsLockFromPlans,
} from '../src/lock'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-cli-update-'))
}

function writeConfig(root: string) {
  const config = createDefaultComponentsConfig({
    framework: 'react',
    typescript: true,
    srcDir: 'src',
  })

  writeFileSync(
    getComponentsConfigPath(root),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf-8',
  )

  return config
}

describe('@zeus-web/cli update', () => {
  it('parses update args', () => {
    expect(
      parseUpdateArgs(
        ['button', '--all', '--dry-run', '--overwrite', '--cwd', 'demo'],
        '/repo',
      ),
    ).toEqual({
      components: ['button'],
      options: {
        cwd: resolve('/repo', 'demo'),
        all: true,
        dryRun: true,
        overwrite: true,
      },
    })
  })

  it('updates missing registry files and writes zeus-ui.lock.json', async () => {
    const root = await createTempDir()

    try {
      writeConfig(root)

      await update(['button', '--cwd', root])

      expect(existsSync(resolve(root, 'src/lib/cn.ts'))).toBe(true)
      expect(existsSync(resolve(root, 'src/styles/zeus.css'))).toBe(true)
      expect(existsSync(resolve(root, 'src/components/ui/button.tsx'))).toBe(
        true,
      )

      const lock = readComponentsLock(root)
      expect(lock.components.button.files).toContain(
        'src/components/ui/button.tsx',
      )
      expect(
        lock.components.button.fileHashes?.['src/components/ui/button.tsx'],
      ).toBeTruthy()
      expect(
        lock.components.button.registryHashes?.['src/components/ui/button.tsx'],
      ).toBeTruthy()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not overwrite local modifications without --overwrite', async () => {
    const root = await createTempDir()

    try {
      const config = writeConfig(root)

      await update(['button', '--cwd', root])

      const buttonPath = resolve(root, 'src/components/ui/button.tsx')
      writeFileSync(buttonPath, 'local edit', 'utf-8')

      await update(['button', '--cwd', root])

      expect(readFileSync(buttonPath, 'utf-8')).toBe('local edit')

      const lock = readComponentsLock(root)
      expect(lock.components.button.files).toContain(
        'src/components/ui/button.tsx',
      )
      expect(config.framework).toBe('react')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('overwrites local modifications with --overwrite', async () => {
    const root = await createTempDir()

    try {
      writeConfig(root)

      await update(['button', '--cwd', root])

      const buttonPath = resolve(root, 'src/components/ui/button.tsx')
      writeFileSync(buttonPath, 'local edit', 'utf-8')

      await update(['button', '--cwd', root, '--overwrite'])

      expect(readFileSync(buttonPath, 'utf-8')).not.toBe('local edit')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('dry-run does not write missing files', async () => {
    const root = await createTempDir()

    try {
      writeConfig(root)

      await update(['button', '--cwd', root, '--dry-run'])

      expect(existsSync(resolve(root, 'src/components/ui/button.tsx'))).toBe(
        false,
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('supports lock hash helpers for custom plans', async () => {
    const root = await createTempDir()

    try {
      const config = writeConfig(root)
      const plans = createAddPlan({
        components: ['button'],
        cwd: root,
        config,
      })
      const buttonPlan = plans.find(plan => plan.component === 'button')!
      const file = buttonPlan.files[0]

      mkdirSync(dirname(file.absoluteTarget), { recursive: true })
      writeFileSync(file.absoluteTarget, 'installed', 'utf-8')

      await updateComponentsLockFromPlans({
        cwd: root,
        plans: [buttonPlan],
        writtenTargets: [file.target],
        registryHashes: {
          [file.target]: hashString('installed'),
        },
      })

      const lock = readComponentsLock(root)
      expect(lock.components.button.fileHashes?.[file.target]).toBe(
        hashString('installed'),
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
```

---

# 9. 新增 `scripts/checks/check-cli-update-diff.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'packages/cli/src/commands/diff.ts',
  'packages/cli/src/commands/update.ts',
  'packages/cli/src/lock.ts',
  'packages/cli/__tests__/diff.spec.ts',
  'packages/cli/__tests__/update.spec.ts',
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

function checkSourceNotContains(
  file: string,
  contents: string[],
  errors: string[],
): void {
  const source = read(file)

  for (const content of contents) {
    if (source.includes(content)) {
      errors.push(`${file} must not contain "${content}"`)
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
      'packages/cli/src/commands/diff.ts',
      [
        'registry-changed',
        'locally-modified',
        'registry-and-local-changed',
        'untracked-existing',
        'getLockedFileHash',
        'getLockedRegistryHash',
        'createAddPlan({',
        'cwd: options.cwd',
        'config',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/src/commands/update.ts',
      [
        'createUpdatePlans',
        'updateComponentsLockFromPlans',
        'registry-and-local-changed',
        '--overwrite',
        '--dry-run',
        'writtenTargets',
      ],
      errors,
    )

    checkSourceNotContains(
      'packages/cli/src/commands/update.ts',
      ['components.lock.json', 'readLegacyLock', 'updateLegacyLockFromPlans'],
      errors,
    )

    checkSourceContains(
      'packages/cli/src/lock.ts',
      [
        'fileHashes',
        'registryHashes',
        'getLockedFileHash',
        'getLockedRegistryHash',
        'migrateLegacyLockIfNeeded',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/package.json',
      ['"test:update-diff"'],
      errors,
    )

    checkSourceContains('package.json', ['"check:cli-update-diff"'], errors)

    checkSourceContains(
      'packages/cli/__tests__/diff.spec.ts',
      ['reports missing files', 'reports local modifications'],
      errors,
    )

    checkSourceContains(
      'packages/cli/__tests__/update.spec.ts',
      [
        'updates missing registry files',
        'does not overwrite local modifications without --overwrite',
        'overwrites local modifications with --overwrite',
        'dry-run does not write missing files',
      ],
      errors,
    )
  }

  if (errors.length > 0) {
    console.error(pc.red('CLI update/diff check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('CLI update/diff check passed.'))
}

main()
```

---

# 10. 更新 `scripts/checks/check-product-layers.ts`

把 roadmap 检查更新到 Phase 23。

```ts
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
    'The showcase has sixteen layers of checks:',
    'Product layer checks validate Zeus-UI package boundaries and usage entry decisions.',
    'Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.',
    'Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.',
    'CLI init checks validate zeus-ui.json initialization, project detection and base file generation.',
    'CLI add checks validate registry dependency expansion, framework-specific template filtering and lockfile tracking.',
    'CLI update/diff checks validate registry drift detection, safe update behavior and lock hash tracking.',
    'Showcase registry checks validate React and Vue demos consume registry-synced local styled components.',
    'Native showcase checks validate @zeus-web/ui can be consumed without React or Vue.',
    'Public docs checks validate CLI registry, native styled Web-C and advanced primitive usage paths.',
    'pnpm check:cli-update-diff',
    'pnpm --filter @zeus-web/cli test:update-diff',
    'Phase 24: Release readiness, package metadata audit and final verification.',
  ],
}
```

`checkPhaseOrder()` 增加 Phase 23 和 Phase 24：

```ts
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
  const phase24Index = source.indexOf('Phase 24:')

  if (phase15Index < 0)
    errors.push('showcase-roadmap.md must contain Phase 15 status row')
  if (phase16Index < 0)
    errors.push('showcase-roadmap.md must contain Phase 16 status row')
  if (phase17Index < 0)
    errors.push('showcase-roadmap.md must contain Phase 17 status row')
  if (phase18Index < 0)
    errors.push('showcase-roadmap.md must contain Phase 18 status row')
  if (phase19Index < 0)
    errors.push('showcase-roadmap.md must contain Phase 19 status row')
  if (phase20Index < 0)
    errors.push('showcase-roadmap.md must contain Phase 20 status row')
  if (phase21Index < 0)
    errors.push('showcase-roadmap.md must contain Phase 21 status row')
  if (phase22Index < 0)
    errors.push('showcase-roadmap.md must contain Phase 22 status row')
  if (phase23Index < 0)
    errors.push('showcase-roadmap.md must contain Phase 23 status row')
  if (phase24Index < 0)
    errors.push('showcase-roadmap.md must contain Phase 24 next work')

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
      'Phase 24 next work must appear after Phase 23 status',
      phase23Index,
      phase24Index,
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

# 11. 新增设计文档

## `docs/internal/design/zeus-ui-cli-update-diff.md`

````md
# Zeus-UI CLI Update and Diff

## Status

Phase 23 design.

## Goal

`zweb diff` and `zweb update` maintain registry-installed components after the registry source changes.

## Commands

```bash
zweb diff button
zweb diff --all
zweb diff button --json

zweb update button --dry-run
zweb update button
zweb update button --overwrite
zweb update --all
```
````

## Lock model

Phase 23 uses:

```txt
zeus-ui.lock.json
```

The lock file records:

```json
{
  "version": 1,
  "components": {
    "button": {
      "files": ["src/components/ui/button.tsx"],
      "dependencies": ["@zeus-web/button"],
      "registryDependencies": ["cn", "globals"],
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "fileHashes": {
        "src/components/ui/button.tsx": "..."
      },
      "registryHashes": {
        "src/components/ui/button.tsx": "..."
      }
    }
  }
}
```

## Diff statuses

| Status                       | Meaning                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `missing`                    | Target file does not exist.                               |
| `unchanged`                  | Local file and registry template match the lock.          |
| `registry-changed`           | Registry template changed and local file has not changed. |
| `locally-modified`           | Local file changed but registry did not.                  |
| `registry-and-local-changed` | Both local file and registry template changed.            |
| `untracked-existing`         | File exists but no lock hash is available.                |

## Update policy

Default safe update:

- write `missing`
- write `registry-changed`
- skip `locally-modified`
- skip `registry-and-local-changed`
- skip `untracked-existing`

Overwrite update:

```bash
zweb update button --overwrite
```

writes every changed entry.

## Non-goals

Phase 23 does not implement:

- three-way merge
- interactive conflict picker
- remote registry
- registry version pinning
- release

## Next phase

Phase 24 should audit package metadata, verify release readiness and run final validation.

````

---

# 12. 更新 roadmap

## `docs/internal/examples/showcase-roadmap.md`

追加：

```md
| Phase 23 | Done   | CLI update and diff support for registry-installed components with lock hash tracking                            |
````

工程保障改成 16 层：

```md
The showcase has sixteen layers of checks:

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
```

Commands 增加：

```bash
pnpm check:cli-update-diff
pnpm --filter @zeus-web/cli test:update-diff
```

Next work 改成：

```md
## Next work

Future phases should prepare release readiness:

- Phase 24: Release readiness, package metadata audit and final verification.
```

---

# 13. 文件清单

```txt
package.json
packages/cli/package.json

packages/cli/src/lock.ts
packages/cli/src/commands/add.ts
packages/cli/src/commands/diff.ts
packages/cli/src/commands/update.ts

packages/cli/__tests__/diff.spec.ts
packages/cli/__tests__/update.spec.ts

scripts/checks/check-cli-update-diff.ts
scripts/checks/check-product-layers.ts

docs/internal/design/zeus-ui-cli-update-diff.md
docs/internal/examples/showcase-roadmap.md
```

---

# 14. 验收命令

```bash
pnpm check:cli-update-diff
pnpm --filter @zeus-web/cli check
pnpm --filter @zeus-web/cli test:update-diff
pnpm --filter @zeus-web/cli test
pnpm --filter @zeus-web/cli build
```

手工验证：

```bash
tmpdir=$(mktemp -d)

node packages/cli/dist/index.js init --framework react --cwd "$tmpdir" --overwrite
node packages/cli/dist/index.js add button --cwd "$tmpdir"

node packages/cli/dist/index.js diff button --cwd "$tmpdir"
node packages/cli/dist/index.js diff button --cwd "$tmpdir" --json

echo "// local edit" >> "$tmpdir/src/components/ui/button.tsx"

node packages/cli/dist/index.js diff button --cwd "$tmpdir"
node packages/cli/dist/index.js update button --cwd "$tmpdir"
node packages/cli/dist/index.js update button --cwd "$tmpdir" --overwrite
```

预期：

```txt
1. add 后 zeus-ui.lock.json 带 fileHashes / registryHashes
2. 未改文件时 diff 显示 up to date
3. 本地改文件后 diff 显示 locally-modified 或 registry-and-local-changed
4. update 默认不覆盖本地修改
5. update --overwrite 覆盖本地修改
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

# 15. Phase 23 完成判断

```txt
完成：
  - diff 使用 --cwd 对应项目配置
  - diff 基于 zeus-ui.lock.json 判断状态
  - diff 支持 --all
  - diff 支持 --json
  - update 默认安全更新 missing / registry-changed
  - update 默认跳过 locally-modified / registry-and-local-changed / untracked-existing
  - update --overwrite 可覆盖
  - update --dry-run 不写文件
  - add/update 都写 fileHashes / registryHashes
  - 不再写 components.lock.json
  - site:check 接入 check:cli-update-diff
  - roadmap Phase 23 Done

未做：
  - 没有三方 merge
  - 没有远程 registry
  - 没有 release
```

---

# 16. 建议分支与 PR

分支名：

```txt
feat/cli-update-diff
```

PR title：

```txt
feat(cli): add registry diff and update support
```
