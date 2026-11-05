import type { BrowserType } from '@playwright/test'

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { chromium, firefox, webkit } from '@playwright/test'
import { afterAll, describe, expect, it, onTestFailed } from 'vitest'

const fixtureUrl = 'http://127.0.0.1:5177/'

const browsers: Array<{ name: string; engine: BrowserType }> = [
  { name: 'chromium', engine: chromium },
  { name: 'firefox', engine: firefox },
  { name: 'webkit', engine: webkit },
]

const runningBrowsers: Array<Awaited<ReturnType<BrowserType['launch']>>> = []
const report: Array<{ browser: string; status: string; error?: string }> = []

function writeReport(): void {
  const output = path.resolve('temp/data-grid-framework-e2e')
  mkdirSync(output, { recursive: true })
  writeFileSync(
    path.join(output, 'report.json'),
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: process.cwd(),
          encoding: 'utf8',
        }).trim(),
        results: report,
        passed:
          report.length === browsers.length &&
          report.every(entry => entry.status === 'passed'),
      },
      null,
      2,
    )}\n`,
  )
}

afterAll(async () => {
  await Promise.all(runningBrowsers.map(browser => browser.close()))
  writeReport()
})

describe.each(browsers)(
  '$name DataGrid framework renderer browser fixture',
  ({ name, engine }) => {
    it('updates keyed cells, clears framework roots on disconnect, and reconnects', async () => {
      let failure: string | undefined
      onTestFailed(error => {
        failure = String(error)
      })
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
        try {
          await page.close()
        } finally {
          if (failure)
            report.push({ browser: name, status: 'failed', error: failure })
          else report.push({ browser: name, status: 'passed' })
        }
      }
    })
  },
)
