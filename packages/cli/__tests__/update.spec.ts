import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

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

  it('does not install untracked components through update', async () => {
    const root = await createTempDir()

    try {
      writeConfig(root)

      await update(['button', '--cwd', root])

      expect(existsSync(resolve(root, 'lib/cn.ts'))).toBe(false)
      expect(existsSync(resolve(root, 'styles/zeus.css'))).toBe(false)
      expect(existsSync(resolve(root, 'components/ui/button.tsx'))).toBe(false)
      expect(existsSync(resolve(root, 'zeus-ui.lock.json'))).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('restores tracked missing files', async () => {
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

      await rm(file.absoluteTarget, { force: true })

      await update(['button', '--cwd', root])

      expect(existsSync(file.absoluteTarget)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not overwrite local modifications without --overwrite', async () => {
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

      const buttonPath = resolve(root, 'components/ui/button.tsx')
      writeFileSync(buttonPath, 'local edit', 'utf-8')

      await update(['button', '--cwd', root])

      expect(readFileSync(buttonPath, 'utf-8')).toBe('local edit')
      expect(config.framework).toBe('react')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('overwrites local modifications with --overwrite', async () => {
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

      const buttonPath = resolve(root, 'components/ui/button.tsx')
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

      await rm(file.absoluteTarget, { force: true })

      await update(['button', '--cwd', root, '--dry-run'])

      expect(existsSync(file.absoluteTarget)).toBe(false)
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
