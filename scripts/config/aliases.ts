// Shared path aliases for vitest and bundlers.
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')

const nonSrcPackages = ['dts-test']

const entries: Record<string, string> = {}

function addPackage(key: string, pkgPath: string) {
  if (nonSrcPackages.includes(key)) return
  if (key in entries) return

  const index = path.join(pkgPath, 'src', 'index.ts')
  entries[key] = index
}

// Scan packages/*
for (const name of readdirSync(path.join(root, 'packages'))) {
  const pkgPath = path.join(root, 'packages', name)
  if (!statSync(pkgPath).isDirectory()) continue
  addPackage(`@zeus-web/${name}`, pkgPath)
}

// Scan packages/primitives/*
const primitivesRoot = path.join(root, 'packages', 'primitives')
if (statSync(primitivesRoot).isDirectory()) {
  for (const name of readdirSync(primitivesRoot)) {
    const pkgPath = path.join(primitivesRoot, name)
    if (!statSync(pkgPath).isDirectory()) continue
    addPackage(`@zeus-web/${name}`, pkgPath)
  }
}

export { entries }
