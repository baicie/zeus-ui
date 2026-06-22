import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_EXPECTED_ZEUS_VERSION = '0.1.0-beta.6'
const ZEUS_SCOPE = '@zeus-js/'

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
  const expectedVersion =
    options.expectedVersion ?? DEFAULT_EXPECTED_ZEUS_VERSION
  const expectedPeerRange = createExpectedPeerRange(expectedVersion)
  const packageJsonFiles =
    options.packageJsonFiles ?? discoverPackageJsonFiles(root)
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

        if (actual !== expectedVersion) {
          problems.push({
            type: 'zeus-version-mismatch',
            file: relFile,
            packageName: pkg.name,
            field,
            dependencyName,
            actual,
            expected: expectedVersion,
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

        if (actual !== expectedVersion) {
          problems.push({
            type: 'zeus-version-mismatch',
            file: relFile,
            packageName: pkg.name,
            field,
            dependencyName,
            actual,
            expected: expectedVersion,
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

function discoverPackageJsonFiles(root: string): string[] {
  const files: string[] = []

  walk(root, root, files)

  return files.sort()
}

function walk(root: string, dir: string, files: string[]): void {
  for (const name of readdirSync(dir)) {
    const absolute = join(dir, name)
    const stat = statSync(absolute)

    if (stat.isDirectory()) {
      if (shouldSkipDirectory(name)) {
        continue
      }

      walk(root, absolute, files)
      continue
    }

    if (name === 'package.json') {
      files.push(absolute)
    }
  }
}

function shouldSkipDirectory(name: string): boolean {
  return (
    name === 'node_modules' ||
    name === 'dist' ||
    name === '.git' ||
    name === '.turbo' ||
    name === '.vitepress' ||
    name === '.next' ||
    name === 'coverage'
  )
}

function readPackageJson(file: string): PackageJson {
  return JSON.parse(readFileSync(file, 'utf8')) as PackageJson
}

function createExpectedPeerRange(version: string): string {
  const match = /^(\d+)\.(\d+)\.\d+/.exec(version)

  if (!match) {
    return `>=${version}`
  }

  const major = Number(match[1])
  const minor = Number(match[2])
  const upperBound = major === 0 ? `<0.${minor + 1}.0` : `<${major + 1}.0.0`

  return `>=${version} ${upperBound}`
}

function slash(value: string): string {
  return value.replace(/\\/g, '/')
}

function parseExpectedVersionArg(argv: string[]): string {
  const index = argv.indexOf('--version')

  if (index >= 0) {
    const version = argv[index + 1]

    if (!version) {
      throw new Error('--version requires a value.')
    }

    return version
  }

  return DEFAULT_EXPECTED_ZEUS_VERSION
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
    expectedVersion,
  })

  printResult(result)

  if (!result.ok) {
    process.exit(1)
  }
}
