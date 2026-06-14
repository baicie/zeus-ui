import type { Browser, BrowserContext, Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
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

export const advancedShowcaseTarget: ShowcaseTarget = {
  name: 'advanced',
  baseURL: 'http://127.0.0.1:5176',
}

export type ShowcasePageCallback<T> = (
  page: Page,
  context: BrowserContext,
) => Promise<T>

let browserPromise: Promise<Browser> | undefined
let artifactCounter = 0

function shouldRunHeadless(): boolean {
  return process.env.SHOWCASE_E2E_HEADLESS !== 'false'
}

function shouldRecordArtifacts(): boolean {
  return (
    process.env.CI === 'true' || process.env.SHOWCASE_E2E_ARTIFACTS === 'true'
  )
}

function getBrowserChannel(): string | undefined {
  return process.env.SHOWCASE_E2E_BROWSER_CHANNEL || undefined
}

function getLaunchOptions(): Parameters<typeof chromium.launch>[0] {
  const channel = getBrowserChannel()
  const options: Parameters<typeof chromium.launch>[0] = {
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

function toSafeFileName(value: string): string {
  return value.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')
}

function createArtifactPrefix(target: ShowcaseTarget): string {
  artifactCounter += 1

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${timestamp}-${artifactCounter}-${toSafeFileName(target.name)}`
}

async function ensureArtifactDir(): Promise<string> {
  const artifactDir = resolve(process.cwd(), 'e2e/showcase/.artifacts')
  await mkdir(artifactDir, {
    recursive: true,
  })

  return artifactDir
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
  return getBrowser().then(async browser => {
    const context = await browser.newContext({
      baseURL: target.baseURL,
      viewport: {
        width: 1280,
        height: 720,
      },
    })

    const shouldTrace = shouldRecordArtifacts()
    let traceStopped = false

    if (shouldTrace) {
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      })
    }

    const page = await context.newPage()

    try {
      const result = await callback(page, context)

      if (shouldTrace) {
        await context.tracing.stop()
        traceStopped = true
      }

      return result
    } catch (error) {
      if (shouldTrace) {
        const artifactDir = await ensureArtifactDir()
        const artifactPrefix = createArtifactPrefix(target)

        await page
          .screenshot({
            path: resolve(artifactDir, `${artifactPrefix}.png`),
            fullPage: true,
          })
          .catch(() => {})

        await context.tracing
          .stop({
            path: resolve(artifactDir, `${artifactPrefix}.trace.zip`),
          })
          .then(() => {
            traceStopped = true
          })
          .catch(() => {})
      }

      throw error
    } finally {
      if (shouldTrace && !traceStopped) {
        await context.tracing.stop().catch(() => {})
      }

      await context.close()
    }
  })
}
