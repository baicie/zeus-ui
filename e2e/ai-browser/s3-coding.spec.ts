/**
 * AI2-407 · S3 coding review story in real browsers: view → comment →
 * apply → conflict → rebase → re-review (outdated comment) → apply.
 * Files are only ever written by the host.
 */

import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'
import {
  axeViolations,
  BROWSERS,
  hostCommands,
  openStory,
  pageErrors,
} from './browser'

describe.each(BROWSERS)('s3 coding review · %s', engine => {
  it('reviews, comments, resolves a conflict and applies through the host', async () => {
    const page = await openStory(engine, 'coding')
    const tree = page.getByRole('tree', { name: 'Changed files' })
    await expectPage(
      tree.getByRole('treeitem', { name: /math\.ts/ }).first(),
    ).toBeVisible()

    // Keyboard into the tree and open the first file.
    // src/ (expanded) → math.spec.ts → math.ts
    await tree.getByRole('treeitem').first().focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    const diff = page.getByRole('region', { name: 'Changes in src/math.ts' })
    await expectPage(diff).toBeVisible()
    await expectPage(
      diff.locator('[data-kind="add"]').filter({ hasText: 'return a + b' }),
    ).toBeVisible()

    await diff.getByRole('checkbox', { name: 'Reviewed' }).check()
    await expectPage(page.getByTestId('review-progress')).toHaveText(
      'Reviewed 1 / 1',
    )

    await diff.getByLabel('Add comment').fill('Why was this subtracting?')
    await diff.getByRole('button', { name: 'Add comment' }).click()
    await diff.getByRole('button', { name: 'Submit' }).click()
    await expectPage(diff.locator('[data-status="submitted"]')).toContainText(
      'Why was this subtracting?',
    )

    const actions = page.locator('[data-zw-ai="changeset-actions"]')
    await actions.getByRole('button', { name: 'Apply changes' }).click()
    await expectPage(actions.getByRole('status')).toHaveText(
      'Conflicts with the current base',
    )

    await actions
      .getByRole('button', { name: 'Rebase onto current base' })
      .click()
    await expectPage(actions.getByRole('status')).toHaveText('Ready to apply')
    // The hunk changed in the new revision: the old comment is flagged.
    await expectPage(
      page.getByText('This comment may be outdated: the code changed'),
    ).toBeVisible()
    await expectPage(
      diff.locator('[data-kind="add"]').filter({ hasText: 'rebased' }),
    ).toBeVisible()

    await actions.getByRole('button', { name: 'Apply changes' }).click()
    await expectPage(actions.getByRole('status')).toHaveText('Applied')

    const applies = (await hostCommands(page)).filter(
      command => command.type === 'changeset.apply',
    )
    expect(applies).toHaveLength(2)
    expect(new Set(applies.map(command => command.idempotencyKey)).size).toBe(2)
    expect(pageErrors(page), pageErrors(page).join('\n')).toEqual([])
    await page.context().close()
  })

  it('shows failures first and loads raw output on demand', async () => {
    const page = await openStory(engine, 'coding')
    const report = page.locator('[data-zw-ai="test-report"]')
    await expectPage(report.getByRole('status')).toHaveText(
      '2 passed, 1 failed, 0 skipped',
    )
    await expectPage(report.locator('li').first()).toContainText(
      'subtract() returns the difference',
    )
    await expectPage(report.locator('li').first()).toContainText(
      'src/math.spec.ts:7',
    )

    await report
      .locator('li')
      .first()
      .getByRole('button', { name: 'Show details' })
      .click()
    await expectPage(report.locator('pre')).toContainText('expected 1 to be -1')
    await page.context().close()
  })

  it('switches to a side-by-side diff', async () => {
    const page = await openStory(engine, 'coding')
    await page
      .getByRole('treeitem', { name: /math\.ts/ })
      .first()
      .click()
    await page.getByRole('button', { name: 'Side by side' }).click()
    await expectPage(page.locator('[data-zw-ai="diff"]')).toHaveAttribute(
      'data-layout',
      'split',
    )
    await page.context().close()
  })

  it('has no axe violations', async () => {
    const page = await openStory(engine, 'coding')
    await page
      .getByRole('treeitem', { name: /math\.ts/ })
      .first()
      .click()
    await expectPage(
      page.locator('[data-zw-ai="diff"][role="region"]'),
    ).toBeVisible()
    expect(await axeViolations(page)).toEqual([])
    await page.context().close()
  })
})
