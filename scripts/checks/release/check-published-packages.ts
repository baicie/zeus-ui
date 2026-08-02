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

import { listPublishablePackages } from '../../release/workspace'

export interface ConsumerPackageJson {
  name: string
  private: boolean
  type: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

export interface PublishedPackageMetadata {
  distTags: Record<string, string>
  provenancePredicateType?: string
  versions: string[]
}

export interface PublishedMetadataByName {
  [packageName: string]: PublishedPackageMetadata | undefined
}

interface RegistryVersionMetadata {
  dist?: {
    attestations?: {
      provenance?: {
        predicateType?: string
      }
    }
  }
}

interface RegistryPackageMetadata {
  'dist-tags'?: Record<string, string>
  versions?: Record<string, RegistryVersionMetadata>
}

interface Options {
  registry: string
  root: string
  tag: string
  version: string
}

interface ExecFileOptions {
  cwd: string
  env?: NodeJS.ProcessEnv
}

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'
const MAX_REGISTRY_ATTEMPTS = 6
const REGISTRY_RETRY_DELAY_MS = 5000

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
    },
  }
}

export function getPublishedMetadataProblems(
  packageNames: string[],
  version: string,
  tag: string,
  metadataByName: PublishedMetadataByName,
): string[] {
  const problems: string[] = []

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

    if (metadata.provenancePredicateType !== 'https://slsa.dev/provenance/v1') {
      problems.push(`${packageName}: SLSA provenance is unavailable`)
    }
  }

  return problems
}

export function createBrowserEntry(packageNames: string[]): string {
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

function parseOptions(args: string[]): Options {
  let version = ''
  let tag = ''
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

  return {
    registry: registry.endsWith('/') ? registry : `${registry}/`,
    root: process.cwd(),
    tag,
    version,
  }
}

function fetchPublishedPackageMetadata(
  packageName: string,
  version: string,
  registry: string,
): Promise<PublishedPackageMetadata> {
  const url = `${registry}${encodeURIComponent(packageName)}`

  return fetch(url, {
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
      const metadata = value as RegistryPackageMetadata
      const versions = metadata.versions ? Object.keys(metadata.versions) : []
      const versionMetadata = metadata.versions
        ? metadata.versions[version]
        : undefined
      const attestations =
        versionMetadata && versionMetadata.dist
          ? versionMetadata.dist.attestations
          : undefined
      const provenance = attestations ? attestations.provenance : undefined

      return {
        distTags: metadata['dist-tags'] ? metadata['dist-tags'] : {},
        provenancePredicateType: provenance
          ? provenance.predicateType
          : undefined,
        versions,
      }
    })
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds)
  })
}

function verifyRegistry(
  packageNames: string[],
  options: Options,
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
    createBrowserEntry(packageNames),
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

function runConsumerSmoke(packageNames: string[], options: Options): void {
  const directory = mkdtempSync(join(tmpdir(), 'zeus-web-published-smoke-'))
  const installEnv = Object.assign({}, process.env)

  installEnv.npm_config_registry = options.registry

  try {
    writeConsumerProject(directory, packageNames, options.version)
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
      [
        'exec',
        'tsc',
        '--noEmit',
        '--project',
        join(directory, 'tsconfig.json'),
      ],
      { cwd: options.root },
    )
    runCommand('pnpm', ['exec', 'vite', 'build', directory], {
      cwd: options.root,
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
  const options = parseOptions(process.argv.slice(2))
  const packageNames = listPublishablePackages(options.root).map(
    packageItem => packageItem.name,
  )

  return verifyRegistry(packageNames, options).then(() => {
    console.info(
      pc.green(
        `Verified npm metadata for ${packageNames.length} packages at ${options.version} (${options.tag})`,
      ),
    )
    runConsumerSmoke(packageNames, options)
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
