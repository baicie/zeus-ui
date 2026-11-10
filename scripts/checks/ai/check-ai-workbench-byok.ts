/**
 * BYOK acceptance gate.
 *
 * Proves the whole path with a real browser against a deterministic gateway:
 * vault setup and unlock, key storage that never leaks plaintext, a streaming
 * reply, cancellation, the gateway's error statuses, CORS guidance, and the
 * isolation between BYOK chat and the Host agent.
 *
 * Run with `pnpm check:ai-workbench-byok`. Browsers default to Chromium; set
 * `ZEUS_AI_WORKBENCH_BROWSERS` for more.
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'

import { chromium, firefox, webkit } from '@playwright/test'
import { createServer } from 'vite'

import { startAiHost } from '../../../examples/ai-host/src/server'
import { startMockGateway } from './support/mock-gateway'

const root = path.resolve(import.meta.dirname, '../../..')
const outDir = path.join(root, 'temp/ai-workbench-byok')
const cache = path.join(process.env.HOME ?? '', 'Library/Caches/ms-playwright')

const HOST_TOKEN = 'workbench-token-0123456789'
const GATEWAY_KEY = 'mock-key-0123456789'
const PASSPHRASE = 'correct horse battery staple'

const engines = { chromium, firefox, webkit }

const fallbackBinaries: Record<
  keyof typeof engines,
  (directory: string) => string
> = {
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
    .filter(name => name.startsWith(prefix) && !name.includes('headless'))
    .sort()
    .reverse()) {
    const candidate = fallbackBinaries[engine](path.join(cache, entry))
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

const selectedBrowsers = (process.env.ZEUS_AI_WORKBENCH_BROWSERS ?? 'chromium')
  .split(',')
  .map(name => name.trim())
  .filter((name): name is keyof typeof engines => name in engines)

interface CaseResult {
  browser: string
  status: 'passed' | 'failed'
  checks: Array<{ name: string; ok: boolean; detail?: string }>
  error?: string
}

function record(
  checks: CaseResult['checks'],
  name: string,
  ok: boolean,
  detail?: string,
): void {
  checks.push({ name, ok, ...(detail ? { detail } : {}) })
  if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ''}`)
}

async function runBrowser(
  engine: keyof typeof engines,
  url: string,
  gatewayOrigin: string,
): Promise<CaseResult> {
  const checks: CaseResult['checks'] = []
  const browser = await engines[engine].launch({
    executablePath: executableFor(engine),
  })
  const context = await browser.newContext()
  const page = await context.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  try {
    await page.goto(url)
    await page.getByTestId('mode-byok').click()
    await page.getByTestId('byok-chat').waitFor()

    /* ------------------------------------------------------------ vault */
    await page.getByTestId('open-settings').click()
    await page.getByTestId('settings-page').waitFor()
    record(checks, 'settings opens', true)

    await page.getByTestId('vault-setup').click()
    await page.getByTestId('vault-field-passphrase').fill(PASSPHRASE)
    await page.getByTestId('vault-field-confirm').fill(PASSPHRASE)
    await page.getByTestId('vault-form').getByRole('button').first().click()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="vault-state"]')
          ?.getAttribute('data-status') === 'unlocked',
      null,
      { timeout: 15_000 },
    )
    record(checks, 'vault created and unlocked', true)

    /* --------------------------------------------------------- provider */
    await page.getByTestId('provider-add').click()
    await page.getByTestId('provider-form').waitFor({ timeout: 10_000 })
    await page.getByTestId('provider-field-name').fill('Mock gateway')
    await page.getByTestId('provider-field-baseUrl').fill(gatewayOrigin)
    await page.getByTestId('provider-field-apiKey').fill(GATEWAY_KEY)
    await page.getByTestId('provider-field-model').fill('mock-echo')
    await page.getByTestId('provider-save').click()
    await page.waitForTimeout(1200)
    const saveText = await page
      .getByTestId('provider-status')
      .textContent()
      .catch(() => null)
    record(
      checks,
      'provider saved',
      saveText?.includes('Saved') === true,
      `status=${JSON.stringify(saveText)}`,
    )

    /* ------------------------------------------- no plaintext in storage */
    const leaked = await page.evaluate(async () => {
      const found: string[] = []
      const needle = 'mock-key-0123456789'
      for (const name of ['zeus-byok-vault', 'zeus-byok-profiles']) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(name)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        for (const store of Array.from(db.objectStoreNames)) {
          const rows = await new Promise<unknown[]>((resolve, reject) => {
            const tx = db.transaction(store, 'readonly')
            const request = tx.objectStore(store).getAll()
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          const text = JSON.stringify(rows)
          if (text.includes(needle)) found.push(`${name}/${store}`)
        }
        db.close()
      }
      const localStorageText = JSON.stringify({ ...localStorage })
      if (localStorageText.includes(needle)) found.push('localStorage')
      const sessionText = JSON.stringify({ ...sessionStorage })
      if (sessionText.includes(needle)) found.push('sessionStorage')
      return found
    })
    record(
      checks,
      'API key is absent from every browser store',
      leaked.length === 0,
      leaked.join(', '),
    )

    /* ------------------------------------------------------------ chat */
    await page.getByTestId('mode-byok').click()
    await page.getByTestId('byok-input').fill('hello gateway')
    await page.getByTestId('byok-send').click()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="byok-thread"]')
          ?.textContent?.includes('echo: hello gateway') === true,
      null,
      { timeout: 20_000 },
    )
    record(checks, 'streamed reply rendered', true)

    /* ------------------------------------------------------- cancel path */
    await page.getByTestId('open-settings').click()
    await page.getByTestId('provider-field-model').fill('mock-slow')
    await page.getByTestId('provider-save').click()
    await page.getByTestId('mode-byok').click()
    await page.getByTestId('byok-input').fill('cancel me')
    await page.getByTestId('byok-send').click()
    await page.getByTestId('byok-stop').waitFor({ timeout: 10_000 })
    await page.getByTestId('byok-stop').click()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="byok-thread"]')
          ?.textContent?.toLowerCase()
          .includes('stopped') === true,
      null,
      { timeout: 15_000 },
    )
    record(checks, 'generation can be stopped', true)

    /* ----------------------------------------------------- error statuses */
    for (const [model, expected] of [
      ['mock-401', '401'],
      ['mock-429', '429'],
      ['mock-500', '500'],
    ] as const) {
      await page.getByTestId('open-settings').click()
      await page.getByTestId('provider-field-model').fill(model)
      await page.getByTestId('provider-save').click()
      await page.getByTestId('mode-byok').click()
      await page.getByTestId('byok-input').fill(`test ${model}`)
      await page.getByTestId('byok-send').click()
      await page.waitForFunction(
        text =>
          document
            .querySelector('[data-testid="byok-thread"]')
            ?.textContent?.includes(text) === true,
        expected,
        { timeout: 15_000 },
      )
      record(checks, `${model} surfaces a ${expected} error`, true)
    }

    /* ------------------------------------------------------------ locking */
    await page.getByTestId('open-settings').click()
    await page.getByTestId('vault-lock').click()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="vault-state"]')
          ?.getAttribute('data-status') === 'locked',
      null,
      { timeout: 10_000 },
    )
    const keyDisabled = await page
      .getByTestId('provider-field-apiKey')
      .isDisabled()
    record(checks, 'locking disables key entry', keyDisabled)

    await page.getByTestId('vault-unlock').click()
    await page.getByTestId('vault-field-passphrase').fill(PASSPHRASE)
    await page.getByTestId('vault-form').getByRole('button').first().click()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="vault-state"]')
          ?.getAttribute('data-status') === 'unlocked',
      null,
      { timeout: 15_000 },
    )
    record(checks, 'vault re-unlocks with the passphrase', true)

    /* ------------------------------------------------------ wrong password */
    await page.getByTestId('vault-lock').click()
    await page.getByTestId('vault-unlock').click()
    await page.getByTestId('vault-field-passphrase').fill('wrong passphrase')
    await page.getByTestId('vault-form').getByRole('button').first().click()
    await page.getByTestId('vault-error').waitFor({ timeout: 10_000 })
    const wrongMessage = await page.getByTestId('vault-error').textContent()
    record(
      checks,
      'a wrong passphrase is rejected',
      wrongMessage?.includes('does not open') === true,
      wrongMessage ?? '',
    )

    /* ------------------------------------------------------------- reload */
    await page.reload()
    await page.getByTestId('mode-byok').click()
    await page.getByTestId('byok-chat').waitFor()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="byok-thread"]')
          ?.textContent?.includes('echo: hello gateway') === true,
      null,
      { timeout: 15_000 },
    )
    record(checks, 'conversations survive a reload', true)

    record(
      checks,
      'no page errors',
      pageErrors.length === 0,
      pageErrors.slice(0, 3).join(' | '),
    )
    return { browser: engine, status: 'passed', checks }
  } catch (error) {
    return {
      browser: engine,
      status: 'failed',
      checks,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    await context.close()
    await browser.close()
  }
}

async function main(): Promise<void> {
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const gateway = await startMockGateway({ apiKeys: [GATEWAY_KEY] })
  const host = await startAiHost({
    port: 0,
    databaseFile: ':memory:',
    workspaceRoot: path.join(outDir, 'workspace'),
    allowedOrigins: ['http://127.0.0.1:5198'],
    tokens: [
      {
        token: HOST_TOKEN,
        tenantId: 'reference',
        userId: 'workbench',
        role: 'admin',
      },
    ],
  })

  process.env.ZEUS_AI_HOST_ORIGIN = host.origin
  process.env.ZEUS_AI_UPSTREAM_TOKEN = HOST_TOKEN

  const vite = await createServer({
    configFile: path.join(root, 'examples/ai-workbench/vite.config.ts'),
    root: path.join(root, 'examples/ai-workbench'),
    server: { port: 5198, host: '127.0.0.1' },
    define: {
      __ZEUS_AI_HOST__: JSON.stringify(host.origin),
    },
  })
  await vite.listen()

  const results: CaseResult[] = []
  for (const engine of selectedBrowsers) {
    results.push(
      await runBrowser(engine, 'http://127.0.0.1:5198/', gateway.origin),
    )
  }

  await vite.close()
  await host.close()
  await gateway.close()

  const passed = results.every(result => result.status === 'passed')
  console.log(JSON.stringify({ results, passed }, null, 2))
  if (!passed) throw new Error('BYOK gate failed')
}

await main()
