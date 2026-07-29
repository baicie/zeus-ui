import type { Page } from '@playwright/test'

import type { ComponentCatalogItem } from '../../apps/docs/.vitepress/data/component-catalog'
import type { DocsLocale } from '../../apps/docs/.vitepress/data/docs-i18n'
import type {
  PlaygroundSource,
  PlaygroundSourceSet,
} from '../../apps/docs/.vitepress/data/playground-sources'

import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import {
  getComponentCatalog,
  getComponentCategories,
} from '../../apps/docs/.vitepress/data/component-catalog'
import { playgroundSources } from '../../apps/docs/.vitepress/data/playground-sources'
import {
  docsShowcaseTarget,
  waitForZeusElements,
  withShowcasePage,
} from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

interface FrameworkExpectation {
  importPath: string
  source: PlaygroundSource
}

interface DocsLocaleCase {
  id: DocsLocale
  lang: string
  routePrefix: string
  pathnamePrefix: string
}

const docsLocaleCases: DocsLocaleCase[] = [
  {
    id: 'en',
    lang: 'en-US',
    routePrefix: '',
    pathnamePrefix: '/zeus-ui',
  },
  {
    id: 'zh',
    lang: 'zh-CN',
    routePrefix: 'zh/',
    pathnamePrefix: '/zeus-ui/zh',
  },
]

const frameworkSourceKeys: Array<keyof PlaygroundSourceSet> = [
  'webComponent',
  'react',
  'vue',
]

function getFrameworkImportPath(source: PlaygroundSource): string {
  const matches =
    source.code.match(/@zeus-web\/[a-z0-9-]+\/(?:wc\/auto|react|vue)/gi) || []

  expect(matches).toHaveLength(1)

  return matches[0] || ''
}

function getFrameworkExpectations(
  component: ComponentCatalogItem,
): FrameworkExpectation[] {
  const sources = playgroundSources[component.name]

  return frameworkSourceKeys.reduce<FrameworkExpectation[]>(
    (expectations, key) => {
      const source = sources[key]

      if (source) {
        expectations.push({
          importPath: getFrameworkImportPath(source),
          source,
        })
      }

      return expectations
    },
    [],
  )
}

function expectLivePreview(
  page: Page,
  component: ComponentCatalogItem,
): Promise<void> {
  if (component.name === 'data-grid') {
    const grid = page.getByTestId('data-grid-playground-grid')

    return expectPage(grid)
      .toBeVisible()
      .then(() => waitForZeusElements(grid))
      .then(() =>
        expectPage(
          grid.locator('[data-slot="data-grid-cell"]').first(),
        ).toBeVisible(),
      )
  }

  const playground = page.locator(
    `.component-playground[data-playground="${component.name}"]`,
  )

  return expectPage(playground)
    .toHaveAttribute('data-ready', 'true')
    .then(() =>
      expectPage(
        playground.locator(`[data-playground-demo="${component.name}"]`),
      ).toBeVisible(),
    )
    .then(() => waitForZeusElements(playground))
}

function expectFrameworkSources(
  page: Page,
  component: ComponentCatalogItem,
): Promise<void> {
  const codeGroup = page.locator('.vp-code-group').last()
  const labels = codeGroup.locator('.tabs label')
  const inputs = codeGroup.locator('.tabs input[type="radio"]')
  const blocks = codeGroup.locator('.blocks > div[class*="language-"]')
  const frameworks = getFrameworkExpectations(component)

  return expectPage(codeGroup)
    .toBeVisible()
    .then(() => expectPage(inputs).toHaveCount(frameworks.length))
    .then(() => expectPage(blocks).toHaveCount(frameworks.length))
    .then(() => labels.allTextContents())
    .then(values => {
      expect(values.map(value => value.trim())).toEqual(
        frameworks.map(framework => framework.source.label),
      )
    })
    .then(() => {
      return frameworks.reduce<Promise<void>>((promise, framework, index) => {
        return promise.then(() => {
          const input = inputs.nth(index)
          const block = blocks.nth(index)

          return labels
            .nth(index)
            .click()
            .then(() => expectPage(input).toBeChecked())
            .then(() =>
              expectPage(codeGroup.locator('.blocks > .active')).toHaveCount(1),
            )
            .then(() => expectPage(block).toHaveClass(/\bactive\b/))
            .then(() => expectPage(block).toBeVisible())
            .then(() => expectPage(block).toContainText(framework.importPath))
            .then(() => {
              return Promise.all(
                frameworks
                  .filter((_, frameworkIndex) => frameworkIndex !== index)
                  .map(otherFramework => {
                    return expectPage(block).not.toContainText(
                      otherFramework.importPath,
                    )
                  }),
              )
            })
            .then(() => {
              return Promise.all(
                frameworks.map((_, blockIndex) => {
                  if (blockIndex === index) return Promise.resolve()

                  return expectPage(blocks.nth(blockIndex)).toBeHidden()
                }),
              )
            })
            .then(() => {})
        })
      }, Promise.resolve())
    })
}

describe('docs component playgrounds', () => {
  for (const localeCase of docsLocaleCases) {
    const componentCatalog = getComponentCatalog(localeCase.id)
    const componentCategories = getComponentCategories(localeCase.id)

    it(`serves every ${localeCase.id} component with a live preview and framework sources`, () => {
      return withShowcasePage(docsShowcaseTarget, page => {
        const errors = collectPageErrors(page)

        return componentCatalog
          .reduce((promise, component) => {
            return promise
              .then(() =>
                page.goto(
                  `${localeCase.routePrefix}components/${component.name}`,
                  { waitUntil: 'networkidle' },
                ),
              )
              .then(response => {
                expect(response).not.toBeNull()
                expect(response && response.ok()).toBe(true)
                expect(new URL(page.url()).pathname).toBe(
                  `${localeCase.pathnamePrefix}/components/${component.name}`,
                )
              })
              .then(() =>
                expectPage(page.locator('html')).toHaveAttribute(
                  'lang',
                  localeCase.lang,
                ),
              )
              .then(() =>
                expectPage(
                  page.getByRole('heading', {
                    level: 1,
                    name: component.title,
                  }),
                ).toBeVisible(),
              )
              .then(() => expectLivePreview(page, component))
              .then(() => expectFrameworkSources(page, component))
          }, Promise.resolve())
          .then(() => errors.assertClean())
      })
    }, 180_000)

    it(`keeps the ${localeCase.id} directory and component Playground usable on mobile`, () => {
      return withShowcasePage(docsShowcaseTarget, page => {
        const errors = collectPageErrors(page)

        return page
          .setViewportSize({
            width: 390,
            height: 844,
          })
          .then(() =>
            page.goto(`${localeCase.routePrefix}components/`, {
              waitUntil: 'networkidle',
            }),
          )
          .then(() =>
            expectPage(page.locator('html')).toHaveAttribute(
              'lang',
              localeCase.lang,
            ),
          )
          .then(() =>
            expectPage(page.locator('[data-component-category]')).toHaveCount(
              componentCategories.length,
            ),
          )
          .then(() =>
            Promise.all(
              componentCategories.map(category => {
                return expectPage(
                  page.getByRole('heading', {
                    level: 2,
                    name: category.label,
                  }),
                ).toBeVisible()
              }),
            ),
          )
          .then(() =>
            expectPage(page.locator('[data-component-link]')).toHaveCount(
              componentCatalog.length,
            ),
          )
          .then(() => {
            return Promise.all(
              componentCatalog.map(component => {
                return page
                  .locator(`[data-component-link="${component.name}"]`)
                  .getAttribute('href')
                  .then(href =>
                    expect(href).toBe(
                      `${localeCase.pathnamePrefix}/components/${component.name}`,
                    ),
                  )
              }),
            )
          })
          .then(() =>
            page.goto(`${localeCase.routePrefix}components/button`, {
              waitUntil: 'networkidle',
            }),
          )
          .then(() =>
            expectPage(
              page.locator('.component-playground[data-playground="button"]'),
            ).toHaveAttribute('data-ready', 'true'),
          )
          .then(() =>
            page.locator('.component-playground').evaluate(element => {
              return element.scrollWidth <= element.clientWidth
            }),
          )
          .then(fits => expect(fits).toBe(true))
          .then(() => errors.assertClean())
      })
    })
  }
})
