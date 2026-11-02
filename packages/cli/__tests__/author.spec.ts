import type { AuthorPackageJson } from '@zeus-web/registry'

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { detectInstalledZeusVersion } from '../src/author'
import { author } from '../src/commands/author'
import { registry } from '../src/commands/registry'

interface PackageFixture {
  root: string
  write: (file: string, content: string) => void
  writeJson: (file: string, value: unknown) => void
}

function createPackageFixture(name = 'third-party-author'): PackageFixture {
  const root = mkdtempSync(join(tmpdir(), `zeus-web-${name}-`))
  return {
    root,
    write(file, content) {
      const target = join(root, file)
      mkdirSync(join(target, '..'), { recursive: true })
      writeFileSync(target, content)
    },
    writeJson(file, value) {
      const target = join(root, file)
      mkdirSync(join(target, '..'), { recursive: true })
      writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
    },
  }
}

function createPackageJson(
  overrides: Partial<AuthorPackageJson> = {},
): AuthorPackageJson {
  return {
    name: '@acme/fancy-element',
    version: '0.1.0',
    type: 'module',
    files: ['dist'],
    exports: {
      '.': { types: './dist/wc/index.d.ts', import: './dist/wc/index.js' },
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
      contractVersion: 1,
      zeusVersion: '0.1.1-beta.20',
      plugins: [],
    },
    ...overrides,
  }
}

function writeOutputs(fixture: PackageFixture): void {
  const components = {
    schemaVersion: 1,
    components: [
      {
        tag: 'x-fancy',
        name: 'Fancy',
        events: {
          'fancy-change': {
            name: 'fancy-change',
            bubbles: true,
            composed: true,
            cancelable: false,
          },
        },
        slots: { default: { name: 'default' } },
        cssParts: ['button'],
        hostAttributes: ['data-slot'],
      },
    ],
  }
  const customElements = {
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
            events: [{ name: 'fancy-change', type: { text: 'CustomEvent' } }],
            slots: [{ name: '' }],
            cssParts: [{ name: 'button' }],
          },
        ],
      },
    ],
  }
  fixture.writeJson('zeus.components.json', components)
  fixture.writeJson('custom-elements.json', customElements)
  fixture.writeJson('dist/zeus.components.json', components)
  fixture.writeJson('dist/custom-elements.json', customElements)
  for (const file of [
    'dist/wc/index.js',
    'dist/wc/index.d.ts',
    'dist/wc/auto.js',
    'dist/react/index.js',
    'dist/react/index.d.ts',
    'dist/vue/index.js',
    'dist/vue/index.d.ts',
  ]) {
    fixture.write(file, 'export {}\n')
  }
}

function parseJsonLog(log: {
  mock: { calls: unknown[][] }
}): Record<string, unknown> {
  const calls = log.mock.calls
  return JSON.parse(String(calls[calls.length - 1]?.[0])) as Record<
    string,
    unknown
  >
}

afterEach(() => {
  process.exitCode = 0
  vi.restoreAllMocks()
})

describe('zweb author check', () => {
  it('accepts a built third-party package and reports the Zeus pin', async () => {
    const fixture = createPackageFixture()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      fixture.writeJson('package.json', createPackageJson())
      writeOutputs(fixture)

      await author([
        'check',
        fixture.root,
        '--json',
        '--zeus-version',
        '0.1.1-beta.20',
      ])

      expect(error).not.toHaveBeenCalled()
      expect(process.exitCode ?? 0).toBe(0)
      const report = parseJsonLog(log)
      expect(report.valid).toBe(true)
      expect(report.packageZeusVersion).toBe('0.1.1-beta.20')
      expect(report.consumerZeusVersion).toBe('0.1.1-beta.20')
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('fails with paths when a wrapper export is missing', async () => {
    const fixture = createPackageFixture()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      fixture.writeJson(
        'package.json',
        createPackageJson({
          exports: {
            '.': {
              types: './dist/wc/index.d.ts',
              import: './dist/wc/index.js',
            },
            './wc/auto': './dist/wc/auto.js',
            './custom-elements.json': './dist/custom-elements.json',
            './zeus.components.json': './dist/zeus.components.json',
          },
        }),
      )
      writeOutputs(fixture)

      await author([
        'check',
        fixture.root,
        '--json',
        '--zeus-version',
        '0.1.1-beta.20',
      ])

      expect(process.exitCode).toBe(1)
      const report = parseJsonLog(log)
      expect(report.valid).toBe(false)
      expect(
        (report.diagnostics as Array<{ code: string; path: string }>).map(
          (diagnostic: { code: string; path: string }) =>
            `${diagnostic.code} ${diagnostic.path}`,
        ),
      ).toContain('ZEUS_AUTHOR_WRAPPER_MISSING exports["./react"]')
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('detects a version conflict against the consumer Zeus install', async () => {
    const fixture = createPackageFixture()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      fixture.writeJson('package.json', createPackageJson())
      writeOutputs(fixture)

      await author([
        'check',
        fixture.root,
        '--json',
        '--zeus-version',
        '0.1.1-beta.21',
      ])

      expect(process.exitCode).toBe(1)
      const report = parseJsonLog(log)
      const diagnostics = report.diagnostics as Array<{
        code: string
        message: string
      }>
      const diagnostic = diagnostics.find(
        entry => entry.code === 'ZEUS_AUTHOR_PACKAGE_VERSION_MISMATCH',
      )
      expect(diagnostic?.message).toContain('0.1.1-beta.21')
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('reports missing build output instead of throwing', async () => {
    const fixture = createPackageFixture()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      fixture.writeJson('package.json', createPackageJson())

      await author(['check', fixture.root, '--json'])

      expect(process.exitCode).toBe(1)
      const report = parseJsonLog(log)
      expect(
        (report.diagnostics as Array<{ code: string; path: string }>).map(
          (entry: { path: string }) => entry.path,
        ),
      ).toEqual(
        expect.arrayContaining([
          'zeus.components.json',
          'custom-elements.json',
        ]),
      )
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('falls back to the contract baseline when Zeus is not installed', () => {
    const fixture = createPackageFixture()
    try {
      expect(detectInstalledZeusVersion(fixture.root)).toEqual({
        version: '0.1.1-beta.20',
        source: 'baseline',
      })
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('reads the installed Zeus version from node_modules', () => {
    const fixture = createPackageFixture()
    try {
      fixture.writeJson('node_modules/@zeus-js/zeus/package.json', {
        name: '@zeus-js/zeus',
        version: '0.1.1-beta.20',
      })
      expect(detectInstalledZeusVersion(fixture.root)).toEqual({
        version: '0.1.1-beta.20',
        source: 'installed',
      })
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })
})

describe('zweb registry validate', () => {
  it('accepts a schemaVersion 2 registry with provenance', async () => {
    const fixture = createPackageFixture('registry-valid')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      fixture.writeJson('registry.json', {
        schemaVersion: 2,
        name: '@acme/registry',
        version: '1.0.0',
        license: 'MIT',
        authors: [{ name: 'Acme UI' }],
        items: [],
      })

      await registry(['validate', '--cwd', fixture.root, '--json'])

      expect(process.exitCode).toBe(0)
      const report = parseJsonLog(log)
      expect(report.valid).toBe(true)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('fails a schemaVersion 1 registry without silent migration', async () => {
    const fixture = createPackageFixture('registry-v1')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      fixture.writeJson('registry.json', {
        schemaVersion: 1,
        name: '@acme/registry',
        version: '1.0.0',
        items: [],
      })

      await registry(['validate', '--cwd', fixture.root])

      expect(process.exitCode).toBe(1)
      expect(error.mock.calls.flat().join('\n')).toContain(
        'schemaVersion must be 2',
      )
      expect(error.mock.calls.flat().join('\n')).toContain('1 is not supported')
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('names the invalid field path on a malformed registry', async () => {
    const fixture = createPackageFixture('registry-invalid')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      fixture.writeJson('registry.json', {
        schemaVersion: 2,
        name: '@acme/registry',
        version: '1.0.0',
        license: 'MIT',
        authors: [{ name: 'Acme' }],
        items: [
          {
            name: 'fancy',
            type: 'component',
            description: 'Fancy',
            frameworks: ['react'],
            dependencies: [],
            registryDependencies: ['missing'],
            files: [
              {
                framework: 'react',
                source: 'templates/react/fancy.tsx',
                target: 'components/ui/fancy.tsx',
              },
            ],
          },
        ],
      })

      await registry(['validate', '--cwd', fixture.root])

      expect(process.exitCode).toBe(1)
      const output = error.mock.calls.flat().join('\n')
      expect(output).toContain('items[0].registryDependencies[0]')
      expect(output).toContain('missing registry dependency: missing')
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('writes diagnostics as JSON for editor integration', async () => {
    const fixture = createPackageFixture('registry-json')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      fixture.writeJson('registry.json', {
        schemaVersion: 2,
        name: 'bad name',
        version: '1.0.0',
        license: '',
        authors: [],
        items: [],
      })

      await registry(['validate', '--cwd', fixture.root, '--json'])

      expect(process.exitCode).toBe(1)
      const report = parseJsonLog(log)
      expect(report.valid).toBe(false)
      expect(
        (report.diagnostics as Array<{ code: string; path: string }>).map(
          (entry: { path: string }) => entry.path,
        ),
      ).toEqual(expect.arrayContaining(['name', 'license', 'authors']))
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('reports a missing manifest file', async () => {
    const fixture = createPackageFixture('registry-missing')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await registry(['validate', '--cwd', fixture.root])
      expect(process.exitCode).toBe(1)
      expect(error.mock.calls.flat().join('\n')).toContain(
        'Registry manifest not found',
      )
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })
})

describe('third-party author fixture integrity', () => {
  it('keeps the fixture files inside their package root', () => {
    const fixture = createPackageFixture()
    try {
      writeOutputs(fixture)
      expect(existsSync(join(fixture.root, 'zeus.components.json'))).toBe(true)
      expect(
        JSON.parse(
          readFileSync(join(fixture.root, 'zeus.components.json'), 'utf-8'),
        ).components,
      ).toHaveLength(1)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })
})
