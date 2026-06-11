import { writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  createInstallCommand,
  detectPackageManager,
} from '../src/package-manager'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-pm-'))
}

describe('@zeus-web/cli package manager', () => {
  it('detects pnpm by lockfile', async () => {
    const cwd = await createTempDir()

    try {
      writeFileSync(resolve(cwd, 'pnpm-lock.yaml'), '', 'utf-8')
      expect(detectPackageManager(cwd)).toBe('pnpm')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('detects npm by lockfile', async () => {
    const cwd = await createTempDir()

    try {
      writeFileSync(resolve(cwd, 'package-lock.json'), '{}\n', 'utf-8')
      expect(detectPackageManager(cwd)).toBe('npm')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('falls back to pnpm', async () => {
    const cwd = await createTempDir()

    try {
      expect(detectPackageManager(cwd)).toBe('pnpm')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('creates install commands', () => {
    expect(
      createInstallCommand({
        packageManager: 'pnpm',
        dependencies: ['a', 'b'],
        dev: false,
      }),
    ).toEqual({
      command: 'pnpm',
      args: ['add', 'a', 'b'],
    })

    expect(
      createInstallCommand({
        packageManager: 'npm',
        dependencies: ['a'],
        dev: true,
      }),
    ).toEqual({
      command: 'npm',
      args: ['install', '-D', 'a'],
    })
  })
})
