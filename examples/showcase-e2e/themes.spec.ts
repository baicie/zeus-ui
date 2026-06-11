import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { showcaseTargets, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe.each(showcaseTargets)('$name showcase themes page', target => {
  it('renders theme variants and controls', () => {
    return withShowcasePage(target, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/themes')
        .then(() =>
          expectPage(
            page.locator('.showcase-theme-variant-card').first(),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(page.getByText('Semantic token palette')).toBeVisible(),
        )
        .then(() =>
          expectPage(page.getByText('Component preview')).toBeVisible(),
        )
        .then(() => errors.assertClean())
    })
  })
})
