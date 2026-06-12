import { execa } from 'execa'
import pc from 'picocolors'

interface Step {
  name: string
  command: string
  args: string[]
}

const steps: Step[] = [
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
    args: ['release:verify:strict'],
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

async function runStep(step: Step): Promise<void> {
  console.log(pc.cyan(`\n▶ ${step.name}`))
  console.log(pc.gray(`  ${step.command} ${step.args.join(' ')}`))

  await execa(step.command, step.args, {
    stdio: 'inherit',
  })
}

async function main(): Promise<void> {
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
