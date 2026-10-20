import { isAbsolute, resolve } from 'node:path'

import pc from 'picocolors'

import { loadRegistrySource } from '../registry-source'
import { listAvailableComponents } from './add'

interface ListOptions {
  cwd: string
  json: boolean
  registry?: string
}

export function parseListArgs(
  args: string[],
  cwd = process.cwd(),
): ListOptions {
  const options: ListOptions = { cwd, json: false }
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
    if (arg === '--registry') {
      const value = args[index + 1]
      if (!value) throw new Error('--registry requires a URL or file path')
      options.registry = value
      index += 1
      continue
    }
    if (arg.startsWith('--registry=')) {
      const value = arg.slice('--registry='.length)
      if (!value) throw new Error('--registry requires a URL or file path')
      options.registry = value
      continue
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

export async function list(args: string[]): Promise<void> {
  try {
    const options = parseListArgs(args)
    const registry = await loadRegistrySource({
      reference: options.registry,
      cwd: options.cwd,
    })
    const components = listAvailableComponents(registry.registry)
    if (options.json) {
      console.log(JSON.stringify({ components }, null, 2))
      return
    }
    console.log(pc.bold('Available components:'))
    for (const component of components) console.log(`  ${component}`)
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
