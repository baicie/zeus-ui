import type {
  ComponentQualityManifest,
  RegistryComponentSchemaManifest,
  RegistryManifest,
} from '../src'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import {
  findRegistryItem,
  getComponentQuality,
  getRegistryComponentSchema,
  getRegistryDependencies,
  getRegistryFilesForFramework,
  getRegistryItemNames,
  validateComponentQualityManifest,
  validateRegistry,
  validateRegistryComponentSchema,
} from '../src'

interface RegistryPackageJson {
  name: string
  version: string
  exports: Record<string, unknown>
}

const testDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(testDir, '..')

const publicRegistryItemNames = ['cn', 'globals', 'button', 'input']

const publicRegistryExports = [
  '.',
  './schema',
  './registry.json',
  './quality',
  './quality.json',
  './components.json',
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

function readQualityManifest(): ComponentQualityManifest {
  return JSON.parse(read('quality.json')) as ComponentQualityManifest
}

function readComponentSchema(): RegistryComponentSchemaManifest {
  return JSON.parse(read('components.json')) as RegistryComponentSchemaManifest
}

describe('@zeus-web/registry package contract', () => {
  it('exports exactly the beta.0 registry surface', () => {
    const packageJson = JSON.parse(read('package.json')) as RegistryPackageJson

    expect(packageJson.name).toBe('@zeus-web/registry')
    expect(Object.keys(packageJson.exports)).toEqual(publicRegistryExports)
  })

  it('contains exactly the beta.0 registry items', () => {
    const manifest = readManifest()
    const packageJson = JSON.parse(read('package.json')) as RegistryPackageJson

    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.version).toBe(packageJson.version)
    expect(getRegistryItemNames(manifest)).toEqual(publicRegistryItemNames)
  })

  it('ships a machine-readable component quality catalog', () => {
    const quality = readQualityManifest()
    const componentNames = readdirSync(resolve(packageRoot, '../primitives'), {
      withFileTypes: true,
    })
      .filter(
        entry =>
          entry.isDirectory() &&
          existsSync(
            resolve(packageRoot, '../primitives', entry.name, 'package.json'),
          ),
      )
      .map(entry => entry.name)

    expect(validateComponentQualityManifest(quality, componentNames)).toEqual({
      valid: true,
      errors: [],
    })
    expect(getComponentQuality(quality, 'button')).toMatchObject({
      level: 'beta',
    })
  })

  it('enforces evidence thresholds for quality levels', () => {
    const quality = readQualityManifest()
    const button = getComponentQuality(quality, 'button')

    if (!button) throw new Error('button quality entry is required')

    button.level = 'stable'

    expect(
      validateComponentQualityManifest(quality, ['button']).errors,
    ).toEqual(
      expect.arrayContaining(['button: stable requires end-to-end evidence']),
    )
  })

  it('uses one component schema for framework contracts and API metadata', () => {
    const manifest = readComponentSchema()

    expect(validateRegistryComponentSchema(manifest)).toEqual({
      valid: true,
      errors: [],
    })
    expect(manifest.components.map(component => component.name)).toEqual([
      'button',
      'input',
    ])
    expect(getRegistryComponentSchema(manifest, 'button')).toMatchObject({
      variants: {
        variant: {
          values: [
            'default',
            'primary',
            'secondary',
            'outline',
            'ghost',
            'danger',
          ],
          default: 'default',
        },
      },
      events: [{ reactName: 'onPress', vueName: 'press' }],
      slots: [{ name: 'prefix' }, { name: 'default' }, { name: 'suffix' }],
    })
    expect(read('components.md')).toContain('| Prop  | `variant`')
  })

  it('keeps generated framework contracts and API tables in sync with the schema', () => {
    execFileSync(
      process.execPath,
      [
        resolve(packageRoot, 'scripts/generate-component-contracts.mjs'),
        '--check',
      ],
      { cwd: packageRoot },
    )
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

  it('accepts package-like names for external registries', () => {
    const manifest = readManifest()
    manifest.name = '@example/registry'

    expect(validateRegistry(manifest)).toEqual({ valid: true, errors: [] })

    manifest.name = '../invalid'
    expect(validateRegistry(manifest)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        'registry.name must be a valid package-like name',
      ]),
    })
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

  it('rejects unsafe package dependencies and option injection', () => {
    for (const dependency of ['--global', 'pkg name', 'pkg\n--registry=evil']) {
      const manifest = readManifest()
      const item = manifest.items[0]
      if (!item) throw new Error('registry manifest must contain an item')
      item.dependencies = [dependency]

      expect(validateRegistry(manifest)).toMatchObject({
        valid: false,
        errors: expect.arrayContaining([
          expect.stringContaining('unsafe dependency'),
        ]),
      })
    }
  })

  it('rejects malformed and prototype-sensitive registry entries', () => {
    const manifest = readManifest()
    const item = manifest.items[0]
    if (!item) throw new Error('registry manifest must contain an item')

    item.name = '__proto__'
    item.registryDependencies = [{ toString: 'bad' }] as unknown as string[]
    item.files[0]!.source = 'templates/../secret'

    expect(() => validateRegistry(manifest)).not.toThrow()
    expect(validateRegistry(manifest)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        expect.stringContaining('safe identifier'),
        expect.stringContaining('unsafe registry dependency'),
        expect.stringContaining('unsafe file source'),
      ]),
    })
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

  it('uses collision-free Agent Console slots in the Vue template', () => {
    const source = read('templates/vue/agent-console.vue')

    expect(source).toContain(':tool-calls="toolCalls"')
    expect(source).toContain(':diagnostics="diagnostics"')
    expect(source).toContain('v-for="toolCall in toolCalls"')
    expect(source).toContain('v-for="diagnostic in diagnostics"')
    expect(source).toContain('<template #artifactsContent>')
    expect(source).toContain('<template #diagnosticsContent>')
    expect(source).not.toContain('<template #artifacts>')
    expect(source).not.toContain('<template #diagnostics>')
  })

  it('styles the select draft as a custom popup control', () => {
    const source = read('default/select.tsx')

    expect(source).toContain('[&_[data-slot=select-native]]:sr-only')
    expect(source).toContain('[&_[data-slot=select-control]]:relative')
    expect(source).toContain('[&_[data-slot=select-content]]:absolute')
    expect(source).toContain('[&_[data-slot=select-content]]:overflow-y-auto')
    expect(source).toContain(
      'data-[side=top]:[&_[data-slot=select-content]]:bottom-',
    )
    expect(source).toContain(
      '[&_[data-slot=select-option][data-state=checked]_[data-slot=select-option-indicator]]:opacity-100',
    )
    expect(source).toContain(
      'data-[invalid]:[&_[data-slot=select-trigger]]:border-destructive',
    )
    expect(source).toContain('data-[disabled]:cursor-not-allowed')

    expect(getRegistryItemNames(readManifest())).not.toContain('select')
  })
})
