import { chromium } from '@playwright/test'
import { describe, expect, it } from 'vitest'

const BENCHMARK_URL = 'http://127.0.0.1:5177'

describe('web-c instance benchmark infrastructure', () => {
  it('runs a benchmark page in Chromium', () => {
    return chromium.launch({ headless: true }).then(browser => {
      return browser
        .newPage()
        .then(page => {
          return page
            .goto(BENCHMARK_URL)
            .then(() =>
              page.waitForFunction(() => {
                return (
                  globalThis.document.body.dataset.benchmarkReady === 'true'
                )
              }),
            )
            .then(() =>
              page.locator('body').getAttribute('data-benchmark-ready'),
            )
            .then(value => expect(value).toBe('true'))
        })
        .finally(() => browser.close())
    })
  })
})
