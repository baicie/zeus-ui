import type { PlaygroundComponent } from '../../../apps/docs/.vitepress/data/playground-manifest'
import type { PlaygroundSourceSet } from '../../../apps/docs/.vitepress/data/playground-sources'
import type { PlaygroundContractOptions } from '../docs/playground-contract'

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { checkPlaygroundContract } from '../docs/playground-contract'

interface Fixture {
  root: string
  options: PlaygroundContractOptions
}

const fixtureRoots: string[] = []

const buttonComponent: PlaygroundComponent = {
  name: 'button',
  title: 'Button',
  packageName: '@zeus-web/button',
  group: 'primitives',
  route: '/playground/button/',
  description: 'Button fixture.',
}

const dataGridComponent: PlaygroundComponent = {
  name: 'data-grid',
  title: 'Data Grid',
  packageName: '@zeus-web/data-grid',
  group: 'advanced',
  route: '/playground/data-grid/',
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

  lines.push('}', '')
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
  writeFixtureFile(
    root,
    'apps/docs/playground/button/index.md',
    generatedContent,
  )

  return {
    root,
    options: {
      components: [buttonComponent],
      sources: {
        button: createButtonSources(),
      },
      generatedDocs: [
        {
          path: 'apps/docs/playground/button/index.md',
          content: generatedContent,
        },
      ],
      sidebarItems: [
        {
          link: '/playground/',
        },
        {
          link: '/playground/button/',
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
  it('keeps the real workspace component packages and Playgrounds aligned', () => {
    const result = checkPlaygroundContract()

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
    expect(result.componentCount).toBeGreaterThan(0)
    expect(result.packageNames).toHaveLength(result.componentCount)
  })

  it('reports a public component package without a Playground definition', () => {
    const fixture = createValidFixture()
    writeComponentPackage(fixture.root, 'input')

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Missing Playground definition for @zeus-web/input.',
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

  it('reports duplicate Playground routes', () => {
    const fixture = createValidFixture()
    const duplicate: PlaygroundComponent = {
      name: 'button',
      title: 'Duplicate button',
      packageName: '@zeus-web/button',
      group: 'primitives',
      route: '/playground/button/',
      description: 'Duplicate route fixture.',
    }

    fixture.options.components = [buttonComponent, duplicate]

    const result = checkPlaygroundContract(fixture.root, fixture.options)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Duplicate Playground route "/playground/button/".',
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
      'apps/docs/playground/data-grid/index.md',
      generatedContent,
    )

    const result = checkPlaygroundContract(root, {
      components: [dataGridComponent],
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
          path: 'apps/docs/playground/data-grid/index.md',
          content: generatedContent,
        },
      ],
      sidebarItems: [
        {
          link: '/playground/',
        },
        {
          link: '/playground/data-grid/',
        },
      ],
      runtimeSource: "onMounted(() => import('@zeus-web/data-grid/wc/auto'))\n",
    })

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })
})
