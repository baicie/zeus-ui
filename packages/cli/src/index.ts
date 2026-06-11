#!/usr/bin/env node

import pc from 'picocolors'
import { add } from './commands/add'
import { ai } from './commands/ai'
import { diff } from './commands/diff'
import { doctor } from './commands/doctor'
import { icon } from './commands/icon'
import { init } from './commands/init'
import { list } from './commands/list'
import { theme } from './commands/theme'
import { update } from './commands/update'

const [, , command, ...args] = process.argv

async function main() {
  switch (command) {
    case 'init':
      await init(args)
      break
    case 'add':
      await add(args)
      break
    case 'list':
      await list(args)
      break
    case 'diff':
      await diff(args)
      break
    case 'update':
      await update(args)
      break
    case 'doctor':
      await doctor(args)
      break
    case 'theme':
      await theme(args)
      break
    case 'icon':
      await icon(args)
      break
    case 'ai':
      await ai(args)
      break
    case undefined:
    case '-h':
    case '--help':
      printHelp()
      break
    default:
      console.error(pc.red(`Unknown command: ${command}`))
      printHelp()
      process.exit(1)
  }
}

function printHelp() {
  console.log(`\n${pc.bold('zweb')} - Zeus Web CLI\n`)
  console.log('Usage:')
  console.log('  zweb init')
  console.log('  zweb init --style slate --css src/styles/globals.css')
  console.log('  zweb init --style zinc --radius lg --motion reduced')
  console.log('  zweb add button')
  console.log('  zweb add button input dialog')
  console.log('  zweb add --all')
  console.log('  zweb list')
  console.log('  zweb list --json')
  console.log('  zweb diff button')
  console.log('  zweb diff --all')
  console.log('  zweb diff --all --json')
  console.log('  zweb update button')
  console.log('  zweb update --all')
  console.log('  zweb update button --dry-run')
  console.log('  zweb update button --overwrite')
  console.log('  zweb doctor')
  console.log('  zweb doctor --json')
  console.log('  zweb theme list')
  console.log('  zweb theme list --json')
  console.log('  zweb theme tokens')
  console.log('  zweb theme tokens slate --json')
  console.log('  zweb theme set slate')
  console.log('  zweb theme set zinc --radius lg --motion reduced')
  console.log('  zweb theme set default --accent "240 5.9% 10%"')
  console.log('  zweb icon list')
  console.log('  zweb icon list --json')
  console.log('  zweb icon search check')
  console.log('  zweb icon show check')
  console.log('  zweb ai')
  console.log('  zweb ai --cursor')
  console.log('  zweb ai --json')
  console.log('')
  console.log('Options:')
  console.log('  --cwd <dir>                 Use a specific project directory')
  console.log('  --style <name>              Theme style for init/theme set')
  console.log('  --css <file>                Tailwind css file for init')
  console.log('  --radius <name>             none | sm | md | lg | xl')
  console.log(
    '  --motion <name>             none | reduced | normal | expressive',
  )
  console.log('  --dark-mode <name>          class | data | media')
  console.log('  --accent <hsl>              Override primary/ring HSL value')
  console.log('  --all                       Select all registry components')
  console.log(
    '  --dry-run                   Print the plan without writing files',
  )
  console.log('  --overwrite, --force        Replace existing files')
  console.log('  --no-install, --skip-deps   Do not install dependencies')
  console.log('  --yes, -y                   Skip confirmations when supported')
  console.log('  --package-manager <name>    pnpm | npm | yarn | bun')
  console.log('  --json                      Print JSON output')
  console.log('  --format <name>             markdown | json')
  console.log('  --output <file>             Output file path')
  console.log('  --cursor                    Write .cursor/rules/zeus-web.mdc')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
