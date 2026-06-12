import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'packages/cli/src/commands/add.ts',
  'packages/cli/src/lock.ts',
  'packages/cli/__tests__/add.spec.ts',
]

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf-8')
}

function checkFileExists(path: string, errors: string[]): void {
  if (!existsSync(resolve(root, path))) {
    errors.push(`Missing ${path}`)
  }
}

function checkSourceContains(
  file: string,
  contents: string[],
  errors: string[],
): void {
  const source = read(file)

  for (const content of contents) {
    if (!source.includes(content)) {
      errors.push(`${file} must contain "${content}"`)
    }
  }
}

function main(): void {
  const errors: string[] = []

  for (const file of requiredFiles) {
    checkFileExists(file, errors)
  }

  if (errors.length === 0) {
    checkSourceContains(
      'packages/cli/src/commands/add.ts',
      [
        'collectRegistryItems',
        'registryDependencies',
        'shouldIncludeFileForFramework',
        'rewriteRegistrySource',
        'resolveRegistryTarget',
        'readComponentsConfig',
        'readComponentsLock',
        'writeComponentsLock',
        '--dry-run',
        '--overwrite',
        '--install',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/src/lock.ts',
      [
        'zeus-ui.lock.json',
        'readComponentsLock',
        'writeComponentsLock',
        'createEmptyComponentsLock',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/__tests__/add.spec.ts',
      [
        'expands registry dependencies before the component',
        'filters files by React framework',
        'filters files by Vue framework',
        'dedupes shared registry dependencies',
        'marks existing files as skipped by default',
        'marks existing files as overwrite when requested',
      ],
      errors,
    )

    checkSourceContains('packages/cli/package.json', ['"test:add"'], errors)
  }

  if (errors.length > 0) {
    console.error(pc.red('CLI add check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('CLI add check passed.'))
}

main()
