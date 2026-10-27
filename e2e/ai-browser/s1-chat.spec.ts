/**
 * AI2-211 · S1 chat story in real browsers (Chromium, Firefox, WebKit):
 * @ context, IME guard, streaming, stop, regenerate / branch navigation,
 * reconnect without duplicates, scroll follow, accessibility.
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

function composer(page: Page) {
  return page.getByRole('textbox', { name: 'Ask the assistant' })
}

function message(page: Page, index: number) {
  return articles(page).nth(index).locator('[data-zw-ai="message"]')
}

async function send(page: Page, text: string): Promise<void> {
  const input = composer(page)
  await input.fill(text)
  await input.press('Enter')
}

function articles(page: Page) {
  return page.locator('[role="feed"] [role="article"]')
}

describe.each(BROWSERS)('s1 chat · %s', engine => {
  it('picks @ context with the keyboard, then sends and streams an answer', async () => {
    const page = await openStory(engine, 'chat')
    const input = composer(page)

    await input.click()
    await input.pressSequentially('Explain @ma')
    await expectPage(
      page.getByRole('listbox', { name: 'Add context' }),
    ).toBeVisible()
    await expectPage(input).toHaveAttribute('aria-haspopup', 'listbox')
    await input.press('Enter')
    await expectPage(input).toHaveValue('Explain @math.ts ')
    expect(
      (await hostCommands(page)).filter(
        command => command.type === 'message.send',
      ),
    ).toHaveLength(0)

    await input.pressSequentially('please')
    await input.press('Enter')
    await expectPage(articles(page)).toHaveCount(2)
    await expectPage(articles(page).nth(1)).toContainText('unified diff')
    await expectPage(page.locator('[role="feed"]')).toHaveAttribute(
      'aria-busy',
      'false',
    )
    await expectPage(input).toHaveValue('')
    // Markdown rendered as elements, code kept as text.
    await expectPage(articles(page).nth(1).locator('strong')).toHaveText(
      'unified diff',
    )
    await expectPage(articles(page).nth(1).locator('pre code')).toContainText(
      '+const y = 3',
    )
    expect(pageErrors(page), pageErrors(page).join('\n')).toEqual([])
    await page.context().close()
  })

  it('does not send while an input method is composing', async () => {
    const page = await openStory(engine, 'chat')
    const input = composer(page)
    await input.fill('ni hao')
    await input.evaluate(element => {
      element.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true }),
      )
      element.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
          isComposing: true,
        }),
      )
    })
    await page.waitForTimeout(100)
    expect(
      (await hostCommands(page)).filter(
        command => command.type === 'message.send',
      ),
    ).toEqual([])
    await expectPage(input).toHaveValue('ni hao')
    await page.context().close()
  })

  it('stops a streaming answer through the host', async () => {
    const page = await openStory(engine, 'chat')
    await page.evaluate(() => {
      ;(
        window as unknown as { __aiDemo: { host: { tokenDelay: number } } }
      ).__aiDemo.host.tokenDelay = 150
    })
    await send(page, 'Tell me about streaming')
    const stop = page.locator('[data-action="cancel"]')
    await stop.click()

    await expectPage(
      page.locator('[data-zw-ai="execution-status"]'),
    ).toContainText('Cancelled')
    await expectPage(message(page, 1)).toHaveAttribute(
      'data-status',
      'cancelled',
    )
    expect(
      (await hostCommands(page)).filter(
        command => command.type === 'execution.cancel',
      ),
    ).toHaveLength(1)
    await page.context().close()
  })

  it('regenerates into a new branch and navigates between versions', async () => {
    const page = await openStory(engine, 'chat')
    await send(page, 'First question')
    await expectPage(message(page, 1)).toHaveAttribute(
      'data-status',
      'complete',
    )

    await articles(page)
      .nth(1)
      .getByRole('button', { name: 'Regenerate' })
      .click()
    await expectPage(articles(page).nth(1)).toContainText('Version 2 of 2')
    await expectPage(articles(page).nth(1)).toContainText(
      'Streaming keeps the message readable',
    )

    await articles(page)
      .nth(1)
      .getByRole('button', { name: 'Previous version' })
      .click()
    await expectPage(articles(page).nth(1)).toContainText('Version 1 of 2')
    await expectPage(articles(page).nth(1)).toContainText('unified diff')
    expect(
      (await hostCommands(page)).filter(
        command => command.type === 'execution.retry',
      ),
    ).toHaveLength(1)
    await page.context().close()
  })

  it('reconnects after a dropped connection without duplicating messages', async () => {
    const page = await openStory(engine, 'chat')
    await send(page, 'Before the drop')
    await expectPage(articles(page)).toHaveCount(2)

    await page.getByRole('button', { name: 'Drop connection' }).click()
    await expectPage(page.locator('.connection')).not.toHaveText('live')
    // The session resubscribes from its cursor; the next events bring it live.
    await send(page, 'After the drop')
    await expectPage(page.locator('.connection')).toHaveText('live', {
      timeout: 10_000,
    })

    await expectPage(articles(page)).toHaveCount(4)
    await expectPage(message(page, 3)).toHaveAttribute(
      'data-status',
      'complete',
    )
    const ids = await articles(page).evaluateAll(nodes =>
      nodes.map(node => node.getAttribute('data-message-id')),
    )
    expect(new Set(ids).size).toBe(ids.length)
    await page.context().close()
  })

  it('has no axe violations', async () => {
    const page = await openStory(engine, 'chat')
    await send(page, 'Accessibility check')
    await expectPage(articles(page)).toHaveCount(2)
    expect(await axeViolations(page)).toEqual([])
    await page.context().close()
  })
})

describe('s1 chat · scroll follow (chromium)', () => {
  it('does not steal the scroll position while the user reads history', async () => {
    const page = await openStory('chromium', 'chat')
    for (let index = 0; index < 5; index += 1) {
      await send(page, `Question ${index}`)
      await expectPage(articles(page)).toHaveCount((index + 1) * 2)
    }
    const scroller = page.locator('[data-part="scroller"]')
    await scroller.evaluate(element => element.scrollTo({ top: 0 }))
    await page.mouse.wheel(0, -200)
    await page.waitForTimeout(100)

    await send(page, 'While reading')
    await expectPage(articles(page)).toHaveCount(12)
    expect(await scroller.evaluate(element => element.scrollTop)).toBe(0)
    const jump = page.getByRole('button', { name: /Jump to latest/ })
    await expectPage(jump).toBeVisible()

    await jump.click()
    await expectPage
      .poll(() =>
        scroller.evaluate(
          element =>
            element.scrollHeight - element.clientHeight - element.scrollTop,
        ),
      )
      .toBeLessThan(2)
    await page.context().close()
  })
})
