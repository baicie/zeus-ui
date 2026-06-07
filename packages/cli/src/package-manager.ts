import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { execa } from 'execa'

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

export interface InstallDependenciesOptions {
  cwd: string
  packageManager?: PackageManager
  dependencies?: string[]
  devDependencies?: string[]
  dryRun?: boolean
}

export interface InstallCommand {
  command: PackageManager
  args: string[]
}

export function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(resolve(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(resolve(cwd, 'bun.lockb'))) return 'bun'
  if (existsSync(resolve(cwd, 'bun.lock'))) return 'bun'
  if (existsSync(resolve(cwd, 'yarn.lock'))) return 'yarn'
  if (existsSync(resolve(cwd, 'package-lock.json'))) return 'npm'

  return 'pnpm'
}

export function createInstallCommand(params: {
  packageManager: PackageManager
  dependencies: string[]
  dev: boolean
}): InstallCommand | null {
  if (params.dependencies.length === 0) return null

  switch (params.packageManager) {
    case 'pnpm':
      return {
        command: 'pnpm',
        args: params.dev
          ? ['add', '-D', ...params.dependencies]
          : ['add', ...params.dependencies],
      }

    case 'npm':
      return {
        command: 'npm',
        args: params.dev
          ? ['install', '-D', ...params.dependencies]
          : ['install', ...params.dependencies],
      }

    case 'yarn':
      return {
        command: 'yarn',
        args: params.dev
          ? ['add', '-D', ...params.dependencies]
          : ['add', ...params.dependencies],
      }

    case 'bun':
      return {
        command: 'bun',
        args: params.dev
          ? ['add', '-d', ...params.dependencies]
          : ['add', ...params.dependencies],
      }

    default:
      return null
  }
}

export async function installDependencies(
  options: InstallDependenciesOptions,
): Promise<InstallCommand[]> {
  const packageManager =
    options.packageManager ?? detectPackageManager(options.cwd)

  const commands = [
    createInstallCommand({
      packageManager,
      dependencies: options.dependencies ?? [],
      dev: false,
    }),
    createInstallCommand({
      packageManager,
      dependencies: options.devDependencies ?? [],
      dev: true,
    }),
  ].filter((command): command is InstallCommand => Boolean(command))

  if (options.dryRun) {
    return commands
  }

  for (const command of commands) {
    await execa(command.command, command.args, {
      cwd: options.cwd,
      stdio: 'inherit',
    })
  }

  return commands
}
