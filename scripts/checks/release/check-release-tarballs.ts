import type { WorkspacePackage } from '../../release/workspace'

import { existsSync } from 'node:fs'

import { execa } from 'execa'
import pc from 'picocolors'

import { listPublishablePackages } from '../../release/workspace'

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

const forbiddenPathSuffixes = ['.tsbuildinfo', '.log']

function parsePackOutput(stdout: string): PackResult[] {
  const trimmed = stdout.trim()
  if (!trimmed) return []

  const parsed = JSON.parse(trimmed) as unknown
  return Array.isArray(parsed)
    ? (parsed as PackResult[])
    : [parsed as PackResult]
}

function isForbiddenFile(path: string): boolean {
  return (
    forbiddenPathPrefixes.some(prefix => path.startsWith(prefix)) ||
    forbiddenPathSuffixes.some(suffix => path.endsWith(suffix))
  )
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

  if (!paths.includes('package.json')) {
    errors.push(`${pkg.name}: tarball must include package.json`)
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

        for (const file of result.files ?? []) {
          if (file.path.endsWith('.map') && !file.path.startsWith('dist/')) {
            errors.push(
              `${pkg.name}: sourcemap must be inside dist/: ${file.path}`,
            )
          }
        }
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
