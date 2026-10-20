import type { ComponentsLockFile } from '../src/lock'

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

import { parseRemoveArgs, remove } from '../src/commands/remove'
import {
  hashFile,
  hashString,
  readComponentsLock,
  writeComponentsLock,
} from '../src/lock'
import { createBundledRegistrySource } from '../src/registry-source'

afterEach(() => {
  process.exitCode = 0
  vi.restoreAllMocks()
})

async function createProject() {
  const cwd = await mkdtemp(join(tmpdir(), 'zeus-web-remove-'))
  const bundled = (await createBundledRegistrySource()).source
  const lock: ComponentsLockFile = {
    version: 2,
    registries: { [bundled.id]: bundled },
    components: {},
  }
  for (const name of ['button', 'input', 'cn']) {
    const target =
      name === 'cn' ? 'src/lib/cn.ts' : `src/components/ui/${name}.tsx`
    mkdirSync(dirname(resolve(cwd, target)), { recursive: true })
    writeFileSync(resolve(cwd, target), name)
    lock.components[name] = {
      registry: bundled.id,
      files: [target],
      dependencies: name === 'cn' ? [] : [`@zeus-web/${name}`],
      registryDependencies: name === 'cn' ? [] : ['cn'],
      updatedAt: new Date(0).toISOString(),
      fileHashes: { [target]: hashString(name) },
    }
  }
  writeFileSync(
    resolve(cwd, 'package.json'),
    '{"dependencies":{"@zeus-web/button":"1.0.0"}}',
  )
  await writeComponentsLock(cwd, lock)
  return cwd
}

describe('@zeus-web/cli remove', () => {
  it('removes an installed component and retains shared files and npm dependencies', async () => {
    const cwd = await createProject()
    const pkg = readFileSync(resolve(cwd, 'package.json'), 'utf-8')
    try {
      await remove(['button', '--cwd', cwd])
      expect(existsSync(resolve(cwd, 'src/components/ui/button.tsx'))).toBe(
        false,
      )
      expect(existsSync(resolve(cwd, 'src/lib/cn.ts'))).toBe(true)
      expect(existsSync(resolve(cwd, 'src/components/ui/input.tsx'))).toBe(true)
      expect(readComponentsLock(cwd).components.button).toBeUndefined()
      expect(readFileSync(resolve(cwd, 'package.json'), 'utf-8')).toBe(pkg)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('protects local modifications and preserves their lock entry until --force', async () => {
    const cwd = await createProject()
    const target = resolve(cwd, 'src/components/ui/button.tsx')
    writeFileSync(target, 'edited')
    try {
      await remove(['button', '--cwd', cwd])
      expect(readFileSync(target, 'utf-8')).toBe('edited')
      expect(readComponentsLock(cwd).components.button).toBeDefined()
      await remove(['button', '--force', '--cwd', cwd])
      expect(existsSync(target)).toBe(false)
      expect(readComponentsLock(cwd).components.button).toBeUndefined()
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('does not remove dependencies or other files when any selected file has local changes', async () => {
    const cwd = await createProject()
    const target = resolve(cwd, 'src/components/ui/button.tsx')
    writeFileSync(target, 'edited')
    const before = readFileSync(resolve(cwd, 'zeus-ui.lock.json'), 'utf-8')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await remove(['--all', '--cwd', cwd])
      expect(readFileSync(target, 'utf-8')).toBe('edited')
      expect(readFileSync(resolve(cwd, 'src/lib/cn.ts'), 'utf-8')).toBe('cn')
      expect(
        readFileSync(resolve(cwd, 'src/components/ui/input.tsx'), 'utf-8'),
      ).toBe('input')
      expect(readFileSync(resolve(cwd, 'zeus-ui.lock.json'), 'utf-8')).toBe(
        before,
      )
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('requires --force when a tracked file has no hash', async () => {
    const cwd = await createProject()
    const lock = readComponentsLock(cwd)
    delete lock.components.button.fileHashes
    await writeComponentsLock(cwd, lock)
    const before = readFileSync(resolve(cwd, 'zeus-ui.lock.json'), 'utf-8')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await remove(['button', '--cwd', cwd])
      expect(existsSync(resolve(cwd, 'src/components/ui/button.tsx'))).toBe(
        true,
      )
      expect(readFileSync(resolve(cwd, 'zeus-ui.lock.json'), 'utf-8')).toBe(
        before,
      )
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('compares file bytes without normalizing invalid UTF-8', async () => {
    const cwd = await createProject()
    const target = resolve(cwd, 'src/components/ui/button.tsx')
    writeFileSync(target, Buffer.from([255]))
    const lock = readComponentsLock(cwd)
    lock.components.button.fileHashes!['src/components/ui/button.tsx'] =
      hashFile(target)
    await writeComponentsLock(cwd, lock)
    writeFileSync(target, Buffer.from([254]))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await remove(['button', '--cwd', cwd])
      expect(readFileSync(target)).toEqual(Buffer.from([254]))
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it.each([
    'zeus-ui.json',
    'zeus-ui.lock.json',
    'package.json',
    'pnpm-lock.yaml',
  ])('rejects a lock claiming protected project file %s', async target => {
    const cwd = await createProject()
    const lock = readComponentsLock(cwd)
    lock.components.button.files = [target]
    delete lock.components.button.fileHashes
    writeFileSync(resolve(cwd, 'zeus-ui.lock.json'), JSON.stringify(lock))
    const before = readFileSync(resolve(cwd, 'zeus-ui.lock.json'), 'utf-8')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await remove(['--all', '--cwd', cwd, '--force'])
      expect(readFileSync(resolve(cwd, 'zeus-ui.lock.json'), 'utf-8')).toBe(
        before,
      )
      expect(existsSync(resolve(cwd, 'package.json'))).toBe(true)
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('keeps files and lock bytes unchanged in dry-run', async () => {
    const cwd = await createProject()
    const before = readFileSync(resolve(cwd, 'zeus-ui.lock.json'), 'utf-8')
    try {
      await remove(['button', '--cwd', cwd, '--dry-run'])
      expect(existsSync(resolve(cwd, 'src/components/ui/button.tsx'))).toBe(
        true,
      )
      expect(readFileSync(resolve(cwd, 'zeus-ui.lock.json'), 'utf-8')).toBe(
        before,
      )
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('refuses a shared registry dependency still required by another component', async () => {
    const cwd = await createProject()
    try {
      await remove(['cn', '--cwd', cwd, '--force'])
      expect(existsSync(resolve(cwd, 'src/lib/cn.ts'))).toBe(true)
      expect(readComponentsLock(cwd).components.cn).toBeDefined()
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects all unsafe targets before deleting any file', async () => {
    const cwd = await createProject()
    const lock = readComponentsLock(cwd)
    lock.components.button.files.push('../outside.ts')
    writeFileSync(resolve(cwd, 'zeus-ui.lock.json'), JSON.stringify(lock))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await remove(['button', '--cwd', cwd, '--force'])
      expect(existsSync(resolve(cwd, 'src/components/ui/button.tsx'))).toBe(
        true,
      )
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects a symlink target even when its destination is missing', async () => {
    const cwd = await createProject()
    const target = resolve(cwd, 'src/components/ui/button.tsx')
    await rm(target)
    symlinkSync(resolve(cwd, 'missing.tsx'), target)
    const before = readFileSync(resolve(cwd, 'zeus-ui.lock.json'), 'utf-8')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await remove(['button', '--cwd', cwd, '--force'])
      expect(readFileSync(resolve(cwd, 'zeus-ui.lock.json'), 'utf-8')).toBe(
        before,
      )
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects symlink parent directories even with --force', async () => {
    const cwd = await createProject()
    const outside = await mkdtemp(join(tmpdir(), 'zeus-web-remove-outside-'))
    const target = resolve(cwd, 'src/components/ui/button.tsx')
    const outsideFile = resolve(outside, 'button.tsx')
    await rm(dirname(target), { recursive: true, force: true })
    writeFileSync(outsideFile, 'outside')
    symlinkSync(outside, dirname(target), 'junction')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await remove(['button', '--cwd', cwd, '--force'])
      expect(readFileSync(outsideFile, 'utf-8')).toBe('outside')
      expect(existsSync(target)).toBe(true)
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
      await rm(outside, { recursive: true, force: true })
    }
  })

  it('removes missing files from the lock and leaves untracked neighbors alone', async () => {
    const cwd = await createProject()
    const neighbor = resolve(cwd, 'src/components/ui/custom.tsx')
    writeFileSync(neighbor, 'owned by the app')
    await rm(resolve(cwd, 'src/components/ui/button.tsx'))
    try {
      await remove(['button', '--cwd', cwd])
      expect(readComponentsLock(cwd).components.button).toBeUndefined()
      expect(readFileSync(neighbor, 'utf-8')).toBe('owned by the app')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('retains a target tracked by an unselected component', async () => {
    const cwd = await createProject()
    const lock = readComponentsLock(cwd)
    const target = 'src/components/ui/button.tsx'
    lock.components.input.files.push(target)
    lock.components.input.fileHashes![target] = hashString('button')
    await writeComponentsLock(cwd, lock)
    try {
      await remove(['button', '--cwd', cwd, '--force'])
      expect(existsSync(resolve(cwd, target))).toBe(true)
      expect(readComponentsLock(cwd).components.button).toBeUndefined()
      expect(readComponentsLock(cwd).components.input.files).toContain(target)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('removes every tracked entry with --all', async () => {
    const cwd = await createProject()
    try {
      await remove(['--all', '--cwd', cwd])
      expect(readComponentsLock(cwd).components).toEqual({})
      expect(existsSync(resolve(cwd, 'src/lib/cn.ts'))).toBe(false)
      expect(existsSync(resolve(cwd, 'package.json'))).toBe(true)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('does not treat a directory as a removable tracked file', async () => {
    const cwd = await createProject()
    const target = resolve(cwd, 'src/components/ui/button.tsx')
    await rm(target)
    mkdirSync(target)
    writeFileSync(resolve(target, 'owned.ts'), 'owned')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await remove(['button', '--cwd', cwd, '--force'])
      expect(readFileSync(resolve(target, 'owned.ts'), 'utf-8')).toBe('owned')
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects malformed locks before touching tracked files', async () => {
    const cwd = await createProject()
    writeFileSync(
      resolve(cwd, 'zeus-ui.lock.json'),
      '{"version":1,"components":[]}',
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await remove(['button', '--cwd', cwd, '--force'])
      expect(existsSync(resolve(cwd, 'src/components/ui/button.tsx'))).toBe(
        true,
      )
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
  it.each([
    '../outside.ts',
    '/tmp/outside.ts',
    'src/../outside.ts',
    'src\\file.ts',
    'C:/file.ts',
    './src/file.ts',
    'src//file.ts',
  ])('rejects unsafe path %s before deleting files', async target => {
    const cwd = await createProject()
    const lock = readComponentsLock(cwd)
    lock.components.button.files = [target]
    delete lock.components.button.fileHashes
    writeFileSync(resolve(cwd, 'zeus-ui.lock.json'), JSON.stringify(lock))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await remove(['--all', '--cwd', cwd, '--force'])
      expect(existsSync(resolve(cwd, 'src/components/ui/button.tsx'))).toBe(
        true,
      )
      expect(existsSync(resolve(cwd, 'src/lib/cn.ts'))).toBe(true)
      expect(process.exitCode).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects a missing cwd value instead of consuming the next option', () => {
    expect(() => parseRemoveArgs(['button', '--cwd', '--force'])).toThrow(
      '--cwd requires a directory path',
    )
    expect(() => parseRemoveArgs(['button', '--cwd='])).toThrow(
      '--cwd requires a directory path',
    )
  })
})
