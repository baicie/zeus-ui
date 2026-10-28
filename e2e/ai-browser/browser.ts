/**
 * Playwright helpers for the AI Headless V2 browser stories.
 */

import type { Browser, BrowserType, Page } from '@playwright/test'

import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { chromium, firefox, webkit } from '@playwright/test'
import { afterAll } from 'vitest'
import { AI_E2E_PORT } from './setup'

const require = createRequire(import.meta.url)
const axeScript = require.resolve('axe-core/axe.min.js') as string

export const BASE_URL = `http://127.0.0.1:${AI_E2E_PORT}/?fast`

const ENGINES: Record<string, BrowserType> = { chromium, firefox, webkit }

/** Engines to run; `AI_E2E_BROWSERS=chromium` narrows it locally. */
export const BROWSERS = (
  process.env.AI_E2E_BROWSERS ?? 'chromium,firefox,webkit'
)
  .split(',')
  .map(name => name.trim())
  .filter(name => name in ENGINES)

const launched = new Map<string, Promise<Browser>>()

const CACHE = join(homedir(), 'Library', 'Caches', 'ms-playwright')
const FALLBACK_BINARIES: Record<string, (dir: string) => string> = {
  chromium: dir =>
    join(
      dir,
      'chrome-mac-arm64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing',
    ),
  firefox: dir =>
    join(dir, 'firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'),
  webkit: dir => join(dir, 'pw_run.sh'),
}

/**
 * The repo pins Playwright; when its exact browser build is not installed
 * (offline machines), use another installed build of the same engine.
 */
function executableFor(engine: string): string | undefined {
  if (engine === 'chromium' && process.env.AI_E2E_CHROMIUM_PATH)
    return process.env.AI_E2E_CHROMIUM_PATH
  if (existsSync(ENGINES[engine].executablePath())) return undefined
  if (!existsSync(CACHE)) return undefined
  const prefix = engine === 'chromium' ? 'chromium-' : `${engine}-`
  for (const entry of readdirSync(CACHE)
    .filter(name => name.startsWith(prefix))
    .sort()
    .reverse()) {
    const candidate = FALLBACK_BINARIES[engine](join(CACHE, entry))
    if (existsSync(candidate)) {
      process.stderr.write(
        `[ai-e2e] ${engine}: pinned build missing, using ${entry}\n`,
      )
      return candidate
    }
  }
  return undefined
}

afterAll(async () => {
  for (const browser of launched.values()) await (await browser).close()
  launched.clear()
})

export async function openStory(engine: string, route: string): Promise<Page> {
  let browser = launched.get(engine)
  if (!browser) {
    browser = ENGINES[engine].launch({
      headless: process.env.AI_E2E_HEADLESS !== 'false',
      executablePath: executableFor(engine),
    })
    launched.set(engine, browser)
  }
  const context = await (
    await browser
  ).newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  ;(page as Page & { errors: string[] }).errors = errors
  await page.goto(`${BASE_URL}#/${route}`)
  return page
}

export function pageErrors(page: Page): string[] {
  return (page as Page & { errors: string[] }).errors
}

export async function axeViolations(
  page: Page,
  selector = 'main',
): Promise<{ id: string; nodes: string[] }[]> {
  await page.addScriptTag({ path: axeScript })
  return page.evaluate(async scope => {
    const axe = (
      window as unknown as {
        axe: {
          run: (root: Element) => Promise<{
            violations: { id: string; nodes: { html: string }[] }[]
          }>
        }
      }
    ).axe
    const result = await axe.run(document.querySelector(scope)!)
    return result.violations.map(violation => ({
      id: violation.id,
      nodes: violation.nodes.slice(0, 3).map(node => node.html),
    }))
  }, selector)
}

/** Commands the demo host received, for idempotency assertions. */
interface DemoWindow {
  __aiDemo: {
    host: { commands: () => { type: string; idempotencyKey: string }[] }
  }
}

export function hostCommands(
  page: Page,
): Promise<{ type: string; idempotencyKey: string }[]> {
  return page.evaluate(() => {
    const commands = (window as unknown as DemoWindow).__aiDemo.host.commands()
    return commands.map(({ type, idempotencyKey }) => ({
      type,
      idempotencyKey,
    }))
  })
}
