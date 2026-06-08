import type { WorkspacePackage } from '../release/workspace'
import { execa } from 'execa'

import pc from 'picocolors'
import {
  getUniqueVersions,
  listPublishablePackages,
} from '../release/workspace'

interface Options {
  dryRun: boolean
  tag: string
  skipExisting: boolean
  provenance: boolean
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    dryRun: false,
    tag: 'latest',
    skipExisting: true,
    provenance: true,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run' || arg === '--dry') {
      options.dryRun = true
      continue
    }

    if (arg === '--skip-existing') {
      options.skipExisting = true
      continue
    }

    if (arg === '--no-skip-existing') {
      options.skipExisting = false
      continue
    }

    if (arg === '--no-provenance') {
      options.provenance = false
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

async function npmVersionExists(pkg: WorkspacePackage): Promise<boolean> {
  const result = await execa(
    'npm',
    ['view', `${pkg.name}@${pkg.version}`, 'version'],
    {
      reject: false,
    },
  )

  return result.exitCode === 0
}

function createPublishArgs(pkg: WorkspacePackage, options: Options): string[] {
  const args = [
    '--filter',
    pkg.name,
    'publish',
    '--access',
    'public',
    '--tag',
    options.tag,
    '--no-git-checks',
  ]

  if (options.provenance && !options.dryRun) {
    args.push('--provenance')
  }

  if (options.dryRun) {
    args.push('--dry-run')
  }

  return args
}

async function publishPackage(
  pkg: WorkspacePackage,
  options: Options,
): Promise<void> {
  if (options.skipExisting) {
    const exists = await npmVersionExists(pkg)

    if (exists) {
      console.log(pc.yellow(`skip existing ${pkg.name}@${pkg.version}`))
      return
    }
  }

  const args = createPublishArgs(pkg, options)

  console.log(pc.cyan(`pnpm ${args.join(' ')}`))

  await execa('pnpm', args, {
    stdio: 'inherit',
    env: {
      ...process.env,
    },
  })

  console.log(pc.green(`published ${pkg.name}@${pkg.version}`))
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const packages = listPublishablePackages()
  const versions = getUniqueVersions(packages)

  if (versions.length !== 1) {
    throw new Error(
      `Publish requires one shared version. Found: ${versions.join(', ')}`,
    )
  }

  if (
    !options.dryRun &&
    !process.env.NODE_AUTH_TOKEN &&
    !process.env.NPM_TOKEN
  ) {
    throw new Error('NODE_AUTH_TOKEN or NPM_TOKEN is required for publish.')
  }

  console.log(
    pc.bold(
      `Publishing ${packages.length} package(s) version ${versions[0]} with tag ${options.tag}${options.dryRun ? ' (dry-run)' : ''}`,
    ),
  )

  for (const pkg of packages) {
    await publishPackage(pkg, options)
  }
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
