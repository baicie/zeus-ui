import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

import { validateShowcaseMetadata } from '../../examples/showcase-shared/src'

interface RegistryItem {
  name: string
  type: string
}

interface Registry {
  items: RegistryItem[]
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf-8')) as T
}

function readRegistryComponentNames(): string[] {
  const registry = readJson<Registry>(
    resolve(process.cwd(), 'packages/registry/registry.json'),
  )

  return registry.items
    .filter(item => item.type === 'registry:ui')
    .map(item => item.name)
    .sort()
}

const result = validateShowcaseMetadata({
  registryComponentNames: readRegistryComponentNames(),
})

for (const warning of result.warnings) {
  console.log(pc.yellow(`warning: ${warning}`))
}

if (!result.valid) {
  for (const error of result.errors) {
    console.error(pc.red(`error: ${error}`))
  }

  process.exit(1)
}

console.log(pc.green('Showcase metadata check passed.'))
