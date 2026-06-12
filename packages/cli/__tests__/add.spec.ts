import type { Registry } from '@zeus-web/registry'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  add,
  createAddPlan,
  parseAddArgs,
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
  mkdirSync(resolve(root, 'src'), { recursive: true })
  writeFileSync(
    getComponentsConfigPath(root),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf-8',
  )

  return config
}

const registry: Registry = {
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
}

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

  it('writes registry files and updates lock when running add command', async () => {
    const root = await createTempDir()

    try {
      writeConfig(root, 'react')

      await add(['button', '--cwd', root])

      expect(existsSync(resolve(root, 'src/lib/cn.ts'))).toBe(true)
      expect(existsSync(resolve(root, 'src/styles/zeus.css'))).toBe(true)
      expect(existsSync(resolve(root, 'src/components/ui/button.tsx'))).toBe(
        true,
      )
      expect(existsSync(resolve(root, 'src/components/ui/button.vue'))).toBe(
        false,
      )

      const button = readFileSync(
        resolve(root, 'src/components/ui/button.tsx'),
        'utf-8',
      )

      expect(button).toContain("import { cn } from '@/lib/cn'")
      expect(button).toContain('@zeus-web/button/react')

      const lock = readComponentsLock(root)

      expect(lock.components.button.files).toContain(
        'src/components/ui/button.tsx',
      )
      expect(lock.components.button.dependencies).toEqual(['@zeus-web/button'])
      expect(lock.components.button.registryDependencies).toEqual([
        'cn',
        'globals',
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
