import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { advancedShowcaseTarget, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe('advanced showcase', () => {
  it('renders the data grid demo', () => {
    return withShowcasePage(advancedShowcaseTarget, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/data-grid')
        .then(() =>
          expectPage(
            page.getByText('Advanced Component Showcase'),
          ).toBeVisible(),
        )
        .then(() => expectPage(page.locator('zw-data-grid')).toBeVisible())
        .then(() =>
          expectPage(page.locator('zw-data-grid')).toHaveAttribute(
            'data-row-count',
            '100000',
          ),
        )
        .then(() =>
          expectPage(page.locator('zw-data-grid')).toHaveAttribute(
            'data-column-count',
            '100',
          ),
        )
        .then(() =>
          expectPage(page.locator('zw-data-grid')).toContainText('Record'),
        )
        .then(() => errors.assertClean())
    })
  })

  it('renders the chat demo', () => {
    return withShowcasePage(advancedShowcaseTarget, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/chat')
        .then(() => expectPage(page.locator('zw-chat')).toBeVisible())
        .then(() => errors.assertClean())
    })
  })

  it('renders the virtual list demo', () => {
    return withShowcasePage(advancedShowcaseTarget, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/virtual-list')
        .then(() => expectPage(page.locator('zw-virtual-list')).toBeVisible())
        .then(() => errors.assertClean())
    })
  })

  it('emits chat send events from the showcase composer', () => {
    return withShowcasePage(advancedShowcaseTarget, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/chat')
        .then(() =>
          page
            .getByRole('textbox', { name: 'Message ChatGPT' })
            .fill('Summarize the grid'),
        )
        .then(() => page.getByRole('button', { name: 'Send message' }).click())
        .then(() =>
          expectPage(page.locator('.event-output')).toContainText(
            'Summarize the grid',
          ),
        )
        .then(() => errors.assertClean())
    })
  })
})
