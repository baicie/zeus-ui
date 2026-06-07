#!/usr/bin/env node

import pc from 'picocolors'
import { add } from './commands/add'
import { ai } from './commands/ai'
import { init } from './commands/init'

const [, , command, ...args] = process.argv

async function main() {
  switch (command) {
    case 'init':
      await init(args)
      break

    case 'add':
      await add(args)
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
  console.log('  zweb add button')
  console.log('  zweb add button input dialog')
  console.log('  zweb ai')
  console.log('  zweb ai --cursor')
  console.log('  zweb ai --json')
  console.log('')
  console.log('Options:')
  console.log('  --cwd <dir>                 Use a specific project directory')
  console.log('  --style <name>              Theme style for init')
  console.log('  --css <file>                Tailwind css file for init')
  console.log(
    '  --dry-run                   Print the plan without writing files',
  )
  console.log('  --overwrite                 Replace existing files')
  console.log('  --no-install                Do not install dependencies')
  console.log('  --package-manager <name>    pnpm | npm | yarn | bun')
  console.log('  --format <name>             markdown | json')
  console.log('  --output <file>             Output file path')
  console.log('  --cursor                    Write .cursor/rules/zeus-web.mdc')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
