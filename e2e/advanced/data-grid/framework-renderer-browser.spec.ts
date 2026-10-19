import type { BrowserType } from '@playwright/test'

import { chromium, firefox, webkit } from '@playwright/test'
import { afterAll, describe, expect, it } from 'vitest'

const fixtureUrl = 'http://127.0.0.1:5177/'

const browsers: Array<{ name: string; engine: BrowserType }> = [
  { name: 'chromium', engine: chromium },
  { name: 'firefox', engine: firefox },
  { name: 'webkit', engine: webkit },
]

const runningBrowsers: Array<Awaited<ReturnType<BrowserType['launch']>>> = []

afterAll(async () => {
  await Promise.all(runningBrowsers.map(browser => browser.close()))
})

describe.each(browsers)(
  '$name DataGrid framework renderer browser fixture',
  ({ engine }) => {
    it('updates keyed cells, clears framework roots on disconnect, and reconnects', async () => {
      const browser = await engine.launch({ headless: true })
      runningBrowsers.push(browser)
      const page = await browser.newPage()

      try {
        await page.goto(fixtureUrl)
        await page.locator('[data-renderer="react"]').waitFor()
        await page.locator('[data-renderer="vue"]').waitFor()

        const initial = await page.evaluate(() =>
          window.__dataGridFixture.snapshot(),
        )
        expect(initial).toMatchObject({
          hostConnected: true,
          reactText: 'Ada',
          vueText: 'Ada',
          portalText: 'portal:Ada',
          teleportText: 'teleport:Ada',
          externalTargetExists: true,
          externalSentinelCount: 1,
          reactMounted: 1,
          vueMounted: 1,
        })

        const updated = await page.evaluate(() =>
          window.__dataGridFixture.update('Grace'),
        )
        expect(updated).toMatchObject({
          reactText: 'Grace',
          vueText: 'Grace',
          portalText: 'portal:Grace',
          teleportText: 'teleport:Grace',
          sameReactButton: true,
          sameVueButton: true,
          externalSentinelCount: 1,
        })

        await page.evaluate(() => window.__dataGridFixture.disconnect())
        await page.waitForFunction(
          () => !window.__dataGridFixture.snapshot().hostConnected,
        )
        const disconnected = await page.evaluate(() =>
          window.__dataGridFixture.snapshot(),
        )
        expect(disconnected).toMatchObject({
          hostConnected: false,
          reactDisposed: 1,
          vueDisposed: 1,
          externalTargetExists: true,
          externalSentinelCount: 1,
          portalText: '',
          teleportText: '',
        })

        await page.evaluate(() => window.__dataGridFixture.reconnect())
        await page.locator('[data-renderer="react"]').waitFor()
        const reconnected = await page.evaluate(() =>
          window.__dataGridFixture.snapshot(),
        )
        expect(reconnected).toMatchObject({
          hostConnected: true,
          reactText: 'Grace',
          vueText: 'Grace',
          portalText: 'portal:Grace',
          teleportText: 'teleport:Grace',
          externalTargetExists: true,
          externalSentinelCount: 1,
          reactMounted: 2,
          vueMounted: 2,
          reactDisposed: 1,
          vueDisposed: 1,
        })
      } finally {
        await page.close()
      }
    })
  },
)
