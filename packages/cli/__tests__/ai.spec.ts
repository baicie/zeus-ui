import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  createAiGuideContent,
  parseAiArgs,
  writeAiGuide,
} from '../src/commands/ai'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-ai-'))
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
    expect(parsed.components).toHaveLength(6)
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
