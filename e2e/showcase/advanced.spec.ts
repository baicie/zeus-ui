import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { advancedShowcaseTarget, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe('advanced showcase', () => {
  it('renders advanced component demos', () => {
    return withShowcasePage(advancedShowcaseTarget, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/')
        .then(() =>
          expectPage(
            page.getByText('Advanced Component Showcase'),
          ).toBeVisible(),
        )
        .then(() => expectPage(page.locator('zw-data-grid')).toBeVisible())
        .then(() => expectPage(page.locator('zw-chat')).toBeVisible())
        .then(() => expectPage(page.locator('zw-virtual-list')).toBeVisible())
        .then(() =>
          expectPage(page.locator('zw-data-grid')).toContainText('MRR'),
        )
        .then(() => errors.assertClean())
    })
  })

  it('emits chat send events from the showcase composer', () => {
    return withShowcasePage(advancedShowcaseTarget, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/')
        .then(() => page.getByRole('button', { name: 'Send' }).click())
        .then(() =>
          expectPage(page.locator('[data-send-output]')).toContainText(
            'Summarize the grid',
          ),
        )
        .then(() => errors.assertClean())
    })
  })
})
