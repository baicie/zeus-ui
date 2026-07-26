import { pathToFileURL } from 'node:url'

import { execa } from 'execa'
import pc from 'picocolors'

export interface Step {
  name: string
  command: string
  args: string[]
}

export interface Options {
  version: string
  allowZero: boolean
}

const SEMVER_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-z-][0-9a-z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-z-][0-9a-z-]*))*)?(?:\+[0-9a-z-]+(?:\.[0-9a-z-]+)*)?$/i

function isSemverLike(version: string): boolean {
  return SEMVER_PATTERN.test(version)
}

export function parseOptions(args: string[]): Options {
  let version = ''
  let allowZero = false

  for (const arg of args) {
    if (arg === '--allow-zero') {
      if (allowZero) {
        throw new Error('Duplicate option: --allow-zero')
      }

      allowZero = true
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (version) {
      throw new Error(`Unexpected argument: ${arg}`)
    }

    version = arg
  }

  if (!version) {
    throw new Error('Usage: pnpm release:final <version> [--allow-zero]')
  }

  if (!isSemverLike(version)) {
    throw new Error(`Invalid semver version: ${version}`)
  }

  if (version === '0.0.0') {
    throw new Error('Release version must not be 0.0.0')
  }

  return {
    version,
    allowZero,
  }
}

export function createSteps(options: Options): Step[] {
  const readinessArgs = ['release:verify:strict']

  if (options.allowZero) {
    readinessArgs.push('--allow-zero')
  }

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
      args: readinessArgs,
    },
    {
      name: 'Release tarball dry-run',
      command: 'pnpm',
      args: ['release:verify:pack'],
    },
    {
      name: 'Release dry-run',
      command: 'pnpm',
      args: ['release:dry', options.version],
    },
  ]
}

function runStep(step: Step): Promise<void> {
  console.info(pc.cyan(`\n> ${step.name}`))
  console.info(pc.gray(`  ${step.command} ${step.args.join(' ')}`))

  return execa(step.command, step.args, {
    stdio: 'inherit',
  }).then(() => undefined)
}

function runSteps(steps: Step[], index = 0): Promise<void> {
  if (index >= steps.length) return Promise.resolve()

  return runStep(steps[index]).then(() => runSteps(steps, index + 1))
}

function main(): Promise<void> {
  return Promise.resolve().then(() => {
    const options = parseOptions(process.argv.slice(2))
    const steps = createSteps(options)

    return runSteps(steps).then(() => {
      console.info('')
      console.info(pc.green('Release final verification passed.'))
    })
  })
}

const entryPath = process.argv[1]

if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  main().catch(error => {
    console.error('')
    console.error(pc.red('Release final verification failed.'))
    console.error((error as Error).message)
    process.exit(1)
  })
}
