import { execa } from 'execa'
import pc from 'picocolors'

import {
  getUniqueVersions,
  listPublishablePackages,
} from '../release/workspace'

interface Options {
  json: boolean
  tag: string
  checkNpm: boolean
}

interface ReleasePlanItem {
  name: string
  version: string
  directory: string
  npmExists?: boolean
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    json: false,
    tag: 'latest',
    checkNpm: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--check-npm') {
      options.checkNpm = true
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

async function npmVersionExists(
  name: string,
  version: string,
): Promise<boolean> {
  const result = await execa('npm', ['view', `${name}@${version}`, 'version'], {
    reject: false,
  })

  return result.exitCode === 0
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const packages = listPublishablePackages()
  const versions = getUniqueVersions(packages)

  if (versions.length !== 1) {
    throw new Error(
      `Release plan requires one shared version. Found: ${versions.join(', ')}`,
    )
  }

  const items: ReleasePlanItem[] = []

  for (const pkg of packages) {
    items.push({
      name: pkg.name,
      version: pkg.version,
      directory: pkg.relativeDir,
      npmExists: options.checkNpm
        ? await npmVersionExists(pkg.name, pkg.version)
        : undefined,
    })
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          version: versions[0],
          tag: options.tag,
          packages: items,
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(pc.bold(`Release plan: ${versions[0]} (${options.tag})`))
  console.log('')

  for (const item of items) {
    const status =
      item.npmExists === undefined
        ? ''
        : item.npmExists
          ? pc.yellow(' already exists')
          : pc.green(' new')

    console.log(
      `  ${item.name}@${item.version}  ${pc.gray(item.directory)}${status}`,
    )
  }

  console.log('')
  console.log(pc.green(`${items.length} package(s) in release plan.`))
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
