import type { Page } from '@playwright/test'

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const axeScriptPath = require.resolve('axe-core/axe.min.js') as string

interface AxeNodeResult {
  html: string
  target: string[]
}

interface AxeViolation {
  id: string
  impact: string | null
  help: string
  helpUrl: string
  nodes: AxeNodeResult[]
}

interface AxeResults {
  violations: AxeViolation[]
}

interface AxeRunOptions {
  include?: string
}

interface AxeGlobal {
  run: (context: Element | Document) => Promise<AxeResults>
}

declare global {
  interface Window {
    axe?: AxeGlobal
  }
}

async function ensureAxe(page: Page): Promise<void> {
  if (await page.evaluate(() => Boolean(window.axe))) return

  await page.addScriptTag({ path: axeScriptPath })
}

export async function expectNoAccessibilityViolations(
  page: Page,
  options: AxeRunOptions = {},
): Promise<void> {
  await ensureAxe(page)

  const result = await page.evaluate(async ({ include }) => {
    if (!window.axe) throw new Error('axe-core failed to load')

    const root = include
      ? document.querySelector(include)
      : document.documentElement

    if (!root) throw new Error(`Accessibility scope not found: ${include}`)

    return window.axe.run(root)
  }, options)

  if (result.violations.length === 0) return

  const details = result.violations
    .map(violation => {
      const nodes = violation.nodes
        .map(node => `${node.target.join(', ')} (${node.html})`)
        .join('; ')

      return `${violation.id} [${violation.impact ?? 'unknown'}]: ${violation.help} (${violation.helpUrl}) - ${nodes}`
    })
    .join('\n')

  throw new Error(`Accessibility violations:\n${details}`)
}
