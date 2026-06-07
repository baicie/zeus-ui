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
import { createDefaultComponentsConfig } from '../src/config'

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

function writeComponentsJson(root: string): void {
  mkdirSync(resolve(root, 'src'), { recursive: true })
  writeFileSync(
    resolve(root, 'components.json'),
    `${JSON.stringify(createDefaultComponentsConfig(), null, 2)}\n`,
    'utf-8',
  )
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
      writeComponentsJson(targetRoot)

      const plans = createAddPlan(['button'], registry)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: true,
          overwrite: false,
          install: true,
        },
        registryRoot,
      )

      expect(result.planned).toEqual([
        'src/lib/utils.ts',
        'src/components/ui/button.tsx',
      ])
      expect(result.written).toEqual([])
      expect(existsSync(resolve(targetRoot, 'src/lib/utils.ts'))).toBe(false)
      expect(
        existsSync(resolve(targetRoot, 'src/components/ui/button.tsx')),
      ).toBe(false)
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
        'default/lib/utils.ts',
        'export function cn() {}\n',
      )
      writeRegistrySource(
        registryRoot,
        'default/button.tsx',
        'export const Button = null\n',
      )
      writeComponentsJson(targetRoot)

      const plans = createAddPlan(['button'], registry)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: false,
          install: true,
        },
        registryRoot,
      )

      expect(result.written).toEqual([
        'src/lib/utils.ts',
        'src/components/ui/button.tsx',
      ])
      expect(result.skipped).toEqual([])
      expect(
        readFileSync(resolve(targetRoot, 'src/lib/utils.ts'), 'utf-8'),
      ).toBe('export function cn() {}\n')
      expect(
        readFileSync(
          resolve(targetRoot, 'src/components/ui/button.tsx'),
          'utf-8',
        ),
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
      writeComponentsJson(targetRoot)

      mkdirSync(resolve(targetRoot, 'src/lib'), { recursive: true })
      writeFileSync(
        resolve(targetRoot, 'src/lib/utils.ts'),
        'existing\n',
        'utf-8',
      )

      const plans = createAddPlan(['button'], registry)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: false,
          install: true,
        },
        registryRoot,
      )

      expect(result.skipped).toEqual(['src/lib/utils.ts'])
      expect(
        readFileSync(resolve(targetRoot, 'src/lib/utils.ts'), 'utf-8'),
      ).toBe('existing\n')
      expect(
        existsSync(resolve(targetRoot, 'src/components/ui/button.tsx')),
      ).toBe(true)
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
      writeComponentsJson(targetRoot)

      mkdirSync(resolve(targetRoot, 'src/lib'), { recursive: true })
      writeFileSync(
        resolve(targetRoot, 'src/lib/utils.ts'),
        'existing\n',
        'utf-8',
      )

      const plans = createAddPlan(['button'], registry)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: true,
          install: true,
        },
        registryRoot,
      )

      expect(result.skipped).toEqual([])
      expect(result.written).toContain('src/lib/utils.ts')
      expect(
        readFileSync(resolve(targetRoot, 'src/lib/utils.ts'), 'utf-8'),
      ).toBe('new\n')
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
      writeComponentsJson(targetRoot)

      const plans = createAddPlan(['input', 'button'], registry)
      const result = await executeAddPlan(
        plans,
        {
          cwd: targetRoot,
          dryRun: false,
          overwrite: false,
          install: true,
        },
        registryRoot,
      )

      expect(result.written).toEqual([
        'src/lib/utils.ts',
        'src/components/ui/input.tsx',
        'src/components/ui/button.tsx',
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
            install: true,
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
