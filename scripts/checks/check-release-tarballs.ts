import type { WorkspacePackage } from '../release/workspace'

import { existsSync } from 'node:fs'

import { execa } from 'execa'
import pc from 'picocolors'

import { listPublishablePackages } from '../release/workspace'

interface PackFile {
  path: string
  size?: number
  mode?: number
}

interface PackResult {
  id?: string
  name?: string
  version?: string
  filename?: string
  files?: PackFile[]
}

const forbiddenPathPrefixes = [
  'src/',
  'tests/',
  '__tests__/',
  'examples/',
  'scripts/',
  '.github/',
  'temp/',
]

const forbiddenPathSuffixes = ['.map', '.tsbuildinfo', '.log']

function parsePackOutput(stdout: string): PackResult[] {
  const trimmed = stdout.trim()

  if (!trimmed) return []

  const parsed = JSON.parse(trimmed) as unknown

  if (Array.isArray(parsed)) {
    return parsed as PackResult[]
  }

  return [parsed as PackResult]
}

function isForbiddenFile(path: string): boolean {
  if (forbiddenPathPrefixes.some(prefix => path.startsWith(prefix))) {
    return true
  }

  if (forbiddenPathSuffixes.some(suffix => path.endsWith(suffix))) {
    return true
  }

  return false
}

function checkPackResult(
  pkg: WorkspacePackage,
  result: PackResult,
  errors: string[],
): void {
  const files = result.files ?? []
  const paths = files.map(file => file.path)

  if (paths.length === 0) {
    errors.push(`${pkg.name}: npm pack returned no files`)
    return
  }

  for (const required of ['package.json', 'README.md']) {
    if (!paths.includes(required)) {
      errors.push(`${pkg.name}: tarball must include ${required}`)
    }
  }

  if (!paths.some(path => path.startsWith('dist/'))) {
    errors.push(`${pkg.name}: tarball must include dist/ files`)
  }

  for (const path of paths) {
    if (isForbiddenFile(path)) {
      errors.push(`${pkg.name}: tarball must not include ${path}`)
    }
  }
}

async function packPackage(pkg: WorkspacePackage): Promise<PackResult[]> {
  const result = await execa('pnpm', ['pack', '--dry-run', '--json'], {
    cwd: pkg.dir,
    reject: true,
  })

  return parsePackOutput(result.stdout)
}

async function main(): Promise<void> {
  const errors: string[] = []
  const packages = listPublishablePackages()

  for (const pkg of packages) {
    if (!existsSync(pkg.dir)) {
      errors.push(`${pkg.name}: package directory missing`)
      continue
    }

    process.stdout.write(`Packing ${pc.bold(pkg.name)} ... `)

    try {
      const results = await packPackage(pkg)

      if (results.length === 0) {
        errors.push(`${pkg.name}: npm pack returned empty result`)
      }

      for (const result of results) {
        checkPackResult(pkg, result, errors)
      }

      process.stdout.write(`${pc.green('✓')}\n`)
    } catch (error) {
      process.stdout.write(`${pc.red('✘')}\n`)
      errors.push(
        `${pkg.name}: pnpm pack --dry-run failed: ${(error as Error).message}`,
      )
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('Release tarball check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Release tarball check passed.'))
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
