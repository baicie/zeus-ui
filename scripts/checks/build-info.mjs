// Build metadata for the AI Workbench image. Keep the algorithm identical to
// the Core scripts/release/build-info.ts so CI provenance can verify it.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    product: { type: 'string' },
    dist: { type: 'string' },
    'core-commit': { type: 'string' },
    'ui-commit': { type: 'string' },
    version: { type: 'string' },
    'built-at': { type: 'string' },
  },
})

const products = (values.product ?? '').split(',').map(value => value.trim()).filter(Boolean)
for (const [name, value] of [
  ['product', products.length > 0],
  ['dist', values.dist],
  ['core-commit', values['core-commit']],
  ['ui-commit', values['ui-commit']],
  ['version', values.version],
]) {
  if (!value) throw new Error(`--${name} is required`)
}

const dist = path.resolve(values.dist)
const files = []
const walk = (directory, prefix) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (relative === 'build-info.json') continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute, relative)
    else if (entry.isFile()) {
      const content = fs.readFileSync(absolute)
      files.push({
        path: relative,
        sha256: createHash('sha256').update(content).digest('hex'),
        bytes: content.byteLength,
      })
    }
  }
}
walk(dist, '')
files.sort((left, right) => left.path.localeCompare(right.path))
const hash = createHash('sha256')
for (const file of files) hash.update(`${file.path}\0${file.sha256}\n`)
const info = {
  schema: 'zeus.build-info/v1',
  products: [...new Set(products)].sort(),
  coreCommit: values['core-commit'],
  uiCommit: values['ui-commit'],
  version: values.version,
  builtAt: values['built-at'] ?? new Date().toISOString(),
  artifactDigest: `sha256:${hash.digest('hex')}`,
  files,
}
fs.writeFileSync(path.join(dist, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`)
console.log(`build-info ${info.products.join(',')}: ${info.artifactDigest}`)
