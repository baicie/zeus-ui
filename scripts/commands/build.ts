import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execa } from 'execa'

const root = process.cwd()

interface WorkspacePackage {
  name: string
  dir: string
  private?: boolean
  scripts?: Record<string, string>
}

const foundationPackages = ['zeus-compat', 'utils']

function readPackage(dir: string): WorkspacePackage | null {
  const packageJsonPath = join(dir, 'package.json')

  if (!existsSync(packageJsonPath)) {
    return null
  }

  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    name?: string
    private?: boolean
    scripts?: Record<string, string>
  }

  if (!pkg.name) {
    return null
  }

  return {
    name: pkg.name,
    dir,
    private: pkg.private,
    scripts: pkg.scripts,
  }
}

function listDirs(parent: string): string[] {
  if (!existsSync(parent)) {
    return []
  }

  return readdirSync(parent)
    .map(name => join(parent, name))
    .filter(dir => existsSync(join(dir, 'package.json')))
}

function listPackages(): WorkspacePackage[] {
  const packagesRoot = join(root, 'packages')
  const primitivesRoot = join(root, 'packages/primitives')

  const topLevelPackages = listDirs(packagesRoot)
    .filter(dir => !dir.endsWith(join('packages', 'primitives')))
    .map(readPackage)
    .filter(Boolean) as WorkspacePackage[]

  const primitivePackages = listDirs(primitivesRoot)
    .map(readPackage)
    .filter(Boolean) as WorkspacePackage[]

  const foundations = topLevelPackages.filter(pkg =>
    foundationPackages.some(name => pkg.dir.endsWith(join('packages', name))),
  )

  const restTopLevel = topLevelPackages.filter(
    pkg => !foundations.some(found => found.dir === pkg.dir),
  )

  return [...foundations, ...primitivePackages, ...restTopLevel].filter(
    pkg => !pkg.private && pkg.scripts?.build,
  )
}

async function main() {
  const packages = listPackages()

  if (packages.length === 0) {
    console.log('No buildable packages found.')
    return
  }

  console.log(`Building ${packages.length} package(s)...\n`)

  for (const pkg of packages) {
    console.log(`\nBuilding ${pkg.name}`)

    await execa('pnpm', ['--dir', pkg.dir, 'build'], {
      stdio: 'inherit',
    })
  }

  console.log('\nAll packages built.')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
