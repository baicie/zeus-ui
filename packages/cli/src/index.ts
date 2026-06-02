#!/usr/bin/env node

import pc from 'picocolors'
import { add } from './commands/add'
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
  console.log('  zweb add input')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
