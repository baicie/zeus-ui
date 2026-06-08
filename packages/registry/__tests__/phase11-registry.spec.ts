import type { Registry } from '../src'
import { readFileSync } from 'node:fs'

import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import { validateRegistry } from '../src'

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
  const registry = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'packages/registry/registry.json'),
      'utf-8',
    ),
  ) as Registry

  it('keeps registry valid', () => {
    expect(validateRegistry(registry)).toEqual({
      valid: true,
      errors: [],
    })
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
