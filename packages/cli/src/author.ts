import type {
  AuthorComponentManifest,
  AuthorCustomElementsManifest,
  AuthorPackageJson,
  AuthorValidationResult,
} from '@zeus-web/registry'

import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

import {
  authorZeusBaselineVersion,
  validateComponentPackage,
  validateOutputPluginMetadata,
} from '@zeus-web/registry'

export interface AuthorCheckFileReport {
  file: string
  valid: boolean
  diagnostics: AuthorValidationResult['diagnostics']
}

export interface AuthorCheckReport {
  valid: boolean
  packageDir: string
  /** Zeus version the package was built against. */
  packageZeusVersion?: string
  /** Zeus version found in the consumer install, if one was detected. */
  consumerZeusVersion?: string
  checks: AuthorCheckFileReport[]
  diagnostics: AuthorValidationResult['diagnostics']
}

export interface AuthorCheckOptions {
  /** Package root. Defaults to the current directory. */
  packageDir: string
  /** Override the consumer Zeus version instead of reading node_modules. */
  zeusVersion?: string
}

/**
 * Reads the installed `@zeus-js/zeus` version from the consumer's
 * node_modules. Falls back to the contract baseline when Zeus is not
 * installed yet, and reports that through `source` so callers can tell the
 * difference.
 */
export function detectInstalledZeusVersion(packageDir: string): {
  version: string
  source: 'installed' | 'baseline'
} {
  let current = resolve(packageDir)

  while (true) {
    const candidate = resolve(
      current,
      'node_modules',
      '@zeus-js',
      'zeus',
      'package.json',
    )
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, 'utf-8')) as {
          version?: unknown
        }
        if (typeof pkg.version === 'string' && pkg.version) {
          return { version: pkg.version, source: 'installed' }
        }
      } catch {
        // Ignore unreadable installs; the caller reports the baseline source.
      }
    }

    const parent = resolve(current, '..')
    if (parent === current) break
    current = parent
  }

  return { version: authorZeusBaselineVersion, source: 'baseline' }
}

/**
 * Resolves a published artifact through the package `exports` map, falling
 * back to the package root for sources that are not exported yet. Authors
 * build with `outDir: 'dist'`, so the manifest normally lives at
 * `dist/zeus.components.json`.
 */
function resolvePublishedFile(
  packageDir: string,
  packageJson: AuthorPackageJson,
  exportName: string,
  fallback: string,
): string | undefined {
  const entry = packageJson.exports?.[exportName] as unknown
  const candidates: string[] = []

  if (typeof entry === 'string') {
    candidates.push(entry)
  } else if (entry && typeof entry === 'object') {
    for (const value of Object.values(entry as Record<string, unknown>)) {
      if (typeof value === 'string') candidates.push(value)
    }
  }
  candidates.push(fallback)

  for (const candidate of candidates) {
    if (!candidate.startsWith('./')) continue
    const absolute = resolve(packageDir, candidate)
    if (existsSync(absolute) && statSync(absolute).isFile()) return absolute
  }

  return undefined
}

function readJsonFile(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf-8'))
}

function assertInside(base: string, file: string, label: string): void {
  const target = relative(base, file)
  if (target === '..' || target.startsWith(`..${sep}`) || isAbsolute(target)) {
    throw new Error(`${label} must live inside the package directory.`)
  }
}

/**
 * Creates the file resolver used by package export validation. Every export
 * target must resolve inside the package and exist as a file.
 */
function createFileResolver(packageDir: string): (file: string) => boolean {
  return file => {
    if (file.includes('\0')) return false
    const absolute = resolve(packageDir, file)
    const target = relative(packageDir, absolute)
    if (
      target === '..' ||
      target.startsWith(`..${sep}`) ||
      isAbsolute(target)
    ) {
      return false
    }
    if (!existsSync(absolute)) return false
    return statSync(absolute).isFile()
  }
}

function createCheck(
  file: string,
  diagnostics: AuthorValidationResult['diagnostics'],
): AuthorCheckFileReport {
  return { file, valid: diagnostics.length === 0, diagnostics }
}

export function checkAuthorPackage(
  options: AuthorCheckOptions,
): AuthorCheckReport {
  const packageDir = resolve(options.packageDir)
  if (!existsSync(packageDir) || !statSync(packageDir).isDirectory()) {
    throw new Error(`Package directory not found: ${packageDir}`)
  }

  const packageJsonFile = resolve(packageDir, 'package.json')
  if (!existsSync(packageJsonFile)) {
    throw new Error(`package.json not found in ${packageDir}`)
  }

  const packageJson = readJsonFile(packageJsonFile) as AuthorPackageJson
  const checks: AuthorCheckFileReport[] = []
  const diagnostics: AuthorValidationResult['diagnostics'] = []

  const consumer =
    options.zeusVersion !== undefined
      ? { version: options.zeusVersion, source: 'installed' as const }
      : detectInstalledZeusVersion(packageDir)

  const manifestFile = resolvePublishedFile(
    packageDir,
    packageJson,
    './zeus.components.json',
    'zeus.components.json',
  )
  const customElementsFile = resolvePublishedFile(
    packageDir,
    packageJson,
    './custom-elements.json',
    'custom-elements.json',
  )

  if (!manifestFile) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_FILE_MISSING',
      path: 'zeus.components.json',
      message:
        'zeus.components.json is required. Build the package with @zeus-js/output-wc before publishing.',
    })
  }

  if (!customElementsFile) {
    diagnostics.push({
      code: 'ZEUS_AUTHOR_FILE_MISSING',
      path: 'custom-elements.json',
      message:
        'custom-elements.json is required. Enable customElementsFile in @zeus-js/output-wc.',
    })
  }

  if (manifestFile && customElementsFile) {
    const manifest = readJsonFile(manifestFile) as AuthorComponentManifest
    const customElements = readJsonFile(
      customElementsFile,
    ) as AuthorCustomElementsManifest

    const result = validateComponentPackage({
      packageJson,
      manifest,
      customElements,
      expectedZeusVersion: consumer.version,
      fileExists: createFileResolver(packageDir),
    })

    checks.push(createCheck('package', result.diagnostics))
    diagnostics.push(...result.diagnostics)
  } else {
    const metadataResult = validateOutputPluginMetadata({
      zeus: packageJson.zeus,
    })
    checks.push(createCheck('package', metadataResult.diagnostics))
    diagnostics.push(...metadataResult.diagnostics)
  }

  if (packageJson.zeus?.plugins) {
    const pluginResult = validateOutputPluginMetadata({
      zeus: packageJson.zeus,
    })
    checks.push(createCheck('zeus.plugins', pluginResult.diagnostics))
    for (const diagnostic of pluginResult.diagnostics) {
      if (!diagnostics.includes(diagnostic)) diagnostics.push(diagnostic)
    }
  }

  if (manifestFile) {
    assertInside(packageDir, manifestFile, 'zeus.components.json')
  }
  if (customElementsFile) {
    assertInside(packageDir, customElementsFile, 'custom-elements.json')
  }

  return {
    valid: diagnostics.length === 0,
    packageDir,
    packageZeusVersion: packageJson.peerDependencies?.['@zeus-js/zeus'],
    consumerZeusVersion: consumer.version,
    checks,
    diagnostics,
  }
}

export function formatAuthorCheckReport(report: AuthorCheckReport): string {
  const lines: string[] = []
  lines.push(
    report.valid
      ? `Author package is valid: ${report.packageDir}`
      : `Author package has ${report.diagnostics.length} problem(s): ${report.packageDir}`,
  )

  if (report.packageZeusVersion) {
    lines.push(
      `  Zeus peer pin: ${report.packageZeusVersion} (consumer resolves ${report.consumerZeusVersion})`,
    )
  }

  for (const diagnostic of report.diagnostics) {
    lines.push(`  ${diagnostic.code} ${diagnostic.path}`)
    lines.push(`    ${diagnostic.message}`)
  }

  return lines.join('\n')
}
