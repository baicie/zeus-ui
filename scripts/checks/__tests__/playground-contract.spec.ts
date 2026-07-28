import type {
  ComponentCatalogItem,
  ComponentCategoryDefinition,
} from '../../../apps/docs/.vitepress/data/component-catalog'
import type { PlaygroundSourceSet } from '../../../apps/docs/.vitepress/data/playground-sources'
import type { PlaygroundContractOptions } from '../docs/playground-contract'

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { playgroundSources } from '../../../apps/docs/.vitepress/data/playground-sources'
import { checkPlaygroundContract } from '../docs/playground-contract'

interface Fixture {
  root: string
  options: PlaygroundContractOptions
}

const fixtureRoots: string[] = []

const generalCategory: ComponentCategoryDefinition = {
  id: 'general',
  label: 'General',
  description: 'General fixture.',
}

const advancedCategory: ComponentCategoryDefinition = {
  id: 'advanced',
  label: 'Advanced',
  description: 'Advanced fixture.',
}

const buttonComponent: ComponentCatalogItem = {
  name: 'button',
  title: 'Button',
  packageName: '@zeus-web/button',
  packageGroup: 'primitives',
  category: 'general',
  route: '/components/button',
  description: 'Button fixture.',
}

const dataGridComponent: ComponentCatalogItem = {
  name: 'data-grid',
  title: 'Data Grid',
  packageName: '@zeus-web/data-grid',
  packageGroup: 'advanced',
  category: 'advanced',
  route: '/components/data-grid',
  description: 'Data Grid fixture.',
}

function writeFixtureFile(
  root: string,
  relativePath: string,
  content: string,
): void {
  const path = join(root, relativePath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  writeFixtureFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`)
}

function createPackageExports(
  frameworks: Array<'react' | 'vue' | 'webComponent'>,
): Record<string, unknown> {
  const exports: Record<string, unknown> = {}

  if (frameworks.includes('webComponent')) {
    exports['./wc/auto'] = {
      import: './dist/wc/auto.js',
    }
  }

  if (frameworks.includes('react')) {
    exports['./react'] = {
      import: './dist/react/index.js',
    }
  }

  if (frameworks.includes('vue')) {
    exports['./vue'] = {
      import: './dist/vue/index.js',
    }
  }

  return exports
}

function writeComponentPackage(
  root: string,
  name: string,
  frameworks: Array<'react' | 'vue' | 'webComponent'> = [
    'webComponent',
    'react',
    'vue',
  ],
): void {
  writeJson(root, `packages/primitives/${name}/package.json`, {
    name: `@zeus-web/${name}`,
    exports: createPackageExports(frameworks),
  })
}

function createButtonSources(): PlaygroundSourceSet {
  return {
    webComponent: {
      label: 'Web Component',
      language: 'html',
      code: "import '@zeus-web/button/wc/auto'",
    },
    react: {
      label: 'React',
      language: 'tsx',
      code: "import { Button } from '@zeus-web/button/react'",
    },
    vue: {
      label: 'Vue',
      language: 'vue',
      code: "import { Button } from '@zeus-web/button/vue'",
    },
  }
}

function createRuntimeSource(includeDemo = true): string {
  const lines = [
    'export const componentLoaders = {',
    "  button: () => import('@zeus-web/button/wc/auto'),",
    '}',
    '',
    'export const demoLoaders = {',
  ]

  if (includeDemo) {
    lines.push("  button: () => import('./playgrounds/demos/button-demo.vue'),")
  }

  lines.push(
    '}',
    '',
    '<p v-if="errorMessage" role="alert">{{ errorMessage }}</p>',
    '<p v-else-if="!ready" role="status" aria-live="polite">Loading</p>',
    '',
  )
  return lines.join('\n')
}

function createValidFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'zeus-ui-playground-contract-'))
  fixtureRoots.push(root)

  writeComponentPackage(root, 'button')
  writeJson(root, 'apps/docs/package.json', {
    devDependencies: {
      '@zeus-web/button': 'workspace:*',
    },
  })

  const generatedContent = '<ComponentPlayground name="button" />\n'
  writeFixtureFile(root, 'apps/docs/components/button.md', generatedContent)

  return {
    root,
    options: {
      catalog: [buttonComponent],
      categories: [generalCategory],
      sources: {
        button: createButtonSources(),
      },
      generatedDocs: [
        {
          path: 'apps/docs/components/button.md',
          content: generatedContent,
        },
      ],
      sidebarItems: [
        {
          items: [
            {
              link: '/components/button',
            },
          ],
        },
      ],
      runtimeSource: createRuntimeSource(),
    },
  }
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, {
      recursive: true,
      force: true,
    })
  }
})

describe('playground contract', () => {
  it('keeps the real workspace component packages and docs aligned', () => {
    const result = checkPlaygroundContract()

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
    expect(result.componentCount).toBe(25)
    expect(result.categoryCount).toBe(7)
    expect(result.packageNames).toHaveLength(result.componentCount)
  })

  it('uses the public Progress label prop in every framework source', () => {
    const sources = [
      {
        source: playgroundSources.progress.webComponent,
        expected:
          '<zw-progress value="64" max="100" label="Upload progress"></zw-progress>',
      },
      {
        source: playgroundSources.progress.react,
        expected: '<Progress value={64} max={100} label="Upload progress" />',
      },
      {
        source: playgroundSources.progress.vue,
        expected: '<Progress :value="64" :max="100" label="Upload progress" />',
      },
    ]

    for (const { source, expected } of sources) {
      expect(source).toBeDefined()
      if (!source) continue

      expect(source.code).toContain(expected)
      expect(source.code).not.toContain('aria-label="Upload progress"')
    }
  })

  it('reports a public component package without a catalog entry', () => {
    const fixture = createValidFixture()
    writeComponentPackage(fixture.root, 'input')

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Missing component catalog entry for @zeus-web/input.',
    )
  })

  it('reports a supported framework without source', () => {
    const fixture = createValidFixture()
    const sources = createButtonSources()

    fixture.options.sources = {
      button: {
        webComponent: sources.webComponent,
        vue: sources.vue,
      },
    }

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      '@zeus-web/button is missing its "react" Playground source.',
    )
  })

  it('reports source for a framework the package does not export', () => {
    const fixture = createValidFixture()
    writeComponentPackage(fixture.root, 'button', ['webComponent', 'react'])

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      '@zeus-web/button Playground framework sources must match package exports exactly: expected [react, webComponent], received [react, vue, webComponent].',
    )
  })

  it('reports duplicate canonical component routes', () => {
    const fixture = createValidFixture()
    const duplicate: ComponentCatalogItem = {
      name: 'button',
      title: 'Duplicate button',
      packageName: '@zeus-web/button',
      packageGroup: 'primitives',
      category: 'general',
      route: '/components/button',
      description: 'Duplicate route fixture.',
    }

    fixture.options.catalog = [buttonComponent, duplicate]

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Duplicate component catalog route "/components/button".',
    )
  })

  it('reports package groups and canonical routes that do not match packages', () => {
    const fixture = createValidFixture()
    const invalidComponent: ComponentCatalogItem = {
      name: 'button',
      title: 'Button',
      packageName: '@zeus-web/button',
      packageGroup: 'advanced',
      category: 'general',
      route: '/components/not-button',
      description: 'Invalid catalog fixture.',
    }

    fixture.options.catalog = [invalidComponent]

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      '@zeus-web/button packageGroup must be "primitives".',
    )
    expect(result.errors).toContain(
      '@zeus-web/button canonical component route must be "/components/button".',
    )
  })

  it('reports empty categories and recursively duplicated sidebar routes', () => {
    const fixture = createValidFixture()

    fixture.options.categories = [generalCategory, advancedCategory]
    fixture.options.sidebarItems = [
      {
        items: [
          {
            link: '/components/button',
          },
          {
            items: [
              {
                link: '/components/button',
              },
            ],
          },
        ],
      },
    ]

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Component category "advanced" must contain at least one component.',
    )
    expect(result.errors).toContain(
      'Component sidebar must contain "/components/button" exactly once; received 2.',
    )
  })

  it('reports unknown categories and missing category definitions', () => {
    const fixture = createValidFixture()
    const unknownCategory = Object.assign({}, generalCategory)

    Reflect.set(unknownCategory, 'id', 'unknown')
    fixture.options.categories = [unknownCategory]

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Unknown component category "unknown".')
    expect(result.errors).toContain(
      '@zeus-web/button category "general" has no category definition.',
    )
  })

  it('rejects legacy standalone Playground markdown', () => {
    const fixture = createValidFixture()

    writeFixtureFile(
      fixture.root,
      'apps/docs/playground/button/index.md',
      '# Legacy Playground\n',
    )

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Legacy Playground markdown must be removed: apps/docs/playground/button/index.md.',
    )
  })

  it('reports incorrect framework imports and missing runtime demos', () => {
    const fixture = createValidFixture()
    const sources = createButtonSources()

    fixture.options.sources = {
      button: {
        webComponent: sources.webComponent,
        react: {
          label: 'React',
          language: 'tsx',
          code: "import { Button } from '@zeus-web/input/react'",
        },
        vue: sources.vue,
      },
    }
    fixture.options.runtimeSource = createRuntimeSource(false)

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      '@zeus-web/button "react" Playground source must reference "@zeus-web/button/react".',
    )
    expect(result.errors).toContain(
      '@zeus-web/button must have an explicit demo loader for "./playgrounds/demos/button-demo.vue".',
    )
  })

  it('requires accessible async Playground status messages', () => {
    const fixture = createValidFixture()

    fixture.options.runtimeSource = createRuntimeSource()
      .replace(' role="alert"', '')
      .replace(' role="status" aria-live="polite"', '')

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Playground runtime errors must use role="alert".',
    )
    expect(result.errors).toContain(
      'Playground runtime loading feedback must use role="status" and aria-live="polite".',
    )
  })

  it('rejects non-registering Web Component side-effect imports', () => {
    const fixture = createValidFixture()
    const sources = createButtonSources()

    sources.webComponent!.code += "\nimport '@zeus-web/button/wc'"
    fixture.options.sources = {
      button: sources,
    }

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      '@zeus-web/button "webComponent" Playground source must not use the non-registering side-effect import "@zeus-web/button/wc"; use "@zeus-web/button/wc/auto".',
    )
  })

  it('rejects non-registering Web Component imports in public docs', () => {
    const fixture = createValidFixture()

    writeFixtureFile(
      fixture.root,
      'apps/docs/guide/web-components.md',
      "```ts\nimport '@zeus-web/button/wc'\n```\n",
    )

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'apps/docs/guide/web-components.md must not use the non-registering side-effect import "@zeus-web/button/wc"; use "@zeus-web/button/wc/auto".',
    )
  })

  it('rejects nested native buttons in Web Component trigger elements', () => {
    const fixture = createValidFixture()
    const sources = createButtonSources()

    sources.webComponent!.code = [
      "import '@zeus-web/button/wc/auto'",
      '<zw-dialog-trigger><button type="button">Open</button></zw-dialog-trigger>',
      '<zw-tooltip-trigger><button type="button">Help</button></zw-tooltip-trigger>',
    ].join('\n')
    fixture.options.sources = {
      button: sources,
    }

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      '@zeus-web/button "webComponent" Playground source must not nest a native button inside <zw-dialog-trigger>.',
    )
    expect(result.errors).toContain(
      '@zeus-web/button "webComponent" Playground source must not nest a native button inside <zw-tooltip-trigger>.',
    )
  })

  it('accepts the dedicated Data Grid loader without a generic demo', () => {
    const root = mkdtempSync(
      join(tmpdir(), 'zeus-ui-playground-contract-grid-'),
    )
    fixtureRoots.push(root)

    writeJson(root, 'packages/advanced/data-grid/package.json', {
      name: '@zeus-web/data-grid',
      exports: createPackageExports(['webComponent', 'react', 'vue']),
    })
    writeJson(root, 'apps/docs/package.json', {
      devDependencies: {
        '@zeus-web/data-grid': 'workspace:*',
      },
    })

    const generatedContent = '<DataGridPlayground />\n'
    writeFixtureFile(
      root,
      'apps/docs/components/data-grid.md',
      generatedContent,
    )

    const result = checkPlaygroundContract(root, {
      catalog: [dataGridComponent],
      categories: [advancedCategory],
      sources: {
        'data-grid': {
          webComponent: {
            label: 'Web Component',
            language: 'js',
            code: "import '@zeus-web/data-grid/wc/auto'",
          },
          react: {
            label: 'React',
            language: 'tsx',
            code: "import { DataGrid } from '@zeus-web/data-grid/react'",
          },
          vue: {
            label: 'Vue',
            language: 'vue',
            code: "import { DataGrid } from '@zeus-web/data-grid/vue'",
          },
        },
      },
      generatedDocs: [
        {
          path: 'apps/docs/components/data-grid.md',
          content: generatedContent,
        },
      ],
      sidebarItems: [
        {
          items: [
            {
              link: '/components/data-grid',
            },
          ],
        },
      ],
      runtimeSource: [
        "onMounted(() => import('@zeus-web/data-grid/wc/auto'))",
        '<p role="alert">Error</p>',
        '<p role="status" aria-live="polite">Loading</p>',
      ].join('\n'),
    })

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })
})
