import type { ZeusWebIconName } from '@zeus-web/icons'

import {
  iconMetadata,
  iconNames,
  isIconName,
  searchIcons,
} from '@zeus-web/icons'
import pc from 'picocolors'

type IconSubcommand = 'list' | 'search' | 'show'

interface IconOptions {
  json: boolean
}

function parseIconOptions(args: string[]): {
  positional: string[]
  options: IconOptions
} {
  const positional: string[] = []
  const options: IconOptions = {
    json: false,
  }

  for (const arg of args) {
    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }

    positional.push(arg)
  }

  return {
    positional,
    options,
  }
}

function printIconUsage() {
  console.log(`\n${pc.bold('zweb icon')} - Zeus Web icon helper\n`)
  console.log('Usage:')
  console.log('  zweb icon list')
  console.log('  zweb icon list --json')
  console.log('  zweb icon search check')
  console.log('  zweb icon show check')
}

function printIconTable(names: readonly ZeusWebIconName[]) {
  for (const name of names) {
    const icon = iconMetadata[name]
    console.log(`  ${pc.cyan(icon.name.padEnd(18))} ${icon.title}`)
  }
}

async function iconList(args: string[]): Promise<void> {
  const { options } = parseIconOptions(args)

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          icons: iconNames.map(name => iconMetadata[name]),
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(pc.bold('Available icons:'))
  printIconTable(iconNames)
}

async function iconSearch(args: string[]): Promise<void> {
  const { positional, options } = parseIconOptions(args)
  const query = positional.join(' ').trim()

  if (!query) {
    throw new Error('zweb icon search requires a query.')
  }

  const result = searchIcons(query)

  if (options.json) {
    console.log(JSON.stringify({ query, icons: result }, null, 2))
    return
  }

  if (result.length === 0) {
    console.log(pc.yellow(`No icons found for "${query}".`))
    return
  }

  console.log(pc.bold(`Icons matching "${query}":`))
  printIconTable(result.map(icon => icon.name))
}

async function iconShow(args: string[]): Promise<void> {
  const { positional, options } = parseIconOptions(args)
  const name = positional[0]

  if (!name) {
    throw new Error('zweb icon show requires an icon name.')
  }

  if (!isIconName(name)) {
    throw new Error(`Unknown icon: ${name}`)
  }

  const icon = iconMetadata[name]

  if (options.json) {
    console.log(JSON.stringify(icon, null, 2))
    return
  }

  console.log(pc.bold(icon.title))
  console.log(`Name: ${icon.name}`)
  console.log(`Category: ${icon.category}`)
  console.log(`Tags: ${icon.tags.join(', ')}`)
  console.log('')
  console.log('React:')
  console.log(
    `  import { Icon${toPascalIconName(icon.name)} } from '@zeus-web/icons/react'`,
  )
  console.log('')
  console.log('Web Component:')
  console.log(
    `  <zw-icon-${icon.name} aria-hidden="true"></zw-icon-${icon.name}>`,
  )
  console.log('')
  console.log('Raw SVG:')
  console.log(`  import iconUrl from '@zeus-web/icons/svg/${icon.name}.svg'`)
}

function toPascalIconName(name: string): string {
  return name
    .split('-')
    .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join('')
}

export async function icon(args: string[]): Promise<void> {
  try {
    const [subcommand, ...rest] = args
    const command = (subcommand ?? 'list') as IconSubcommand

    if (command === 'list') {
      await iconList(rest)
      return
    }

    if (command === 'search') {
      await iconSearch(rest)
      return
    }

    if (command === 'show') {
      await iconShow(rest)
      return
    }

    if (subcommand === '-h' || subcommand === '--help') {
      printIconUsage()
      return
    }

    throw new Error(`Unknown icon command: ${String(subcommand)}`)
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
