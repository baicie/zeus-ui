import { readdirSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

import ts from 'typescript'

import { componentCatalog } from '../../../apps/docs/.vitepress/data/component-catalog'
import { playgroundSources } from '../../../apps/docs/.vitepress/data/playground-sources'
import {
  getSupportedPlaygroundFrameworks,
  renderEmbeddedPlayground,
} from '../playground-docs'

const FRAMEWORK_SOURCE_KEYS = {
  './wc/auto': 'webComponent',
  './react': 'react',
  './vue': 'vue',
} as const

interface VirtualSource {
  componentName: string
  source: string
}

function createReactSourceProgram(): {
  diagnostics: string[]
  sourceCount: number
} {
  const virtualSources = new Map<string, VirtualSource>()
  const paths: Record<string, string[]> = {}

  for (const component of componentCatalog) {
    const source = playgroundSources[component.name].react

    if (!source) continue

    const fileName = resolve(
      process.cwd(),
      `__playground_${component.name.replace(/-/g, '_')}.tsx`,
    )

    virtualSources.set(fileName, {
      componentName: component.name,
      source: source.code,
    })
    paths[`${component.packageName}/react`] = [
      `packages/${component.packageGroup}/${component.name}/dist/react/index.d.ts`,
    ]
  }

  const compilerOptions: ts.CompilerOptions = {
    baseUrl: process.cwd(),
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    paths,
    skipLibCheck: false,
    strict: true,
    target: ts.ScriptTarget.ES2016,
  }
  const host = ts.createCompilerHost(compilerOptions)
  const fileExists = host.fileExists.bind(host)
  const readFile = host.readFile.bind(host)

  host.fileExists = fileName => {
    return virtualSources.has(resolve(fileName)) || fileExists(fileName)
  }
  host.readFile = fileName => {
    const virtualSource = virtualSources.get(resolve(fileName))

    return virtualSource ? virtualSource.source : readFile(fileName)
  }
  host.getSourceFile = (fileName, languageVersion) => {
    const source = host.readFile(fileName)

    if (source === undefined) return undefined

    return ts.createSourceFile(fileName, source, languageVersion, true)
  }

  const program = ts.createProgram(
    Array.from(virtualSources.keys()),
    compilerOptions,
    host,
  )
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    // Package declaration diagnostics belong to the upstream DTS contract.
    // This gate isolates diagnostics emitted from the Playground snippets.
    .filter(diagnostic => {
      return (
        diagnostic.file !== undefined &&
        virtualSources.has(resolve(diagnostic.file.fileName))
      )
    })
    .map(diagnostic => {
      const file = diagnostic.file

      if (!file) {
        return `TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n',
        )}`
      }

      const virtualSource = virtualSources.get(resolve(file.fileName))
      const position = file.getLineAndCharacterOfPosition(diagnostic.start || 0)
      const componentName = virtualSource
        ? virtualSource.componentName
        : basename(file.fileName)
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n',
      )

      return `${componentName}:${position.line + 1}:${position.character + 1} TS${diagnostic.code} ${message}`
    })

  return {
    diagnostics,
    sourceCount: virtualSources.size,
  }
}

describe('playground docs generator', () => {
  it('covers every public primitive and advanced component package', () => {
    const packageNames = ['primitives', 'advanced'].flatMap(group => {
      const groupPath = resolve(process.cwd(), 'packages', group)

      return readdirSync(groupPath, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .flatMap(entry => {
          const packagePath = resolve(groupPath, entry.name, 'package.json')
          let packageJson: { name: string; private?: boolean }

          try {
            packageJson = JSON.parse(readFileSync(packagePath, 'utf-8')) as {
              name: string
              private?: boolean
            }
          } catch {
            return []
          }

          return packageJson.private ? [] : [packageJson.name]
        })
    })

    expect(componentCatalog).toHaveLength(25)
    expect(
      componentCatalog.map(component => component.packageName).sort(),
    ).toEqual(packageNames.sort())
  })

  it('keeps framework sources aligned with package exports', () => {
    for (const component of componentCatalog) {
      const supported = getSupportedPlaygroundFrameworks(component)
      const sources = playgroundSources[component.name]

      expect(Object.keys(sources).sort()).toEqual([...supported].sort())

      for (const [exportPath, sourceKey] of Object.entries(
        FRAMEWORK_SOURCE_KEYS,
      )) {
        const packagePath = resolve(
          process.cwd(),
          'packages',
          component.packageGroup,
          component.name,
          'package.json',
        )
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8')) as {
          exports: Record<string, unknown>
        }
        const expected = exportPath in packageJson.exports

        expect(sourceKey in sources).toBe(expected)
      }
    }
  })

  it('has no strict TypeScript diagnostics in any React Playground snippet', () => {
    const result = createReactSourceProgram()
    const reactSourceCount = componentCatalog.filter(component => {
      return Boolean(playgroundSources[component.name].react)
    }).length

    expect(result.sourceCount).toBe(reactSourceCount)
    expect(result.diagnostics).toEqual([])
  }, 15_000)

  it('renders framework code groups inside the canonical component page', () => {
    const button = componentCatalog.find(
      component => component.name === 'button',
    )
    const dataGrid = componentCatalog.find(
      component => component.name === 'data-grid',
    )

    expect(button).toBeDefined()
    expect(dataGrid).toBeDefined()

    const buttonSource = renderEmbeddedPlayground(
      button!,
      playgroundSources.button,
    )
    const dataGridSource = renderEmbeddedPlayground(
      dataGrid!,
      playgroundSources['data-grid'],
    )

    expect(buttonSource).toContain('<ComponentPlayground name="button" />')
    expect(buttonSource).toContain('[Web Component]')
    expect(buttonSource).toContain('[React]')
    expect(buttonSource).toContain('[Vue]')
    expect(buttonSource).toContain('@zeus-web/button/wc/auto')
    expect(buttonSource).toContain('@zeus-web/button/react')
    expect(buttonSource).toContain('@zeus-web/button/vue')

    expect(dataGridSource).toContain('<DataGridPlayground />')
    expect(dataGridSource).toContain('100,000 rows')
    expect(dataGridSource).toContain('1,000 columns')
  })
})
