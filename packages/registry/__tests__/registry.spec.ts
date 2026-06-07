import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface RegistryItem {
  name: string
  type: string
  dependencies?: string[]
  files: Array<{
    path: string
    target: string
    type: string
  }>
}

interface RegistryJson {
  name: string
  homepage?: string
  items: RegistryItem[]
}

const testDir = dirname(fileURLToPath(import.meta.url))
const registryJsonPath = resolve(testDir, '../registry.json')

function readRegistry(): RegistryJson {
  return JSON.parse(readFileSync(registryJsonPath, 'utf-8')) as RegistryJson
}

describe('@zeus-web/registry registry.json', () => {
  it('uses zeus-web registry name', () => {
    const registry = readRegistry()

    expect(registry.name).toBe('@zeus-web/registry')
  })

  it('contains MVP primitive registry items', () => {
    const registry = readRegistry()

    expect(registry.items.map(item => item.name)).toEqual([
      'input',
      'button',
      'checkbox',
      'switch',
      'tabs',
      'dialog',
    ])
  })

  it('uses per-primitive @zeus-web dependencies', () => {
    const registry = readRegistry()

    for (const item of registry.items) {
      expect(item.type).toBe('registry:ui')
      const dep = `@zeus-web/${item.name}`
      expect(item.dependencies).toContain(dep)
    }
  })

  it('maps files into components/ui', () => {
    const registry = readRegistry()

    for (const item of registry.items) {
      expect(item.files).toHaveLength(1)
      const file = item.files[0]
      expect(file.path).toBe(`${item.name}.tsx`)
      expect(file.target).toBe(`components/ui/${item.name}.tsx`)
      expect(file.type).toBe('registry:ui')
    }
  })
})
