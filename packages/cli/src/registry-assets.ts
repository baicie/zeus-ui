import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)

function readIfExists(path: string): string | null {
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf-8')
}

function readWorkspaceRegistryAsset(exportPath: string): string | null {
  const sourcePath = resolve(process.cwd(), 'packages/registry', exportPath)
  return readIfExists(sourcePath)
}

export function readRegistryAsset(exportPath: string): string {
  try {
    const resolvedPath = require.resolve(`@zeus-web/registry/${exportPath}`)
    const content = readIfExists(resolvedPath)

    if (content !== null) return content
  } catch {
    // Fall back to workspace source templates during local dev/test before
    // @zeus-web/registry has been built.
  }

  const workspaceContent = readWorkspaceRegistryAsset(exportPath)
  if (workspaceContent !== null) return workspaceContent

  throw new Error(
    `Unable to resolve @zeus-web/registry/${exportPath}. Build @zeus-web/registry or run from the workspace root.`,
  )
}

export function readRegistryCnTemplate(): string {
  return readRegistryAsset('templates/lib/cn.ts')
}

export function readRegistryGlobalsTemplate(): string {
  return readRegistryAsset('templates/css/globals.css')
}
