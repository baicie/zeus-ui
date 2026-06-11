import type { PackageJsonLike, WorkspacePackage } from '../release/workspace'
import { readFileSync } from 'node:fs'

import { writeFile } from 'node:fs/promises'

import pc from 'picocolors'
import { listPublishablePackages, repositoryUrl } from '../release/workspace'

interface Options {
  version: string
  dryRun: boolean
}

function parseOptions(args: string[]): Options {
  let version = ''
  let dryRun = false

  for (const arg of args) {
    if (arg === '--dry-run' || arg === '--dry') {
      dryRun = true
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (!version) {
      version = arg
      continue
    }

    throw new Error(`Unexpected argument: ${arg}`)
  }

  if (!version) {
    throw new Error('Usage: pnpm version:packages <version> [--dry-run]')
  }

  if (!/^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i.test(version)) {
    throw new Error(`Invalid semver version: ${version}`)
  }

  return {
    version,
    dryRun,
  }
}

function sortPackageJson(pkg: PackageJsonLike): PackageJsonLike {
  const preferredKeys = [
    'name',
    'type',
    'version',
    'description',
    'license',
    'repository',
    'publishConfig',
    'sideEffects',
    'exports',
    'bin',
    'files',
    'scripts',
    'peerDependencies',
    'peerDependenciesMeta',
    'dependencies',
    'devDependencies',
    'optionalDependencies',
  ]

  const result: PackageJsonLike = {}

  for (const key of preferredKeys) {
    if (key in pkg) {
      result[key] = pkg[key]
    }
  }

  for (const key of Object.keys(pkg).sort()) {
    if (!(key in result)) {
      result[key] = pkg[key]
    }
  }

  return result
}

function updatePackageJson(
  pkg: WorkspacePackage,
  version: string,
): PackageJsonLike {
  return sortPackageJson({
    ...pkg.packageJson,
    version,
    repository: {
      type: 'git',
      url: repositoryUrl,
      directory: pkg.relativeDir,
    },
    publishConfig: {
      ...(pkg.packageJson.publishConfig ?? {}),
      access: 'public',
      provenance: true,
    },
  })
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const packages = listPublishablePackages()

  for (const pkg of packages) {
    const before = readFileSync(pkg.packageJsonPath, 'utf-8')
    const nextJson = updatePackageJson(pkg, options.version)
    const next = `${JSON.stringify(nextJson, null, 2)}\n`

    if (before === next) {
      console.log(pc.gray(`unchanged ${pkg.name}`))
      continue
    }

    if (options.dryRun) {
      console.log(pc.cyan(`would update ${pkg.name} -> ${options.version}`))
      continue
    }

    await writeFile(pkg.packageJsonPath, next, 'utf-8')
    console.log(pc.green(`updated ${pkg.name} -> ${options.version}`))
  }
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
