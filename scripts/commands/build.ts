import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execa } from 'execa'

const root = process.cwd()

function listPackageDirs() {
  const dirs: string[] = []

  // Primitives must be built first, before other packages that depend on them
  const primitivesRoot = join(root, 'packages/primitives')
  if (existsSync(primitivesRoot)) {
    for (const name of readdirSync(primitivesRoot)) {
      const dir = join(primitivesRoot, name)
      if (existsSync(join(dir, 'package.json'))) {
        dirs.push(dir)
      }
    }
  }

  const packageRoot = join(root, 'packages')
  if (existsSync(packageRoot)) {
    for (const name of readdirSync(packageRoot)) {
      const dir = join(packageRoot, name)
      if (existsSync(join(dir, 'package.json'))) {
        dirs.push(dir)
      }
    }
  }

  return dirs
}

async function main() {
  const dirs = listPackageDirs()

  if (dirs.length === 0) {
    console.log('No packages found.')
    return
  }

  console.log(`Building ${dirs.length} package(s)...\n`)

  for (const dir of dirs) {
    const pkgJson = await import(
      pathToFileURL(join(dir, 'package.json')).href,
      {
        with: { type: 'json' },
      }
    ).then(m => m.default)
    console.log(`\nBuilding @ ${pkgJson.name}`)

    await execa('pnpm', ['--dir', dir, 'build'], {
      stdio: 'inherit',
    })
  }

  console.log('\nAll packages built.')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
