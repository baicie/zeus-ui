import { Buffer } from 'node:buffer'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAddPlan } from '../src/commands/add'
import { createDiffEntries } from '../src/commands/diff'
import { remove } from '../src/commands/remove'
import { update } from '../src/commands/update'
import {
  createDefaultComponentsConfig,
  getComponentsConfigPath,
} from '../src/config'
import { hashString, updateComponentsLockFromPlans } from '../src/lock'
import { createBundledRegistrySource } from '../src/registry-source'

afterEach(() => {
  process.exitCode = 0
  vi.restoreAllMocks()
})

async function createProject() {
  const cwd = await mkdtemp(join(tmpdir(), 'zeus-cli-maintenance-safety-'))
  const config = createDefaultComponentsConfig({
    framework: 'react',
    typescript: true,
    srcDir: 'src',
  })
  writeFileSync(getComponentsConfigPath(cwd), JSON.stringify(config))
  return {
    cwd,
    config,
    bundled: (await createBundledRegistrySource()).source,
  }
}

describe('@zeus-web/cli maintenance safety', () => {
  it.each(['.git/HEAD', 'PACKAGE.JSON'])(
    'does not delete protected metadata %s claimed by a lock',
    async target => {
      const { cwd, bundled } = await createProject()
      const file = resolve(cwd, target)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, 'protected')
      writeFileSync(
        resolve(cwd, 'zeus-ui.lock.json'),
        JSON.stringify({
          version: 2,
          registries: { [bundled.id]: bundled },
          components: {
            button: {
              registry: bundled.id,
              files: [target],
              dependencies: [],
              registryDependencies: [],
              updatedAt: '',
            },
          },
        }),
      )
      vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        await remove(['--all', '--force', '--cwd', cwd])
        expect(existsSync(file)).toBe(true)
        expect(readFileSync(file, 'utf-8')).toBe('protected')
        expect(process.exitCode).toBe(1)
      } finally {
        await rm(cwd, { recursive: true, force: true })
      }
    },
  )

  it('keeps byte-level local edits that decode to the same UTF-8 text', async () => {
    const { cwd, config } = await createProject()
    const plan = createAddPlan({ components: ['button'], cwd, config }).find(
      item => item.component === 'button',
    )!
    const file = plan.files[0]
    mkdirSync(dirname(file.absoluteTarget), { recursive: true })
    writeFileSync(file.absoluteTarget, '\uFFFD')
    await updateComponentsLockFromPlans({
      cwd,
      plans: [plan],
      writtenTargets: [file.target],
      registryHashes: { [file.target]: hashString('\uFFFD') },
    })
    writeFileSync(file.absoluteTarget, Buffer.from([255]))
    try {
      const [entry] = await createDiffEntries({ cwd, plans: [plan] })
      expect(entry.status).toBe('registry-and-local-changed')
      await update(['button', '--cwd', cwd])
      expect(readFileSync(file.absoluteTarget)).toEqual(Buffer.from([255]))
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('does not overwrite an untracked symlink target outside the project', async () => {
    const { cwd, config } = await createProject()
    const external = await mkdtemp(join(tmpdir(), 'zeus-cli-owned-outside-'))
    const owned = resolve(external, 'owned.tsx')
    const plan = createAddPlan({ components: ['button'], cwd, config }).find(
      item => item.component === 'button',
    )!
    const file = plan.files[0]
    mkdirSync(dirname(file.absoluteTarget), { recursive: true })
    writeFileSync(owned, 'owned outside the project')
    symlinkSync(owned, file.absoluteTarget)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await update(['button', '--force', '--cwd', cwd])
      expect(readFileSync(owned, 'utf-8')).toBe('owned outside the project')
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
      await rm(external, { recursive: true, force: true })
    }
  })

  it('retains a shared file with differently cased lock paths on insensitive file systems', async context => {
    const { cwd, bundled } = await createProject()
    const target = 'src/components/ui/Button.tsx'
    const alias = 'src/components/ui/button.tsx'
    const file = resolve(cwd, target)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, 'shared')
    try {
      if (!existsSync(resolve(cwd, alias))) {
        context.skip()
        return
      }
      writeFileSync(
        resolve(cwd, 'zeus-ui.lock.json'),
        JSON.stringify({
          version: 2,
          registries: { [bundled.id]: bundled },
          components: {
            selected: {
              registry: bundled.id,
              files: [target],
              dependencies: [],
              registryDependencies: [],
              updatedAt: '',
              fileHashes: { [target]: hashString('shared') },
            },
            retained: {
              registry: bundled.id,
              files: [alias],
              dependencies: [],
              registryDependencies: [],
              updatedAt: '',
              fileHashes: { [alias]: hashString('shared') },
            },
          },
        }),
      )
      await remove(['selected', '--force', '--cwd', cwd])
      expect(existsSync(resolve(cwd, alias))).toBe(true)
      expect(readFileSync(resolve(cwd, alias), 'utf-8')).toBe('shared')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
