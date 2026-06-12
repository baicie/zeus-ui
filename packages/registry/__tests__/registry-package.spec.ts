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
} from '../src'

const testDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(testDir, '..')

function read(relativePath: string): string {
  return readFileSync(resolve(packageRoot, relativePath), 'utf-8')
}

function readManifest(): RegistryManifest {
  return JSON.parse(read('registry.json')) as RegistryManifest
}

describe('@zeus-web/registry package contract', () => {
  it('declares package exports', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      name: string
      exports: Record<string, unknown>
    }

    expect(packageJson.name).toBe('@zeus-web/registry')
    expect(packageJson.exports).toHaveProperty('.')
    expect(packageJson.exports).toHaveProperty('./schema')
    expect(packageJson.exports).toHaveProperty('./registry.json')
    expect(packageJson.exports).toHaveProperty('./templates/react/button.tsx')
    expect(packageJson.exports).toHaveProperty('./templates/react/input.tsx')
    expect(packageJson.exports).toHaveProperty('./templates/vue/button.vue')
    expect(packageJson.exports).toHaveProperty('./templates/vue/input.vue')
    expect(packageJson.exports).toHaveProperty('./templates/css/globals.css')
    expect(packageJson.exports).toHaveProperty('./templates/lib/cn.ts')
  })

  it('contains required registry items', () => {
    const manifest = readManifest()
    const names = getRegistryItemNames(manifest)

    expect(manifest.schemaVersion).toBe(1)
    expect(names).toEqual(['cn', 'globals', 'button', 'input'])
  })

  it('resolves item dependencies', () => {
    const manifest = readManifest()
    const button = findRegistryItem(manifest, 'button')
    const input = findRegistryItem(manifest, 'input')

    expect(button).toBeTruthy()
    expect(input).toBeTruthy()

    expect(button?.dependencies).toEqual([
      '@zeus-web/button',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ])
    expect(input?.dependencies).toEqual([
      '@zeus-web/input',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ])

    expect(
      getRegistryDependencies(manifest, button!).map(item => item.name),
    ).toEqual(['cn', 'globals'])

    expect(
      getRegistryDependencies(manifest, input!).map(item => item.name),
    ).toEqual(['cn', 'globals'])
  })

  it('resolves files by framework', () => {
    const manifest = readManifest()
    const button = findRegistryItem(manifest, 'button')!

    expect(getRegistryFilesForFramework(button, 'react')).toEqual([
      {
        framework: 'react',
        source: 'templates/react/button.tsx',
        target: 'components/ui/button.tsx',
        path: 'templates/react/button.tsx',
        type: 'registry:ui',
      },
    ])

    expect(getRegistryFilesForFramework(button, 'vue')).toEqual([
      {
        framework: 'vue',
        source: 'templates/vue/button.vue',
        target: 'components/ui/button.vue',
        path: 'templates/vue/button.vue',
        type: 'registry:ui',
      },
    ])
  })

  it('ships every source template referenced by registry.json', () => {
    const manifest = readManifest()

    for (const item of manifest.items) {
      for (const file of item.files) {
        const sourcePath = file.source ?? file.path
        expect(
          existsSync(resolve(packageRoot, sourcePath!)),
          `${item.name} missing template ${sourcePath}`,
        ).toBe(true)
      }
    }
  })

  it('templates use primitives and local utility imports', () => {
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
