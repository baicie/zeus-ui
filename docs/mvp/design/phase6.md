下面给 **Phase 6：CLI Add Copy MVP** 的详细设计与完整代码。

基于当前 `mvp` / `a4580d7` 状态，Phase 5 已经把 `registry.json`、`default` 模板源码、registry 校验、CLI add plan 都落地了。`@zeus-web/registry` 已经把 `default` 模板目录加入发布文件列表，所以 CLI 可以从安装后的 registry 包里读取模板源码。
但当前 `zweb add` 还只是打印计划，不会复制文件。`add.ts` 里现在也仍然手写了一份 `registryItems`，这和 `registry.json` 双写，后续容易漂移。

# Phase 6 目标

```txt
Phase 6：CLI Add Copy MVP

目标：
1. zweb add button/input/dialog 能真实复制 registry 文件到用户项目。
2. add plan 从 @zeus-web/registry/registry.json 派生，不再在 CLI 里双写。
3. 支持 --dry-run。
4. 支持 --overwrite。
5. 支持 --cwd <dir>。
6. 多组件添加时自动去重 lib/utils.ts。
7. 默认不覆盖用户已有文件。
8. 默认不自动安装依赖，只输出推荐安装命令。
```

Phase 6 暂时不做：

```txt
不执行 pnpm add。
不自动检测 npm/yarn/pnpm/bun。
不合并 global.css。
不处理 components.json alias。
不做远程 registry 拉取。
```

这些放到 Phase 7 更合适。

---

# 1. Phase 6 文件变更

```txt
修改：
  packages/cli/package.json
  packages/cli/src/index.ts
  packages/cli/src/commands/add.ts
  packages/cli/__tests__/add.spec.ts
```

可选新增暂时不需要；为了控制复杂度，Phase 6 可以只改这 4 个文件。

---

# 2. `packages/cli/package.json`

当前 CLI 只有 `picocolors` 依赖。
Phase 6 需要运行时读取 `@zeus-web/registry/registry.json` 和 `default` 模板源码，所以要加 `@zeus-web/registry`。

替换完整文件：

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
    "test": "vitest --root ../.. --project unit packages/cli/__tests__/add.spec.ts"
  },
  "dependencies": {
    "@zeus-web/registry": "workspace:*",
    "picocolors": "^1.1.1"
  }
}
```

---

# 3. `packages/cli/src/commands/add.ts`

替换完整文件。

这个版本做了几件事：

```txt
1. loadRegistry() 从 @zeus-web/registry/registry.json 读取 registry。
2. createAddPlan() 从 registry items 生成计划。
3. executeAddPlan() 真实复制文件。
4. --dry-run 只打印，不写文件。
5. --overwrite 才覆盖已有文件。
6. 多组件 add 时按 target 去重，避免重复写 lib/utils.ts。
7. add 完成后输出推荐安装命令。
```

```ts
import type {
  Registry,
  RegistryItem,
  RegistryItemFile,
} from '@zeus-web/registry'

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

import pc from 'picocolors'
import { validateRegistry } from '@zeus-web/registry'

export interface RegistryFilePlan {
  source: string
  target: string
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
}

export interface AddExecutionResult {
  written: string[]
  skipped: string[]
  dependencies: string[]
  devDependencies: string[]
}

interface ParsedAddArgs {
  components: string[]
  options: AddOptions
}

const require = createRequire(import.meta.url)

function resolveRegistryJsonPath(): string {
  return require.resolve('@zeus-web/registry/registry.json')
}

function resolveRegistryRoot(): string {
  return dirname(resolveRegistryJsonPath())
}

export function loadRegistry(): Registry {
  const registry = require('@zeus-web/registry/registry.json') as Registry
  const result = validateRegistry(registry)

  if (!result.valid) {
    throw new Error(
      [
        'Invalid @zeus-web/registry/registry.json:',
        ...result.errors.map(error => `- ${error}`),
      ].join('\n'),
    )
  }

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
  const item = registry.items.find(item => item.name === component)

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
  return registry.items
    .filter(item => item.type === 'registry:ui')
    .map(item => item.name)
}

export function createAddPlan(
  components: string[],
  registry = loadRegistry(),
): AddPlan[] {
  const plans = components.map(component => {
    const item = findRegistryItem(registry, component)
    return toAddPlan(item)
  })

  return dedupePlans(plans)
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

export function parseAddArgs(
  args: string[],
  cwd = process.cwd(),
): ParsedAddArgs {
  const components: string[] = []
  const options: AddOptions = {
    cwd,
    dryRun: false,
    overwrite: false,
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
  const relativeTarget = relative(cwd, absoluteTarget)

  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith(`..${String.fromCharCode(47)}`) ||
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
}): Promise<'written' | 'skipped'> {
  const sourcePath = resolve(params.registryRoot, params.file.source)
  const targetPath = assertSafeTarget(params.cwd, params.file.target)

  if (!existsSync(sourcePath)) {
    throw new Error(
      `Registry source file does not exist: ${params.file.source}`,
    )
  }

  if (existsSync(targetPath) && !params.overwrite) {
    return 'skipped'
  }

  if (params.dryRun) {
    return 'written'
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
  const written: string[] = []
  const skipped: string[] = []
  const seenTargets = new Set<string>()

  for (const plan of plans) {
    for (const file of plan.files) {
      if (seenTargets.has(file.target)) {
        continue
      }

      seenTargets.add(file.target)

      const result = await copyRegistryFile({
        registryRoot,
        cwd: options.cwd,
        file,
        dryRun: options.dryRun,
        overwrite: options.overwrite,
      })

      if (result === 'written') {
        written.push(file.target)
      } else {
        skipped.push(file.target)
      }
    }
  }

  const installPlan = createCombinedInstallPlan(plans)

  return {
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
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 4. `packages/cli/src/index.ts`

当前 help 只有 `zweb add input`。
Phase 6 要把新参数写清楚。

替换完整文件：

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
  console.log('  zweb add button')
  console.log('  zweb add button input dialog')
  console.log('')
  console.log('Options:')
  console.log('  --cwd <dir>     Write files into a specific project directory')
  console.log('  --dry-run       Print the plan without writing files')
  console.log('  --overwrite     Replace existing files')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
```

---

# 5. `packages/cli/__tests__/add.spec.ts`

替换完整文件。

这个测试覆盖：

```txt
1. 从 registry 生成 add plan。
2. 多组件依赖合并去重。
3. dry-run 不写文件。
4. 真实复制文件。
5. 默认不覆盖。
6. --overwrite 覆盖。
7. 防止写出 cwd。
```

```ts
import type { Registry } from '@zeus-web/registry'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  createAddPlan,
  createCombinedInstallPlan,
  executeAddPlan,
  listAvailableComponents,
  parseAddArgs,
} from '../src/commands/add'

const registry: Registry = {
  $schema: 'https://zeus-web.dev/schema/registry.json',
  name: '@zeus-web/registry',
  homepage: 'https://zeus-web.dev',
  items: [
    {
      name: 'input',
      type: 'registry:ui',
      description: 'Text input styled component.',
      dependencies: [
        '@zeus-web/input',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
      files: [
        {
          path: 'default/lib/utils.ts',
          target: 'lib/utils.ts',
          type: 'registry:lib',
        },
        {
          path: 'default/input.tsx',
          target: 'components/ui/input.tsx',
          type: 'registry:ui',
        },
      ],
    },
    {
      name: 'button',
      type: 'registry:ui',
      description: 'Button styled component.',
      dependencies: [
        '@zeus-web/button',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
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
    {
      name: 'dialog',
      type: 'registry:ui',
      description: 'Dialog styled component.',
      dependencies: [
        '@zeus-web/dialog',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
      files: [
        {
          path: 'default/lib/utils.ts',
          target: 'lib/utils.ts',
          type: 'registry:lib',
        },
        {
          path: 'default/dialog.tsx',
          target: 'components/ui/dialog.tsx',
          type: 'registry:ui',
        },
      ],
    },
  ],
}

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-cli-'))
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

describe('@zeus-web/cli add', () => {
  it('lists registry ui components', () => {
    expect(listAvailableComponents(registry)).toEqual([
      'input',
      'button',
      'dialog',
    ])
  })

  it('creates add plan for one component from registry', () => {
    const [plan] = createAddPlan(['button'], registry)

    expect(plan).toEqual({
      component: 'button',
      dependencies: [
        '@zeus-web/button',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
      devDependencies: [],
      files: [
        {
          source: 'default/lib/utils.ts',
          target: 'lib/utils.ts',
          type: 'registry:lib',
        },
        {
          source: 'default/button.tsx',
          target: 'components/ui/button.tsx',
          type: 'registry:ui',
        },
      ],
    })
  })

  it('creates add plan for multiple components from registry', () => {
    const plans = createAddPlan(['input', 'dialog'], registry)

    expect(plans.map(plan => plan.component)).toEqual(['input', 'dialog'])
    expect(plans[0].dependencies).toContain('@zeus-web/input')
    expect(plans[1].dependencies).toContain('@zeus-web/dialog')
  })

  it('dedupes install dependencies across plans', () => {
    const plans = createAddPlan(['input', 'button'], registry)
    const installPlan = createCombinedInstallPlan(plans)

    expect(installPlan.dependencies).toEqual([
      '@zeus-web/button',
      '@zeus-web/input',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ])
  })

  it('throws on unknown component', () => {
    expect(() => createAddPlan(['unknown'], registry)).toThrow(
      'Unknown component: unknown',
    )
  })

  it('throws when registry is invalid', () => {
    const invalidRegistry: Registry = {
      name: 'bad-registry',
      items: [],
    }

    expect(() => listAvailableComponents(invalidRegistry)).toThrow(
      'Invalid @zeus-web/registry/registry.json',
    )
  })

  it('parses add options', () => {
    const parsed = parseAddArgs(
      ['button', 'input', '--dry-run', '--overwrite', '--cwd', 'demo'],
      '/repo',
    )

    expect(parsed.components).toEqual(['button', 'input'])
    expect(parsed.options).toEqual({
      cwd: resolve('/repo', 'demo'),
      dryRun: true,
      overwrite: true,
    })
  })

  it('throws on unknown options', () => {
    expect(() => parseAddArgs(['button', '--bad'])).toThrow(
      'Unknown option: --bad',
    )
  })

  it('dry-runs without writing files', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(registryRoot, 'default/lib/utils.ts', 'export {}\n')
      writeRegistrySource(registryRoot, 'default/button.tsx', 'export {}\n')

      const plans = createAddPlan(['button'], registry)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: true,
          overwrite: false,
        },
        registryRoot,
      )

      expect(result.written).toEqual([
        'lib/utils.ts',
        'components/ui/button.tsx',
      ])
      expect(existsSync(resolve(targetRoot, 'lib/utils.ts'))).toBe(false)
      expect(existsSync(resolve(targetRoot, 'components/ui/button.tsx'))).toBe(
        false,
      )
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('copies registry files into cwd', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(
        registryRoot,
        'default/lib/utils.ts',
        'export function cn() {}\n',
      )
      writeRegistrySource(
        registryRoot,
        'default/button.tsx',
        'export const Button = null\n',
      )

      const plans = createAddPlan(['button'], registry)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: false,
        },
        registryRoot,
      )

      expect(result.written).toEqual([
        'lib/utils.ts',
        'components/ui/button.tsx',
      ])
      expect(result.skipped).toEqual([])
      expect(readFileSync(resolve(targetRoot, 'lib/utils.ts'), 'utf-8')).toBe(
        'export function cn() {}\n',
      )
      expect(
        readFileSync(resolve(targetRoot, 'components/ui/button.tsx'), 'utf-8'),
      ).toBe('export const Button = null\n')
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('skips existing files by default', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(registryRoot, 'default/lib/utils.ts', 'new\n')
      writeRegistrySource(registryRoot, 'default/button.tsx', 'button\n')

      mkdirSync(resolve(targetRoot, 'lib'), { recursive: true })
      writeFileSync(resolve(targetRoot, 'lib/utils.ts'), 'existing\n', 'utf-8')

      const plans = createAddPlan(['button'], registry)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: false,
        },
        registryRoot,
      )

      expect(result.skipped).toEqual(['lib/utils.ts'])
      expect(readFileSync(resolve(targetRoot, 'lib/utils.ts'), 'utf-8')).toBe(
        'existing\n',
      )
      expect(existsSync(resolve(targetRoot, 'components/ui/button.tsx'))).toBe(
        true,
      )
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('overwrites existing files when requested', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(registryRoot, 'default/lib/utils.ts', 'new\n')
      writeRegistrySource(registryRoot, 'default/button.tsx', 'button\n')

      mkdirSync(resolve(targetRoot, 'lib'), { recursive: true })
      writeFileSync(resolve(targetRoot, 'lib/utils.ts'), 'existing\n', 'utf-8')

      const plans = createAddPlan(['button'], registry)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: true,
        },
        registryRoot,
      )

      expect(result.skipped).toEqual([])
      expect(result.written).toContain('lib/utils.ts')
      expect(readFileSync(resolve(targetRoot, 'lib/utils.ts'), 'utf-8')).toBe(
        'new\n',
      )
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('dedupes files by target when adding multiple components', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(registryRoot, 'default/lib/utils.ts', 'utils\n')
      writeRegistrySource(registryRoot, 'default/input.tsx', 'input\n')
      writeRegistrySource(registryRoot, 'default/button.tsx', 'button\n')

      const plans = createAddPlan(['input', 'button'], registry)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: false,
        },
        registryRoot,
      )

      expect(result.written).toEqual([
        'lib/utils.ts',
        'components/ui/input.tsx',
        'components/ui/button.tsx',
      ])
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('refuses to write outside cwd', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(registryRoot, 'default/button.tsx', 'button\n')

      await expect(
        executeAddPlan(
          [
            {
              component: 'button',
              dependencies: [],
              devDependencies: [],
              files: [
                {
                  source: 'default/button.tsx',
                  target: '../button.tsx',
                  type: 'registry:ui',
                },
              ],
            },
          ],
          {
            cwd: targetRoot,
            dryRun: false,
            overwrite: false,
          },
          registryRoot,
        ),
      ).rejects.toThrow('Refusing to write outside cwd')
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })
})
```

---

# 6. 为什么 Phase 6 不自动执行安装

Phase 6 先输出：

```bash
pnpm add @zeus-web/button class-variance-authority clsx tailwind-merge
```

而不是自动执行，原因是：

```txt
1. 用户项目可能用 pnpm/yarn/npm/bun。
2. 自动执行会引入 child_process、包管理器检测、失败回滚。
3. 当前 registry 文件复制是核心闭环，安装依赖可以 Phase 7 做。
4. Phase 6 输出安装命令已经足够完成 MVP 使用路径。
```

---

# 7. 使用效果

执行：

```bash
zweb add button input
```

输出类似：

```txt
Add button
Dependencies: @zeus-web/button, class-variance-authority, clsx, tailwind-merge
Files:
  default/lib/utils.ts -> lib/utils.ts
  default/button.tsx -> components/ui/button.tsx

Add input
Dependencies: @zeus-web/input, class-variance-authority, clsx, tailwind-merge
Files:
  default/lib/utils.ts -> lib/utils.ts
  default/input.tsx -> components/ui/input.tsx

Written files:
  lib/utils.ts
  components/ui/button.tsx
  components/ui/input.tsx

Install dependencies:
  pnpm add @zeus-web/button @zeus-web/input class-variance-authority clsx tailwind-merge
```

执行：

```bash
zweb add button --dry-run
```

只打印计划，不写文件。

执行：

```bash
zweb add button --cwd ./playground --overwrite
```

写入 `./playground/components/ui/button.tsx`，并覆盖已有文件。

---

# 8. Phase 6 验收命令

```bash
pnpm --filter @zeus-web/cli check
pnpm --filter @zeus-web/cli test
pnpm --filter @zeus-web/cli build

pnpm --filter @zeus-web/registry check
pnpm --filter @zeus-web/registry test
pnpm --filter @zeus-web/registry build

pnpm check
pnpm test
pnpm check:exports
pnpm build
pnpm check:build-output
```

验收标准：

```txt
1. zweb add button 能复制 lib/utils.ts 和 components/ui/button.tsx。
2. zweb add button input 时 lib/utils.ts 只写一次。
3. 默认跳过已有文件。
4. --overwrite 能覆盖已有文件。
5. --dry-run 不写文件。
6. --cwd 能指定目标项目目录。
7. add plan 从 @zeus-web/registry/registry.json 派生。
8. CLI 不再手写 registryItems。
```

---

# 9. 建议提交

```txt
feat(cli): copy registry files in add command
feat(cli): support add dry-run cwd and overwrite options
test(cli): cover registry file copy behavior
```

Phase 6 完成后，Phase 7 可以做：

```txt
1. 自动检测包管理器并安装依赖。
2. 读取 components.json。
3. 支持 alias：@/lib/utils、@/components。
4. zweb init 写入 components.json。
5. 合并 theme css 到 app/global.css。
```
