import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

import { listZeusDependencyManifests } from '../../release/zeus-dependency-manifests'
import { createZeusPeerRequirement } from '../../release/zeus-peer-requirement'

/**
 * The version this workspace should be aligned to, read from the workspace.
 *
 * This used to be the literal `0.1.1-beta.20`. Every time Zeus published, the
 * pin had to be edited here as well, and forgetting it did not fail loudly —
 * the check compared the *new* tree against the *old* version and reported
 * every correct pin as wrong. Measured after moving to 0.2.0-rc.5: 147 pins at
 * the new version, all flagged as misaligned.
 *
 * The workspace is the authority for what it is aligned to. The pins are
 * already required to agree with each other — that is what this check is —
 * so the version they agree on is the version to hold them to. Pass
 * `--version` to assert a specific one instead.
 */
const ZEUS_SCOPE = '@zeus-js/'

/**
 * Only used when the workspace pins no `@zeus-js` dependency at all — an
 * empty tree, or one whose manifests could not be read. Keeping a value here
 * means such a tree is still checked rather than silently passing.
 */
const FALLBACK_EXPECTED_ZEUS_VERSION = '0.2.0-rc.5'
const INDEPENDENT_PACKAGE_VERSIONS: Readonly<Record<string, string>> = {
  '@zeus-js/vite-plugin': '0.0.5',
}

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
] as const

const PEER_DEP_FIELDS = ['peerDependencies'] as const

interface PackageJson {
  name?: string
  private?: boolean
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export interface CheckZeusBetaAlignmentOptions {
  root?: string
  expectedVersion?: string
  packageJsonFiles?: string[]
  primitiveRolldownConfig?: string
}

export interface ZeusBetaAlignmentProblem {
  type:
    | 'root-zeus-missing'
    | 'zeus-version-mismatch'
    | 'zeus-peer-range-mismatch'
    | 'web-c-runtime-legacy-version'
    | 'local-wc-dts-patch-present'
  file: string
  packageName?: string
  field?: string
  dependencyName?: string
  actual?: string
  expected?: string
}

export interface CheckZeusBetaAlignmentResult {
  ok: boolean
  expectedVersion: string
  expectedPeerRange: string
  problems: ZeusBetaAlignmentProblem[]
}

export function checkZeusBetaAlignment(
  options: CheckZeusBetaAlignmentOptions = {},
): CheckZeusBetaAlignmentResult {
  const root = options.root ?? process.cwd()
  const packageJsonFiles =
    options.packageJsonFiles ?? listZeusDependencyManifests(root)
  const expectedVersion =
    options.expectedVersion ??
    resolveWorkspaceZeusVersion(packageJsonFiles) ??
    FALLBACK_EXPECTED_ZEUS_VERSION
  const expectedPeerRange = createExpectedPeerRange(expectedVersion)
  const primitiveRolldownConfig =
    options.primitiveRolldownConfig ??
    join(root, 'scripts/rolldown/createPrimitiveRolldownConfig.ts')

  const problems: ZeusBetaAlignmentProblem[] = []

  checkPackageJsons({
    root,
    expectedVersion,
    expectedPeerRange,
    packageJsonFiles,
    problems,
  })

  checkNoLocalWcDtsPatch({
    root,
    primitiveRolldownConfig,
    problems,
  })

  return {
    ok: problems.length === 0,
    expectedVersion,
    expectedPeerRange,
    problems,
  }
}

function checkPackageJsons(options: {
  root: string
  expectedVersion: string
  expectedPeerRange: string
  packageJsonFiles: string[]
  problems: ZeusBetaAlignmentProblem[]
}): void {
  const {
    root,
    expectedVersion,
    expectedPeerRange,
    packageJsonFiles,
    problems,
  } = options

  let rootZeusFound = false

  for (const file of packageJsonFiles) {
    const pkg = readPackageJson(file)
    const relFile = slash(relative(root, file))

    for (const field of DEP_FIELDS) {
      const deps = pkg[field] ?? {}

      for (const [dependencyName, actual] of Object.entries(deps)) {
        if (!dependencyName.startsWith(ZEUS_SCOPE)) {
          continue
        }

        if (dependencyName === '@zeus-js/web-c-runtime' && actual === '0.2.0') {
          problems.push({
            type: 'web-c-runtime-legacy-version',
            file: relFile,
            packageName: pkg.name,
            field,
            dependencyName,
            actual,
            expected: expectedVersion,
          })
          continue
        }

        const allowedVersion =
          INDEPENDENT_PACKAGE_VERSIONS[dependencyName] ?? expectedVersion
        if (actual !== allowedVersion) {
          problems.push({
            type: 'zeus-version-mismatch',
            file: relFile,
            packageName: pkg.name,
            field,
            dependencyName,
            actual,
            expected: allowedVersion,
          })
        }

        if (relFile === 'package.json' && dependencyName === '@zeus-js/zeus') {
          rootZeusFound = true
        }
      }
    }

    for (const field of PEER_DEP_FIELDS) {
      const deps = pkg[field] ?? {}

      for (const [dependencyName, actual] of Object.entries(deps)) {
        if (!dependencyName.startsWith(ZEUS_SCOPE)) {
          continue
        }

        if (dependencyName === '@zeus-js/zeus') {
          if (actual !== expectedPeerRange) {
            problems.push({
              type: 'zeus-peer-range-mismatch',
              file: relFile,
              packageName: pkg.name,
              field,
              dependencyName,
              actual,
              expected: expectedPeerRange,
            })
          }

          continue
        }

        const allowedVersion =
          INDEPENDENT_PACKAGE_VERSIONS[dependencyName] ?? expectedVersion
        if (actual !== allowedVersion) {
          problems.push({
            type: 'zeus-version-mismatch',
            file: relFile,
            packageName: pkg.name,
            field,
            dependencyName,
            actual,
            expected: allowedVersion,
          })
        }
      }
    }
  }

  if (!rootZeusFound) {
    problems.push({
      type: 'root-zeus-missing',
      file: 'package.json',
      dependencyName: '@zeus-js/zeus',
      expected: expectedVersion,
    })
  }
}

function checkNoLocalWcDtsPatch(options: {
  root: string
  primitiveRolldownConfig: string
  problems: ZeusBetaAlignmentProblem[]
}): void {
  const { root, primitiveRolldownConfig, problems } = options

  if (!existsSync(primitiveRolldownConfig)) {
    return
  }

  const source = readFileSync(primitiveRolldownConfig, 'utf8')
  const forbiddenPatterns = [
    'fixWcEventListenerDts',
    'zeus-ui-fix-wc-event-listener-dts',
  ]

  for (const pattern of forbiddenPatterns) {
    if (!source.includes(pattern)) {
      continue
    }

    problems.push({
      type: 'local-wc-dts-patch-present',
      file: slash(relative(root, primitiveRolldownConfig)),
      actual: pattern,
      expected: 'remove local WC d.ts patch and rely on @zeus-js/component-dts',
    })
  }
}

function readPackageJson(file: string): PackageJson {
  return JSON.parse(readFileSync(file, 'utf8')) as PackageJson
}

/**
 * Reads the version the workspace pins itself to.
 *
 * Only `@zeus-js` dependencies that follow the coordinated line count;
 * `vite-plugin` is exempt and carries its own version. A workspace with no
 * such pins has nothing to check against, so the caller falls back to the
 * recorded baseline rather than guessing.
 */
function resolveWorkspaceZeusVersion(files: string[]): string | null {
  const counts = new Map<string, number>()

  for (const file of files) {
    let pkg: PackageJson

    try {
      pkg = readPackageJson(file)
    } catch {
      continue
    }

    for (const field of [...DEP_FIELDS, ...PEER_DEP_FIELDS]) {
      const deps = pkg[field]

      if (!deps) {
        continue
      }

      for (const [name, version] of Object.entries(deps)) {
        if (!name.startsWith(ZEUS_SCOPE)) {
          continue
        }

        if (name in INDEPENDENT_PACKAGE_VERSIONS) {
          continue
        }

        if (typeof version !== 'string' || !/^\d+\.\d+\.\d+/.test(version)) {
          continue
        }

        counts.set(version, (counts.get(version) ?? 0) + 1)
      }
    }
  }

  let winner: string | null = null
  let best = 0

  for (const [version, count] of counts) {
    if (count > best) {
      best = count
      winner = version
    }
  }

  return winner
}

function createExpectedPeerRange(version: string): string {
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    return `>=${version}`
  }

  return createZeusPeerRequirement(version)
}

function slash(value: string): string {
  return value.replace(/\\/g, '/')
}

function parseExpectedVersionArg(argv: string[]): string | null {
  const index = argv.indexOf('--version')

  if (index >= 0) {
    const version = argv[index + 1]

    if (!version) {
      throw new Error('--version requires a value.')
    }

    return version
  }

  return null
}

function printResult(result: CheckZeusBetaAlignmentResult): void {
  if (result.ok) {
    console.log(
      `Zeus beta alignment passed: ${result.expectedVersion}, peer ${result.expectedPeerRange}`,
    )
    return
  }

  console.error('Zeus beta alignment failed:')
  console.error(`  expected version: ${result.expectedVersion}`)
  console.error(`  expected peer: ${result.expectedPeerRange}`)

  for (const problem of result.problems) {
    const name = problem.packageName ? `${problem.packageName}: ` : ''
    const dep = problem.dependencyName ? `${problem.dependencyName}: ` : ''
    const field = problem.field ? `${problem.field}.` : ''

    switch (problem.type) {
      case 'root-zeus-missing':
        console.error(
          `  - ${problem.file}: root package.json must declare ${problem.dependencyName}=${problem.expected}`,
        )
        break

      case 'zeus-version-mismatch':
        console.error(
          `  - ${problem.file}: ${name}${field}${dep}${problem.actual} !== ${problem.expected}`,
        )
        break

      case 'zeus-peer-range-mismatch':
        console.error(
          `  - ${problem.file}: ${name}${field}${dep}${problem.actual} !== ${problem.expected}`,
        )
        break

      case 'web-c-runtime-legacy-version':
        console.error(
          `  - ${problem.file}: ${name}${field}${dep}must not use legacy ${problem.actual}; use ${problem.expected}`,
        )
        break

      case 'local-wc-dts-patch-present':
        console.error(
          `  - ${problem.file}: local WC d.ts patch is still present (${problem.actual})`,
        )
        break
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const expectedVersion = parseExpectedVersionArg(process.argv.slice(2))
  const result = checkZeusBetaAlignment({
    ...(expectedVersion ? { expectedVersion } : {}),
  })

  printResult(result)

  if (!result.ok) {
    process.exit(1)
  }
}
