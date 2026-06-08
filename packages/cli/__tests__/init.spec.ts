import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { parseInitArgs } from '../src/commands/init'
import {
  createDefaultComponentsConfig,
  ensureThemeCss,
  readComponentsConfig,
  updateComponentsConfig,
} from '../src/config'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-cli-'))
}

function writeComponentsJson(root: string): void {
  mkdirSync(resolve(root, 'src/styles'), { recursive: true })
  writeFileSync(
    resolve(root, 'components.json'),
    `${JSON.stringify(createDefaultComponentsConfig(), null, 2)}\n`,
    'utf-8',
  )
}

describe('@zeus-web/cli init', () => {
  it('parses init options', () => {
    const parsed = parseInitArgs(
      [
        '--cwd',
        'demo',
        '--style',
        'slate',
        '--css',
        'app/globals.css',
        '--overwrite',
        '--no-install',
        '--package-manager',
        'npm',
      ],
      '/repo',
    )

    expect(parsed.options).toEqual({
      cwd: resolve('/repo', 'demo'),
      style: 'slate',
      css: 'app/globals.css',
      overwrite: true,
      install: false,
      packageManager: 'npm',
    })
  })

  it('rejects unsupported style', () => {
    expect(() => parseInitArgs(['--style', 'bad'])).toThrow(
      'Unsupported style: bad',
    )
  })

  it('rejects empty css option', () => {
    expect(() => parseInitArgs(['--css='])).toThrow(
      '--css requires a file path',
    )
  })

  it('rejects empty style option', () => {
    expect(() => parseInitArgs(['--style='])).toThrow(
      '--style requires a theme name',
    )
  })

  it('parses init theme options', () => {
    const parsed = parseInitArgs([
      '--style',
      'slate',
      '--radius',
      'lg',
      '--motion',
      'reduced',
      '--dark-mode',
      'data',
      '--accent',
      '220 90% 56%',
      '--no-install',
    ])
    expect(parsed.options.style).toBe('slate')
    expect(parsed.options.radius).toBe('lg')
    expect(parsed.options.motion).toBe('reduced')
    expect(parsed.options.darkMode).toBe('data')
    expect(parsed.options.accentColor).toBe('220 90% 56%')
    expect(parsed.options.install).toBe(false)
  })

  it('creates default config with theme config', () => {
    const config = createDefaultComponentsConfig({
      style: 'zinc',
      theme: {
        radius: 'xl',
        motion: 'expressive',
        darkMode: 'media',
        accentColor: '240 5.9% 10%',
      },
    })
    expect(config.style).toBe('zinc')
    expect(config.theme).toEqual({
      radius: 'xl',
      motion: 'expressive',
      darkMode: 'media',
      accentColor: '240 5.9% 10%',
    })
  })

  it('writes managed theme override block', async () => {
    const root = await createTempDir()
    try {
      const config = createDefaultComponentsConfig({
        style: 'slate',
        theme: {
          radius: 'lg',
          motion: 'reduced',
          darkMode: 'data',
          accentColor: '220 90% 56%',
        },
      })
      const result = await ensureThemeCss({
        cwd: root,
        config,
        overwrite: false,
      })
      const css = readFileSync(resolve(root, 'src/styles/globals.css'), 'utf-8')
      expect(result).toBe('created')
      expect(css).toContain("@import '@zeus-web/themes/slate.css';")
      expect(css).toContain('/* zeus-web theme overrides:start */')
      expect(css).toContain('--radius: 0.75rem;')
      expect(css).toContain('--zw-duration-normal: 120ms;')
      expect(css).toContain('--primary: 220 90% 56%;')
      expect(css).toContain('--zw-theme-dark-mode: data;')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('updates existing theme import and override block', async () => {
    const root = await createTempDir()
    try {
      mkdirSync(resolve(root, 'src/styles'), { recursive: true })
      writeFileSync(
        resolve(root, 'src/styles/globals.css'),
        [
          "@import '@zeus-web/themes/default.css';",
          'body { margin: 0; }',
          '/* zeus-web theme overrides:start */',
          ':root {',
          '  --radius: 0.5rem;',
          '}',
          '/* zeus-web theme overrides:end */',
          '',
        ].join('\n'),
        'utf-8',
      )
      const config = createDefaultComponentsConfig({
        style: 'stone',
        theme: { radius: 'xl', motion: 'expressive', darkMode: 'class' },
      })
      await ensureThemeCss({ cwd: root, config, overwrite: false })
      const css = readFileSync(resolve(root, 'src/styles/globals.css'), 'utf-8')
      expect(css).toContain("@import '@zeus-web/themes/stone.css';")
      expect(css).toContain('body { margin: 0; }')
      expect(css).toContain('--radius: 1rem;')
      expect(css).toContain('--zw-duration-normal: 220ms;')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('updates components.json theme config', async () => {
    const root = await createTempDir()
    try {
      writeComponentsJson(root)
      await updateComponentsConfig({
        cwd: root,
        updater: config => ({
          ...config,
          style: 'neutral',
          theme: {
            ...config.theme,
            radius: 'sm',
            motion: 'none',
            darkMode: 'media',
          },
        }),
      })
      const config = readComponentsConfig(root)
      expect(config.style).toBe('neutral')
      expect(config.theme.radius).toBe('sm')
      expect(config.theme.motion).toBe('none')
      expect(config.theme.darkMode).toBe('media')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('validates config when reading components.json', async () => {
    const root = await createTempDir()
    try {
      mkdirSync(resolve(root, 'src/styles'), { recursive: true })
      writeFileSync(
        resolve(root, 'components.json'),
        JSON.stringify(
          {
            ...createDefaultComponentsConfig(),
            theme: {
              radius: 'bad-radius',
              motion: 'normal',
              darkMode: 'class',
            },
          },
          null,
          2,
        ),
        'utf-8',
      )
      expect(() => readComponentsConfig(root)).toThrow(
        'Unsupported radius preset',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('returns updated when only managed override block changes', async () => {
    const root = await createTempDir()
    try {
      mkdirSync(resolve(root, 'src/styles'), { recursive: true })
      writeFileSync(
        resolve(root, 'src/styles/globals.css'),
        [
          "@import '@zeus-web/themes/default.css';",
          'body { margin: 0; }',
          '/* zeus-web theme overrides:start */',
          ':root {',
          '  --radius: 0.5rem;',
          '  --zw-duration-normal: 180ms;',
          '}',
          '/* zeus-web theme overrides:end */',
          '',
        ].join('\n'),
        'utf-8',
      )
      const config = createDefaultComponentsConfig({
        style: 'default',
        theme: { radius: 'lg', motion: 'normal', darkMode: 'class' },
      })
      const result = await ensureThemeCss({
        cwd: root,
        config,
        overwrite: false,
      })
      const css = readFileSync(resolve(root, 'src/styles/globals.css'), 'utf-8')
      expect(result).toBe('updated')
      expect(css).toContain('--radius: 0.75rem;')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not duplicate theme import when overwrite is true', async () => {
    const root = await createTempDir()
    try {
      mkdirSync(resolve(root, 'src/styles'), { recursive: true })
      writeFileSync(
        resolve(root, 'src/styles/globals.css'),
        [
          "@import '@zeus-web/themes/default.css';",
          'body { margin: 0; }',
          '',
        ].join('\n'),
        'utf-8',
      )
      const config = createDefaultComponentsConfig({
        style: 'zinc',
        theme: { radius: 'md', motion: 'normal', darkMode: 'class' },
      })
      const result = await ensureThemeCss({
        cwd: root,
        config,
        overwrite: true,
      })
      const css = readFileSync(resolve(root, 'src/styles/globals.css'), 'utf-8')
      const imports = css.match(/@import '@zeus-web\/themes\/zinc\.css';/g)
      expect(result).toBe('updated')
      expect(imports).toHaveLength(1)
      expect(css).not.toContain("@import '@zeus-web/themes/default.css';")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
