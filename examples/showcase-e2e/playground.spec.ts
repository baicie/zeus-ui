import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { showcaseTargets, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe.each(showcaseTargets)('$name showcase playground page', target => {
  it('uses admin dashboard interactions', () => {
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
          page.getByRole('button', { name: 'Promote release' }).click(),
        )
        .then(() => expectPage(page.getByText('78%').first()).toBeVisible())
        .then(() =>
          expectPage(page.getByText('release-progress')).toBeVisible(),
        )
        .then(() =>
          page.getByRole('button', { name: 'Roll back release' }).click(),
        )
        .then(() => expectPage(page.getByText('68%').first()).toBeVisible())
        .then(() =>
          page
            .getByRole('combobox', { name: 'Dashboard environment' })
            .selectOption('staging'),
        )
        .then(() => expectPage(page.getByText('staging rollout')).toBeVisible())
        .then(() =>
          expectPage(page.getByText('environment-change')).toBeVisible(),
        )
        .then(() => errors.assertClean())
    })
  })

  it('validates settings form', () => {
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
        .then(() => page.getByPlaceholder('Organization name').fill('ze'))
        .then(() =>
          expectPage(page.getByText('Validation warning')).toBeVisible(),
        )
        .then(() =>
          expectPage(
            page.getByText('Use at least 3 characters.'),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(page.getByText('organization-name-change')).toBeVisible(),
        )
        .then(() => errors.assertClean())
    })
  })

  it('selects project template and shows creation action', () => {
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
        .then(() =>
          expectPage(
            page.getByRole('button', { name: /Component library/ }),
          ).toBeVisible(),
        )
        .then(() => page.getByRole('button', { name: /Dashboard app/ }).click())
        .then(() =>
          expectPage(page.getByText('project-template-change')).toBeVisible(),
        )
        .then(() =>
          expectPage(
            page
              .locator('.showcase-playground-template-card[data-active="true"]')
              .getByText('Dashboard app'),
          ).toBeVisible(),
        )
        .then(() => errors.assertClean())
    })
  })
})
