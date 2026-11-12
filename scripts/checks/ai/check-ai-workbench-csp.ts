import type { Page } from '@playwright/test'
/**
 * Proves the workbench reports a Content-Security-Policy block as what it is.
 *
 * A blocked `fetch` and a CORS rejection both surface as a `TypeError`, so the
 * obvious implementation guesses — and the guess is usually "CORS", which sends
 * the reader to fix the gateway when the deployment is the problem.
 *
 * This gate runs the page twice under the same policy the nginx template
 * renders:
 *
 *   strict   connect-src 'self'                → the request is blocked, and the
 *                                                message must name CSP
 *   opted-in connect-src 'self' <gateway>       → the request must succeed
 *
 * Run with `pnpm check:ai-workbench-csp`.
 */
import { existsSync, readdirSync } from 'node:fs'

import path from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

import { startMockGateway } from './support/mock-gateway'
import { selectMode } from './support/workbench-ui'

const root = path.resolve(import.meta.dirname, '../../..')
const GATEWAY_KEY = 'mock-key-0123456789'
const PASSPHRASE = 'correct horse battery staple'

/**
 * Playwright's bundled revision may not be downloaded on this machine, so fall
 * back to whatever Chromium the cache does hold. Returns undefined when the
 * recorded path is already valid, which lets Playwright use its default.
 */
function findChromium(): string | undefined {
  if (existsSync(chromium.executablePath())) return undefined
  const cache = path.join(
    process.env.HOME ?? '',
    'Library/Caches/ms-playwright',
  )
  if (!existsSync(cache)) return undefined
  for (const entry of readdirSync(cache)
    .filter(name => name.startsWith('chromium-') && !name.includes('headless'))
    .sort()
    .reverse()) {
    const candidate = path.join(
      cache,
      entry,
      'chrome-mac-arm64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing',
    )
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

interface Check {
  readonly name: string
  readonly ok: boolean
  readonly detail?: string
}

function assert(
  checks: Check[],
  name: string,
  ok: boolean,
  detail?: string,
): void {
  checks.push({ name, ok, ...(detail ? { detail } : {}) })
  if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ''}`)
}

/**
 * Injects a fixed policy into every response, the way the nginx template does.
 * `extra` is appended to `connect-src`.
 */
function cspPlugin(extra: string) {
  return {
    name: 'gate-csp',
    configureServer(server: {
      middlewares: {
        use: (
          handler: (
            request: unknown,
            response: { setHeader: (name: string, value: string) => void },
            next: () => void,
          ) => void,
        ) => void
      }
    }) {
      server.middlewares.use((_request, response, next) => {
        response.setHeader(
          'Content-Security-Policy',
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            `connect-src 'self' ws://127.0.0.1:*${extra ? ` ${extra}` : ''}`,
            "font-src 'self' data:",
            "object-src 'none'",
            "base-uri 'none'",
            "frame-ancestors 'none'",
          ].join('; '),
        )
        next()
      })
    },
  }
}

/** Configures the vault and one provider pointing at the mock gateway. */
async function configure(page: Page, gatewayOrigin: string): Promise<void> {
  await selectMode(page, 'byok')
  await page.getByTestId('byok-chat').waitFor({ timeout: 30_000 })
  await page.getByTestId('open-settings').click()
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
    { timeout: 20_000 },
  )
  await page.getByTestId('provider-add').click()
  await page.getByTestId('provider-form').waitFor()
  await page.getByTestId('provider-field-name').fill('Mock gateway')
  await page.getByTestId('provider-field-baseUrl').fill(gatewayOrigin)
  await page.getByTestId('provider-field-apiKey').fill(GATEWAY_KEY)
  await page.getByTestId('provider-field-model').fill('mock-echo')
  await page.getByTestId('provider-save').click()
  await page.waitForTimeout(800)
  await page.getByTestId('settings-back').click()
}

async function send(page: Page, text: string): Promise<void> {
  await page.getByTestId('byok-input').fill(text)
  await page.getByTestId('byok-send').click()
}

async function startVite(port: number, extra: string) {
  const vite = await createServer({
    configFile: path.join(root, 'examples/ai-workbench/vite.config.ts'),
    root: path.join(root, 'examples/ai-workbench'),
    plugins: [cspPlugin(extra)],
    server: { port, host: '127.0.0.1', strictPort: true },
  })
  await vite.listen()
  return vite
}

async function main(): Promise<void> {
  const gateway = await startMockGateway({ apiKeys: [GATEWAY_KEY] })
  const checks: Check[] = []

  const browser = await chromium.launch({ executablePath: findChromium() })

  try {
    /* ---------------------------------------------------- strict policy */
    const strict = await startVite(5240, '')
    const strictPage = await browser.newPage()
    await strictPage.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', event => {
        ;(window as unknown as { __csp: string[] }).__csp ??= []
        ;(window as unknown as { __csp: string[] }).__csp.push(
          (event as SecurityPolicyViolationEvent).violatedDirective,
        )
      })
    })
    await strictPage.goto('http://127.0.0.1:5240/')
    await configure(strictPage, gateway.origin)
    await send(strictPage, 'blocked by policy')
    // The error element always contains its Retry / Dismiss buttons, so a
    // non-empty `textContent` is true before anything failed. Wait for the
    // line to actually be shown, then read it.
    await strictPage.waitForFunction(
      () => {
        const line = document.querySelector<HTMLElement>(
          '[data-testid="byok-error"]',
        )
        return (
          line !== null && !line.hidden && line.textContent !== 'RetryDismiss'
        )
      },
      null,
      { timeout: 20_000 },
    )

    const blocked = (await strictPage.evaluate(`(() => {
      const el = document.querySelector('[data-testid="byok-error"]');
      return {
        message: el ? el.textContent : '',
        directives: window.__csp ?? [],
      };
    })()`)) as { message: string; directives: string[] }

    assert(
      checks,
      'the browser actually enforced connect-src',
      blocked.directives.includes('connect-src'),
      `${JSON.stringify(blocked.directives)} message=${blocked.message.slice(0, 200)}`,
    )
    assert(
      checks,
      'the message names Content-Security-Policy',
      /content-security-policy/i.test(blocked.message),
      blocked.message.slice(0, 160),
    )
    assert(
      checks,
      'the message does not blame CORS',
      !/cors/i.test(blocked.message),
      blocked.message.slice(0, 160),
    )
    assert(
      checks,
      'the message points at the operator',
      /operator/i.test(blocked.message),
      blocked.message.slice(0, 160),
    )
    await strictPage.close()
    await strict.close()

    /* ------------------------------------------------------ opted-in policy */
    const allowed = await startVite(5241, gateway.origin)
    const allowedPage = await browser.newPage()
    await allowedPage.goto('http://127.0.0.1:5241/')
    await configure(allowedPage, gateway.origin)
    await send(allowedPage, 'allowed by policy')
    await allowedPage.waitForFunction(
      () =>
        (
          document.querySelector('[data-testid="byok-thread"]')?.textContent ??
          ''
        ).includes('echo: allowed by policy'),
      null,
      { timeout: 20_000 },
    )
    // The error line keeps its Retry / Dismiss controls in the DOM even when
    // it is not shown, so "no error" is its hidden state, not empty text.
    const succeeded = await allowedPage.evaluate(
      () =>
        document.querySelector<HTMLElement>('[data-testid="byok-error"]')
          ?.hidden === true,
    )
    assert(
      checks,
      'the same request succeeds once the origin is allowed',
      succeeded === true,
    )
    await allowedPage.close()
    await allowed.close()

    console.log(JSON.stringify({ checks, passed: true }, null, 2))
  } finally {
    await browser.close()
    await gateway.close()
  }
}

await main()
