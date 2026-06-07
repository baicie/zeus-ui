import type { Registry } from '../src'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { fileURLToPath } from 'node:url'
import { validateRegistry } from '../src'

const testDir = dirname(fileURLToPath(import.meta.url))
const registryRoot = resolve(testDir, '..')
const registryJsonPath = resolve(registryRoot, 'registry.json')

function readRegistry(): Registry {
  return JSON.parse(readFileSync(registryJsonPath, 'utf-8')) as Registry
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

  it('passes registry validation', () => {
    const registry = readRegistry()
    const result = validateRegistry(registry)

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('uses per-primitive @zeus-web dependencies', () => {
    const registry = readRegistry()

    for (const item of registry.items) {
      expect(item.type).toBe('registry:ui')
      expect(item.dependencies).toContain(`@zeus-web/${item.name}`)
      expect(item.dependencies).toContain('class-variance-authority')
      expect(item.dependencies).toContain('clsx')
      expect(item.dependencies).toContain('tailwind-merge')
    }
  })

  it('references existing registry source files', () => {
    const registry = readRegistry()

    for (const item of registry.items) {
      for (const file of item.files) {
        expect(
          existsSync(resolve(registryRoot, file.path)),
          `${item.name} -> ${file.path}`,
        ).toBe(true)
      }
    }
  })

  it('ships shared utils source', () => {
    expect(existsSync(resolve(registryRoot, 'default/lib/utils.ts'))).toBe(true)
  })

  it('does not depend on @zeus-web/react aggregate package', () => {
    const registry = readRegistry()
    const sourceFiles = registry.items.flatMap(item => item.files)

    for (const file of sourceFiles) {
      if (!file.path.endsWith('.tsx') && !file.path.endsWith('.ts')) continue

      const source = readFileSync(resolve(registryRoot, file.path), 'utf-8')

      expect(source).not.toContain('@zeus-web/react')
    }
  })

  it('uses single primitive react entries in styled sources', () => {
    const registry = readRegistry()

    for (const item of registry.items) {
      const uiFile = item.files.find(file => file.type === 'registry:ui')
      expect(uiFile).toBeDefined()

      const source = readFileSync(resolve(registryRoot, uiFile!.path), 'utf-8')

      expect(source).toContain(`@zeus-web/${item.name}/react`)
    }
  })

  it('styles native controls through primitive data-slot selectors', () => {
    const buttonSource = readFileSync(
      resolve(registryRoot, 'default/button.tsx'),
      'utf-8',
    )
    const inputSource = readFileSync(
      resolve(registryRoot, 'default/input.tsx'),
      'utf-8',
    )

    expect(buttonSource).toContain('[&_[data-slot=button]]')
    expect(inputSource).toContain('[&_[data-slot=input]]')
    expect(inputSource).toContain('[&_[part=root]]')
  })
})
