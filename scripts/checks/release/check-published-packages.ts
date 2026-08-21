import type { Bundle as SigstoreBundle } from 'sigstore'
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
  distTags: Record<string, unknown>
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

export interface PublishedPackageLatestBaseline {
  [packageName: string]: string | null | undefined
}

export interface PublishedPackageCheckOptions {
  latestBaselinePath: string
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

export interface SigstoreVerifyOptions {
  certificateIdentityURI: string
  certificateIssuer: string
}

export interface SigstoreVerifier {
  (bundle: unknown, options: SigstoreVerifyOptions): Promise<void>
}

export interface PublishedPackageVerificationDependencies {
  fetchMetadata?: (
    packageName: string,
    version: string,
    registry: string,
  ) => Promise<PublishedPackageMetadata>
  wait?: (milliseconds: number) => Promise<void>
}

interface CapturedPackageLatest {
  latest: string | null
  packageName: string
}

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'
const DSSE_PAYLOAD_TYPE = 'application/vnd.in-toto+json'
const EXPECTED_CERTIFICATE_ISSUER =
  'https://token.actions.githubusercontent.com'
const EXPECTED_WORKFLOW_REPOSITORY = repositoryUrl.replace(/\.git$/, '')
const EXPECTED_WORKFLOW_PATH = '.github/workflows/publish.yml'
const MAX_REGISTRY_ATTEMPTS = 13
const REGISTRY_RETRY_DELAY_MS = 10_000
const RELEASE_VERSION_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-([\da-z-]+(?:\.[\da-z-]+)*))?$/i
const SLSA_PREDICATE_TYPE = 'https://slsa.dev/provenance/v1'

function isValidReleaseVersion(value: string): boolean {
  const match = RELEASE_VERSION_PATTERN.exec(value)

  if (!match) return false

  const prerelease = match[1]

  if (!prerelease) return true

  return prerelease.split('.').every(identifier => {
    if (!/^\d+$/.test(identifier)) return true

    return identifier === '0' || !identifier.startsWith('0')
  })
}

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
  latestBaseline: PublishedPackageLatestBaseline,
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
        `${packageName}: dist-tag ${tag} points to ${formatDistTagValue(actualTag)}`,
      )
    }

    const baselineLatest = latestBaseline[packageName]

    if (baselineLatest === undefined) {
      problems.push(`${packageName}: latest baseline is unavailable`)
    }

    const expectedLatest = tag === 'latest' ? version : baselineLatest
    const actualLatest = metadata.distTags.latest
    const latestMatches =
      expectedLatest === undefined ||
      (expectedLatest === null
        ? actualLatest === undefined
        : actualLatest === expectedLatest)

    if (!latestMatches) {
      problems.push(
        `${packageName}: dist-tag latest points to ${formatDistTagValue(actualLatest)}`,
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

function formatDistTagValue(value: unknown): string {
  if (value === undefined) return 'nothing'

  return String(value) || 'empty string'
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

export function verifySlsaProvenanceBundle(
  value: unknown,
  version: string,
  verifier: SigstoreVerifier = verifySigstoreBundle,
): Promise<PublishedProvenanceStatement | undefined> {
  const attestation = getSlsaProvenanceAttestation(value)

  if (
    !attestation ||
    !isRecord(attestation.bundle) ||
    !hasDsseSignature(attestation.bundle)
  ) {
    return Promise.resolve(undefined)
  }

  const bundle = attestation.bundle
  const encodedPayload = getDssePayload(bundle)

  if (!encodedPayload) return Promise.resolve(undefined)

  const certificateIdentity = `${EXPECTED_WORKFLOW_REPOSITORY}/${EXPECTED_WORKFLOW_PATH}@refs/tags/v${version}`

  return verifier(bundle, {
    certificateIdentityURI: `^${escapeRegExp(certificateIdentity)}$`,
    certificateIssuer: EXPECTED_CERTIFICATE_ISSUER,
  }).then(() => {
    if (getDssePayload(bundle) !== encodedPayload) return undefined

    const statement = decodeBase64Json(encodedPayload)

    return isPublishedProvenanceStatement(statement) ? statement : undefined
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasDsseSignature(bundle: Record<string, unknown>): boolean {
  const envelope = bundle.dsseEnvelope

  return Boolean(
    isRecord(envelope) &&
    Array.isArray(envelope.signatures) &&
    envelope.signatures.length > 0,
  )
}

function getDssePayload(bundle: Record<string, unknown>): string | undefined {
  const envelope = bundle.dsseEnvelope

  return isRecord(envelope) &&
    envelope.payloadType === DSSE_PAYLOAD_TYPE &&
    typeof envelope.payload === 'string'
    ? envelope.payload
    : undefined
}

function getSlsaProvenanceAttestation(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(value) || !Array.isArray(value.attestations)) return undefined

  const attestations = value.attestations.filter(
    candidate =>
      isRecord(candidate) && candidate.predicateType === SLSA_PREDICATE_TYPE,
  )

  return attestations.length === 1 ? attestations[0] : undefined
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
  const distTags = isRecord(packageMetadata['dist-tags'])
    ? packageMetadata['dist-tags']
    : {}
  const metadata: PublishedPackageMetadata = {
    distTags,
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

export function createRuntimeSmokeEntry(): string {
  return [
    "import assert from 'node:assert/strict'",
    "import * as compat from '@zeus-web/zeus-compat'",
    '',
    "assert.equal(typeof compat.defineElement, 'function')",
    "assert.equal(typeof compat.createSignal, 'function')",
    "assert.equal(typeof compat.createEffect, 'function')",
    '',
  ].join('\n')
}

export function parsePublishedPackageOptions(
  args: string[],
): PublishedPackageCheckOptions {
  let version = ''
  let tag = ''
  let latestBaselinePath = ''
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

    if (arg === '--latest-baseline' && value) {
      latestBaselinePath = value
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

  if (!isValidReleaseVersion(version)) {
    throw new Error('Expected --version with a valid release version')
  }

  if (!/^[a-z][\w.-]*$/i.test(tag)) {
    throw new Error('Expected --tag with a valid npm dist-tag')
  }

  if (!latestBaselinePath) {
    throw new Error('Expected --latest-baseline with a baseline file path')
  }

  if (!/^[0-9a-f]{40}$/i.test(releaseSha)) {
    throw new Error('Expected --release-sha with a 40-character commit SHA')
  }

  return {
    latestBaselinePath,
    releaseSha,
    registry: registry.endsWith('/') ? registry : `${registry}/`,
    root: process.cwd(),
    tag,
    version,
  }
}

export function capturePublishedPackageLatestBaseline(
  packageNames: string[],
  registry: string,
  fetcher: RegistryFetch = fetchRegistry,
): Promise<PublishedPackageLatestBaseline> {
  return Promise.all(
    packageNames.map(packageName => {
      const url = `${registry}${encodeURIComponent(packageName)}`

      return fetcher(url, {
        cache: 'no-store',
        headers: {
          accept: 'application/json',
        },
      }).then<CapturedPackageLatest>(response => {
        if (response.status === 404) {
          return { latest: null, packageName }
        }

        if (!response.ok) {
          throw new Error(
            `${packageName}: registry returned HTTP ${response.status}`,
          )
        }

        return response.json().then(value => {
          const packageMetadata = isRecord(value) ? value : {}
          const distTags = packageMetadata['dist-tags']

          if (!isRecord(distTags)) {
            throw new Error(`${packageName}: registry dist-tags are invalid`)
          }

          const latest = distTags.latest

          if (latest === undefined) return { latest: null, packageName }

          if (typeof latest !== 'string' || !isValidReleaseVersion(latest)) {
            throw new Error(
              `${packageName}: registry latest dist-tag is invalid`,
            )
          }

          return { latest, packageName }
        })
      })
    }),
  ).then(results => {
    const baseline: PublishedPackageLatestBaseline = {}

    for (const result of results) {
      baseline[result.packageName] = result.latest
    }

    return baseline
  })
}

export function readPublishedPackageLatestBaseline(
  path: string,
): PublishedPackageLatestBaseline {
  let value: unknown

  try {
    value = JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch {
    throw new Error('Latest baseline must be valid JSON')
  }

  if (!isRecord(value)) {
    throw new Error('Latest baseline must be a JSON object')
  }

  const baseline: PublishedPackageLatestBaseline = {}

  for (const packageName of Object.keys(value)) {
    const latest = value[packageName]

    if (
      latest !== null &&
      (typeof latest !== 'string' || !isValidReleaseVersion(latest))
    ) {
      throw new Error(`${packageName}: latest baseline is invalid`)
    }

    baseline[packageName] = latest
  }

  return baseline
}

export function fetchPublishedPackageMetadata(
  packageName: string,
  version: string,
  registry: string,
  fetcher: RegistryFetch = fetchRegistry,
  verifier: SigstoreVerifier = verifySigstoreBundle,
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
        .then(bundle =>
          verifySlsaProvenanceBundle(bundle, version, verifier).then(
            statement => {
              metadata.provenanceStatement = statement

              return metadata
            },
          ),
        )
    })
}

function verifySigstoreBundle(
  bundle: unknown,
  options: SigstoreVerifyOptions,
): Promise<void> {
  return import('sigstore')
    .then(moduleValue => moduleValue.verify(bundle as SigstoreBundle, options))
    .then(() => undefined)
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

export function verifyPublishedPackageRegistry(
  packageNames: string[],
  options: PublishedPackageCheckOptions,
  latestBaseline: PublishedPackageLatestBaseline,
  dependencies: PublishedPackageVerificationDependencies = {},
): Promise<void> {
  return verifyRegistry(packageNames, options, latestBaseline, 1, dependencies)
}

function verifyRegistry(
  packageNames: string[],
  options: PublishedPackageCheckOptions,
  latestBaseline: PublishedPackageLatestBaseline,
  attempt = 1,
  dependencies: PublishedPackageVerificationDependencies = {},
): Promise<void> {
  const fetchMetadata =
    dependencies.fetchMetadata ||
    ((packageName: string, version: string, registry: string) =>
      fetchPublishedPackageMetadata(packageName, version, registry))
  const wait = dependencies.wait || delay

  return Promise.all(
    packageNames.map(packageName =>
      fetchMetadata(packageName, options.version, options.registry).then(
        metadata => ({ metadata, packageName }),
      ),
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
        latestBaseline,
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

      return wait(REGISTRY_RETRY_DELAY_MS).then(() =>
        verifyRegistry(
          packageNames,
          options,
          latestBaseline,
          attempt + 1,
          dependencies,
        ),
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
  writeFileSync(join(directory, 'runtime-smoke.mjs'), createRuntimeSmokeEntry())
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

  const latestBaseline = readPublishedPackageLatestBaseline(
    options.latestBaselinePath,
  )

  return verifyPublishedPackageRegistry(
    packageNames,
    options,
    latestBaseline,
  ).then(() => {
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
