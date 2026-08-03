import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import pc from 'picocolors'

import { listPublishablePackages, repositoryUrl } from '../../release/workspace'

export interface ConsumerPackageJson {
  name: string
  private: boolean
  type: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

export interface PublishedPackageMetadata {
  attestationUrl?: string
  distTags: Record<string, string>
  integrity?: string
  provenancePredicateType?: string
  provenanceStatement?: PublishedProvenanceStatement
  versions: string[]
}

interface ProvenanceDigest {
  gitCommit?: string
  sha512?: string
}

interface ProvenanceResolvedDependency {
  digest?: ProvenanceDigest
  uri?: string
}

interface ProvenanceSubject {
  digest?: ProvenanceDigest
  name?: string
}

interface ProvenanceWorkflow {
  path?: string
  ref?: string
  repository?: string
}

export interface PublishedProvenanceStatement {
  predicate?: {
    buildDefinition?: {
      externalParameters?: {
        workflow?: ProvenanceWorkflow
      }
      resolvedDependencies?: ProvenanceResolvedDependency[]
    }
  }
  predicateType?: string
  subject?: ProvenanceSubject[]
}

export interface PublishedMetadataByName {
  [packageName: string]: PublishedPackageMetadata | undefined
}

export interface PublishedPackageCheckOptions {
  expectedLatest: string
  releaseSha: string
  registry: string
  root: string
  tag: string
  version: string
}

interface ExecFileOptions {
  cwd: string
  env?: NodeJS.ProcessEnv
}

export interface RegistryFetchOptions {
  cache: 'no-store'
  headers: {
    accept: 'application/json'
  }
}

export interface RegistryFetchResponse {
  json: () => Promise<unknown>
  ok: boolean
  status: number
}

export interface RegistryFetch {
  (url: string, options: RegistryFetchOptions): Promise<RegistryFetchResponse>
}

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'
const DSSE_PAYLOAD_TYPE = 'application/vnd.in-toto+json'
const EXPECTED_WORKFLOW_REPOSITORY = repositoryUrl.replace(/\.git$/, '')
const EXPECTED_WORKFLOW_PATH = '.github/workflows/publish.yml'
const MAX_REGISTRY_ATTEMPTS = 6
const REGISTRY_RETRY_DELAY_MS = 5000
const SLSA_PREDICATE_TYPE = 'https://slsa.dev/provenance/v1'

export function createConsumerPackageJson(
  packageNames: string[],
  version: string,
): ConsumerPackageJson {
  const dependencies: Record<string, string> = {
    react: '^19.1.1',
    'react-dom': '^19.1.1',
    vue: '^3.5.18',
  }

  for (const packageName of packageNames) {
    dependencies[packageName] = version
  }

  return {
    name: 'zeus-web-published-smoke',
    private: true,
    type: 'module',
    dependencies,
    devDependencies: {
      '@types/react': '^19.1.9',
      '@types/react-dom': '^19.1.7',
      typescript: '^6.0.3',
      vite: '^8.0.16',
    },
  }
}

export function getPublishedMetadataProblems(
  packageNames: string[],
  version: string,
  tag: string,
  metadataByName: PublishedMetadataByName,
  expectedLatest: string,
  releaseSha: string,
): string[] {
  const problems: string[] = []
  const expectedWorkflowRef = `refs/tags/v${version}`
  const expectedSourceUri = `git+${EXPECTED_WORKFLOW_REPOSITORY}@${expectedWorkflowRef}`

  for (const packageName of packageNames) {
    const metadata = metadataByName[packageName]

    if (!metadata) {
      problems.push(`${packageName}: registry metadata is unavailable`)
      continue
    }

    if (!metadata.versions.includes(version)) {
      problems.push(`${packageName}: version ${version} is unavailable`)
    }

    if (metadata.distTags[tag] !== version) {
      const actualTag = metadata.distTags[tag]

      problems.push(
        `${packageName}: dist-tag ${tag} points to ${actualTag || 'nothing'}`,
      )
    }

    if (metadata.distTags.latest !== expectedLatest) {
      const actualLatest = metadata.distTags.latest

      problems.push(
        `${packageName}: dist-tag latest points to ${actualLatest || 'nothing'}`,
      )
    }

    const provenanceStatement =
      metadata.provenancePredicateType === SLSA_PREDICATE_TYPE &&
      metadata.provenanceStatement &&
      metadata.provenanceStatement.predicateType === SLSA_PREDICATE_TYPE
        ? metadata.provenanceStatement
        : undefined

    if (!provenanceStatement) {
      problems.push(`${packageName}: SLSA provenance is unavailable`)
    }

    if (provenanceStatement) {
      const workflow = getProvenanceWorkflow(provenanceStatement)
      const sourceDependencies = getProvenanceResolvedDependencies(
        provenanceStatement,
      ).filter(dependency => dependency.uri === expectedSourceUri)
      const expectedSubjectName = getNpmPackagePurl(packageName, version)
      const expectedSubjectDigest = metadata.integrity
        ? decodeSha512Integrity(metadata.integrity)
        : undefined

      if (
        !expectedSubjectDigest ||
        !hasProvenanceSubject(
          provenanceStatement,
          expectedSubjectName,
          expectedSubjectDigest,
        )
      ) {
        problems.push(
          `${packageName}: SLSA provenance subject does not match ${expectedSubjectName} and its sha512 digest`,
        )
      }

      if (sourceDependencies.length === 0) {
        problems.push(
          `${packageName}: SLSA provenance source does not match ${expectedSourceUri}`,
        )
      } else if (
        !sourceDependencies.some(dependency => {
          const digest = dependency.digest

          return digest ? digest.gitCommit === releaseSha : false
        })
      ) {
        problems.push(
          `${packageName}: SLSA provenance release commit does not match ${releaseSha}`,
        )
      }

      if (!workflow || workflow.repository !== EXPECTED_WORKFLOW_REPOSITORY) {
        problems.push(
          `${packageName}: SLSA provenance workflow repository does not match ${EXPECTED_WORKFLOW_REPOSITORY}`,
        )
      }

      if (!workflow || workflow.ref !== expectedWorkflowRef) {
        problems.push(
          `${packageName}: SLSA provenance workflow ref does not match ${expectedWorkflowRef}`,
        )
      }

      if (!workflow || workflow.path !== EXPECTED_WORKFLOW_PATH) {
        problems.push(
          `${packageName}: SLSA provenance workflow path does not match ${EXPECTED_WORKFLOW_PATH}`,
        )
      }
    }
  }

  return problems
}

function getProvenanceResolvedDependencies(
  statement: PublishedProvenanceStatement,
): ProvenanceResolvedDependency[] {
  const predicate = statement.predicate
  const buildDefinition = predicate ? predicate.buildDefinition : undefined
  const dependencies = buildDefinition
    ? buildDefinition.resolvedDependencies
    : undefined

  return dependencies || []
}

function decodeSha512Integrity(integrity: string): string | undefined {
  const prefix = 'sha512-'

  if (!integrity.startsWith(prefix)) return undefined

  const encodedDigest = integrity.slice(prefix.length)
  const digest = decodeCanonicalBase64(encodedDigest)

  if (!digest || digest.length !== 64) return undefined

  return digest.toString('hex')
}

function getNpmPackagePurl(packageName: string, version: string): string {
  const encodedPackageName = packageName.startsWith('@')
    ? `%40${packageName.slice(1)}`
    : packageName

  return `pkg:npm/${encodedPackageName}@${version}`
}

function hasProvenanceSubject(
  statement: PublishedProvenanceStatement,
  expectedName: string,
  expectedDigest: string,
): boolean {
  const subjects = statement.subject

  if (!subjects) return false

  return subjects.some(subject => {
    const digest = subject.digest

    return (
      subject.name === expectedName &&
      Boolean(digest && digest.sha512 === expectedDigest)
    )
  })
}

function getProvenanceWorkflow(
  statement: PublishedProvenanceStatement,
): ProvenanceWorkflow | undefined {
  const predicate = statement.predicate
  const buildDefinition = predicate ? predicate.buildDefinition : undefined
  const externalParameters = buildDefinition
    ? buildDefinition.externalParameters
    : undefined

  return externalParameters ? externalParameters.workflow : undefined
}

export function parseSlsaProvenanceBundle(
  value: unknown,
): PublishedProvenanceStatement | undefined {
  if (!isRecord(value) || !Array.isArray(value.attestations)) return undefined

  const attestations = value.attestations.filter(
    candidate =>
      isRecord(candidate) && candidate.predicateType === SLSA_PREDICATE_TYPE,
  )
  const attestation = attestations.length === 1 ? attestations[0] : undefined

  if (!isRecord(attestation) || !isRecord(attestation.bundle)) {
    return undefined
  }

  const envelope = attestation.bundle.dsseEnvelope

  if (
    !isRecord(envelope) ||
    envelope.payloadType !== DSSE_PAYLOAD_TYPE ||
    typeof envelope.payload !== 'string'
  ) {
    return undefined
  }

  const statement = decodeBase64Json(envelope.payload)

  return isPublishedProvenanceStatement(statement) ? statement : undefined
}

export function parseRegistryPackageMetadata(
  value: unknown,
  version: string,
): PublishedPackageMetadata {
  const packageMetadata = isRecord(value) ? value : {}
  const versions = isRecord(packageMetadata.versions)
    ? packageMetadata.versions
    : {}
  const versionMetadata = isRecord(versions[version]) ? versions[version] : {}
  const dist = isRecord(versionMetadata.dist) ? versionMetadata.dist : {}
  const attestations = isRecord(dist.attestations) ? dist.attestations : {}
  const provenance = isRecord(attestations.provenance)
    ? attestations.provenance
    : {}
  const metadata: PublishedPackageMetadata = {
    distTags: getStringRecord(packageMetadata['dist-tags']),
    versions: Object.keys(versions),
  }

  if (typeof dist.integrity === 'string') {
    metadata.integrity = dist.integrity
  }

  if (typeof attestations.url === 'string') {
    metadata.attestationUrl = attestations.url
  }

  if (typeof provenance.predicateType === 'string') {
    metadata.provenancePredicateType = provenance.predicateType
  }

  return metadata
}

function getStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}

  const result: Record<string, string> = {}

  for (const key of Object.keys(value)) {
    const item = value[key]

    if (typeof item === 'string') result[key] = item
  }

  return result
}

function decodeBase64Json(value: string): unknown {
  const decoded = decodeCanonicalBase64(value)

  if (!decoded) return undefined

  try {
    const parsed: unknown = JSON.parse(decoded.toString('utf8'))

    return parsed
  } catch {
    return undefined
  }
}

function decodeCanonicalBase64(value: string): Buffer | undefined {
  const normalizedValue = value.replace(/=+$/, '')

  if (
    value.length === 0 ||
    value.length % 4 === 1 ||
    !/^[a-z\d+/]+={0,2}$/i.test(value)
  ) {
    return undefined
  }

  const decoded = Buffer.from(value, 'base64')
  const normalizedDecoded = decoded.toString('base64').replace(/=+$/, '')

  return normalizedDecoded === normalizedValue ? decoded : undefined
}

function isPublishedProvenanceStatement(
  value: unknown,
): value is PublishedProvenanceStatement {
  if (
    !isRecord(value) ||
    value.predicateType !== SLSA_PREDICATE_TYPE ||
    !Array.isArray(value.subject) ||
    !value.subject.every(isProvenanceSubject) ||
    !isRecord(value.predicate) ||
    !isRecord(value.predicate.buildDefinition)
  ) {
    return false
  }

  const buildDefinition = value.predicate.buildDefinition

  return (
    isRecord(buildDefinition.externalParameters) &&
    isProvenanceWorkflow(buildDefinition.externalParameters.workflow) &&
    Array.isArray(buildDefinition.resolvedDependencies) &&
    buildDefinition.resolvedDependencies.every(isProvenanceResolvedDependency)
  )
}

function isProvenanceResolvedDependency(
  value: unknown,
): value is ProvenanceResolvedDependency {
  return (
    isRecord(value) &&
    typeof value.uri === 'string' &&
    isRecord(value.digest) &&
    typeof value.digest.gitCommit === 'string'
  )
}

function isProvenanceSubject(value: unknown): value is ProvenanceSubject {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    isRecord(value.digest) &&
    typeof value.digest.sha512 === 'string'
  )
}

function isProvenanceWorkflow(value: unknown): value is ProvenanceWorkflow {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    typeof value.ref === 'string' &&
    typeof value.repository === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function createBrowserEntry(
  packageNames: string[],
  componentPackageNames: string[],
): string {
  const browserPackageNames = packageNames.filter(
    packageName => packageName !== '@zeus-web/cli',
  )
  const imports = browserPackageNames.map(
    (packageName, index) =>
      `import * as PublishedPackage${index} from '${packageName}'`,
  )
  const moduleNames = browserPackageNames.map(
    (_packageName, index) => `  PublishedPackage${index},`,
  )

  for (let index = 0; index < componentPackageNames.length; index += 1) {
    const packageName = componentPackageNames[index]

    imports.push(
      `import * as PublishedReactPackage${index} from '${packageName}/react'`,
      `import * as PublishedVuePackage${index} from '${packageName}/vue'`,
    )
    moduleNames.push(
      `  PublishedReactPackage${index},`,
      `  PublishedVuePackage${index},`,
    )
  }

  if (packageNames.includes('@zeus-web/ui')) {
    imports.push("import '@zeus-web/ui/styles.css'")
  }

  const lines = imports.slice()

  lines.push('', 'const publishedPackages = [')

  for (const moduleName of moduleNames) {
    lines.push(moduleName)
  }

  lines.push(
    ']',
    '',
    'if (publishedPackages.length === 0)',
    "  throw new Error('No published browser packages were loaded')",
    '',
    'document.documentElement.dataset.zeusPackages = String(publishedPackages.length)',
    '',
  )

  return lines.join('\n')
}

export function parsePublishedPackageOptions(
  args: string[],
): PublishedPackageCheckOptions {
  let version = ''
  let tag = ''
  let expectedLatest = ''
  let releaseSha = ''
  let registry = DEFAULT_REGISTRY

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const value = args[index + 1]

    if (arg === '--version' && value) {
      version = value
      index += 1
      continue
    }

    if (arg === '--tag' && value) {
      tag = value
      index += 1
      continue
    }

    if (arg === '--expected-latest' && value) {
      expectedLatest = value
      index += 1
      continue
    }

    if (arg === '--release-sha' && value) {
      releaseSha = value
      index += 1
      continue
    }

    if (arg === '--registry' && value) {
      registry = value
      index += 1
      continue
    }

    throw new Error(`Unknown or incomplete option: ${arg}`)
  }

  if (!/^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i.test(version)) {
    throw new Error('Expected --version with a valid release version')
  }

  if (!/^[a-z][\w.-]*$/i.test(tag)) {
    throw new Error('Expected --tag with a valid npm dist-tag')
  }

  if (!/^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i.test(expectedLatest)) {
    throw new Error('Expected --expected-latest with a valid release version')
  }

  if (!/^[0-9a-f]{40}$/i.test(releaseSha)) {
    throw new Error('Expected --release-sha with a 40-character commit SHA')
  }

  return {
    expectedLatest,
    releaseSha,
    registry: registry.endsWith('/') ? registry : `${registry}/`,
    root: process.cwd(),
    tag,
    version,
  }
}

export function fetchPublishedPackageMetadata(
  packageName: string,
  version: string,
  registry: string,
  fetcher: RegistryFetch = fetchRegistry,
): Promise<PublishedPackageMetadata> {
  const url = `${registry}${encodeURIComponent(packageName)}`

  return fetcher(url, {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
    },
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(
          `${packageName}: registry returned HTTP ${response.status}`,
        )
      }

      return response.json()
    })
    .then(value => {
      const metadata = parseRegistryPackageMetadata(value, version)

      if (!metadata.attestationUrl) return metadata

      return fetcher(metadata.attestationUrl, {
        cache: 'no-store',
        headers: {
          accept: 'application/json',
        },
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(
              `${packageName}: attestation registry returned HTTP ${response.status}`,
            )
          }

          return response.json()
        })
        .then(bundle => {
          metadata.provenanceStatement = parseSlsaProvenanceBundle(bundle)

          return metadata
        })
    })
}

function fetchRegistry(
  url: string,
  options: RegistryFetchOptions,
): Promise<RegistryFetchResponse> {
  return fetch(url, options)
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds)
  })
}

function verifyRegistry(
  packageNames: string[],
  options: PublishedPackageCheckOptions,
  attempt = 1,
): Promise<void> {
  return Promise.all(
    packageNames.map(packageName =>
      fetchPublishedPackageMetadata(
        packageName,
        options.version,
        options.registry,
      ).then(metadata => ({ metadata, packageName })),
    ),
  )
    .then(results => {
      const metadataByName: PublishedMetadataByName = {}

      for (const result of results) {
        metadataByName[result.packageName] = result.metadata
      }

      const problems = getPublishedMetadataProblems(
        packageNames,
        options.version,
        options.tag,
        metadataByName,
        options.expectedLatest,
        options.releaseSha,
      )

      if (problems.length > 0) {
        throw new Error(problems.join('\n'))
      }
    })
    .catch(error => {
      if (attempt >= MAX_REGISTRY_ATTEMPTS) {
        throw error
      }

      console.warn(
        pc.yellow(
          `Registry verification attempt ${attempt} failed; retrying in ${REGISTRY_RETRY_DELAY_MS / 1000}s`,
        ),
      )

      return delay(REGISTRY_RETRY_DELAY_MS).then(() =>
        verifyRegistry(packageNames, options, attempt + 1),
      )
    })
}

function writeConsumerProject(
  directory: string,
  packageNames: string[],
  componentPackageNames: string[],
  version: string,
): void {
  const sourceDirectory = join(directory, 'src')

  mkdirSync(sourceDirectory, { recursive: true })
  writeFileSync(
    join(directory, 'package.json'),
    `${JSON.stringify(createConsumerPackageJson(packageNames, version), null, 2)}\n`,
  )
  writeFileSync(
    join(directory, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          lib: ['ES2022', 'DOM'],
          module: 'ESNext',
          moduleResolution: 'Bundler',
          noEmit: true,
          strict: true,
          target: 'ES2022',
        },
        include: ['src'],
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(
    join(directory, 'index.html'),
    '<div id="app"></div>\n<script type="module" src="/src/main.ts"></script>\n',
  )
  writeFileSync(
    join(sourceDirectory, 'main.ts'),
    createBrowserEntry(packageNames, componentPackageNames),
  )
  writeFileSync(
    join(sourceDirectory, 'styles.d.ts'),
    "declare module '*.css'\n",
  )
  writeFileSync(
    join(directory, 'runtime-smoke.mjs'),
    [
      "import assert from 'node:assert/strict'",
      "import * as compat from '@zeus-web/zeus-compat'",
      '',
      "assert.equal(typeof compat.defineElement, 'function')",
      "assert.equal(typeof compat.state, 'function')",
      "assert.equal(typeof compat.effect, 'function')",
      '',
    ].join('\n'),
  )
}

function runCommand(
  command: string,
  args: string[],
  options: ExecFileOptions,
): void {
  execFileSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: 'inherit',
  })
}

function assertInstalledVersions(
  directory: string,
  packageNames: string[],
  version: string,
): void {
  for (const packageName of packageNames) {
    const packageJsonPath = join(
      directory,
      'node_modules',
      packageName,
      'package.json',
    )
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      version?: string
    }

    if (packageJson.version !== version) {
      throw new Error(
        `${packageName}: installed ${packageJson.version ? packageJson.version : 'unknown'} instead of ${version}`,
      )
    }
  }
}

function runConsumerSmoke(
  packageNames: string[],
  componentPackageNames: string[],
  options: PublishedPackageCheckOptions,
): void {
  const directory = mkdtempSync(join(tmpdir(), 'zeus-web-published-smoke-'))
  const installEnv = Object.assign({}, process.env)

  installEnv.npm_config_registry = options.registry

  try {
    writeConsumerProject(
      directory,
      packageNames,
      componentPackageNames,
      options.version,
    )
    runCommand(
      'pnpm',
      ['install', '--ignore-workspace', '--frozen-lockfile=false'],
      {
        cwd: directory,
        env: installEnv,
      },
    )
    assertInstalledVersions(directory, packageNames, options.version)
    runCommand(
      'pnpm',
      ['exec', 'tsc', '--noEmit', '--project', 'tsconfig.json'],
      { cwd: directory },
    )
    runCommand('pnpm', ['exec', 'vite', 'build'], {
      cwd: directory,
    })
    runCommand('node', [join(directory, 'runtime-smoke.mjs')], {
      cwd: directory,
    })
    runCommand('pnpm', ['exec', 'zweb', '--help'], {
      cwd: directory,
    })
  } finally {
    rmSync(directory, {
      force: true,
      recursive: true,
    })
  }
}

function main(): Promise<void> {
  const options = parsePublishedPackageOptions(process.argv.slice(2))
  const packages = listPublishablePackages(options.root)
  const packageNames = packages.map(packageItem => packageItem.name)
  const componentPackageNames = packages
    .filter(packageItem => packageItem.isPrimitive || packageItem.isAdvanced)
    .map(packageItem => packageItem.name)

  return verifyRegistry(packageNames, options).then(() => {
    console.info(
      pc.green(
        `Verified npm metadata for ${packageNames.length} packages at ${options.version} (${options.tag})`,
      ),
    )
    runConsumerSmoke(packageNames, componentPackageNames, options)
    console.info(
      pc.green(
        `Published package smoke passed for ${packageNames.length} packages.`,
      ),
    )
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(pc.red((error as Error).message))
    process.exit(1)
  })
}
