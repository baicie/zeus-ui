import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { showcaseTargets, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe.each(showcaseTargets)('$name showcase playground page', target => {
  it('renders admin dashboard scenario', () => {
    return withShowcasePage(target, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/playground')
        .then(() =>
          expectPage(
            page.getByRole('heading', {
              name: /Production composition playground/i,
            }),
          ).toBeVisible(),
        )
        .then(() => expectPage(page.getByText('68%').first()).toBeVisible())
        .then(() =>
          expectPage(
            page.getByRole('button', { name: /Admin dashboard/ }),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(
            page.getByRole('button', { name: /Settings form/ }),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(
            page.getByRole('button', { name: /Project creation/ }),
          ).toBeVisible(),
        )
        .then(() => errors.assertClean())
    })
  })

  it('switches to settings form scenario', () => {
    return withShowcasePage(target, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/playground')
        .then(() => page.getByRole('button', { name: /Settings form/ }).click())
        .then(() =>
          expectPage(
            page.getByRole('heading', { name: /Workspace configuration/i }),
          ).toBeVisible(),
        )
        .then(() => expectPage(page.getByText('Settings ready')).toBeVisible())
        .then(() => errors.assertClean())
    })
  })

  it('switches to project creation scenario', () => {
    return withShowcasePage(target, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/playground')
        .then(() =>
          page.getByRole('button', { name: /Project creation/ }).click(),
        )
        .then(() =>
          expectPage(
            page.getByRole('heading', { name: /Create and review projects/i }),
          ).toBeVisible(),
        )
        .then(() => expectPage(page.getByText('Templates')).toBeVisible())
        .then(() => errors.assertClean())
    })
  })
})
