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
    expect(packageJson.exports).toHaveProperty('./templates/react/chat.tsx')
    expect(packageJson.exports).toHaveProperty(
      './templates/react/data-grid.tsx',
    )
    expect(packageJson.exports).toHaveProperty('./templates/vue/button.vue')
    expect(packageJson.exports).toHaveProperty('./templates/vue/input.vue')
    expect(packageJson.exports).toHaveProperty('./templates/vue/chat.vue')
    expect(packageJson.exports).toHaveProperty('./templates/vue/data-grid.vue')
    expect(packageJson.exports).toHaveProperty('./templates/native/chat.ts')
    expect(packageJson.exports).toHaveProperty(
      './templates/native/data-grid.ts',
    )
    expect(packageJson.exports).toHaveProperty('./templates/css/globals.css')
    expect(packageJson.exports).toHaveProperty('./templates/lib/cn.ts')
  })

  it('contains required registry items', () => {
    const manifest = readManifest()
    const names = getRegistryItemNames(manifest)

    expect(manifest.schemaVersion).toBe(1)
    expect(names).toEqual([
      'cn',
      'globals',
      'button',
      'input',
      'chat',
      'data-grid',
    ])
  })

  it('resolves item dependencies', () => {
    const manifest = readManifest()
    const button = findRegistryItem(manifest, 'button')
    const input = findRegistryItem(manifest, 'input')

    expect(button).toBeTruthy()
    expect(input).toBeTruthy()

    expect(button?.dependencies).toEqual(['@zeus-web/button'])
    expect(input?.dependencies).toEqual(['@zeus-web/input'])

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

  it('registers chat across native/react/vue with safe templates', () => {
    const manifest = readManifest()
    const chat = findRegistryItem(manifest, 'chat')

    expect(chat).toBeTruthy()
    expect(chat?.dependencies).toEqual(['@zeus-web/chat'])
    expect(chat?.frameworks).toEqual(
      expect.arrayContaining(['native', 'react', 'vue']),
    )
    expect(getRegistryItemNames(manifest)).toContain('chat')

    expect(chat?.files).toEqual(
      expect.arrayContaining([
        {
          framework: 'native',
          source: 'templates/native/chat.ts',
          target: 'components/chat.ts',
        },
        {
          framework: 'react',
          source: 'templates/react/chat.tsx',
          target: 'components/ui/chat.tsx',
        },
        {
          framework: 'vue',
          source: 'templates/vue/chat.vue',
          target: 'components/ui/chat.vue',
        },
      ]),
    )

    const nativeSource = read('templates/native/chat.ts')
    const reactSource = read('templates/react/chat.tsx')
    const vueSource = read('templates/vue/chat.vue')

    expect(nativeSource).toContain("import '@zeus-web/chat/wc/auto'")
    expect(nativeSource).toContain("from '@zeus-web/chat'")
    expect(nativeSource).toContain('mountChatDemo')
    expect(nativeSource).toContain('zw-chat')
    expect(nativeSource).toContain('zw-chat-thread')
    expect(nativeSource).toContain('zw-chat-message')
    expect(nativeSource).toContain('zw-chat-composer')
    expect(nativeSource).toContain('scrollToBottom')
    expect(nativeSource).not.toContain('String.raw')
    expect(nativeSource).not.toContain('chatNativeSource')

    expect(reactSource).toContain('@zeus-web/chat/react')
    expect(reactSource).toContain("import { cn } from '@/lib/cn'")
    expect(reactSource).toContain('ChatPrimitive')

    expect(vueSource).toContain('@zeus-web/chat/vue')
    expect(vueSource).toContain("import { cn } from '@/lib/cn'")
    expect(vueSource).toContain('ChatPrimitive')

    for (const source of [nativeSource, reactSource, vueSource]) {
      expect(source).not.toContain('fetch(')
      expect(source).not.toContain('Authorization')
      expect(source).not.toContain('Bearer')
      expect(source).not.toContain('apiKey')
      expect(source).not.toContain('OPENAI_API_KEY')
      expect(source).not.toContain('ANTHROPIC_API_KEY')
      expect(source).not.toContain('DEEPSEEK_API_KEY')
    }
  })

  it('registers data-grid across native/react/vue with safe templates', () => {
    const manifest = readManifest()
    const dataGrid = findRegistryItem(manifest, 'data-grid')

    expect(dataGrid).toBeTruthy()
    expect(dataGrid?.dependencies).toEqual(['@zeus-web/data-grid'])
    expect(dataGrid?.frameworks).toEqual(
      expect.arrayContaining(['native', 'react', 'vue']),
    )
    expect(getRegistryItemNames(manifest)).toContain('data-grid')

    expect(dataGrid?.files).toEqual(
      expect.arrayContaining([
        {
          framework: 'native',
          source: 'templates/native/data-grid.ts',
          target: 'components/data-grid.ts',
        },
        {
          framework: 'react',
          source: 'templates/react/data-grid.tsx',
          target: 'components/ui/data-grid.tsx',
        },
        {
          framework: 'vue',
          source: 'templates/vue/data-grid.vue',
          target: 'components/ui/data-grid.vue',
        },
      ]),
    )

    const nativeSource = read('templates/native/data-grid.ts')
    const reactSource = read('templates/react/data-grid.tsx')
    const vueSource = read('templates/vue/data-grid.vue')

    expect(nativeSource).toContain("import '@zeus-web/data-grid/wc/auto'")
    expect(nativeSource).toContain("from '@zeus-web/data-grid'")
    expect(nativeSource).toContain('mountDataGridDemo')
    expect(nativeSource).toContain('zw-data-grid')
    expect(nativeSource).toContain('dataGridDemoColumns')
    expect(nativeSource).toContain('dataGridDemoRows')
    expect(nativeSource).not.toContain('String.raw')
    expect(nativeSource).not.toContain('dataGridNativeSource')

    expect(reactSource).toContain('@zeus-web/data-grid/react')
    expect(reactSource).toContain("import { cn } from '@/lib/cn'")
    expect(reactSource).toContain('DataGridPrimitive')
    expect(reactSource).toContain('DataGridDemo')

    expect(vueSource).toContain('@zeus-web/data-grid/vue')
    expect(vueSource).toContain("import { cn } from '@/lib/cn'")
    expect(vueSource).toContain('DataGridPrimitive')

    for (const source of [nativeSource, reactSource, vueSource]) {
      expect(source).not.toContain('fetch(')
      expect(source).not.toContain('Authorization')
      expect(source).not.toContain('Bearer')
      expect(source).not.toContain('apiKey')
      expect(source).not.toContain('OPENAI_API_KEY')
      expect(source).not.toContain('ANTHROPIC_API_KEY')
      expect(source).not.toContain('DEEPSEEK_API_KEY')
      expect(source).not.toContain('ag-grid')
      expect(source).not.toContain('@ag-grid')
    }
  })
})
