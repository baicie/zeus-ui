import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import { showcaseTargets, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe.each(showcaseTargets)('$name showcase icons page', target => {
  it('filters icons and updates preview controls', () => {
    return withShowcasePage(target, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/icons')
        .then(() =>
          expectPage(
            page.getByRole('heading', { name: 'Icons' }),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(
            page.getByRole('heading', { name: 'Check', exact: true }),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(
            page.getByRole('heading', { name: 'Menu', exact: true }),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(page.locator('.showcase-icon-grid')).toBeVisible(),
        )
        .then(() =>
          expectPage(
            page.locator('.showcase-icon-preview svg').first(),
          ).toBeVisible(),
        )
        .then(() => page.getByLabel('Search icons').fill('settings'))
        .then(() =>
          expectPage(
            page.getByRole('heading', { name: 'Settings', exact: true }),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(
            page.getByRole('heading', { name: 'Menu', exact: true }),
          ).toHaveCount(0),
        )
        .then(() =>
          expectPage(
            page.getByRole('heading', { name: 'Check', exact: true }),
          ).toHaveCount(0),
        )
        .then(() => page.getByLabel('Search icons').fill(''))
        .then(() => page.getByRole('button', { name: 'navigation' }).click())
        .then(() =>
          expectPage(
            page.getByRole('heading', { name: 'Menu', exact: true }),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(
            page.getByRole('heading', { name: 'Chevron down' }),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(
            page.getByRole('heading', { name: 'Settings', exact: true }),
          ).toHaveCount(0),
        )
        .then(() => page.getByLabel('Icon preview size').selectOption('32'))
        .then(() =>
          expectPage(page.getByLabel('Icon preview size')).toHaveValue('32'),
        )
        .then(() =>
          page.getByLabel('Icon preview color').selectOption('primary'),
        )
        .then(() =>
          expectPage(page.getByLabel('Icon preview color')).toHaveValue(
            'primary',
          ),
        )
        .then(() => errors.assertClean())
    })
  })

  it('copies icon snippets', () => {
    return withShowcasePage(target, (page, context) => {
      const errors = collectPageErrors(page)

      return context
        .grantPermissions(['clipboard-read', 'clipboard-write'])
        .then(() => page.goto('/icons'))
        .then(() => page.getByLabel('Copy REACT import for Check').click())
        .then(() => expectPage(page.getByText('Copied REACT')).toBeVisible())
        .then(() =>
          page
            .evaluate(() => navigator.clipboard.readText())
            .then(text => {
              expect(text).toBe(
                "import { CheckIcon } from '@zeus-web/icons/react'",
              )
            }),
        )
        .then(() => page.getByLabel('Copy VUE import for Check').click())
        .then(() =>
          page
            .evaluate(() => navigator.clipboard.readText())
            .then(text => {
              expect(text).toContain(
                "import { CheckIcon } from '@zeus-web/icons/vue'",
              )
            }),
        )
        .then(() => page.getByLabel('Copy WC import for Check').click())
        .then(() =>
          page
            .evaluate(() => navigator.clipboard.readText())
            .then(text => {
              expect(text).toContain('<zw-icon-check></zw-icon-check>')
            }),
        )
        .then(() => page.getByLabel('Copy raw svg import for Check').click())
        .then(() =>
          page
            .evaluate(() => navigator.clipboard.readText())
            .then(text => {
              expect(text).toBe(
                "import CheckIconSvg from '@zeus-web/icons/svg/check.svg?raw'",
              )
            }),
        )
        .then(() => errors.assertClean())
    })
  })
})
