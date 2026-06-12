import { execa } from 'execa'
import pc from 'picocolors'

interface Step {
  name: string
  command: string
  args: string[]
}

interface Options {
  allowZero: boolean
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    allowZero: false,
  }

  for (const arg of args) {
    if (arg === '--allow-zero') {
      options.allowZero = true
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

function createSteps(options: Options): Step[] {
  return [
    {
      name: 'TypeScript workspace check',
      command: 'pnpm',
      args: ['check'],
    },
    {
      name: 'Build packages and examples',
      command: 'pnpm',
      args: ['build'],
    },
    {
      name: 'Site check',
      command: 'pnpm',
      args: ['site:check'],
    },
    {
      name: 'Showcase CI',
      command: 'pnpm',
      args: ['showcase:ci'],
    },
    {
      name: 'Release readiness strict',
      command: 'pnpm',
      args: [
        'release:verify:strict',
        ...(options.allowZero ? ['--allow-zero'] : []),
      ],
    },
    {
      name: 'Release tarball dry-run',
      command: 'pnpm',
      args: ['release:verify:pack'],
    },
    {
      name: 'Release dry-run',
      command: 'pnpm',
      args: ['release:dry'],
    },
  ]
}

async function runStep(step: Step): Promise<void> {
  console.log(pc.cyan(`\n▶ ${step.name}`))
  console.log(pc.gray(`  ${step.command} ${step.args.join(' ')}`))

  await execa(step.command, step.args, {
    stdio: 'inherit',
  })
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const steps = createSteps(options)

  for (const step of steps) {
    await runStep(step)
  }

  console.log('')
  console.log(pc.green('Release final verification passed.'))
}

main().catch(error => {
  console.error('')
  console.error(pc.red('Release final verification failed.'))
  console.error((error as Error).message)
  process.exit(1)
})
