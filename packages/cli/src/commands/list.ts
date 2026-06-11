import pc from 'picocolors'

import { listAvailableComponents, loadRegistry } from './add'

interface ListOptions {
  json: boolean
}

function parseListArgs(args: string[]): ListOptions {
  const options: ListOptions = { json: false }
  for (const arg of args) {
    if (arg === '--json') {
      options.json = true
      continue
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

export async function list(args: string[]): Promise<void> {
  try {
    const options = parseListArgs(args)
    const registry = loadRegistry()
    const components = listAvailableComponents(registry)
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
