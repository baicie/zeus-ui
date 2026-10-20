import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { doctor } from '../src/commands/doctor'
import {
  createDefaultComponentsConfig,
  getComponentsConfigPath,
} from '../src/config'
import { hashString, writeComponentsLock } from '../src/lock'
import { createBundledRegistrySource } from '../src/registry-source'

afterEach(() => {
  process.exitCode = 0
  vi.restoreAllMocks()
})

async function createProject() {
  const cwd = await mkdtemp(join(tmpdir(), 'zeus-web-doctor-'))
  const config = createDefaultComponentsConfig({ srcDir: 'src' })
  mkdirSync(resolve(cwd, 'src'), { recursive: true })
  writeFileSync(getComponentsConfigPath(cwd), JSON.stringify(config))
  writeFileSync(
    resolve(cwd, 'package.json'),
    JSON.stringify({ dependencies: { '@zeus-web/themes': '1.0.0' } }),
  )
  const bundled = (await createBundledRegistrySource()).source
  await writeComponentsLock(cwd, {
    version: 2,
    registries: { [bundled.id]: bundled },
    components: {
      button: {
        registry: bundled.id,
        files: ['src/components/ui/button.tsx'],
        dependencies: ['@zeus-web/button'],
        registryDependencies: [],
        updatedAt: new Date(0).toISOString(),
        fileHashes: { 'src/components/ui/button.tsx': hashString('installed') },
      },
    },
  })
  return cwd
}

describe('@zeus-web/cli doctor', () => {
  it('reports tracked missing files from the current lock without modifying it', async () => {
    const cwd = await createProject()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const before = readFileSync(resolve(cwd, 'zeus-ui.lock.json'), 'utf-8')
    try {
      await doctor(['--cwd', cwd, '--json'])
      const { checks } = JSON.parse(String(log.mock.calls[0][0]))
      expect(checks).toContainEqual({
        level: 'fail',
        message: 'button: src/components/ui/button.tsx is missing.',
      })
      expect(checks).toContainEqual({
        level: 'warn',
        message: '@zeus-web/button is not installed.',
      })
      expect(process.exitCode).toBe(1)
      expect(readFileSync(resolve(cwd, 'zeus-ui.lock.json'), 'utf-8')).toBe(
        before,
      )
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects unsafe targets in the current lock', async () => {
    const cwd = await createProject()
    const bundled = (await createBundledRegistrySource()).source
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    writeFileSync(
      resolve(cwd, 'zeus-ui.lock.json'),
      JSON.stringify({
        version: 2,
        registries: { [bundled.id]: bundled },
        components: {
          button: {
            registry: bundled.id,
            files: ['../outside.ts'],
            dependencies: [],
            registryDependencies: [],
            updatedAt: '',
          },
        },
      }),
    )
    try {
      await doctor(['--cwd', cwd, '--json'])
      const { checks } = JSON.parse(String(log.mock.calls[0][0]))
      expect(
        checks.some(
          (check: { level: string; message: string }) =>
            check.level === 'fail' &&
            check.message.includes('Unsafe lock target'),
        ),
      ).toBe(true)
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
  it('reports local changes and missing registry dependencies from the current lock', async () => {
    const cwd = await createProject()
    mkdirSync(resolve(cwd, 'src/components/ui'), { recursive: true })
    writeFileSync(resolve(cwd, 'src/components/ui/button.tsx'), 'edited')
    const file = resolve(cwd, 'zeus-ui.lock.json')
    const lock = JSON.parse(readFileSync(file, 'utf-8'))
    lock.components.button.registryDependencies = ['cn']
    writeFileSync(file, JSON.stringify(lock))
    const before = readFileSync(file, 'utf-8')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await doctor(['--cwd', cwd, '--json'])
      const { checks } = JSON.parse(String(log.mock.calls[0][0]))
      expect(checks).toContainEqual({
        level: 'warn',
        message: 'button: src/components/ui/button.tsx has local changes.',
      })
      expect(checks).toContainEqual({
        level: 'fail',
        message: 'button: registry dependency cn is not tracked.',
      })
      expect(readFileSync(file, 'utf-8')).toBe(before)
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects symlink paths and does not read their external target', async () => {
    const cwd = await createProject()
    const external = await mkdtemp(join(tmpdir(), 'zeus-web-doctor-external-'))
    mkdirSync(resolve(cwd, 'src/components'), { recursive: true })
    writeFileSync(resolve(external, 'button.tsx'), 'external')
    symlinkSync(external, resolve(cwd, 'src/components/ui'), 'junction')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await doctor(['--cwd', cwd, '--json'])
      const { checks } = JSON.parse(String(log.mock.calls[0][0]))
      expect(
        checks.some(
          (check: { level: string; message: string }) =>
            check.level === 'fail' && check.message.includes('symbolic link'),
        ),
      ).toBe(true)
      expect(readFileSync(resolve(external, 'button.tsx'), 'utf-8')).toBe(
        'external',
      )
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
      await rm(external, { recursive: true, force: true })
    }
  })

  it.each([
    { version: 1, components: [] },
    { version: 2, components: {} },
    { version: 1, components: { button: { files: ['button.tsx'] } } },
    {
      version: 1,
      components: {
        button: {
          files: ['button.tsx'],
          dependencies: [],
          registryDependencies: [],
          updatedAt: '',
          fileHashes: { 'other.tsx': '0'.repeat(64) },
        },
      },
    },
    {
      version: 1,
      components: {
        button: {
          files: ['button.tsx'],
          dependencies: [],
          registryDependencies: [],
          updatedAt: '',
          fileHashes: { 'button.tsx': 'invalid' },
        },
      },
    },
  ])('reports malformed current locks as failures', async value => {
    const cwd = await createProject()
    writeFileSync(resolve(cwd, 'zeus-ui.lock.json'), JSON.stringify(value))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await doctor(['--cwd', cwd, '--json'])
      const { checks } = JSON.parse(String(log.mock.calls[0][0]))
      expect(
        checks.some(
          (check: { level: string; message: string }) =>
            check.level === 'fail' &&
            check.message.includes('Invalid zeus-ui.lock.json'),
        ),
      ).toBe(true)
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
  it('reports malformed package.json in JSON checks and continues checking files', async () => {
    const cwd = await createProject()
    writeFileSync(resolve(cwd, 'package.json'), '{')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await doctor(['--cwd', cwd, '--json'])
      const { checks } = JSON.parse(String(log.mock.calls[0][0]))
      expect(
        checks.some(
          (check: { level: string; message: string }) =>
            check.level === 'fail' &&
            check.message.includes('Invalid package.json:'),
        ),
      ).toBe(true)
      expect(checks).toContainEqual({
        level: 'fail',
        message: 'button: src/components/ui/button.tsx is missing.',
      })
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
  it('accepts existing application-owned dependency files without adopting them into the lock', async () => {
    const cwd = await createProject()
    const file = resolve(cwd, 'zeus-ui.lock.json')
    const lock = JSON.parse(readFileSync(file, 'utf-8'))
    lock.components.button.registryDependencies = ['cn', 'globals']
    writeFileSync(file, JSON.stringify(lock))
    mkdirSync(resolve(cwd, 'src/lib'), { recursive: true })
    mkdirSync(resolve(cwd, 'src/styles'), { recursive: true })
    mkdirSync(resolve(cwd, 'src/components/ui'), { recursive: true })
    writeFileSync(resolve(cwd, 'src/lib/cn.ts'), 'app-owned helper')
    writeFileSync(resolve(cwd, 'src/styles/zeus.css'), 'app-owned css')
    writeFileSync(resolve(cwd, 'src/components/ui/button.tsx'), 'installed')
    const before = readFileSync(file, 'utf-8')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await doctor(['--cwd', cwd, '--json'])
      const { checks } = JSON.parse(String(log.mock.calls[0][0]))
      expect(
        checks.some((check: { level: string }) => check.level === 'fail'),
      ).toBe(false)
      expect(checks).toContainEqual({
        level: 'warn',
        message:
          'button: registry dependency cn files exist but are not tracked.',
      })
      expect(readFileSync(file, 'utf-8')).toBe(before)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
