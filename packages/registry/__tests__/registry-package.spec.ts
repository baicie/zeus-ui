import type { RegistryManifest } from '../src'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import {
  findRegistryItem,
  getRegistryDependencies,
  getRegistryFilesForFramework,
  getRegistryItemNames,
  validateRegistry,
} from '../src'

interface RegistryPackageJson {
  name: string
  exports: Record<string, unknown>
}

const testDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(testDir, '..')

const publicRegistryItemNames = ['cn', 'globals', 'button', 'input']

const publicRegistryExports = [
  '.',
  './schema',
  './registry.json',
  './templates/react/button.tsx',
  './templates/react/input.tsx',
  './templates/vue/button.vue',
  './templates/vue/input.vue',
  './templates/css/globals.css',
  './templates/lib/cn.ts',
]

function read(relativePath: string): string {
  return readFileSync(resolve(packageRoot, relativePath), 'utf-8')
}

function readManifest(): RegistryManifest {
  return JSON.parse(read('registry.json')) as RegistryManifest
}

describe('@zeus-web/registry package contract', () => {
  it('exports exactly the beta.0 registry surface', () => {
    const packageJson = JSON.parse(read('package.json')) as RegistryPackageJson

    expect(packageJson.name).toBe('@zeus-web/registry')
    expect(Object.keys(packageJson.exports)).toEqual(publicRegistryExports)
  })

  it('contains exactly the beta.0 registry items', () => {
    const manifest = readManifest()

    expect(manifest.schemaVersion).toBe(1)
    expect(getRegistryItemNames(manifest)).toEqual(publicRegistryItemNames)
  })

  it('resolves item dependencies', () => {
    const manifest = readManifest()
    const button = findRegistryItem(manifest, 'button')
    const input = findRegistryItem(manifest, 'input')

    expect(button).toBeTruthy()
    expect(input).toBeTruthy()

    if (!button || !input) {
      throw new Error('button and input registry items are required')
    }

    expect(button.dependencies).toEqual(['@zeus-web/button'])
    expect(input.dependencies).toEqual(['@zeus-web/input'])

    expect(
      getRegistryDependencies(manifest, button).map(item => item.name),
    ).toEqual(['cn', 'globals'])

    expect(
      getRegistryDependencies(manifest, input).map(item => item.name),
    ).toEqual(['cn', 'globals'])
  })

  it('resolves files by framework', () => {
    const manifest = readManifest()
    const button = findRegistryItem(manifest, 'button')

    expect(button).toBeTruthy()

    if (!button) {
      throw new Error('button registry item is required')
    }

    expect(getRegistryFilesForFramework(button, 'react')).toEqual([
      {
        framework: 'react',
        source: 'templates/react/button.tsx',
        target: 'components/ui/button.tsx',
      },
    ])

    expect(getRegistryFilesForFramework(button, 'vue')).toEqual([
      {
        framework: 'vue',
        source: 'templates/vue/button.vue',
        target: 'components/ui/button.vue',
      },
    ])
  })

  it('ships every source template referenced by registry.json', () => {
    const manifest = readManifest()

    for (const item of manifest.items) {
      for (const file of item.files) {
        expect(
          existsSync(resolve(packageRoot, file.source)),
          `${item.name} missing template ${file.source}`,
        ).toBe(true)
      }
    }
  })

  it('rejects registry sources that escape the templates directory', () => {
    const unsafeSources = [
      'templates/../../../package.json',
      'templates/..\\..\\package.json',
    ]

    for (const unsafeSource of unsafeSources) {
      const manifest = readManifest()
      const item = manifest.items[0]
      const file = item && item.files[0]

      if (!file) {
        throw new Error('registry manifest must contain a source file')
      }

      file.source = unsafeSource

      expect(validateRegistry(manifest)).toMatchObject({
        valid: false,
        errors: expect.arrayContaining([
          expect.stringContaining('unsafe file source'),
        ]),
      })
    }
  })

  it('rejects registry targets that escape the project directory', () => {
    const unsafeTargets = [
      '../../../package.json',
      '..\\..\\package.json',
      '/tmp/package.json',
      '\\tmp\\package.json',
      'C:/tmp/package.json',
      'C:\\tmp\\package.json',
      'C:package.json',
      'C:..\\package.json',
      'components/ui/C:outside.ts',
      'lib/C:..\\outside.ts',
      'components/ui//outside.ts',
      'components/ui/\\outside.ts',
      'styles/\\outside.css',
    ]

    for (const unsafeTarget of unsafeTargets) {
      const manifest = readManifest()
      const item = manifest.items[0]
      const file = item && item.files[0]

      if (!file) {
        throw new Error('registry manifest must contain a target file')
      }

      file.target = unsafeTarget

      expect(validateRegistry(manifest)).toMatchObject({
        valid: false,
        errors: expect.arrayContaining([
          expect.stringContaining('unsafe file target'),
        ]),
      })
    }
  })

  it('uses primitives and local utility imports in public templates', () => {
    expect(read('templates/react/button.tsx')).toContain(
      "import { Button as ButtonPrimitive } from '@zeus-web/button/react'",
    )
    expect(read('templates/react/input.tsx')).toContain(
      "import { Input as InputPrimitive } from '@zeus-web/input/react'",
    )
    expect(read('templates/vue/button.vue')).toContain(
      "import { Button as ButtonPrimitive } from '@zeus-web/button/vue'",
    )
    expect(read('templates/vue/input.vue')).toContain(
      "import { Input as InputPrimitive } from '@zeus-web/input/vue'",
    )

    expect(read('templates/react/button.tsx')).toContain(
      "import { cn } from '@/lib/cn'",
    )
    expect(read('templates/vue/button.vue')).toContain(
      "import { cn } from '@/lib/cn'",
    )
  })
})
