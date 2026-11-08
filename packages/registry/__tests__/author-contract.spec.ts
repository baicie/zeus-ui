import type {
  AuthorComponentManifest,
  AuthorComponentManifestEntry,
  AuthorComponentPackageInput,
  AuthorCustomElementsManifest,
  AuthorPackageJson,
} from '../src/author'
import type { RegistryManifest } from '../src/schema'

import { describe, expect, it } from 'vitest'

import {
  authorContractVersion,
  pluginApiVersion,
  validateComponentPackage,
  validateOutputPluginMetadata,
} from '../src/author'
import { validateRegistry } from '../src/schema'

type AuthorPackageJsonInput = Omit<Partial<AuthorPackageJson>, 'exports'> & {
  exports?: Record<string, string | { types?: string; import?: string }>
}

function createPackageJson(
  overrides: AuthorPackageJsonInput = {},
): AuthorPackageJson {
  return {
    name: '@acme/fancy-element',
    version: '0.1.0',
    type: 'module',
    files: ['dist'],
    exports: {
      '.': {
        types: './dist/wc/index.d.ts',
        import: './dist/wc/index.js',
      },
      './wc/auto': './dist/wc/auto.js',
      './custom-elements.json': './dist/custom-elements.json',
      './zeus.components.json': './dist/zeus.components.json',
      './react': {
        types: './dist/react/index.d.ts',
        import: './dist/react/index.js',
      },
      './vue': {
        types: './dist/vue/index.d.ts',
        import: './dist/vue/index.js',
      },
    },
    peerDependencies: { '@zeus-js/zeus': '0.1.1-beta.20' },
    dependencies: {
      '@zeus-js/output-react-wrapper': '0.1.1-beta.20',
      '@zeus-js/output-vue-wrapper': '0.1.1-beta.20',
      '@zeus-js/runtime-dom': '0.1.1-beta.20',
      '@zeus-js/web-c-runtime': '0.1.1-beta.20',
    },
    zeus: {
      kind: 'component-package',
      contractVersion: authorContractVersion,
      zeusVersion: '0.1.1-beta.20',
      plugins: [],
    },
    ...overrides,
  }
}

function createManifest(
  overrides: Partial<AuthorComponentManifestEntry> = {},
): AuthorComponentManifest {
  return {
    schemaVersion: 1,
    components: [
      {
        tag: 'x-fancy',
        name: 'Fancy',
        exportName: 'Fancy',
        source: 'src/index.tsx',
        props: {
          label: { type: 'string' },
          pressed: { type: 'boolean', reflect: true, attr: 'aria-pressed' },
        },
        events: {
          'fancy-change': {
            key: 'fancy-change',
            name: 'fancy-change',
            reactName: 'onFancyChange',
            bubbles: true,
            composed: true,
            cancelable: false,
            detail: { value: 'string' },
          },
        },
        methods: {},
        slots: { default: { name: 'default' }, icon: { name: 'icon' } },
        hostAttributes: ['data-slot'],
        cssParts: ['button', 'label'],
        cssVars: {},
        ...overrides,
      },
    ],
  }
}

function createCustomElements(
  overrides: Record<string, unknown> = {},
): AuthorCustomElementsManifest {
  return {
    schemaVersion: '1.0.0',
    modules: [
      {
        kind: 'javascript-module',
        path: 'wc/x-fancy.entry.js',
        declarations: [
          {
            kind: 'class',
            name: 'FancyElement',
            tagName: 'x-fancy',
            customElement: true,
            attributes: [
              { name: 'label', type: { text: 'string' } },
              { name: 'aria-pressed', type: { text: 'boolean' } },
            ],
            members: [],
            events: [{ name: 'fancy-change', type: { text: 'CustomEvent' } }],
            slots: [{ name: '' }, { name: 'icon' }],
            cssParts: [{ name: 'button' }, { name: 'label' }],
            cssProperties: [],
            ...overrides,
          },
        ],
        exports: [],
      },
    ],
  }
}

function createInput(
  overrides: Partial<AuthorComponentPackageInput> = {},
): AuthorComponentPackageInput {
  return {
    packageJson: createPackageJson(),
    manifest: createManifest(),
    customElements: createCustomElements(),
    expectedZeusVersion: '0.1.1-beta.20',
    fileExists: () => true,
    ...overrides,
  }
}

function codes(result: ReturnType<typeof validateComponentPackage>): string[] {
  return result.diagnostics.map(diagnostic => diagnostic.code)
}

function createRegistry(
  overrides: Partial<RegistryManifest> = {},
): RegistryManifest {
  return {
    schemaVersion: 2,
    name: '@acme/registry',
    version: '1.0.0',
    license: 'MIT',
    authors: [{ name: 'Acme UI', url: 'https://acme.example.com' }],
    items: [
      {
        name: 'fancy',
        type: 'component',
        description: 'Acme fancy element',
        frameworks: ['react', 'vue'],
        dependencies: ['@acme/fancy-element'],
        registryDependencies: [],
        files: [
          {
            framework: 'react',
            source: 'templates/react/fancy.tsx',
            target: 'components/ui/fancy.tsx',
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('third-party author contract', () => {
  it('accepts a complete component package', () => {
    expect(validateComponentPackage(createInput())).toEqual({
      valid: true,
      diagnostics: [],
    })
  })

  it('reports every missing publish entry with a path', () => {
    const packageJson = createPackageJson({
      exports: {
        '.': { types: './dist/wc/index.d.ts', import: './dist/wc/index.js' },
      },
    })

    const result = validateComponentPackage(
      createInput({
        packageJson,
        fileExists: file => file === 'dist/wc/index.js',
      }),
    )

    expect(result.valid).toBe(false)
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'ZEUS_AUTHOR_PACKAGE_EXPORTS',
        'ZEUS_AUTHOR_WRAPPER_MISSING',
      ]),
    )
    expect(
      result.diagnostics.some(
        diagnostic => diagnostic.path === 'exports["./wc/auto"]',
      ),
    ).toBe(true)
  })

  it('rejects packages that do not pin the Zeus peer version', () => {
    const packageJson = createPackageJson({
      peerDependencies: { '@zeus-js/zeus': '^0.1.0' },
    })

    const result = validateComponentPackage(createInput({ packageJson }))

    expect(codes(result)).toContain('ZEUS_AUTHOR_PACKAGE_PEER')
    expect(
      result.diagnostics.find(
        diagnostic => diagnostic.code === 'ZEUS_AUTHOR_PACKAGE_PEER',
      )?.path,
    ).toBe('peerDependencies["@zeus-js/zeus"]')
  })

  it('detects a consumer Zeus version that does not satisfy the peer pin', () => {
    const result = validateComponentPackage(
      createInput({ expectedZeusVersion: '0.1.1-beta.19' }),
    )

    const diagnostic = result.diagnostics.find(
      entry => entry.code === 'ZEUS_AUTHOR_PACKAGE_VERSION_MISMATCH',
    )
    expect(diagnostic?.message).toContain('0.1.1-beta.19')
    expect(diagnostic?.message).toContain('0.1.1-beta.20')
  })

  it('rejects tags reserved for Zeus Web packages', () => {
    const result = validateComponentPackage(
      createInput({ manifest: createManifest({ tag: 'zw-fancy' }) }),
    )

    expect(codes(result)).toContain('ZEUS_AUTHOR_MANIFEST_TAG')
    expect(
      result.diagnostics.find(
        entry => entry.code === 'ZEUS_AUTHOR_MANIFEST_TAG',
      )?.message,
    ).toContain('zw-')
  })

  it('rejects duplicate tags and duplicate manifest entries', () => {
    const manifest = createManifest()
    manifest.components.push({ ...manifest.components[0], name: 'FancyTwo' })

    const result = validateComponentPackage(
      createInput({
        manifest,
        customElements: createCustomElements(),
      }),
    )

    expect(codes(result)).toContain('ZEUS_AUTHOR_MANIFEST_TAG')
    expect(
      result.diagnostics.some(
        diagnostic => diagnostic.path === 'components[1].tag',
      ),
    ).toBe(true)
  })

  it('fails when the custom elements manifest drifts from the component manifest', () => {
    const customElements = createCustomElements({
      events: [],
      cssParts: [{ name: 'button' }],
    })

    const result = validateComponentPackage(createInput({ customElements }))

    expect(codes(result)).toContain('ZEUS_AUTHOR_CEM_DRIFT')
    expect(
      result.diagnostics.filter(
        diagnostic => diagnostic.code === 'ZEUS_AUTHOR_CEM_DRIFT',
      ),
    ).toHaveLength(2)
  })

  it('rejects unsupported manifest and CEM schema versions', () => {
    const manifest = createManifest() as unknown as AuthorComponentManifest
    ;(manifest as { schemaVersion: number }).schemaVersion = 2

    const result = validateComponentPackage(
      createInput({
        manifest,
        customElements: {
          schemaVersion: '2.0.0',
          modules: [],
        },
      }),
    )

    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'ZEUS_AUTHOR_MANIFEST_SCHEMA',
        'ZEUS_AUTHOR_CEM_SCHEMA',
      ]),
    )
  })

  it('requires wrapper runtime dependencies when wrapper exports exist', () => {
    const packageJson = createPackageJson({
      dependencies: {
        '@zeus-js/runtime-dom': '0.1.1-beta.20',
        '@zeus-js/web-c-runtime': '0.1.1-beta.20',
      },
    })

    const result = validateComponentPackage(createInput({ packageJson }))

    expect(
      result.diagnostics.filter(
        diagnostic => diagnostic.code === 'ZEUS_AUTHOR_WRAPPER_MISSING',
      ),
    ).toHaveLength(2)
  })

  it('reports a missing entry file through the resolver', () => {
    const result = validateComponentPackage(
      createInput({
        fileExists: file => file !== 'dist/wc/auto.js',
      }),
    )

    expect(codes(result)).toContain('ZEUS_AUTHOR_FILE_MISSING')
    expect(
      result.diagnostics.find(
        diagnostic => diagnostic.code === 'ZEUS_AUTHOR_FILE_MISSING',
      )?.path,
    ).toBe('exports["./wc/auto"]')
  })

  it('requires a dist-only publish allowlist', () => {
    const missing = validateComponentPackage(
      createInput({ packageJson: createPackageJson({ files: undefined }) }),
    )

    expect(codes(missing)).toContain('ZEUS_AUTHOR_PACKAGE_FILES')

    const leaking = validateComponentPackage(
      createInput({
        packageJson: createPackageJson({ files: ['dist', 'src'] }),
      }),
    )

    expect(
      leaking.diagnostics.find(
        diagnostic => diagnostic.code === 'ZEUS_AUTHOR_PACKAGE_FILES',
      )?.message,
    ).toContain('"src"')
  })

  it('accepts compatible plugin metadata', () => {
    const result = validateOutputPluginMetadata({
      zeus: {
        kind: 'output-plugin',
        contractVersion: authorContractVersion,
        zeusVersion: '0.1.1-beta.20',
        plugins: [
          {
            id: '@acme/zeus-output-json',
            version: '0.1.0',
            apiVersion: pluginApiVersion,
            capabilities: ['manifest:read'],
            outputs: ['assets'],
            order: 100,
          },
        ],
      },
    })

    expect(result).toEqual({ valid: true, diagnostics: [] })
  })

  it('rejects unsupported plugin API versions and duplicate outputs', () => {
    const result = validateOutputPluginMetadata({
      zeus: {
        kind: 'output-plugin',
        contractVersion: authorContractVersion,
        zeusVersion: '0.1.1-beta.20',
        plugins: [
          {
            id: '@acme/zeus-output-json',
            version: '0.1.0',
            apiVersion: pluginApiVersion + 1,
            capabilities: ['manifest:read'],
            outputs: ['assets'],
            order: 100,
          },
          {
            id: '@acme/zeus-output-css',
            version: '0.1.0',
            apiVersion: pluginApiVersion,
            capabilities: ['manifest:read'],
            outputs: ['assets'],
            order: 100,
          },
        ],
      },
    })

    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'ZEUS_AUTHOR_PLUGIN_API_VERSION',
        'ZEUS_AUTHOR_PLUGIN_OUTPUT_CONFLICT',
      ]),
    )
  })

  it('rejects plugin metadata with duplicate ids and missing fields', () => {
    const result = validateOutputPluginMetadata({
      zeus: {
        kind: 'output-plugin',
        contractVersion: authorContractVersion,
        zeusVersion: '0.1.1-beta.20',
        plugins: [
          {
            id: '@acme/zeus-output-json',
            version: '0.1.0',
            apiVersion: pluginApiVersion,
            capabilities: ['manifest:read'],
            outputs: ['assets'],
            order: 100,
          },
          {
            id: '@acme/zeus-output-json',
            version: '0.1.0',
            apiVersion: pluginApiVersion,
            capabilities: ['manifest:read'],
            outputs: ['report'],
            order: 200,
          },
          { id: '', version: '', capabilities: [], outputs: ['x'] } as never,
        ],
      },
    })

    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'ZEUS_AUTHOR_PLUGIN_ID',
        'ZEUS_AUTHOR_PLUGIN_META',
      ]),
    )
  })
})

describe('registry manifest schema version 2', () => {
  it('accepts a complete third-party registry manifest', () => {
    expect(validateRegistry(createRegistry())).toEqual({
      valid: true,
      errors: [],
      diagnostics: [],
    })
  })

  it('rejects schemaVersion 1 without a silent migration path', () => {
    const registry = createRegistry() as unknown as Record<string, unknown>
    registry.schemaVersion = 1

    const result = validateRegistry(registry as never)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('schemaVersion must be 2')
    expect(result.errors.join('\n')).toContain('1 is not supported')
  })

  it('requires authors, a license and an SPDX-shaped license id', () => {
    const result = validateRegistry(
      createRegistry({
        authors: [],
        license: 'not a license',
      }),
    )

    const errors = result.errors.join('\n')
    expect(errors).toContain(
      'registry.license must be an SPDX license identifier',
    )
    expect(errors).toContain(
      'registry.authors must contain at least one author',
    )
  })

  it('validates author entries', () => {
    const result = validateRegistry(
      createRegistry({
        authors: [
          { name: 'Acme', url: 'ftp://acme.example.com' },
          { name: '' },
        ],
      }),
    )

    const errors = result.errors.join('\n')
    expect(errors).toContain('authors[0].url')
    expect(errors).toContain('must be an http(s) URL')
    expect(errors).toContain('authors[1].name')
  })

  it('reports item diagnostics with their index', () => {
    const registry = createRegistry()
    registry.items.push({
      name: 'fancy',
      type: 'component',
      description: '',
      frameworks: [],
      dependencies: [],
      registryDependencies: ['missing'],
      files: [],
    })

    const result = validateRegistry(registry)

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'items[1].description',
        }),
        expect.objectContaining({
          path: 'items[1].registryDependencies[0]',
        }),
      ]),
    )
  })
})
