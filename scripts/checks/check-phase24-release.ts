import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'scripts/checks/check-release-readiness.ts',
  'scripts/checks/check-release-tarballs.ts',
  'scripts/checks/check-release-final.ts',
  'docs/internal/release/release-readiness.md',
  'docs/internal/design/zeus-ui-release-readiness.md',
  'LICENSE',
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
      'package.json',
      ['"release:verify:strict"', '"release:verify:pack"', '"release:final"'],
      errors,
    )

    checkSourceContains(
      'scripts/checks/check-release-readiness.ts',
      [
        'checkUiPackage',
        'checkRegistryPackage',
        'checkThemesPackage',
        'checkAiPackage',
        'checkExportTargets',
        'checkFilesAllowList',
        'checkPrivateExamplesAndDocs',
        'wildcardExportTargetExists',
        'Root LICENSE is required',
      ],
      errors,
    )

    checkSourceContains(
      'scripts/checks/check-release-tarballs.ts',
      [
        'pnpm',
        'pack',
        '--dry-run',
        '--json',
        'tarball must include dist/ files',
      ],
      errors,
    )

    checkSourceNotContains(
      'scripts/checks/check-release-tarballs.ts',
      ['tarball must include README.md'],
      errors,
    )

    checkSourceContains(
      'scripts/checks/check-release-final.ts',
      [
        'parseOptions',
        '--allow-zero',
        'release:verify:strict',
        'release:verify:pack',
        'release:dry',
        'Release final verification passed.',
      ],
      errors,
    )

    checkSourceContains(
      'docs/internal/release/release-readiness.md',
      [
        'pnpm release:final',
        'pnpm release:verify:strict',
        'pnpm release:verify:pack',
      ],
      errors,
    )
  }

  if (errors.length > 0) {
    console.error(pc.red('Phase 24 release check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Phase 24 release check passed.'))
}

main()
