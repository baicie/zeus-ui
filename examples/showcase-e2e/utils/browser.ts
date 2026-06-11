import type {
  Browser,
  BrowserContext,
  BrowserTypeLaunchOptions,
  Page,
} from '@playwright/test'
import process from 'node:process'
import { chromium } from '@playwright/test'
import { afterAll } from 'vitest'

export interface ShowcaseTarget {
  name: string
  baseURL: string
}

export const showcaseTargets: ShowcaseTarget[] = [
  {
    name: 'react',
    baseURL: 'http://127.0.0.1:5173',
  },
  {
    name: 'vue',
    baseURL: 'http://127.0.0.1:5174',
  },
]

export type ShowcasePageCallback<T> = (
  page: Page,
  context: BrowserContext,
) => Promise<T>

let browserPromise: Promise<Browser> | undefined

function shouldRunHeadless(): boolean {
  return process.env.SHOWCASE_E2E_HEADLESS !== 'false'
}

function getBrowserChannel(): string | undefined {
  return process.env.SHOWCASE_E2E_BROWSER_CHANNEL || undefined
}

function getLaunchOptions(): BrowserTypeLaunchOptions {
  const channel = getBrowserChannel()
  const options: BrowserTypeLaunchOptions = {
    headless: shouldRunHeadless(),
  }

  if (channel) {
    options.channel = channel
  }

  return options
}

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch(getLaunchOptions())
  }

  return browserPromise
}

afterAll(() => {
  if (!browserPromise) {
    return Promise.resolve()
  }

  return browserPromise
    .then(browser => browser.close())
    .then(() => {
      browserPromise = undefined
    })
})

export function withShowcasePage<T>(
  target: ShowcaseTarget,
  callback: ShowcasePageCallback<T>,
): Promise<T> {
  return getBrowser().then(browser =>
    browser
      .newContext({
        baseURL: target.baseURL,
        viewport: {
          width: 1280,
          height: 720,
        },
      })
      .then(context =>
        context
          .newPage()
          .then(page => callback(page, context).finally(() => context.close())),
      ),
  )
}
