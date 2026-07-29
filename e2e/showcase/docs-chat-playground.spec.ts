import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { docsShowcaseTarget, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe('docs chat playground', () => {
  it('keeps the visible thread in sync with local send events', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)
      const playground = page.locator('[data-playground-demo="chat"]')
      const messages = playground.locator('zw-chat-message')
      const sentText = 'Playground regression message'

      return page
        .goto('components/chat')
        .then(() => expectPage(playground).toBeVisible())
        .then(() => expectPage(messages).toHaveCount(3))
        .then(() => expectPage(playground).not.toContainText('No messages yet'))
        .then(() =>
          page
            .getByRole('textbox', {
              name: 'Message Zeus assistant',
              exact: true,
            })
            .fill(sentText),
        )
        .then(() =>
          page.getByRole('button', { name: 'Send', exact: true }).click(),
        )
        .then(() =>
          expectPage(messages.filter({ hasText: sentText })).toBeVisible(),
        )
        .then(() =>
          expectPage(
            messages.filter({ hasText: 'Local reply received.' }),
          ).toBeVisible(),
        )
        .then(() => expectPage(messages).toHaveCount(5))
        .then(() => errors.assertClean())
    })
  })
})
