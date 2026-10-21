import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

import { listPublishablePackages } from '../../release/workspace'

const root = process.cwd()
const defaultLimit = 48 * 1024
const largerPackageLimits: Record<string, number> = {
  '@zeus-web/chat': 64 * 1024,
  '@zeus-web/data-grid': 64 * 1024,
}

function collectJavaScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) return []

  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name)
    if (entry.isDirectory()) return collectJavaScriptFiles(file)
    return entry.name.endsWith('.js') ? [file] : []
  })
}

function gzipSize(files: string[]): number {
  return files.reduce(
    (total, file) => total + gzipSync(readFileSync(file)).length,
    0,
  )
}

const failures: string[] = []
for (const pkg of listPublishablePackages(root)) {
  const files = collectJavaScriptFiles(resolve(pkg.dir, 'dist'))
  if (files.length === 0) {
    failures.push(`${pkg.name}: missing dist JavaScript output`)
    continue
  }

  const size = gzipSize(files)
  const limit = largerPackageLimits[pkg.name] ?? defaultLimit
  if (size > limit) {
    failures.push(`${pkg.name}: ${size} B gzip exceeds ${limit} B`)
  }
}

if (failures.length > 0) {
  throw new Error(['Bundle size budget failed:', ...failures].join('\n'))
}

console.info(
  `Bundle size budget passed for ${listPublishablePackages(root).length} packages.`,
)
