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
  resolveAddPlanTargets,
  rewriteRegistrySource,
} from '../src/commands/add'
import { createDiffEntries } from '../src/commands/diff'
import {
  createDefaultComponentsConfig,
  readComponentsConfig,
} from '../src/config'
import { readComponentsLock, updateComponentsLockFromPlans } from '../src/lock'

const phase17Registry: Registry = {
  schemaVersion: 1,
  name: '@zeus-web/registry',
  version: '0.0.0',
  items: [
    {
      name: 'cn',
      type: 'utility',
      description: 'Class name utility.',
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
      description: 'Global CSS.',
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
      description: 'Button.',
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
      description: 'Input.',
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

function writeComponentsJson(root: string): void {
  mkdirSync(resolve(root, 'src'), { recursive: true })
  writeFileSync(
    resolve(root, 'components.json'),
    `${JSON.stringify(createDefaultComponentsConfig(), null, 2)}\n`,
    'utf-8',
  )
}

function writeComponentsJsonWithConfig(
  root: string,
  config?: ReturnType<typeof createDefaultComponentsConfig>,
): void {
  mkdirSync(resolve(root, 'src'), { recursive: true })
  writeFileSync(
    resolve(root, 'components.json'),
    `${JSON.stringify(config ?? createDefaultComponentsConfig(), null, 2)}\n`,
    'utf-8',
  )
}

describe('@zeus-web/cli add', () => {
  it('lists registry component items', () => {
    expect(listAvailableComponents(phase17Registry)).toEqual([
      'button',
      'input',
    ])
  })

  it('creates add plan with recursive registry dependencies', () => {
    const plans = createAddPlan(['button'], phase17Registry)
    const buttonPlan = plans.find(p => p.component === 'button')!

    expect(buttonPlan.dependencies).toEqual(['@zeus-web/button'])
    expect(buttonPlan.devDependencies).toEqual([])
  })

  it('filters files by framework for React', () => {
    const plans = createAddPlan(['button'], phase17Registry, 'react')
    const buttonPlan = plans.find(p => p.component === 'button')!

    expect(buttonPlan.files.map(f => f.target)).toEqual([
      'components/ui/button.tsx',
    ])
  })

  it('includes shared files from recursive deps as separate plans', () => {
    const plans = createAddPlan(['button'], phase17Registry, 'react')
    const allTargets = plans.flatMap(p => p.files.map(f => f.target)).sort()

    expect(allTargets).toEqual([
      'components/ui/button.tsx',
      'lib/cn.ts',
      'styles/zeus.css',
    ])
  })

  it('dedupes files by target when adding multiple components', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(registryRoot, 'templates/lib/cn.ts', 'cn\n')
      writeRegistrySource(
        registryRoot,
        'templates/css/globals.css',
        ':root{}\n',
      )
      writeRegistrySource(
        registryRoot,
        'templates/react/button.tsx',
        'button\n',
      )
      writeRegistrySource(registryRoot, 'templates/react/input.tsx', 'input\n')
      writeComponentsJson(targetRoot)

      const config = readComponentsConfig(targetRoot)
      const plans = createAddPlan(
        ['button', 'input'],
        phase17Registry,
        config.framework,
      )
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: false,
          install: true,
          all: false,
          yes: false,
        },
        registryRoot,
      )

      expect(result.written.sort()).toEqual([
        'src/components/ui/button.tsx',
        'src/components/ui/input.tsx',
        'src/lib/cn.ts',
        'src/styles/zeus.css',
      ])
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('dedupes install dependencies', () => {
    const plans = createAddPlan(['button', 'input'], phase17Registry)
    const installPlan = createCombinedInstallPlan(plans)

    expect(installPlan.dependencies.sort()).toEqual([
      '@zeus-web/button',
      '@zeus-web/input',
    ])
  })

  it('throws on unknown component', () => {
    expect(() => createAddPlan(['unknown'], phase17Registry)).toThrow(
      'Unknown component: unknown',
    )
  })

  it('throws when registry is invalid', () => {
    const invalidRegistry: Registry = {
      schemaVersion: 1,
      name: 'bad-registry',
      version: '0.0.0',
      items: [],
    }

    expect(() => listAvailableComponents(invalidRegistry)).toThrow(
      'Invalid @zeus-web/registry/registry.json',
    )
  })

  it('parses add options', () => {
    const parsed = parseAddArgs(
      [
        'button',
        'input',
        '--dry-run',
        '--overwrite',
        '--cwd',
        'demo',
        '--no-install',
      ],
      '/repo',
    )

    expect(parsed.components).toEqual(['button', 'input'])
    expect(parsed.options).toEqual({
      cwd: resolve('/repo', 'demo'),
      dryRun: true,
      overwrite: true,
      install: false,
      all: false,
      yes: false,
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
      writeRegistrySource(registryRoot, 'templates/lib/cn.ts', 'export {}\n')
      writeRegistrySource(
        registryRoot,
        'templates/css/globals.css',
        ':root{}\n',
      )
      writeRegistrySource(
        registryRoot,
        'templates/react/button.tsx',
        'export {}\n',
      )
      writeComponentsJson(targetRoot)

      const config = readComponentsConfig(targetRoot)
      const plans = createAddPlan(['button'], phase17Registry, config.framework)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: true,
          overwrite: false,
          install: true,
          all: false,
          yes: false,
        },
        registryRoot,
      )

      expect(result.planned.sort()).toEqual([
        'src/components/ui/button.tsx',
        'src/lib/cn.ts',
        'src/styles/zeus.css',
      ])
      expect(result.written).toEqual([])
      expect(existsSync(resolve(targetRoot, 'src/lib/cn.ts'))).toBe(false)
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('copies registry files into cwd with alias resolution', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(
        registryRoot,
        'templates/lib/cn.ts',
        'export function cn() {}\n',
      )
      writeRegistrySource(
        registryRoot,
        'templates/css/globals.css',
        ':root{}\n',
      )
      writeRegistrySource(
        registryRoot,
        'templates/react/button.tsx',
        'import { cn } from "@/lib/cn"\nexport const Button = null\n',
      )
      writeComponentsJson(targetRoot)

      const config = readComponentsConfig(targetRoot)
      const plans = createAddPlan(['button'], phase17Registry, config.framework)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: false,
          install: true,
          all: false,
          yes: false,
        },
        registryRoot,
      )

      expect(result.written.sort()).toEqual([
        'src/components/ui/button.tsx',
        'src/lib/cn.ts',
        'src/styles/zeus.css',
      ])
      expect(result.skipped).toEqual([])
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('skips existing files by default', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(registryRoot, 'templates/lib/cn.ts', 'new\n')
      writeRegistrySource(
        registryRoot,
        'templates/css/globals.css',
        ':root{}\n',
      )
      writeRegistrySource(
        registryRoot,
        'templates/react/button.tsx',
        'button\n',
      )
      writeComponentsJson(targetRoot)

      mkdirSync(resolve(targetRoot, 'src/lib'), { recursive: true })
      writeFileSync(resolve(targetRoot, 'src/lib/cn.ts'), 'existing\n', 'utf-8')

      const config = readComponentsConfig(targetRoot)
      const plans = createAddPlan(['button'], phase17Registry, config.framework)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: false,
          install: true,
          all: false,
          yes: false,
        },
        registryRoot,
      )

      expect(result.skipped).toEqual(['src/lib/cn.ts'])
      expect(readFileSync(resolve(targetRoot, 'src/lib/cn.ts'), 'utf-8')).toBe(
        'existing\n',
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
      writeRegistrySource(registryRoot, 'templates/lib/cn.ts', 'new\n')
      writeRegistrySource(
        registryRoot,
        'templates/css/globals.css',
        ':root{}\n',
      )
      writeRegistrySource(
        registryRoot,
        'templates/react/button.tsx',
        'button\n',
      )
      writeComponentsJson(targetRoot)

      mkdirSync(resolve(targetRoot, 'src/lib'), { recursive: true })
      writeFileSync(resolve(targetRoot, 'src/lib/cn.ts'), 'existing\n', 'utf-8')

      const config = readComponentsConfig(targetRoot)
      const plans = createAddPlan(['button'], phase17Registry, config.framework)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: true,
          install: true,
          all: false,
          yes: false,
        },
        registryRoot,
      )

      expect(result.skipped).toEqual([])
      expect(readFileSync(resolve(targetRoot, 'src/lib/cn.ts'), 'utf-8')).toBe(
        'new\n',
      )
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('refuses to write outside cwd', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(
        registryRoot,
        'templates/react/button.tsx',
        'button\n',
      )
      writeComponentsJson(targetRoot)

      await expect(
        executeAddPlan(
          [
            {
              component: 'button',
              dependencies: [],
              devDependencies: [],
              files: [
                {
                  source: 'templates/react/button.tsx',
                  target: '../button.tsx',
                },
              ],
            },
          ],
          {
            cwd: targetRoot,
            dryRun: false,
            overwrite: false,
            install: true,
            all: false,
            yes: false,
          },
          registryRoot,
        ),
      ).rejects.toThrow('Refusing to write outside cwd')
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('rewrites registry source lib alias from components config', () => {
    const config = createDefaultComponentsConfig()
    config.aliases.lib = '~/shared/lib'

    const source = "import { cn } from '@/lib/cn'\n"

    expect(rewriteRegistrySource(source, config)).toBe(
      "import { cn } from '~/shared/lib/cn'\n",
    )
  })

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

  it('creates diff entries for missing files (recursive deps)', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(registryRoot, 'templates/lib/cn.ts', 'export {}\n')
      writeRegistrySource(
        registryRoot,
        'templates/css/globals.css',
        ':root{}\n',
      )
      writeRegistrySource(
        registryRoot,
        'templates/react/button.tsx',
        'export {}\n',
      )
      writeComponentsJsonWithConfig(targetRoot)

      const config = readComponentsConfig(targetRoot)
      const plans = createAddPlan(['button'], phase17Registry, config.framework)
      const entries = await createDiffEntries({
        cwd: targetRoot,
        plans,
        registryRoot,
      })

      expect(entries.map(e => e.status).sort()).toEqual([
        'missing',
        'missing',
        'missing',
      ])
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('rewrites registry source in diff entries', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(registryRoot, 'templates/lib/cn.ts', 'export {}\n')
      writeRegistrySource(
        registryRoot,
        'templates/css/globals.css',
        ':root{}\n',
      )
      writeRegistrySource(
        registryRoot,
        'templates/react/button.tsx',
        "import { cn } from '@/lib/cn'\n",
      )
      const config = createDefaultComponentsConfig()
      config.aliases.lib = '~/shared/lib'
      writeComponentsJsonWithConfig(targetRoot, config)

      const plans = createAddPlan(['button'], phase17Registry, config.framework)
      const entries = await createDiffEntries({
        cwd: targetRoot,
        plans,
        registryRoot,
      })

      const buttonEntry = entries.find(
        e => e.source === 'templates/react/button.tsx',
      )
      expect(buttonEntry?.registrySource).toBe(
        "import { cn } from '~/shared/lib/cn'\n",
      )
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('refuses diff access outside cwd', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(
        registryRoot,
        'templates/react/button.tsx',
        'export {}\n',
      )
      writeComponentsJsonWithConfig(targetRoot)

      await expect(
        createDiffEntries({
          cwd: targetRoot,
          registryRoot,
          plans: [
            {
              component: 'button',
              dependencies: [],
              devDependencies: [],
              files: [
                {
                  source: 'templates/react/button.tsx',
                  target: '../button.tsx',
                },
              ],
            },
          ],
        }),
      ).rejects.toThrow('Refusing to access outside cwd')
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })

  it('writes components.lock.json after lock update', async () => {
    const registryRoot = await createTempDir()
    const targetRoot = await createTempDir()

    try {
      writeRegistrySource(registryRoot, 'templates/lib/cn.ts', 'export {}\n')
      writeRegistrySource(
        registryRoot,
        'templates/css/globals.css',
        ':root{}\n',
      )
      writeRegistrySource(
        registryRoot,
        'templates/react/button.tsx',
        'export {}\n',
      )
      writeComponentsJsonWithConfig(targetRoot)

      const config = readComponentsConfig(targetRoot)
      const plans = createAddPlan(['button'], phase17Registry, config.framework)
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

      const resolvedPlans = resolveAddPlanTargets(plans, targetRoot, config)
      await updateComponentsLockFromPlans({
        cwd: targetRoot,
        plans: resolvedPlans,
        writtenTargets: result.written,
      })

      const lock = readComponentsLock(targetRoot)
      expect(result.written.sort()).toEqual([
        'src/components/ui/button.tsx',
        'src/lib/cn.ts',
        'src/styles/zeus.css',
      ])
      expect(lock.components.button).toBeDefined()
    } finally {
      await rm(registryRoot, { recursive: true, force: true })
      await rm(targetRoot, { recursive: true, force: true })
    }
  })
})
