import type { Browser, Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import fs from 'node:fs/promises'
import { homedir } from 'node:os'

import path from 'node:path'
import process from 'node:process'
import { chromium, expect, firefox, webkit } from '@playwright/test'
import { createServer } from 'vite'

import { expectNoAccessibilityViolations } from '../../../e2e/showcase/utils/accessibility'
import { startAiHost } from '../../../examples/ai-host/src/server'

const root = path.resolve(import.meta.dirname, '../../..')
const output = path.join(root, 'temp/ai-workbench')
const engines = { chromium, firefox, webkit }
const browserNames = (
  process.env.ZEUS_AI_WORKBENCH_BROWSERS ?? 'chromium,firefox,webkit'
).split(',')
const port = 5196
const hostPort = 5197
const cache = path.join(homedir(), 'Library', 'Caches', 'ms-playwright')
const fallbackBinaries: Record<string, (directory: string) => string> = {
  chromium: directory =>
    path.join(
      directory,
      'chrome-mac-arm64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing',
    ),
  firefox: directory =>
    path.join(
      directory,
      'firefox',
      'Nightly.app',
      'Contents',
      'MacOS',
      'firefox',
    ),
  webkit: directory => path.join(directory, 'pw_run.sh'),
}

function executableFor(engine: keyof typeof engines): string | undefined {
  const browser = engines[engine]
  if (existsSync(browser.executablePath())) return undefined
  if (!existsSync(cache)) return undefined
  const prefix = engine === 'chromium' ? 'chromium-' : `${engine}-`
  for (const entry of readdirSync(cache)
    .filter(name => name.startsWith(prefix))
    .sort()
    .reverse()) {
    const candidate = fallbackBinaries[engine](path.join(cache, entry))
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

async function main(): Promise<void> {
  await fs.mkdir(output, { recursive: true })
  process.env.ZEUS_AI_HOST_ORIGIN = `http://127.0.0.1:${hostPort}`
  const dev = await createServer({
    root: path.join(root, 'examples/ai-workbench'),
    configFile: path.join(root, 'examples/ai-workbench/vite.config.ts'),
    server: { host: '127.0.0.1', port, strictPort: true },
    logLevel: 'warn',
  })
  const report: Array<{
    browser: string
    status: 'failed' | 'passed'
    error?: string
    pageErrors?: string[]
    body?: string
  }> = []

  try {
    await dev.listen()
    for (const name of browserNames) {
      const engine = engines[name as keyof typeof engines]
      if (!engine) throw new Error(`Unknown browser engine: ${name}`)
      const errors: string[] = []
      let browser: Browser | undefined
      let page: Page | undefined
      try {
        browser = await engine.launch({
          headless: true,
          executablePath: executableFor(name as keyof typeof engines),
        })
        page = await browser.newPage()
        page.on('pageerror', error => errors.push(error.message))
        page.on('console', message => {
          if (message.type() === 'error' || message.type() === 'warning') {
            console.log(
              `[ai-workbench:${name}] ${message.type()}`,
              message.text(),
            )
          }
        })
        await fs.rm(path.join(output, 'workspace'), {
          recursive: true,
          force: true,
        })
        const host = await startAiHost({
          databaseFile: ':memory:',
          workspaceRoot: path.join(output, 'workspace'),
          port: hostPort,
          hostname: '127.0.0.1',
          allowedOrigins: [`http://127.0.0.1:${port}`],
        })
        try {
          await page.goto(`http://127.0.0.1:${port}/`)
          await expect(page.getByTestId('connection')).toHaveText('live')
          await expectNoAccessibilityViolations(page)
          await page.setViewportSize({ width: 640, height: 900 })
          expect(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
            ),
          ).toBe(true)
          await expect(page.getByTestId('composer')).toBeVisible()
          await expect(page.getByTestId('propose-change')).toBeVisible()
          await page.setViewportSize({ width: 1280, height: 900 })
          const zoomEvidence = await page.evaluate(() => {
            document.documentElement.style.zoom = '2'
            const composer = document.querySelector<HTMLElement>(
              '[data-testid="composer"]',
            )
            const propose = document.querySelector<HTMLElement>(
              '[data-testid="propose-change"]',
            )
            const composerRect = composer?.getBoundingClientRect()
            const proposeRect = propose?.getBoundingClientRect()
            return {
              noDocumentOverflow:
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
              composerVisible: Boolean(
                composerRect &&
                composerRect.width > 0 &&
                composerRect.height > 0 &&
                composerRect.right <= document.documentElement.clientWidth + 1,
              ),
              proposeVisible: Boolean(
                proposeRect &&
                proposeRect.width > 0 &&
                proposeRect.height > 0 &&
                proposeRect.right <= document.documentElement.clientWidth + 1,
              ),
            }
          })
          expect(zoomEvidence).toEqual({
            noDocumentOverflow: true,
            composerVisible: true,
            proposeVisible: true,
          })
          await page.evaluate(() => {
            document.documentElement.style.zoom = ''
          })

          const input = page.locator('zw-ai-composer textarea')
          await input.fill(`Hello from ${name}`)
          await page.locator('zw-ai-composer button[aria-label="Send"]').click()
          await expect(page.locator('zw-ai-message-timeline')).toContainText(
            `Hello from ${name}`,
          )

          await page.getByTestId('propose-change').click()
          await expect(
            page.getByTestId('change-tree').getByText('workbench.txt'),
          ).toBeVisible()
          await expect(page.getByTestId('change-tree')).toContainText('+1')
          await expect(page.getByTestId('diff-viewer')).toContainText(
            'Approved through the Zeus Native Workbench',
          )
          await expect(
            page.locator('zw-ai-approval-prompt button[data-action="approve"]'),
          ).toBeVisible()
          await page
            .locator('zw-ai-approval-prompt button[data-action="approve"]')
            .click()
          await expect(page.getByTestId('approvals')).toHaveText(
            'No pending approvals',
          )
          const workspace = (await (
            await fetch(`${host.origin}/workspace`)
          ).json()) as { files: Array<{ path: string }> }
          expect(workspace.files.map(file => file.path)).toContain(
            'notes/workbench.txt',
          )
          await page.getByTestId('run-checks').click()
          await expect(page.getByTestId('test-report')).toContainText(
            '1 passed, 0 failed, 0 skipped',
          )
          await expect(page.getByTestId('test-report')).toContainText(
            'workspace contains notes/workbench.txt',
          )
          await expectNoAccessibilityViolations(page)

          await page.getByTestId('new-conversation').click()
          await expect(page.getByTestId('conversation-list')).toContainText(
            'Session 2',
          )
          await page.getByTestId('attach-file').setInputFiles({
            name: 'notes.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from(`Attachment from ${name}\n`),
          })
          await expect(page.getByTestId('attach-status')).toContainText(
            'notes.txt attached',
          )
          const attachmentInput = page.locator('zw-ai-composer textarea')
          await attachmentInput.fill(`Attachment message from ${name}`)
          await page.locator('zw-ai-composer button[aria-label="Send"]').click()
          await expect(page.locator('zw-ai-message-timeline')).toContainText(
            'notes.txt',
          )
          await page.getByTestId('new-conversation').click()
          await expect(page.getByTestId('conversation-list')).toContainText(
            'Session 3',
          )
          const secondInput = page.locator('zw-ai-composer textarea')
          await secondInput.fill(`Isolated session from ${name}`)
          await page.locator('zw-ai-composer button[aria-label="Send"]').click()
          await expect(page.locator('zw-ai-message-timeline')).toContainText(
            `Isolated session from ${name}`,
          )
          await page
            .getByTestId('conversation-list')
            .getByRole('button')
            .first()
            .click()
          await expect(page.locator('zw-ai-message-timeline')).toContainText(
            `Hello from ${name}`,
          )
          await expect(
            page.locator('zw-ai-message-timeline'),
          ).not.toContainText(`Isolated session from ${name}`)
          await expect(
            page.locator('zw-ai-message-timeline'),
          ).not.toContainText(`Attachment message from ${name}`)
          expect(errors).toEqual([])
          report.push({ browser: name, status: 'passed' })
          console.log(
            `[ai-workbench] ${name}: chat, SSE, approval and write passed`,
          )
        } finally {
          await host.close()
        }
      } catch (error) {
        report.push({
          browser: name,
          status: 'failed',
          error:
            error instanceof Error
              ? (error.stack ?? error.message)
              : String(error),
          pageErrors: errors,
          body: page
            ? ((await page.locator('body').textContent()) ?? '').slice(0, 2000)
            : '',
        })
      } finally {
        await browser?.close()
      }
    }
    await fs.writeFile(
      path.join(output, 'report.json'),
      `${JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: root,
            encoding: 'utf8',
          }).trim(),
          host: process.env.ZEUS_AI_HOST_ORIGIN,
          results: report,
          passed: report.every(result => result.status === 'passed'),
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    await dev.close()
  }

  if (report.some(result => result.status !== 'passed')) {
    throw new Error(`AI Workbench gate failed: ${JSON.stringify(report)}`)
  }
}

void main()
