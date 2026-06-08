import { execa } from 'execa'
import pc from 'picocolors'

interface Options {
  dryRun: boolean
  tag: string
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    dryRun: false,
    tag: 'latest',
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run' || arg === '--dry') {
      options.dryRun = true
      continue
    }

    if (arg === '--tag') {
      const value = args[index + 1]
      if (!value) throw new Error('--tag requires a value')
      options.tag = value
      index += 1
      continue
    }

    if (arg.startsWith('--tag=')) {
      const value = arg.slice('--tag='.length)
      if (!value) throw new Error('--tag requires a value')
      options.tag = value
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

async function run(command: string, args: string[]): Promise<void> {
  console.log(pc.cyan(`${command} ${args.join(' ')}`))

  await execa(command, args, {
    stdio: 'inherit',
  })
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))

  await run('pnpm', ['format-check'])
  await run('pnpm', ['lint'])
  await run('pnpm', ['test'])
  await run('pnpm', ['check'])
  await run('pnpm', ['build'])
  await run('pnpm', ['check:exports'])
  await run('pnpm', ['check:build-output'])
  await run('pnpm', ['site:check'])

  await run('pnpm', ['release:verify', '--strict'])

  await run('pnpm', [
    'release:plan',
    '--tag',
    options.tag,
    ...(options.dryRun ? [] : ['--check-npm']),
  ])

  if (options.dryRun) {
    await run('pnpm', ['ci-publish', '--dry-run', '--tag', options.tag])
    console.log(pc.green('Release dry-run passed.'))
    return
  }

  console.log(
    pc.green(
      'Release checks passed. Run `pnpm ci-publish --tag <tag>` to publish.',
    ),
  )
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
