import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { showcaseTargets, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe.each(showcaseTargets)('$name showcase icons page', target => {
  it('renders icon grid and preview controls', () => {
    return withShowcasePage(target, (page, context) => {
      const errors = collectPageErrors(page)

      return context
        .grantPermissions(['clipboard-read', 'clipboard-write'])
        .then(() => page.goto('/icons'))
        .then(() =>
          expectPage(page.locator('.showcase-icon-grid')).toBeVisible(),
        )
        .then(() =>
          expectPage(page.locator('.showcase-icon-card').first()).toBeVisible(),
        )
        .then(() =>
          expectPage(
            page.locator('.showcase-icon-preview svg').first(),
          ).toBeVisible(),
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
        .then(() => page.getByLabel('Copy REACT import for Check').click())
        .then(() => expectPage(page.getByText('Copied REACT')).toBeVisible())
        .then(() => errors.assertClean())
    })
  })
})
