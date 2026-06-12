import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { parseInitArgs } from '../src/commands/init'
import {
  createDefaultComponentsConfig,
  ensureCnUtil,
  ensureThemeCss,
  getComponentsConfigPath,
  readComponentsConfig,
  updateComponentsConfig,
} from '../src/config'
import { detectProject } from '../src/project'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-cli-'))
}

function writePackageJson(root: string, dependencies: Record<string, string>) {
  writeFileSync(
    resolve(root, 'package.json'),
    `${JSON.stringify({ dependencies }, null, 2)}\n`,
    'utf-8',
  )
}

describe('@zeus-web/cli init', () => {
  it('parses init options', () => {
    const parsed = parseInitArgs(
      [
        '--cwd',
        'demo',
        '--framework',
        'vue',
        '--style',
        'slate',
        '--css',
        'app/zeus.css',
        '--overwrite',
        '--dry-run',
        '--package-manager',
        'npm',
      ],
      '/repo',
    )

    expect(parsed.options).toEqual({
      cwd: resolve('/repo', 'demo'),
      framework: 'vue',
      style: 'slate',
      css: 'app/zeus.css',
      overwrite: true,
      dryRun: true,
      install: false,
      packageManager: 'npm',
    })
  })

  it('rejects unsupported framework', () => {
    expect(() => parseInitArgs(['--framework', 'svelte'])).toThrow(
      'Unsupported framework',
    )
  })

  it('rejects unsupported style', () => {
    expect(() => parseInitArgs(['--style', 'bad'])).toThrow(
      'Unsupported style: bad',
    )
  })

  it('detects react projects', async () => {
    const root = await createTempDir()

    try {
      writePackageJson(root, { react: '^19.0.0' })
      writeFileSync(resolve(root, 'tsconfig.json'), '{}', 'utf-8')

      expect(detectProject(root)).toMatchObject({
        framework: 'react',
        typescript: true,
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('detects vue projects', async () => {
    const root = await createTempDir()

    try {
      writePackageJson(root, { vue: '^3.0.0' })

      expect(detectProject(root)).toMatchObject({
        framework: 'vue',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('asks for explicit framework when both React and Vue exist', async () => {
    const root = await createTempDir()

    try {
      writePackageJson(root, {
        react: '^19.0.0',
        vue: '^3.0.0',
      })

      expect(() => detectProject(root)).toThrow(
        'Both React and Vue dependencies were detected',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('creates default zeus-ui config', () => {
    const config = createDefaultComponentsConfig({
      framework: 'vue',
      style: 'zinc',
      typescript: true,
      srcDir: 'src',
      theme: {
        radius: 'xl',
        motion: 'expressive',
        darkMode: 'media',
        accentColor: '240 5.9% 10%',
      },
    })

    expect(config.$schema).toBe('https://zeus-web.dev/schema/zeus-ui.json')
    expect(config.framework).toBe('vue')
    expect(config.style).toBe('zinc')
    expect(config.typescript).toBe(true)
    expect(config.srcDir).toBe('src')
    expect(config.tailwind.css).toBe('src/styles/zeus.css')
    expect(config.aliases.ui).toBe('@/components/ui')
    expect(config.theme).toEqual({
      radius: 'xl',
      motion: 'expressive',
      darkMode: 'media',
      accentColor: '240 5.9% 10%',
    })
  })

  it('writes managed registry globals and theme override block', async () => {
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

      const css = readFileSync(resolve(root, 'src/styles/zeus.css'), 'utf-8')

      expect(result).toBe('created')
      expect(css).toContain('/* zeus-web registry globals:start */')
      expect(css).toContain('--zeus-primary')
      expect(css).toContain('--zeus-destructive')
      expect(css).toContain('/* zeus-web theme overrides:start */')
      expect(css).toContain('--zeus-radius-md: 0.75rem;')
      expect(css).toContain('--zeus-primary: 220 90% 56%;')
      expect(css).toContain('--zw-theme-dark-mode: data;')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('creates cn utility from registry template', async () => {
    const root = await createTempDir()

    try {
      mkdirSync(resolve(root, 'src/lib'), { recursive: true })

      const config = createDefaultComponentsConfig()
      const result = await ensureCnUtil({
        cwd: root,
        config,
        overwrite: false,
      })

      const cnPath = resolve(root, 'src/lib/cn.ts')
      const cn = readFileSync(cnPath, 'utf-8')

      expect(result).toBe('created')
      expect(cn).toContain('export function cn')
      expect(cn).toContain('ClassValue')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('writes zeus-ui.json and reads it back', async () => {
    const root = await createTempDir()

    try {
      const config = createDefaultComponentsConfig({
        framework: 'vue',
        style: 'neutral',
      })

      writeFileSync(
        getComponentsConfigPath(root),
        `${JSON.stringify(config, null, 2)}\n`,
        'utf-8',
      )

      const next = readComponentsConfig(root)

      expect(next.framework).toBe('vue')
      expect(next.style).toBe('neutral')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('keeps legacy components.json readable', async () => {
    const root = await createTempDir()

    try {
      const config = createDefaultComponentsConfig({
        framework: 'react',
        style: 'default',
        typescript: true,
        srcDir: 'src',
        theme: {},
      })

      writeFileSync(
        resolve(root, 'components.json'),
        `${JSON.stringify(config, null, 2)}\n`,
        'utf-8',
      )

      const next = readComponentsConfig(root)

      expect(next.framework).toBe('react')
      expect(next.style).toBe('default')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('updates zeus-ui.json theme config', async () => {
    const root = await createTempDir()

    try {
      const config = createDefaultComponentsConfig()
      writeFileSync(
        getComponentsConfigPath(root),
        `${JSON.stringify(config, null, 2)}\n`,
        'utf-8',
      )

      await updateComponentsConfig({
        cwd: root,
        updater: current => ({
          ...current,
          style: 'neutral',
          theme: {
            ...current.theme,
            radius: 'sm',
            motion: 'none',
            darkMode: 'media',
          },
        }),
      })

      const next = readComponentsConfig(root)

      expect(next.style).toBe('neutral')
      expect(next.theme.radius).toBe('sm')
      expect(next.theme.motion).toBe('none')
      expect(next.theme.darkMode).toBe('media')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('validates zeus-ui.json when reading config', async () => {
    const root = await createTempDir()

    try {
      const config = createDefaultComponentsConfig()
      writeFileSync(
        getComponentsConfigPath(root),
        JSON.stringify(
          {
            ...config,
            framework: 'svelte',
          },
          null,
          2,
        ),
        'utf-8',
      )

      expect(() => readComponentsConfig(root)).toThrow(
        'Only framework "react" and "vue" are supported.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('updates existing css without duplicating managed blocks', async () => {
    const root = await createTempDir()

    try {
      mkdirSync(resolve(root, 'src/styles'), { recursive: true })
      writeFileSync(
        resolve(root, 'src/styles/zeus.css'),
        [
          'body { margin: 0; }',
          '/* zeus-web theme overrides:start */',
          ':root {',
          '  --zeus-radius-md: 0.375rem;',
          '}',
          '/* zeus-web theme overrides:end */',
          '',
        ].join('\n'),
        'utf-8',
      )

      const config = createDefaultComponentsConfig({
        theme: {
          radius: 'xl',
          motion: 'expressive',
          darkMode: 'class',
        },
      })

      const result = await ensureThemeCss({
        cwd: root,
        config,
        overwrite: false,
      })

      const css = readFileSync(resolve(root, 'src/styles/zeus.css'), 'utf-8')

      expect(result).toBe('updated')
      expect(css).toContain('body { margin: 0; }')
      expect(css).toContain('/* zeus-web registry globals:start */')
      expect(css).toContain('--zeus-radius-md: 1rem;')
      expect(
        css.match(/\/\* zeus-web theme overrides:start \*\//g),
      ).toHaveLength(1)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not overwrite cn utility by default', async () => {
    const root = await createTempDir()

    try {
      mkdirSync(resolve(root, 'src/lib'), { recursive: true })
      writeFileSync(
        resolve(root, 'src/lib/cn.ts'),
        'export const cn = () => "custom"\n',
        'utf-8',
      )

      const config = createDefaultComponentsConfig()
      const result = await ensureCnUtil({
        cwd: root,
        config,
        overwrite: false,
      })

      expect(result).toBe('skipped')
      expect(readFileSync(resolve(root, 'src/lib/cn.ts'), 'utf-8')).toContain(
        '"custom"',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
