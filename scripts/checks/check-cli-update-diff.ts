import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'packages/cli/src/commands/diff.ts',
  'packages/cli/src/commands/update.ts',
  'packages/cli/src/lock.ts',
  'packages/cli/__tests__/diff.spec.ts',
  'packages/cli/__tests__/update.spec.ts',
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

function checkSourceNotContains(
  file: string,
  contents: string[],
  errors: string[],
): void {
  const source = read(file)

  for (const content of contents) {
    if (source.includes(content)) {
      errors.push(`${file} must not contain "${content}"`)
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
      'packages/cli/src/commands/diff.ts',
      [
        'registry-changed',
        'locally-modified',
        'registry-and-local-changed',
        'untracked-existing',
        'getLockedFileHash',
        'getLockedRegistryHash',
        'createAddPlan({',
        'cwd: options.cwd',
        'config',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/src/commands/update.ts',
      [
        'createUpdatePlans',
        'updateComponentsLockFromPlans',
        'registry-and-local-changed',
        '--overwrite',
        '--dry-run',
        'writtenTargets',
      ],
      errors,
    )

    checkSourceNotContains(
      'packages/cli/src/commands/update.ts',
      ['components.lock.json', 'readLegacyLock', 'updateLegacyLockFromPlans'],
      errors,
    )

    checkSourceContains(
      'packages/cli/src/lock.ts',
      [
        'fileHashes',
        'registryHashes',
        'getLockedFileHash',
        'getLockedRegistryHash',
        'migrateLegacyLockIfNeeded',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/package.json',
      ['"test:update-diff"'],
      errors,
    )

    checkSourceContains('package.json', ['"check:cli-update-diff"'], errors)

    checkSourceContains(
      'packages/cli/__tests__/diff.spec.ts',
      ['reports missing files', 'reports local modifications'],
      errors,
    )

    checkSourceContains(
      'packages/cli/__tests__/update.spec.ts',
      [
        'updates missing registry files',
        'does not overwrite local modifications without --overwrite',
        'overwrites local modifications with --overwrite',
        'dry-run does not write missing files',
      ],
      errors,
    )
  }

  if (errors.length > 0) {
    console.error(pc.red('CLI update/diff check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('CLI update/diff check passed.'))
}

main()
