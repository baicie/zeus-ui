import type { Registry } from '../src'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateRegistry } from '../src'

const testDir = dirname(fileURLToPath(import.meta.url))
const registryPath = resolve(testDir, '../registry.json')

const phase11Items = [
  'label',
  'textarea',
  'radio-group',
  'select',
  'card',
  'badge',
  'separator',
  'skeleton',
  'alert',
]

describe('phase 11 registry contract', () => {
  const registry = JSON.parse(readFileSync(registryPath, 'utf-8')) as Registry

  it('keeps registry valid', () => {
    expect(validateRegistry(registry)).toEqual({ valid: true, errors: [] })
  })

  it('registers all phase 11 items', () => {
    for (const name of phase11Items) {
      const item = registry.items.find(candidate => candidate.name === name)
      expect(item).toBeDefined()
      expect(item?.dependencies).toContain(`@zeus-web/${name}`)
      expect(
        item?.files.some(file => file.target === `components/ui/${name}.tsx`),
      ).toBe(true)
    }
  })
})
