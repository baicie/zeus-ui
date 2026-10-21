import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { theme } from '../src/commands/theme'
import {
  createDefaultComponentsConfig,
  getComponentsConfigPath,
} from '../src/config'

afterEach(() => {
  process.exitCode = 0
  vi.restoreAllMocks()
})

describe('zweb theme', () => {
  it('generates a custom theme from a preset with light and dark overrides', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'zeus-web-theme-'))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mkdirSync(resolve(cwd, 'src'), { recursive: true })
      writeFileSync(
        getComponentsConfigPath(cwd),
        JSON.stringify(createDefaultComponentsConfig()),
      )

      await theme([
        'add',
        'brand',
        '--from',
        'slate',
        '--color',
        'light.primary=12 80% 45%',
        '--color=dark.primary=12 70% 65%',
        '--cwd',
        cwd,
        '--json',
      ])

      expect(error).not.toHaveBeenCalled()

      const cssPath = resolve(cwd, 'src/styles/themes/brand.css')
      expect(existsSync(cssPath)).toBe(true)
      const css = readFileSync(cssPath, 'utf-8')
      expect(css).toContain("[data-theme='brand'] {")
      expect(css).toContain('--primary: 12 80% 45%;')
      expect(css).toContain('--primary: 12 70% 65%;')
      expect(css).toContain('--zw-primary: var(--primary);')
      expect(css).toContain('--zeus-primary: var(--primary);')
      expect(css).toContain('--zeus-popover: var(--popover);')
      const lastCall = log.mock.calls[log.mock.calls.length - 1]
      expect(JSON.parse(String(lastCall?.[0]))).toEqual({
        name: 'brand',
        from: 'slate',
        file: 'src/styles/themes/brand.css',
      })
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('refuses to overwrite generated themes', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'zeus-web-theme-'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      writeFileSync(
        getComponentsConfigPath(cwd),
        JSON.stringify(createDefaultComponentsConfig()),
      )
      await theme(['add', 'brand', '--cwd', cwd])
      process.exitCode = 0

      await theme(['add', 'brand', '--cwd', cwd])

      expect(process.exitCode).toBe(1)
      expect(error.mock.calls.flat().join('\n')).toContain('EEXIST')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects styles aliases outside the project', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'zeus-web-theme-'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const config = createDefaultComponentsConfig()
      config.aliases.styles = resolve(cwd, '../outside')
      writeFileSync(getComponentsConfigPath(cwd), JSON.stringify(config))

      await theme(['add', 'brand', '--cwd', cwd])

      expect(process.exitCode).toBe(1)
      expect(error.mock.calls.flat().join('\n')).toContain(
        'must resolve inside the project',
      )
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects styles aliases that escape through a symbolic link', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'zeus-web-theme-'))
    const outside = await mkdtemp(join(tmpdir(), 'zeus-web-theme-outside-'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const config = createDefaultComponentsConfig()
      mkdirSync(resolve(cwd, 'src'), { recursive: true })
      symlinkSync(outside, resolve(cwd, 'src/styles'), 'dir')
      config.aliases.styles = '@/styles'
      writeFileSync(getComponentsConfigPath(cwd), JSON.stringify(config))

      await theme(['add', 'brand', '--cwd', cwd])

      expect(process.exitCode).toBe(1)
      expect(error.mock.calls.flat().join('\n')).toContain(
        'must resolve inside the project',
      )
      expect(existsSync(resolve(outside, 'themes/brand.css'))).toBe(false)
    } finally {
      await rm(cwd, { recursive: true, force: true })
      await rm(outside, { recursive: true, force: true })
    }
  })

  it('rejects malformed theme color scopes', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'zeus-web-theme-'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      writeFileSync(
        getComponentsConfigPath(cwd),
        JSON.stringify(createDefaultComponentsConfig()),
      )

      await theme([
        'add',
        'brand',
        '--cwd',
        cwd,
        '--color',
        'light.primary.extra=12 80% 45%',
      ])

      expect(process.exitCode).toBe(1)
      expect(error.mock.calls.flat().join('\n')).toContain(
        'exactly one mode and token',
      )
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
