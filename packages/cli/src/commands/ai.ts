import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import {
  aiMetadata,
  renderAiJson,
  renderAiMarkdown,
  validateAiMetadata,
} from '@zeus-web/ai'
import pc from 'picocolors'

export type AiOutputFormat = 'markdown' | 'json'

export interface AiOptions {
  cwd: string
  format: AiOutputFormat
  output: string
  overwrite: boolean
  dryRun: boolean
}

export interface ParsedAiArgs {
  options: AiOptions
}

export interface AiWriteResult {
  output: string
  planned: boolean
  written: boolean
  skipped: boolean
}

function defaultOutputForFormat(format: AiOutputFormat): string {
  return format === 'json' ? 'zeus-web.ai.json' : 'zeus-web.ai.md'
}

function assertSafeTarget(cwd: string, target: string): string {
  const absoluteTarget = resolve(cwd, target)
  const relativeTarget = relative(cwd, absoluteTarget).replace(/\\/g, '/')

  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith('../') ||
    isAbsolute(relativeTarget)
  ) {
    throw new Error(`Refusing to write outside cwd: ${target}`)
  }

  return absoluteTarget
}

function parseFormat(value: string): AiOutputFormat {
  if (value === 'markdown' || value === 'md') return 'markdown'
  if (value === 'json') return 'json'

  throw new Error(`Unsupported AI output format: ${value}`)
}

export function parseAiArgs(args: string[], cwd = process.cwd()): ParsedAiArgs {
  const options: AiOptions = {
    cwd,
    format: 'markdown',
    output: defaultOutputForFormat('markdown'),
    overwrite: false,
    dryRun: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--overwrite') {
      options.overwrite = true
      continue
    }

    if (arg === '--json') {
      options.format = 'json'
      options.output = defaultOutputForFormat('json')
      continue
    }

    if (arg === '--markdown' || arg === '--md') {
      options.format = 'markdown'
      options.output = defaultOutputForFormat('markdown')
      continue
    }

    if (arg === '--cursor') {
      options.format = 'markdown'
      options.output = '.cursor/rules/zeus-web.mdc'
      continue
    }

    if (arg === '--cwd') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      continue
    }

    if (arg === '--format') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--format requires a value')
      }

      options.format = parseFormat(value)

      if (
        options.output === 'zeus-web.ai.md' ||
        options.output === 'zeus-web.ai.json'
      ) {
        options.output = defaultOutputForFormat(options.format)
      }

      index += 1
      continue
    }

    if (arg.startsWith('--format=')) {
      const value = arg.slice('--format='.length)

      if (!value) {
        throw new Error('--format requires a value')
      }

      options.format = parseFormat(value)

      if (
        options.output === 'zeus-web.ai.md' ||
        options.output === 'zeus-web.ai.json'
      ) {
        options.output = defaultOutputForFormat(options.format)
      }

      continue
    }

    if (arg === '--output') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--output requires a file path')
      }

      options.output = value
      index += 1
      continue
    }

    if (arg.startsWith('--output=')) {
      const value = arg.slice('--output='.length)

      if (!value) {
        throw new Error('--output requires a file path')
      }

      options.output = value
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return {
    options,
  }
}

export function createAiGuideContent(format: AiOutputFormat): string {
  const result = validateAiMetadata(aiMetadata)

  if (!result.valid) {
    throw new Error(
      [
        'Invalid @zeus-web/ai metadata:',
        ...result.errors.map(e => `- ${e}`),
      ].join('\n'),
    )
  }

  return format === 'json'
    ? renderAiJson(aiMetadata)
    : renderAiMarkdown(aiMetadata)
}

export async function writeAiGuide(options: AiOptions): Promise<AiWriteResult> {
  const outputPath = assertSafeTarget(options.cwd, options.output)

  if (existsSync(outputPath) && !options.overwrite) {
    return {
      output: options.output,
      planned: false,
      written: false,
      skipped: true,
    }
  }

  if (options.dryRun) {
    return {
      output: options.output,
      planned: true,
      written: false,
      skipped: false,
    }
  }

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, createAiGuideContent(options.format), 'utf-8')

  return {
    output: options.output,
    planned: false,
    written: true,
    skipped: false,
  }
}

export async function ai(args: string[]) {
  try {
    const { options } = parseAiArgs(args)
    const result = await writeAiGuide(options)

    if (result.planned) {
      console.log(pc.cyan(`Planned AI guide: ${result.output}`))
      return
    }

    if (result.skipped) {
      console.log(
        pc.yellow(
          `${result.output} already exists. Use --overwrite to replace it.`,
        ),
      )
      return
    }

    console.log(pc.green(`Created AI guide: ${result.output}`))
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
