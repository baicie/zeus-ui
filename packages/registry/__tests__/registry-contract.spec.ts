import type { Registry } from '../src'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateRegistry } from '../src'

const testDir = dirname(fileURLToPath(import.meta.url))
const registryPath = resolve(testDir, '../registry.json')

const group11Items = [
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

const group12Items = [
  'collapsible',
  'accordion',
  'tooltip',
  'progress',
  'avatar',
]

describe('registry contract', () => {
  const registry = JSON.parse(readFileSync(registryPath, 'utf-8')) as Registry

  it('keeps registry valid', () => {
    expect(validateRegistry(registry)).toEqual({ valid: true, errors: [] })
  })

  it('registers all group 1 items (label/textarea/radio-group/select/card/badge/separator/skeleton/alert)', () => {
    for (const name of group11Items) {
      const item = registry.items.find(candidate => candidate.name === name)
      expect(item).toBeDefined()
      expect(item?.dependencies).toContain(`@zeus-web/${name}`)
      expect(
        item?.files.some(file => file.target === `components/ui/${name}.tsx`),
      ).toBe(true)
    }
  })

  it('registers all group 2 items (collapsible/accordion/tooltip/progress/avatar)', () => {
    for (const name of group12Items) {
      const item = registry.items.find(candidate => candidate.name === name)
      expect(item).toBeDefined()
      expect(item?.dependencies).toContain(`@zeus-web/${name}`)
      expect(
        item?.files.some(file => file.target === `components/ui/${name}.tsx`),
      ).toBe(true)
    }
  })
})
