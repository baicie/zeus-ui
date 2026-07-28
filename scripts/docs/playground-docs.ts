import type { ComponentCatalogItem } from '../../apps/docs/.vitepress/data/component-catalog'
import type { DocsLocale } from '../../apps/docs/.vitepress/data/docs-i18n'
import type {
  PlaygroundFramework,
  PlaygroundSource,
  PlaygroundSourceSet,
} from '../../apps/docs/.vitepress/data/playground-sources'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getComponentDocsMessages } from './component-docs-i18n'

interface FrameworkContract {
  exportPath: string
  sourceKey: PlaygroundFramework
}

interface PackageManifest {
  exports: Record<string, unknown>
}

const frameworkContracts: FrameworkContract[] = [
  {
    exportPath: './wc/auto',
    sourceKey: 'webComponent',
  },
  {
    exportPath: './react',
    sourceKey: 'react',
  },
  {
    exportPath: './vue',
    sourceKey: 'vue',
  },
]

function readPackageManifest(
  component: ComponentCatalogItem,
  root = process.cwd(),
): PackageManifest {
  const path = resolve(
    root,
    'packages',
    component.packageGroup,
    component.name,
    'package.json',
  )

  return JSON.parse(readFileSync(path, 'utf-8')) as PackageManifest
}

export function getSupportedPlaygroundFrameworks(
  component: ComponentCatalogItem,
  root = process.cwd(),
): PlaygroundFramework[] {
  const manifest = readPackageManifest(component, root)

  return frameworkContracts
    .filter(contract => contract.exportPath in manifest.exports)
    .map(contract => contract.sourceKey)
}

function validateSource(
  component: ComponentCatalogItem,
  framework: PlaygroundFramework,
  source: PlaygroundSource | undefined,
): PlaygroundSource {
  if (!source) {
    throw new Error(
      `${component.packageName} exports ${framework}, but its Playground source is missing.`,
    )
  }

  const expectedImport =
    framework === 'webComponent'
      ? `${component.packageName}/wc/auto`
      : `${component.packageName}/${framework}`

  if (!source.code.includes(expectedImport)) {
    throw new Error(
      `${component.packageName} ${framework} source must import ${expectedImport}.`,
    )
  }

  return source
}

function validateSourceSet(
  component: ComponentCatalogItem,
  sources: PlaygroundSourceSet,
  root = process.cwd(),
): PlaygroundFramework[] {
  const supported = getSupportedPlaygroundFrameworks(component, root)
  const sourceKeys = frameworkContracts
    .map(contract => contract.sourceKey)
    .filter(key => Boolean(sources[key]))

  if (
    supported.length !== sourceKeys.length ||
    supported.some(framework => !sourceKeys.includes(framework))
  ) {
    throw new Error(
      `${component.packageName} Playground sources do not match its package exports.`,
    )
  }

  return supported
}

function renderSource(source: PlaygroundSource): string {
  return [
    `\`\`\`${source.language} [${source.label}]`,
    source.code,
    '```',
  ].join('\n')
}

function renderSourceCodeGroup(
  component: ComponentCatalogItem,
  sources: PlaygroundSourceSet,
  root = process.cwd(),
): string {
  const supported = validateSourceSet(component, sources, root)

  return [
    '::: code-group',
    ...supported.map(framework => {
      return renderSource(
        validateSource(component, framework, sources[framework]),
      )
    }),
    ':::',
  ].join('\n\n')
}

function renderPlaygroundComponent(component: ComponentCatalogItem): string {
  if (component.name === 'data-grid') {
    return '<DataGridPlayground />'
  }

  return `<ComponentPlayground name="${component.name}" />`
}

export function renderEmbeddedPlayground(
  component: ComponentCatalogItem,
  sources: PlaygroundSourceSet,
  locale: DocsLocale = 'en',
  root = process.cwd(),
): string {
  const messages = getComponentDocsMessages(locale)
  const performanceDescription =
    component.name === 'data-grid'
      ? ['', ...messages.dataGridPlaygroundDescription]
      : []

  return [
    `## ${messages.playground}`,
    ...performanceDescription,
    '',
    '<ClientOnly>',
    renderPlaygroundComponent(component),
    '</ClientOnly>',
    '',
    `### ${messages.source}`,
    '',
    messages.sourceDescription,
    '',
    renderSourceCodeGroup(component, sources, root),
    '',
  ].join('\n')
}
