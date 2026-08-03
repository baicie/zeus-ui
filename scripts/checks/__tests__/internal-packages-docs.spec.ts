import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { analyzeFile } from '@zeus-js/component-analyzer'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

interface DocumentedPackage {
  directory: string
  documentedInterfaces: string[]
  packageName: string
}

interface RootEntryApi {
  exportedNames: string[]
  functionSignatures: string[]
  interfaceDeclarations: string[]
}

const TYPE_FORMAT_FLAGS =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
  ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType

const workspaceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
)
const packagesDocument = readFileSync(
  resolve(workspaceRoot, 'docs/internal/packages.md'),
  'utf-8',
)

const documentedPackages: DocumentedPackage[] = [
  {
    directory: 'packages/advanced/chat',
    documentedInterfaces: [
      'ChatStoreSnapshot',
      'ChatStore',
      'ComposerStateSnapshot',
      'ComposerState',
      'StreamBufferOptions',
      'StreamBuffer',
    ],
    packageName: '@zeus-web/chat',
  },
  {
    directory: 'packages/advanced/agent-console',
    documentedInterfaces: [
      'AgentConsoleState',
      'AgentProviderRequest',
      'AgentProviderEvent',
      'AgentProviderRun',
      'AgentProviderAdapter',
      'CreateMockAgentProviderOptions',
    ],
    packageName: '@zeus-web/agent-console',
  },
]

function extractPackageSection(packageName: string): string {
  const heading = `## \`${packageName}\``
  const start = packagesDocument.indexOf(heading)

  if (start === -1) return ''

  const remaining = packagesDocument.slice(start + heading.length)
  const nextSection = remaining.indexOf('\n## ')

  return nextSection === -1 ? remaining : remaining.slice(0, nextSection)
}

function formatNames(names: string[]): string {
  if (names.length === 0) return '-'

  return names
    .slice()
    .sort()
    .map(name => `\`${name}\``)
    .join(', ')
}

function normalizeMarkdownTables(source: string): string {
  return source
    .split('\n')
    .map(line => {
      if (!line.startsWith('|')) return line

      const cells = line
        .slice(1, -1)
        .split('|')
        .map(cell => cell.trim())

      return `| ${cells.join(' | ')} |`
    })
    .join('\n')
}

function normalizeTypeScriptDeclaration(source: string): string {
  return source
    .replace(/,\s*\)/g, ')')
    .replace(/\s+/g, ' ')
    .replace(/\s*([(){}:,?])\s*/g, '$1')
    .trim()
}

function getComponentContractRows(directory: string): string[] {
  const componentDirectory = resolve(workspaceRoot, directory, 'src/components')
  const files = readdirSync(componentDirectory)
    .filter(file => file.endsWith('.tsx'))
    .sort()
  const rows: string[] = []

  for (const file of files) {
    const path = resolve(componentDirectory, file)
    const result = analyzeFile({
      file: path,
      code: readFileSync(path, 'utf-8'),
    })

    expect(result.diagnostics, `${file} analyzer diagnostics`).toEqual([])

    for (const component of result.components) {
      const eventNames: string[] = []

      for (const name of Object.keys(component.events)) {
        const eventName = component.events[name].name

        if (eventName) eventNames.push(eventName)
      }

      const methodNames = component.methods
        ? Object.keys(component.methods)
        : []

      rows.push(
        `| \`${component.tag}\` | ${formatNames(Object.keys(component.props))} | ${formatNames(Object.keys(component.slots))} | ${formatNames(eventNames)} | ${formatNames(methodNames)} |`,
      )
    }
  }

  return rows
}

function getRootEntryApi(
  directory: string,
  documentedInterfaces: string[],
): RootEntryApi {
  const entry = resolve(workspaceRoot, directory, 'src/index.ts')
  const program = ts.createProgram([entry], {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
  })
  const source = program.getSourceFile(entry)

  if (!source) throw new Error(`Unable to read root entry: ${entry}`)

  const checker = program.getTypeChecker()
  const symbol = checker.getSymbolAtLocation(source)

  if (!symbol) throw new Error(`Unable to resolve root entry: ${entry}`)

  const exports = checker.getExportsOfModule(symbol)
  const exportedNames = exports.map(exported => exported.getName()).sort()
  const functionSignatures: string[] = []
  const interfaceDeclarations: string[] = []

  for (const exported of exports) {
    const resolved =
      exported.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(exported)
        : exported
    const declaration =
      resolved.valueDeclaration ||
      (resolved.declarations ? resolved.declarations[0] : undefined) ||
      source

    if (resolved.flags & ts.SymbolFlags.Function) {
      const signature = checker
        .getTypeOfSymbolAtLocation(resolved, declaration)
        .getCallSignatures()[0]

      if (signature) {
        functionSignatures.push(
          `function ${exported.getName()}${checker.signatureToString(
            signature,
            declaration,
            TYPE_FORMAT_FLAGS,
          )}`,
        )
      }
    }

    if (!documentedInterfaces.includes(exported.getName())) continue

    const declaredType = checker.getDeclaredTypeOfSymbol(resolved)
    const lines = [`interface ${exported.getName()} {`]

    for (const property of checker.getPropertiesOfType(declaredType)) {
      const propertyDeclaration =
        property.valueDeclaration ||
        (property.declarations ? property.declarations[0] : undefined) ||
        source
      const propertyType = checker.getTypeOfSymbolAtLocation(
        property,
        propertyDeclaration,
      )
      const optional = property.flags & ts.SymbolFlags.Optional ? '?' : ''

      lines.push(
        `  ${property.getName()}${optional}: ${checker.typeToString(
          propertyType,
          propertyDeclaration,
          TYPE_FORMAT_FLAGS,
        )}`,
      )
    }

    lines.push('}')
    interfaceDeclarations.push(lines.join('\n'))
  }

  return {
    exportedNames,
    functionSignatures: functionSignatures.sort(),
    interfaceDeclarations: interfaceDeclarations.sort(),
  }
}

describe('internal package API documentation contract', () => {
  for (const documentedPackage of documentedPackages) {
    it(`documents the complete ${documentedPackage.packageName} component contract`, () => {
      const section = normalizeMarkdownTables(
        extractPackageSection(documentedPackage.packageName),
      )

      expect(section).toContain(
        '| Web Component | props | slots | events | methods |',
      )

      for (const row of getComponentContractRows(documentedPackage.directory)) {
        expect(section).toContain(row)
      }
    })
  }

  for (const documentedPackage of documentedPackages) {
    it(`documents every ${documentedPackage.packageName} root entry export`, () => {
      const section = extractPackageSection(documentedPackage.packageName)
      const api = getRootEntryApi(
        documentedPackage.directory,
        documentedPackage.documentedInterfaces,
      )
      const normalizedSection = normalizeTypeScriptDeclaration(section)

      expect(section).toContain('### 根入口 API')

      for (const exported of api.exportedNames) {
        expect(section).toContain(`\`${exported}\``)
      }

      for (const signature of api.functionSignatures) {
        expect(normalizedSection).toContain(
          normalizeTypeScriptDeclaration(signature),
        )
      }

      for (const declaration of api.interfaceDeclarations) {
        expect(normalizedSection).toContain(
          normalizeTypeScriptDeclaration(declaration),
        )
      }
    })
  }
})
