import type { Registry } from '@zeus-web/registry'

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createAddPlan, rewriteRegistrySource } from '../src/commands/add'
import { createDiffEntries, parseDiffArgs } from '../src/commands/diff'
import {
  createDefaultComponentsConfig,
  getComponentsConfigPath,
} from '../src/config'
import { hashString, updateComponentsLockFromPlans } from '../src/lock'
import { readRegistryAsset } from '../src/registry-assets'

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
}

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

  it('reports untracked-missing when no lock and file does not exist', async () => {
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
        'untracked-missing',
        'untracked-missing',
        'untracked-missing',
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reports unchanged files when local and registry hashes match lock', async () => {
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
          const raw = readRegistryAsset(file.source)
          const source = rewriteRegistrySource(raw, config)

          mkdirSync(dirname(file.absoluteTarget), { recursive: true })
          writeFileSync(file.absoluteTarget, source, 'utf-8')
          registryHashes[file.target] = hashString(source)
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

      expect(entries.every(entry => entry.status === 'unchanged')).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reports locally-modified when current file differs from lock hash', async () => {
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
      mkdirSync(dirname(file.absoluteTarget), { recursive: true })
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
