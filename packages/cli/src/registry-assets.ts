import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export function readRegistryAsset(exportPath: string): string {
  const path = require.resolve(`@zeus-web/registry/${exportPath}`)
  return readFileSync(path, 'utf-8')
}

export function readRegistryCnTemplate(): string {
  return readRegistryAsset('templates/lib/cn.ts')
}

export function readRegistryGlobalsTemplate(): string {
  return readRegistryAsset('templates/css/globals.css')
}
