import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

import { checkReleaseWorkflowContract } from './check-release-workflows'

const root = process.cwd()

const requiredFiles = [
  'scripts/checks/release/check-release-readiness.ts',
  'scripts/checks/release/check-release-tarballs.ts',
  'scripts/checks/release/check-release-final.ts',
  'scripts/checks/release/check-release-workflows.ts',
  'scripts/release/workspace.ts',
  'scripts/release.config.ts',
  '.github/workflows/publish.yml',
  '.github/workflows/release.yml',
  'docs/release/release-readiness.md',
  'docs/design/zeus-ui-release-readiness.md',
  'docs/examples/showcase-roadmap.md',
  'docs/mvp/release.md',
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
      [
        '"release:verify:strict"',
        '"release:verify:pack"',
        '"release:final"',
        '"check:phase24-release"',
      ],
      errors,
    )

    checkSourceContains(
      'scripts/checks/release/check-release-readiness.ts',
      [
        'checkUiPackage',
        'checkRegistryPackage',
        'checkThemesPackage',
        'checkAiPackage',
        'checkExportTargets',
        'checkFilesAllowList',
        'checkPrivateExamplesAndDocs',
        'checkPublishablePackageSet',
        'expectedWorkspacePackageCounts',
        'wildcardExportTargetExists',
        'Root LICENSE is required',
      ],
      errors,
    )

    checkSourceContains(
      'scripts/checks/release/check-release-tarballs.ts',
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
      'scripts/checks/release/check-release-tarballs.ts',
      ['tarball must include README.md'],
      errors,
    )

    checkSourceContains(
      'scripts/checks/release/check-release-final.ts',
      [
        'parseOptions',
        'version: string',
        '--allow-zero',
        'Usage: pnpm release:final <version> [--allow-zero]',
        'release:verify:strict',
        'release:verify:pack',
        "args: ['release:dry', options.version]",
        'Release final verification passed.',
      ],
      errors,
    )

    errors.push(...checkReleaseWorkflowContract(root))

    checkSourceContains(
      'docs/release/release-readiness.md',
      [
        'pnpm release:final 0.1.0-beta.0 --allow-zero',
        'pnpm release:verify:strict',
        'pnpm release:verify:pack',
        '36 packages: 11 base packages, 20 primitive',
        '5 advanced packages',
        'NPM_PUBLISH_TOKEN',
        'Dispatch the release workflow from `main`',
        'separate `contents: read` job',
        'pinned to a full commit SHA',
        '`release_sha`',
        '`validate-context`',
        '`dispatch-publish`',
        'tag-scoped event',
        '`GITHUB_REF` and `GITHUB_SHA`',
        'pnpm check:build-output',
        'pnpm release:verify:pack',
      ],
      errors,
    )

    checkSourceNotContains(
      'docs/release/release-readiness.md',
      ['pnpm release:final\n', 'default@'],
      errors,
    )

    checkSourceContains(
      'docs/design/zeus-ui-release-readiness.md',
      [
        'Package-local `README.md` files are optional.',
        'Source maps are allowed only under `dist/`.',
      ],
      errors,
    )

    checkSourceNotContains(
      'docs/design/zeus-ui-release-readiness.md',
      ['- contain `README.md`', '\n*.map\n', 'default@'],
      errors,
    )

    checkSourceContains(
      'docs/examples/showcase-roadmap.md',
      ['pnpm release:final 0.1.0-beta.0 --allow-zero'],
      errors,
    )

    checkSourceContains(
      'docs/mvp/release.md',
      [
        '包含 36 个 npm 包',
        '只允许从 `main` 运行',
        'dry-run job 只有 `contents: read`',
        '固定到完整 commit SHA',
        '`release_sha`',
        '`validate-context`',
        '`dispatch-publish`',
        'npm provenance',
        'pnpm check:build-output',
        'pnpm release:verify:pack',
        'release workflow 不接收 npm token',
        'pnpm release:final 0.1.0-beta.0 --allow-zero',
      ],
      errors,
    )

    checkSourceNotContains(
      'docs/mvp/release.md',
      ['default@', '包含 30 个 npm 包', 'secrets: inherit'],
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
