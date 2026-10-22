#!/usr/bin/env node

import pc from 'picocolors'
import { add } from './commands/add'
import { ai } from './commands/ai'
import { diff } from './commands/diff'
import { doctor } from './commands/doctor'
import { icon } from './commands/icon'
import { init } from './commands/init'
import { list } from './commands/list'
import { remove } from './commands/remove'
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
    case 'remove':
      await remove(args)
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
  console.log('  zweb init --framework react')
  console.log('  zweb init --framework vue')
  console.log('  zweb init --style slate --css src/styles/zeus.css')
  console.log('  zweb init --style zinc --radius lg --motion reduced')
  console.log('  zweb init --dry-run')
  console.log('  zweb add button')
  console.log('  zweb add button input')
  console.log('  zweb add --all')
  console.log('  zweb add button --path src/custom/ui')
  console.log('  zweb add button --registry https://example.com/registry.json')
  console.log('  zweb add button --dry-run')
  console.log('  zweb add button --overwrite')
  console.log('  zweb add button --install')
  console.log('  zweb add button --skip-deps')
  console.log('  zweb add --all --yes')
  console.log('  zweb add button --path src/custom/ui')
  console.log('  zweb add button --registry ./registry.json')
  console.log('  zweb list')
  console.log('  zweb list --json')
  console.log('  zweb remove button')
  console.log('  zweb remove button --dry-run')
  console.log('  zweb remove button --force')
  console.log('  zweb remove --all')
  console.log('  zweb diff button')
  console.log('  zweb diff button --registry ./registry.json')
  console.log('  zweb diff --all')
  console.log('  zweb diff --all --json')
  console.log('  zweb update button')
  console.log('  zweb update --all')
  console.log('  zweb update button --dry-run')
  console.log('  zweb update button --overwrite')
  console.log('  zweb update button --registry ./registry.json')
  console.log(
    '  zweb update button --registry https://example.test/registry.json',
  )
  console.log('  zweb doctor')
  console.log('  zweb doctor --json')
  console.log('  zweb theme list')
  console.log('  zweb theme list --json')
  console.log('  zweb theme tokens')
  console.log('  zweb theme tokens slate --json')
  console.log('  zweb theme set slate')
  console.log('  zweb theme set zinc --radius lg --motion reduced')
  console.log('  zweb theme set default --accent "240 5.9% 10%"')
  console.log(
    '  zweb theme add brand --from slate --color light.primary="12 80% 45%"',
  )
  console.log('  zweb theme add brand --color dark.primary="12 70% 65%"')
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
  console.log('  --framework <name>         react | vue')
  console.log('  --style <name>            Theme style for init/theme set')
  console.log('  --css <file>              Tailwind css file for init')
  console.log('  --radius <name>           none | sm | md | lg | xl')
  console.log(
    '  --motion <name>             none | reduced | normal | expressive',
  )
  console.log('  --dark-mode <name>         class | data | media')
  console.log('  --accent <hsl>             Override primary/ring HSL value')
  console.log(
    '  --all                       All registry components for add/diff/update; all tracked entries for remove',
  )
  console.log(
    '  --path <dir>                Component target directory relative to cwd',
  )
  console.log(
    '  --registry <source>         Built-in, local registry, or HTTP(S) URL',
  )
  console.log(
    '  --yes, -y                   Install dependencies non-interactively',
  )
  console.log(
    '  --skip-deps                 Copy source without installing dependencies',
  )
  console.log(
    '  --dry-run                   Print the plan without writing files',
  )
  console.log(
    '  --overwrite, --force        Replace existing files; --force also removes local edits',
  )
  console.log('  --install                  Install npm dependencies')
  console.log('  --no-install                Do not install dependencies')
  console.log(
    '  --yes, -y                  Install dependencies without another confirmation',
  )
  console.log('  --skip-deps                Skip npm dependency installation')
  console.log(
    '  --path <dir>               Component directory relative to the project',
  )
  console.log(
    '  --registry <source>        Bundled, file, or HTTP(S) registry manifest',
  )
  console.log('  --package-manager <name>    pnpm | npm | yarn | bun')
  console.log('  --json                       Print JSON output')
  console.log('  --format <name>            markdown | json')
  console.log('  --output <file>             Output file path')
  console.log('  --cursor                    Write .cursor/rules/zeus-web.mdc')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
