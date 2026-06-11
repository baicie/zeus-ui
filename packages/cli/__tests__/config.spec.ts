import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  createDefaultComponentsConfig,
  ensureThemeCss,
  resolveAliasToPath,
  resolveRegistryTarget,
  writeComponentsConfig,
} from '../src/config'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-config-'))
}

describe('@zeus-web/cli config', () => {
  it('creates default components config', () => {
    const config = createDefaultComponentsConfig({
      style: 'slate',
      css: 'app/globals.css',
    })

    expect(config).toMatchObject({
      framework: 'react',
      style: 'slate',
      tailwind: {
        css: 'app/globals.css',
        cssVariables: true,
      },
      aliases: {
        ui: '@/components/ui',
        lib: '@/lib',
      },
    })
  })

  it('writes components.json', async () => {
    const cwd = await createTempDir()

    try {
      const result = await writeComponentsConfig({
        cwd,
        config: createDefaultComponentsConfig(),
        overwrite: false,
      })

      expect(result).toBe('created')
      expect(existsSync(resolve(cwd, 'components.json'))).toBe(true)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('resolves @ alias into src when src exists', async () => {
    const cwd = await createTempDir()

    try {
      mkdirSync(resolve(cwd, 'src'), { recursive: true })

      expect(resolveAliasToPath(cwd, '@/components/ui')).toBe(
        resolve(cwd, 'src/components/ui'),
      )
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('resolves registry target using config aliases', async () => {
    const cwd = await createTempDir()

    try {
      mkdirSync(resolve(cwd, 'src'), { recursive: true })

      const config = createDefaultComponentsConfig()

      expect(
        resolveRegistryTarget(cwd, config, 'components/ui/button.tsx'),
      ).toBe(resolve(cwd, 'src/components/ui/button.tsx'))

      expect(resolveRegistryTarget(cwd, config, 'lib/utils.ts')).toBe(
        resolve(cwd, 'src/lib/utils.ts'),
      )
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('creates theme css file', async () => {
    const cwd = await createTempDir()

    try {
      const config = createDefaultComponentsConfig({
        style: 'zinc',
        css: 'src/styles/globals.css',
      })

      const result = await ensureThemeCss({
        cwd,
        config,
        overwrite: false,
      })

      expect(result).toBe('created')
      expect(
        readFileSync(resolve(cwd, 'src/styles/globals.css'), 'utf-8'),
      ).toContain("@import '@zeus-web/themes/zinc.css';")
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('appends theme import using existing config style', async () => {
    const cwd = await createTempDir()

    try {
      const config = createDefaultComponentsConfig({
        style: 'slate',
        css: 'src/styles/globals.css',
      })

      const result = await ensureThemeCss({
        cwd,
        config,
        overwrite: false,
      })

      expect(result).toBe('created')
      expect(
        readFileSync(resolve(cwd, 'src/styles/globals.css'), 'utf-8'),
      ).toContain("@import '@zeus-web/themes/slate.css';")
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
