import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  createAiGuideContent,
  parseAiArgs,
  rewriteAiGuideContent,
  writeAiGuide,
} from '../src/commands/ai'
import { createDefaultComponentsConfig } from '../src/config'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-ai-'))
}

async function writeComponentsJson(
  cwd: string,
  config = createDefaultComponentsConfig(),
) {
  await mkdir(cwd, { recursive: true })
  writeFileSync(
    resolve(cwd, 'components.json'),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf-8',
  )
}

describe('@zeus-web/cli ai', () => {
  it('parses default options', () => {
    const parsed = parseAiArgs([], '/repo')

    expect(parsed.options).toEqual({
      cwd: '/repo',
      format: 'markdown',
      output: 'zeus-web.ai.md',
      overwrite: false,
      dryRun: false,
    })
  })

  it('parses json output', () => {
    const parsed = parseAiArgs(['--json'], '/repo')

    expect(parsed.options.format).toBe('json')
    expect(parsed.options.output).toBe('zeus-web.ai.json')
  })

  it('preserves explicit output when format appears later', () => {
    const parsed = parseAiArgs(['--output', 'docs/ai.json', '--json'], '/repo')

    expect(parsed.options.format).toBe('json')
    expect(parsed.options.output).toBe('docs/ai.json')
  })

  it('preserves explicit output when cursor appears later', () => {
    const parsed = parseAiArgs(
      ['--output', 'docs/zeus.md', '--cursor'],
      '/repo',
    )

    expect(parsed.options.format).toBe('markdown')
    expect(parsed.options.output).toBe('docs/zeus.md')
  })

  it('parses cursor output', () => {
    const parsed = parseAiArgs(['--cursor'], '/repo')

    expect(parsed.options.format).toBe('markdown')
    expect(parsed.options.output).toBe('.cursor/rules/zeus-web.mdc')
  })

  it('parses cwd output and overwrite', () => {
    const parsed = parseAiArgs(
      ['--cwd', 'demo', '--output', 'docs/ai.md', '--overwrite'],
      '/repo',
    )

    expect(parsed.options.cwd).toBe(resolve('/repo', 'demo'))
    expect(parsed.options.output).toBe('docs/ai.md')
    expect(parsed.options.overwrite).toBe(true)
  })

  it('renders markdown content', () => {
    const content = createAiGuideContent('markdown')

    expect(content).toContain('# Zeus Web AI Guide')
    expect(content).toContain('zweb add button')
    expect(content).toContain('@/components/ui/button')
  })

  it('renders json content', () => {
    const content = createAiGuideContent('json')
    const parsed = JSON.parse(content)

    expect(parsed.packageName).toBe('@zeus-web/ai')
    expect(parsed.components).toHaveLength(15)
  })

  it('rewrites aliases from components config', () => {
    const config = createDefaultComponentsConfig()
    config.aliases.ui = '~/components/ui'
    config.aliases.lib = '~/shared/lib'

    const source = [
      "import { Button } from '@/components/ui/button'",
      "import { cn } from '@/lib/utils'",
    ].join('\n')

    expect(rewriteAiGuideContent(source, config)).toBe(
      [
        "import { Button } from '~/components/ui/button'",
        "import { cn } from '~/shared/lib/utils'",
      ].join('\n'),
    )
  })

  it('dry-runs without writing files', async () => {
    const cwd = await createTempDir()

    try {
      const result = await writeAiGuide({
        cwd,
        format: 'markdown',
        output: 'zeus-web.ai.md',
        overwrite: false,
        dryRun: true,
      })

      expect(result).toEqual({
        output: 'zeus-web.ai.md',
        planned: true,
        written: false,
        skipped: false,
      })
      expect(existsSync(resolve(cwd, 'zeus-web.ai.md'))).toBe(false)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('writes markdown guide', async () => {
    const cwd = await createTempDir()

    try {
      const result = await writeAiGuide({
        cwd,
        format: 'markdown',
        output: 'zeus-web.ai.md',
        overwrite: false,
        dryRun: false,
      })

      expect(result.written).toBe(true)
      expect(readFileSync(resolve(cwd, 'zeus-web.ai.md'), 'utf-8')).toContain(
        '# Zeus Web AI Guide',
      )
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('writes guide using components config aliases when available', async () => {
    const cwd = await createTempDir()
    const config = createDefaultComponentsConfig()
    config.aliases.ui = '~/components/ui'

    try {
      await writeComponentsJson(cwd, config)

      await writeAiGuide({
        cwd,
        format: 'markdown',
        output: 'zeus-web.ai.md',
        overwrite: false,
        dryRun: false,
      })

      const content = readFileSync(resolve(cwd, 'zeus-web.ai.md'), 'utf-8')

      expect(content).toContain('~/components/ui/button')
      expect(content).not.toContain('@/components/ui/button')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('skips existing file by default', async () => {
    const cwd = await createTempDir()

    try {
      await writeAiGuide({
        cwd,
        format: 'markdown',
        output: 'zeus-web.ai.md',
        overwrite: false,
        dryRun: false,
      })

      const result = await writeAiGuide({
        cwd,
        format: 'markdown',
        output: 'zeus-web.ai.md',
        overwrite: false,
        dryRun: false,
      })

      expect(result.skipped).toBe(true)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
