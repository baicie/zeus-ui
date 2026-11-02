import { isAbsolute, resolve } from 'node:path'

import pc from 'picocolors'

import { checkAuthorPackage, formatAuthorCheckReport } from '../author'

interface AuthorCheckOptions {
  cwd: string
  json: boolean
  packageDir?: string
  zeusVersion?: string
}

export function parseAuthorCheckArgs(
  args: string[],
  cwd = process.cwd(),
): AuthorCheckOptions {
  const options: AuthorCheckOptions = { cwd, json: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--json') {
      options.json = true
      continue
    }
    if (arg === '--cwd') {
      const value = args[index + 1]
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      index += 1
      continue
    }
    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      continue
    }
    if (arg === '--dir') {
      const value = args[index + 1]
      if (!value) throw new Error('--dir requires a package directory')
      options.packageDir = isAbsolute(value) ? value : resolve(cwd, value)
      index += 1
      continue
    }
    if (arg.startsWith('--dir=')) {
      const value = arg.slice('--dir='.length)
      if (!value) throw new Error('--dir requires a package directory')
      options.packageDir = isAbsolute(value) ? value : resolve(cwd, value)
      continue
    }
    if (arg === '--zeus-version') {
      const value = args[index + 1]
      if (!value) throw new Error('--zeus-version requires a version')
      options.zeusVersion = value
      index += 1
      continue
    }
    if (arg.startsWith('--zeus-version=')) {
      const value = arg.slice('--zeus-version='.length)
      if (!value) throw new Error('--zeus-version requires a version')
      options.zeusVersion = value
      continue
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    if (options.packageDir) throw new Error(`Unexpected argument: ${arg}`)
    options.packageDir = isAbsolute(arg) ? arg : resolve(cwd, arg)
  }
  return options
}

export async function author(args: string[]): Promise<void> {
  try {
    const [subcommand, ...rest] = args
    const command = subcommand ?? 'check'
    if (command !== 'check') {
      throw new Error(
        `Unknown author command: ${command}. Available: zweb author check [dir]`,
      )
    }

    const options = parseAuthorCheckArgs(rest)
    const report = checkAuthorPackage({
      packageDir: options.packageDir ?? options.cwd,
      zeusVersion: options.zeusVersion,
    })

    if (options.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      const printer = report.valid ? pc.green : pc.red
      console.log(printer(formatAuthorCheckReport(report)))
    }

    if (!report.valid) process.exitCode = 1
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
