import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { add } from '../src/commands/add'
import { diff } from '../src/commands/diff'
import { update } from '../src/commands/update'
import {
  createDefaultComponentsConfig,
  getComponentsConfigPath,
} from '../src/config'
import { readComponentsLock } from '../src/lock'

afterEach(() => {
  process.exitCode = 0
  vi.restoreAllMocks()
})

async function createFixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'zeus-web-registry-maintenance-'))
  const registryRoot = await mkdtemp(
    join(tmpdir(), 'zeus-web-remote-registry-'),
  )
  mkdirSync(resolve(cwd, 'src'), { recursive: true })
  mkdirSync(resolve(registryRoot, 'templates/react'), { recursive: true })
  writeFileSync(
    getComponentsConfigPath(cwd),
    JSON.stringify(createDefaultComponentsConfig({ srcDir: 'src' })),
  )
  writeFileSync(
    resolve(registryRoot, 'registry.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: '@example/registry',
      version: '1.0.0',
      items: [
        {
          name: 'badge',
          type: 'component',
          description: 'Badge component',
          frameworks: ['react'],
          dependencies: [],
          registryDependencies: [],
          files: [
            {
              framework: 'react',
              source: 'templates/react/badge.tsx',
              target: 'components/ui/badge.tsx',
            },
          ],
        },
      ],
    }),
  )
  const template = resolve(registryRoot, 'templates/react/badge.tsx')
  writeFileSync(template, 'export const Badge = () => "v1"\n')
  return {
    cwd,
    registryRoot,
    registry: resolve(registryRoot, 'registry.json'),
    template,
  }
}

async function cleanup(fixture: Awaited<ReturnType<typeof createFixture>>) {
  await rm(fixture.cwd, { recursive: true, force: true })
  await rm(fixture.registryRoot, { recursive: true, force: true })
}

describe('registry-backed maintenance', () => {
  it('diffs and updates files from the locked registry source', async () => {
    const fixture = await createFixture()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await add(['badge', '--registry', fixture.registry, '--cwd', fixture.cwd])
      writeFileSync(fixture.template, 'export const Badge = () => "v2"\n')

      await diff(['badge', '--json', '--cwd', fixture.cwd])
      const lastCall = log.mock.calls[log.mock.calls.length - 1]
      const report = JSON.parse(String(lastCall?.[0])) as {
        entries: Array<{ status: string }>
      }
      expect(report.entries[0].status).toBe('registry-changed')

      await update(['badge', '--cwd', fixture.cwd])
      expect(
        readFileSync(
          resolve(fixture.cwd, 'src/components/ui/badge.tsx'),
          'utf-8',
        ),
      ).toContain('v2')
    } finally {
      await cleanup(fixture)
    }
  })

  it('preserves local changes and refuses cleanup of lock registries still in use', async () => {
    const fixture = await createFixture()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await add(['badge', '--registry', fixture.registry, '--cwd', fixture.cwd])
      const target = resolve(fixture.cwd, 'src/components/ui/badge.tsx')
      writeFileSync(target, 'local edit\n')
      writeFileSync(fixture.template, 'export const Badge = () => "v2"\n')

      await update(['badge', '--cwd', fixture.cwd])
      expect(readFileSync(target, 'utf-8')).toBe('local edit\n')
      const lock = readComponentsLock(fixture.cwd)
      expect(Object.keys(lock.registries)).toEqual([
        lock.components.badge.registry,
      ])
      expect(log.mock.calls.flat().join('\n')).toContain('SKIP')
    } finally {
      await cleanup(fixture)
      expect(existsSync(fixture.cwd)).toBe(false)
    }
  })
})
