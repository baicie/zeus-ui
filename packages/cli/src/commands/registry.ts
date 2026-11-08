import type { Registry } from '@zeus-web/registry'

import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

import { validateRegistry } from '@zeus-web/registry'
import pc from 'picocolors'

interface RegistryValidateOptions {
  cwd: string
  json: boolean
  file?: string
}

export function parseRegistryValidateArgs(
  args: string[],
  cwd = process.cwd(),
): RegistryValidateOptions {
  const options: RegistryValidateOptions = { cwd, json: false }
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
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    if (options.file) throw new Error(`Unexpected argument: ${arg}`)
    options.file = arg
  }
  return options
}

export function readRegistryManifest(file: string): Registry {
  if (!existsSync(file)) {
    throw new Error(`Registry manifest not found: ${file}`)
  }
  let value: unknown
  try {
    value = JSON.parse(readFileSync(file, 'utf-8'))
  } catch (error) {
    throw new Error(
      `Registry manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Registry manifest must contain an object.')
  }
  return value as Registry
}

export async function registryValidate(args: string[]): Promise<void> {
  try {
    const options = parseRegistryValidateArgs(args)
    const file = resolve(options.cwd, options.file ?? 'registry.json')
    const manifest = readRegistryManifest(file)
    const result = validateRegistry(manifest)

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            file,
            name: manifest.name,
            version: manifest.version,
            valid: result.valid,
            errors: result.errors,
            diagnostics: result.diagnostics,
          },
          null,
          2,
        ),
      )
      if (!result.valid) process.exitCode = 1
      return
    }

    if (result.valid) {
      console.log(pc.green(`Registry manifest is valid: ${file}`))
      return
    }

    console.error(pc.red(`Registry manifest is invalid: ${file}`))
    for (const diagnostic of result.diagnostics) {
      console.error(`  ${diagnostic.code} ${diagnostic.path}`)
      console.error(`    ${diagnostic.message}`)
    }
    process.exitCode = 1
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}

export async function registry(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args
  const command = subcommand ?? 'validate'
  if (command !== 'validate') {
    console.error(
      pc.red(
        `Unknown registry command: ${command}. Available: zweb registry validate [file]`,
      ),
    )
    process.exitCode = 1
    return
  }
  await registryValidate(rest)
}
