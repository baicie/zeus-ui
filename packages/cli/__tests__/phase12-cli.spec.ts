import type { Registry } from '@zeus-web/registry'

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  createAddPlan,
  executeAddPlan,
  parseAddArgs,
} from '../src/commands/add'
import { createDiffEntries } from '../src/commands/diff'
import { createDefaultComponentsConfig } from '../src/config'

const registry: Registry = {
  $schema: 'https://zeus-web.dev/schema/registry.json',
  name: '@zeus-web/registry',
  homepage: 'https://zeus-web.dev',
  items: [
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
