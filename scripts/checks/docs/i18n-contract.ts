import type { GeneratedDoc } from '../../docs/component-docs'

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  componentCategoryIds,
  componentIdentities,
  getComponentCatalog,
  getComponentCategories,
} from '../../../apps/docs/.vitepress/data/component-catalog'
import {
  defaultDocsLocale,
  docsLocaleIds,
  getDocsLocale,
} from '../../../apps/docs/.vitepress/data/docs-i18n'
import { getComponentCategoryGroups } from '../../../apps/docs/.vitepress/data/site'
import {
  createComponentDocsContext,
  generateComponentDocs,
} from '../../docs/component-docs'

export interface DocsI18nContractResult {
  valid: boolean
  errors: string[]
  generatedDocCount: number
}

const HAN_CHARACTER_PATTERN = /[\u3400-\u9FFF\uF900-\uFAFF]/

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
      continue
    }

    seen.add(value)
  }

  return Array.from(duplicates).sort()
}

function flattenSidebarLinks(
  groups: ReturnType<typeof getComponentCategoryGroups>,
): string[] {
  return groups.flatMap(group =>
    group.items.flatMap(item => {
      const childLinks = item.items
        ? item.items.flatMap(child => (child.link ? [child.link] : []))
        : []

      return (item.link ? [item.link] : []).concat(childLinks)
    }),
  )
}

function extractCodeBlocks(source: string): string[] {
  const blocks: string[] = []
  const pattern = /```[^\n]*\n([\s\S]*?)\n```/g
  let match = pattern.exec(source)

  while (match) {
    blocks.push(match[1] || '')
    match = pattern.exec(source)
  }

  return blocks
}

function expectedGeneratedPath(locale: 'en' | 'zh', name: string): string {
  const localeRoot =
    locale === 'en' ? 'apps/docs' : `apps/docs/${getDocsLocale(locale).id}`

  return `${localeRoot}/components/${name}.md`
}

function expectedGeneratedPaths(): string[] {
  return docsLocaleIds.flatMap(locale => [
    expectedGeneratedPath(locale, 'index'),
    ...componentIdentities.map(component =>
      expectedGeneratedPath(locale, component.name),
    ),
  ])
}

function checkLocaleDefinitions(errors: string[]): void {
  if (defaultDocsLocale !== 'en') {
    errors.push('The default docs locale must be English.')
  }

  if (docsLocaleIds.join(',') !== 'en,zh') {
    errors.push('Docs locales must be exactly "en" and "zh".')
  }

  const english = getDocsLocale('en')
  const chinese = getDocsLocale('zh')

  if (english.vitePressKey !== 'root' || english.pathPrefix !== '') {
    errors.push('English must use the VitePress root locale without /en/.')
  }

  if (english.lang !== 'en-US') {
    errors.push('English must declare lang="en-US".')
  }

  if (chinese.vitePressKey !== 'zh' || chinese.pathPrefix !== '/zh') {
    errors.push('Chinese must use the /zh locale prefix.')
  }

  if (chinese.lang !== 'zh-CN') {
    errors.push('Chinese must declare lang="zh-CN".')
  }
}

function checkCatalogParity(errors: string[]): void {
  const identityNames = componentIdentities.map(component => component.name)
  const categoryIds = Array.from(componentCategoryIds)

  for (const locale of docsLocaleIds) {
    const catalog = getComponentCatalog(locale)
    const categories = getComponentCategories(locale)
    const localePrefix = locale === 'en' ? '' : '/zh'

    if (
      catalog.map(component => component.name).join(',') !==
      identityNames.join(',')
    ) {
      errors.push(`${locale}: component catalog identity coverage is invalid.`)
    }

    if (
      categories.map(category => category.id).join(',') !==
      categoryIds.join(',')
    ) {
      errors.push(`${locale}: component category coverage is invalid.`)
    }

    for (const component of catalog) {
      if (!component.title.trim() || !component.description.trim()) {
        errors.push(`${locale}: ${component.name} must have localized copy.`)
      }

      const expectedRoute = `${localePrefix}/components/${component.name}`
      if (component.route !== expectedRoute) {
        errors.push(
          `${locale}: ${component.name} route must be "${expectedRoute}".`,
        )
      }

      if (
        locale === 'zh' &&
        !HAN_CHARACTER_PATTERN.test(
          `${component.title} ${component.description}`,
        )
      ) {
        errors.push(`${locale}: ${component.name} copy must contain Chinese.`)
      }
    }

    for (const category of categories) {
      if (!category.label.trim() || !category.description.trim()) {
        errors.push(`${locale}: ${category.id} must have localized copy.`)
      }

      if (
        locale === 'zh' &&
        !HAN_CHARACTER_PATTERN.test(`${category.label} ${category.description}`)
      ) {
        errors.push(`${locale}: ${category.id} copy must contain Chinese.`)
      }
    }

    const sidebarLinks = flattenSidebarLinks(getComponentCategoryGroups(locale))

    for (const component of catalog) {
      const count = sidebarLinks.filter(link => link === component.route).length
      if (count !== 1) {
        errors.push(
          `${locale}: sidebar must contain "${component.route}" exactly once.`,
        )
      }
    }

    for (const link of sidebarLinks) {
      if (locale === 'en' && link.startsWith('/zh/')) {
        errors.push(`en: sidebar must not contain Chinese route "${link}".`)
      }

      if (locale === 'zh' && !link.startsWith('/zh/components/')) {
        errors.push(`zh: sidebar contains non-Chinese route "${link}".`)
      }
    }
  }
}

function checkGeneratedDocs(
  generatedDocs: readonly GeneratedDoc[],
  errors: string[],
): void {
  const expectedPaths = expectedGeneratedPaths()
  const generatedPaths = generatedDocs.map(doc => doc.path)

  for (const duplicate of findDuplicates(generatedPaths)) {
    errors.push(`Duplicate generated docs path "${duplicate}".`)
  }

  for (const path of expectedPaths) {
    if (!generatedPaths.includes(path)) {
      errors.push(`Missing localized generated doc "${path}".`)
    }
  }

  for (const path of generatedPaths) {
    if (!expectedPaths.includes(path)) {
      errors.push(`Unexpected localized generated doc "${path}".`)
    }
  }

  for (const component of componentIdentities) {
    const englishPath = expectedGeneratedPath('en', component.name)
    const chinesePath = expectedGeneratedPath('zh', component.name)
    const english = generatedDocs.find(doc => doc.path === englishPath)
    const chinese = generatedDocs.find(doc => doc.path === chinesePath)
    const playgroundMarkup =
      component.name === 'data-grid'
        ? '<DataGridPlayground />'
        : `<ComponentPlayground name="${component.name}" />`

    if (!english || !chinese) continue

    if (HAN_CHARACTER_PATTERN.test(english.content)) {
      errors.push(`${englishPath} must be English-only.`)
    }

    if (!HAN_CHARACTER_PATTERN.test(chinese.content)) {
      errors.push(`${chinesePath} must contain Chinese prose.`)
    }

    if (
      !english.content.includes(playgroundMarkup) ||
      !chinese.content.includes(playgroundMarkup)
    ) {
      errors.push(
        `${component.packageName} must use the same Playground in both locales.`,
      )
    }

    const englishCode = extractCodeBlocks(english.content)
    const chineseCode = extractCodeBlocks(chinese.content)

    if (JSON.stringify(englishCode) !== JSON.stringify(chineseCode)) {
      errors.push(
        `${component.packageName} code blocks must stay identical across locales.`,
      )
    }

    if (
      chinese.content.includes('<br />Values:') ||
      (english.content.includes('<br />Values:') &&
        !chinese.content.includes('<br />可选值:'))
    ) {
      errors.push(`${chinesePath} must localize enum value labels.`)
    }
  }

  const englishIndex = generatedDocs.find(
    doc => doc.path === expectedGeneratedPath('en', 'index'),
  )
  const chineseIndex = generatedDocs.find(
    doc => doc.path === expectedGeneratedPath('zh', 'index'),
  )

  if (englishIndex && HAN_CHARACTER_PATTERN.test(englishIndex.content)) {
    errors.push('The root component index must be English-only.')
  }

  if (chineseIndex && !HAN_CHARACTER_PATTERN.test(chineseIndex.content)) {
    errors.push('The Chinese component index must contain Chinese prose.')
  }
}

function checkPlaygroundLocalization(root: string, errors: string[]): void {
  const demoRoot = resolve(
    root,
    'apps/docs/.vitepress/theme/components/playgrounds/demos',
  )
  const localizedDemos = componentIdentities.filter(component => {
    return component.name !== 'data-grid' && component.name !== 'skeleton'
  })

  for (const component of localizedDemos) {
    const path = resolve(demoRoot, `${component.name}-demo.vue`)

    if (!existsSync(path)) {
      errors.push(`${component.packageName} is missing its localized Demo.`)
      continue
    }

    const source = readFileSync(path, 'utf-8')

    if (
      !source.includes('useLocalizedMessages') ||
      !source.includes('en: {') ||
      !source.includes('zh: {') ||
      !HAN_CHARACTER_PATTERN.test(source)
    ) {
      errors.push(
        `${component.packageName} Demo must provide English and Chinese messages.`,
      )
    }
  }

  const dataGridPath = resolve(
    root,
    'apps/docs/.vitepress/theme/components/DataGridPlayground.vue',
  )
  const dataGridSource = readFileSync(dataGridPath, 'utf-8')

  if (!dataGridSource.includes('dataGridPlaygroundMessages')) {
    errors.push('@zeus-web/data-grid Playground must use localized messages.')
  }
}

export function checkDocsI18nContract(
  root = process.cwd(),
  generatedDocs?: readonly GeneratedDoc[],
): DocsI18nContractResult {
  const errors: string[] = []
  let docs = generatedDocs

  checkLocaleDefinitions(errors)
  checkCatalogParity(errors)
  checkPlaygroundLocalization(root, errors)

  if (!docs) {
    try {
      docs = generateComponentDocs(createComponentDocsContext(root), root)
    } catch (error) {
      errors.push(`Unable to generate localized docs: ${String(error)}`)
      docs = []
    }
  }

  checkGeneratedDocs(docs, errors)

  return {
    valid: errors.length === 0,
    errors,
    generatedDocCount: docs.length,
  }
}
