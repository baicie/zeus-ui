/**
 * AI2-307 · S2 agent + approval story in real browsers: the approval shows
 * what, where, scope, risk and expiry; a typed confirmation gates approve;
 * double clicks send one decision; rejection never reports success; a
 * forged / stale decision is refused by the host; hidden runs keep their
 * pending approvals discoverable.
 */

import type { Page } from '@playwright/test'

import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'
import {
  axeViolations,
  BROWSERS,
  hostCommands,
  openStory,
  pageErrors,
} from './browser'

async function startRun(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start run' }).click()
}

function approval(page: Page) {
  return page.locator('[data-zw-ai="approval"]')
}

describe.each(BROWSERS)('s2 agent · %s', engine => {
  it('shows the full request and approves exactly once', async () => {
    const page = await openStory(engine, 'agent')
    await startRun(page)

    const prompt = approval(page)
    await expectPage(prompt).toBeVisible()
    await expectPage(prompt.locator('[data-detail="target"]')).toHaveText(
      'workspace demo: pnpm test --filter math',
    )
    await expectPage(prompt.locator('[data-detail="scope"]')).toHaveText(
      'This one time only',
    )
    await expectPage(prompt.locator('[data-detail="risk"]')).toHaveText(
      'High risk',
    )
    await expectPage(prompt.locator('[data-detail="expires"]')).toBeVisible()
    await expectPage(
      page.locator('[data-zw-ai="execution-status"]'),
    ).toContainText('Waiting for your approval')
    // Secrets in the tool input never reach the page.
    expect(await page.content()).not.toContain('npm_live_secret_value')

    const approve = prompt.getByRole('button', { name: 'Approve' })
    await expectPage(approve).toBeDisabled()
    await prompt.getByLabel('Type "run tests" to confirm').fill('run tests')
    await expectPage(approve).toBeEnabled()
    await approve.dblclick()

    await expectPage(
      page.locator('[data-zw-ai="execution-status"]'),
    ).toContainText('Completed')
    await expectPage(prompt.getByRole('status')).toHaveText('Approved')
    await expectPage(page.locator('[data-zw-ai="tool"]')).toContainText(
      'Succeeded',
    )
    expect(
      (await hostCommands(page)).filter(
        command => command.type === 'approval.resolve',
      ),
    ).toHaveLength(1)
    expect(pageErrors(page), pageErrors(page).join('\n')).toEqual([])
    await page.context().close()
  })

  it('never reports success after a rejection', async () => {
    const page = await openStory(engine, 'agent')
    await startRun(page)
    await approval(page).getByRole('button', { name: 'Reject' }).click()

    await expectPage(
      page.locator('[data-zw-ai="execution-status"]'),
    ).toContainText('Cancelled')
    await expectPage(approval(page).getByRole('status')).toHaveText('Rejected')
    await expectPage(page.locator('[data-zw-ai="tool"]')).toContainText(
      'Cancelled',
    )
    expect(await page.locator('main').textContent()).not.toContain('Succeeded')
    await page.context().close()
  })

  it('refuses a forged or stale decision at the host', async () => {
    const page = await openStory(engine, 'agent')
    await startRun(page)
    await expectPage(approval(page)).toBeVisible()

    const ack = await page.evaluate(async () => {
      const demo = (
        window as unknown as {
          __aiDemo: {
            session: {
              execute: (
                command: unknown,
              ) => Promise<{ accepted: boolean; code?: string }>
            }
          }
        }
      ).__aiDemo
      return demo.session.execute({
        schemaVersion: 2,
        commandId: 'forged',
        idempotencyKey: 'forged',
        type: 'approval.resolve',
        target: { kind: 'approval', id: 'run-1-approval' },
        expectedRevision: 99,
        payload: { decision: 'approved' },
      })
    })

    expect(ack).toMatchObject({ accepted: false, code: 'AI_REVISION_MISMATCH' })
    await expectPage(approval(page).getByRole('status')).toHaveText(
      'Waiting for decision',
    )
    await expectPage(
      page.locator('[data-zw-ai="execution-status"]'),
    ).toContainText('Waiting for your approval')
    await page.context().close()
  })

  it('keeps runs isolated and hidden approvals discoverable', async () => {
    const page = await openStory(engine, 'agent')
    await startRun(page)
    await expectPage(approval(page)).toBeVisible()
    await startRun(page)

    const tabs = page.getByRole('tab')
    await expectPage(tabs).toHaveCount(2)
    await expectPage(page.getByTestId('pending-total')).toHaveText(
      '2 awaiting approval',
    )

    await tabs.nth(0).focus()
    await page.keyboard.press('ArrowRight')
    await expectPage(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expectPage(tabs.nth(1)).toBeFocused()
    // Switching never stops the other run.
    expect(
      (await hostCommands(page)).filter(
        command => command.type === 'execution.cancel',
      ),
    ).toHaveLength(0)
    await expectPage(tabs.nth(0)).toHaveAccessibleName(/awaiting approval/)
    await page.context().close()
  })

  it('has no axe violations', async () => {
    const page = await openStory(engine, 'agent')
    await startRun(page)
    await expectPage(approval(page)).toBeVisible()
    expect(await axeViolations(page)).toEqual([])
    await page.context().close()
  })
})
