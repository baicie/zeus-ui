/**
 * AI2-505 in a real browser: one conversation rendered by React, Vue and
 * Web Components on the same page. Sending from any framework updates all
 * three, and the three render the same accessible tree.
 */

import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'
import { BROWSERS, openStory, pageErrors } from './browser'

const FRAMEWORKS = ['react', 'vue', 'wc'] as const
const LABELS = {
  react: 'Ask from React',
  vue: 'Ask from Vue',
  wc: 'Ask from Web Components',
}

describe.each(BROWSERS)('three renderers · %s', engine => {
  it('stays in sync and exposes the same semantics', async () => {
    const page = await openStory(engine, 'frameworks')

    for (const [index, framework] of FRAMEWORKS.entries()) {
      const input = page.getByRole('textbox', { name: LABELS[framework] })
      await input.fill(`Hello from ${framework}`)
      await input.press('Enter')
      for (const other of FRAMEWORKS) {
        const panel = page.locator(`[data-framework="${other}"]`)
        await expectPage(panel.locator('[role="article"]')).toHaveCount(
          (index + 1) * 2,
        )
        await expectPage(panel.locator('[role="feed"]')).toHaveAttribute(
          'aria-busy',
          'false',
        )
      }
    }

    const outlines = await Promise.all(
      FRAMEWORKS.map(framework =>
        page
          .locator(`[data-framework="${framework}"] [role="feed"]`)
          .evaluate(feed =>
            Array.from(feed.querySelectorAll('[role="article"]')).map(
              article => ({
                position: article.getAttribute('aria-posinset'),
                size: article.getAttribute('aria-setsize'),
                author: article
                  .querySelector('[data-author]')
                  ?.getAttribute('data-author'),
                status: article
                  .querySelector('[data-status]')
                  ?.getAttribute('data-status'),
                text: (
                  article.querySelector('[data-part="content"]')?.textContent ??
                  ''
                ).trim(),
                buttons: Array.from(article.querySelectorAll('button')).map(
                  button => button.getAttribute('aria-label'),
                ),
              }),
            ),
          ),
      ),
    )

    expect(outlines[0].length).toBe(6)
    expect(outlines[1]).toEqual(outlines[0])
    expect(outlines[2]).toEqual(outlines[0])
    expect(pageErrors(page), pageErrors(page).join('\n')).toEqual([])
    await page.context().close()
  })
})
