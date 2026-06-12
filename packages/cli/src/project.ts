import type { PackageManager } from './package-manager'

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type SupportedFramework = 'react' | 'vue'

export interface ProjectDetectionOptions {
  framework?: SupportedFramework
}

export interface ProjectDetectionResult {
  framework: SupportedFramework
  typescript: boolean
  srcDir: string
  packageManager?: PackageManager
}

interface PackageJsonLike {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function readPackageJson(cwd: string): PackageJsonLike | null {
  const file = resolve(cwd, 'package.json')
  if (!existsSync(file)) return null

  return JSON.parse(readFileSync(file, 'utf-8')) as PackageJsonLike
}

function hasDependency(
  packageJson: PackageJsonLike | null,
  dependency: string,
): boolean {
  if (!packageJson) return false

  return Boolean(
    packageJson.dependencies?.[dependency] ||
    packageJson.devDependencies?.[dependency],
  )
}

export function detectPackageManager(cwd: string): PackageManager | undefined {
  if (existsSync(resolve(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(resolve(cwd, 'package-lock.json'))) return 'npm'
  if (existsSync(resolve(cwd, 'yarn.lock'))) return 'yarn'
  if (
    existsSync(resolve(cwd, 'bun.lockb')) ||
    existsSync(resolve(cwd, 'bun.lock'))
  ) {
    return 'bun'
  }

  return undefined
}

export function detectProject(
  cwd: string,
  options: ProjectDetectionOptions = {},
): ProjectDetectionResult {
  const packageJson = readPackageJson(cwd)

  const hasReact = hasDependency(packageJson, 'react')
  const hasVue = hasDependency(packageJson, 'vue')

  if (hasReact && hasVue && !options.framework) {
    throw new Error(
      'Both React and Vue dependencies were detected. Pass --framework react or --framework vue.',
    )
  }

  const framework: SupportedFramework =
    options.framework ?? (hasVue ? 'vue' : 'react')

  const typescript =
    existsSync(resolve(cwd, 'tsconfig.json')) ||
    hasDependency(packageJson, 'typescript')

  const srcDir = existsSync(resolve(cwd, 'src')) ? 'src' : '.'

  return {
    framework,
    typescript,
    srcDir,
    packageManager: detectPackageManager(cwd),
  }
}
