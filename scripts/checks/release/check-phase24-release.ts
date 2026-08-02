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
        '`--skipGit`',
        'merge them through a pull request',
        'never commits or pushes `main`',
        'safely reuses an existing tag only when',
        'Prerelease versions must use the `beta` dist-tag',
        'only the `Tag release` step receives its GitHub token',
        '`git merge-base --is-ancestor --`',
        'revalidates the remote version tag immediately before',
        'active tag ruleset',
      ],
      errors,
    )

    checkSourceNotContains(
      'docs/release/release-readiness.md',
      [
        'pnpm release:final\n',
        'default@',
        'creates the release commit and tag',
      ],
      errors,
    )

    checkSourceContains(
      'docs/design/zeus-ui-release-readiness.md',
      [
        'Package-local `README.md` files are optional.',
        'Source maps are allowed only under `dist/`.',
        'Prerelease versions must use `beta`; stable versions must use `latest`.',
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
        '`--skipGit`',
        '目标版本文件先在',
        '不会创建 commit 或推送 `main`',
        '同一 SHA',
        'npm registry 要求每个包始终存在 `latest`',
        '预发布版本必须使用 `beta`，稳定版本必须使用 `latest`',
        '只有 `Tag release` 步骤接收步骤级 `GH_TOKEN`',
        '`git merge-base --is-ancestor --`',
        '真正写入 npm 前再次查询远端版本 tag',
        '`refs/tags/v*` tag ruleset',
      ],
      errors,
    )

    checkSourceNotContains(
      'docs/mvp/release.md',
      [
        'default@',
        '包含 30 个 npm 包',
        'secrets: inherit',
        '交互式发版（推荐）',
        '配置 Git 身份后完成 git commit',
        '自动完成 commit + `v<version>` tag + push',
        '# 发版 + 立即发布',
        'git checkout -- .',
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
