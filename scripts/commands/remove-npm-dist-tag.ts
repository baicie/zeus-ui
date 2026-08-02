import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

import pc from 'picocolors'

import { listPublishablePackages } from '../release/workspace'

interface DistTags {
  [tag: string]: string | undefined
}

interface Options {
  registry: string
  tag: string
  version: string
}

interface RemovalPlanItem {
  packageName: string
  remove: boolean
}

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'

export function getDistTagRemovalDecision(
  distTags: DistTags,
  tag: string,
  version: string,
): 'remove' | 'skip' {
  const currentVersion = distTags[tag]

  if (!currentVersion) {
    return 'skip'
  }

  if (currentVersion !== version) {
    throw new Error(`${tag} points to ${currentVersion}, not ${version}`)
  }

  return 'remove'
}

function parseOptions(args: string[]): Options {
  let registry = DEFAULT_REGISTRY
  let tag = ''
  let version = ''

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const value = args[index + 1]

    if (arg === '--registry' && value) {
      registry = value
      index += 1
      continue
    }

    if (arg === '--tag' && value) {
      tag = value
      index += 1
      continue
    }

    if (arg === '--version' && value) {
      version = value
      index += 1
      continue
    }

    throw new Error(`Unknown or incomplete option: ${arg}`)
  }

  if (!/^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i.test(version)) {
    throw new Error('Expected --version with a valid release version')
  }

  if (!/^[a-z][\w.-]*$/i.test(tag)) {
    throw new Error('Expected --tag with a valid npm dist-tag')
  }

  return {
    registry,
    tag,
    version,
  }
}

function readDistTags(packageName: string, registry: string): DistTags {
  const output = execFileSync(
    'npm',
    ['view', packageName, 'dist-tags', '--json', `--registry=${registry}`],
    {
      encoding: 'utf8',
    },
  )

  return JSON.parse(output) as DistTags
}

function createRemovalPlan(
  packageNames: string[],
  options: Options,
): RemovalPlanItem[] {
  return packageNames.map(packageName => {
    const distTags = readDistTags(packageName, options.registry)

    try {
      return {
        packageName,
        remove:
          getDistTagRemovalDecision(distTags, options.tag, options.version) ===
          'remove',
      }
    } catch (error) {
      throw new Error(`${packageName}: ${(error as Error).message}`)
    }
  })
}

function removeDistTags(plan: RemovalPlanItem[], options: Options): void {
  for (const item of plan) {
    if (!item.remove) {
      console.info(
        pc.gray(`skip ${item.packageName}: ${options.tag} is absent`),
      )
      continue
    }

    execFileSync(
      'npm',
      [
        'dist-tag',
        'rm',
        item.packageName,
        options.tag,
        `--registry=${options.registry}`,
      ],
      {
        stdio: 'inherit',
      },
    )
    console.info(pc.green(`removed ${item.packageName}@${options.tag}`))
  }
}

function verifyRemoved(packageNames: string[], options: Options): void {
  const failures: string[] = []

  for (const packageName of packageNames) {
    const distTags = readDistTags(packageName, options.registry)

    if (distTags[options.tag]) {
      failures.push(`${packageName}: ${options.tag} still exists`)
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'))
  }
}

function main(): void {
  const options = parseOptions(process.argv.slice(2))
  const packageNames = listPublishablePackages().map(
    packageItem => packageItem.name,
  )
  const plan = createRemovalPlan(packageNames, options)

  removeDistTags(plan, options)
  verifyRemoved(packageNames, options)
  console.info(
    pc.green(
      `Verified ${options.tag} removal for ${packageNames.length} packages.`,
    ),
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    main()
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exit(1)
  }
}
