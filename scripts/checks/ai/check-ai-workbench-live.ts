/**
 * Live gateway acceptance run (A4).
 *
 * The mock gate proves the client's wire handling; it cannot prove that a real
 * OpenAI-compatible gateway accepts this browser, this key and this model. This
 * script does the real thing through the product UI — vault, provider, model,
 * two turns, reload — and then checks that the key it used never left the
 * encrypted store.
 *
 * Credentials come from the environment and are never written by this script:
 *
 *   ZEUS_LIVE_BASE_URL   e.g. https://api.example.com/v1
 *   ZEUS_LIVE_API_KEY    a key you can rotate afterwards
 *   ZEUS_LIVE_MODEL      e.g. gpt-4o-mini
 *   ZEUS_LIVE_PASSPHRASE optional vault passphrase (default: random per run)
 *
 * With none of them set the run reports NOT_RUN and exits 0, so CI can call it
 * without secrets. With all three it runs and fails loudly on any broken step.
 *
 * Run: `pnpm check:ai-workbench-live`
 *
 * Notes that are not the script's business to hide:
 * - the browser calls the gateway directly, so the gateway must allow this
 *   page's origin (CORS). A gateway that does not will be reported as such.
 * - a gateway behind a corporate proxy or a private certificate needs the
 *   browser to trust it first.
 * - the key is visible to any script running on the page while the vault is
 *   unlocked; use a test key and rotate it afterwards.
 */
import type { Page } from '@playwright/test'
import type { EngineName } from './support/browsers'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import process from 'node:process'

import { createServer } from 'vite'
import { startAiHost } from '../../../examples/ai-host/src/server'
import { ENGINES, executableFor, requireBrowsers } from './support/browsers'
import { startMockGateway } from './support/mock-gateway'
import { expectSingleComposer, selectMode } from './support/workbench-ui'

const root = path.resolve(import.meta.dirname, '../../..')
const outDir = path.join(root, 'temp/ai-workbench-live')
const HOST_TOKEN = 'workbench-token-0123456789'
const WORKBENCH_PORT = 5211
const HOST_PORT = 5212

const engines = ENGINES

interface LiveConfig {
  readonly baseUrl: string
  readonly apiKey: string
  readonly model: string
  readonly passphrase: string
  readonly stream: boolean
  readonly label: string
}

interface Check {
  readonly name: string
  readonly ok: boolean
  readonly detail?: string
  /**
   * A real provider decides how fast it answers; a check that depends on the
   * answer still running is reported as skipped rather than failed when the
   * model finished first, and the deterministic mock gate covers it instead.
   */
  readonly skipped?: boolean
}

function record(
  checks: Check[],
  name: string,
  ok: boolean,
  detail?: string,
): void {
  checks.push({ name, ok, ...(detail ? { detail } : {}) })
  if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ''}`)
}

function readConfig(): LiveConfig | undefined {
  const baseUrl = process.env.ZEUS_LIVE_BASE_URL?.trim()
  const apiKey = process.env.ZEUS_LIVE_API_KEY?.trim()
  const model = process.env.ZEUS_LIVE_MODEL?.trim()
  if (!baseUrl && !apiKey && !model) return undefined
  if (!baseUrl || !apiKey || !model) {
    throw new Error(
      'Set all of ZEUS_LIVE_BASE_URL, ZEUS_LIVE_API_KEY and ZEUS_LIVE_MODEL (or none).',
    )
  }
  return {
    baseUrl,
    apiKey,
    model,
    passphrase:
      process.env.ZEUS_LIVE_PASSPHRASE?.trim() ||
      `live-${Math.random().toString(36).slice(2)}-passphrase`,
    stream: process.env.ZEUS_LIVE_STREAM !== '0',
    label: process.env.ZEUS_LIVE_LABEL?.trim() || 'Live gateway',
  }
}

/** Configures vault + provider through the real settings page. */
async function configure(
  page: Page,
  config: LiveConfig,
  checks: Check[],
): Promise<void> {
  await selectMode(page, 'byok')
  await page.getByTestId('byok-chat').waitFor({ timeout: 30_000 })
  await page.getByTestId('open-settings').click()
  await page.getByTestId('vault-setup').click()
  await page.getByTestId('vault-field-passphrase').fill(config.passphrase)
  await page.getByTestId('vault-field-confirm').fill(config.passphrase)
  await page.getByTestId('vault-form').getByRole('button').first().click()
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="vault-state"]')
        ?.getAttribute('data-status') === 'unlocked',
    null,
    { timeout: 20_000 },
  )
  record(checks, 'vault created and unlocked', true)

  await page.getByTestId('provider-add').click()
  await page.getByTestId('provider-form').waitFor({ timeout: 10_000 })
  await page.getByTestId('provider-field-name').fill(config.label)
  await page.getByTestId('provider-field-baseUrl').fill(config.baseUrl)
  await page.getByTestId('provider-field-apiKey').fill(config.apiKey)
  await page.getByTestId('provider-field-model').fill(config.model)
  if (!config.stream) {
    await page.getByTestId('provider-field-stream').uncheck()
  }
  await page.getByTestId('provider-save').click()
  await page.waitForTimeout(800)
  const status = await page
    .getByTestId('provider-status')
    .textContent()
    .catch(() => null)
  record(
    checks,
    'provider saved',
    status?.includes('Saved') === true,
    `status=${JSON.stringify(status)}`,
  )

  // The connection test is the first real network call; it separates a wrong
  // URL/key/model from a chat-path problem before the user types anything.
  await page.getByTestId('provider-test').click()
  await page.waitForFunction(
    () => {
      const node = document.querySelector('[data-testid="provider-status"]')
      const text = node?.textContent ?? ''
      return (
        /Connected/i.test(text) ||
        /401|403|404|429|not found|rejected|blocked|timed out|rate limited/i.test(
          text,
        )
      )
    },
    null,
    { timeout: 60_000 },
  )
  const tested = (await page.getByTestId('provider-status').textContent()) ?? ''
  record(
    checks,
    'the gateway answers the connection test',
    /Connected/i.test(tested),
    tested.slice(0, 240),
  )
  await page.getByTestId('settings-back').click()
  await expectSingleComposer(page, 'byok')
}

interface LiveRequest {
  readonly path: string
  readonly messages?: Array<{ role: string; content: string }>
}

async function runBrowser(
  engine: EngineName,
  url: string,
  config: LiveConfig,
  /**
   * Requests the gateway actually received. Only the local mock exposes them;
   * against a real provider the context is proven by asking the model, because
   * nothing else can see what the provider was sent.
   */
  recorded?: LiveRequest[],
): Promise<{
  browser: string
  status: 'passed' | 'failed'
  checks: Check[]
  error?: string
}> {
  const checks: Check[] = []
  const browser = await engines[engine].launch({
    executablePath: executableFor(engine),
  })
  // No blanket Authorization header: it would also be sent to the gateway
  // under test and replace the vault key. The Host this run starts is only
  // here so the shell boots; it is not what is being accepted.
  const context = await browser.newContext()
  const page = await context.newPage()
  const pageErrors: string[] = []
  // A deliberate wrong-model probe is expected to fail; anything else from
  // the gateway is a real failure. Declared before the listeners below.
  let expectGatewayFailure = false
  page.on('pageerror', error => pageErrors.push(error.message))
  // A 401 from the local Host's own endpoints is expected here (no visitor
  // credential) and the shell reports it in the UI; only failures whose URL is
  // the gateway under test count against this run.
  page.on('console', message => {
    if (message.type() !== 'error') return
    // Expected and surfaced in the UI: the local Host has no visitor
    // credential here, and the wrong-model probe is deliberate.
    if (/status of 401/.test(message.text())) return
    if (expectGatewayFailure) return
    pageErrors.push(message.text())
  })

  const gatewayErrors: string[] = []
  page.on('response', response => {
    if (response.status() < 400 || !response.url().startsWith(config.baseUrl)) {
      return
    }
    if (expectGatewayFailure) return
    gatewayErrors.push(`${response.status()} ${response.url()}`)
  })
  try {
    await page.goto(url)
    await configure(page, config, checks)

    /* ------------------------------- first turn: streaming reply arrives */
    await page
      .getByTestId('byok-input')
      .fill(
        'Reply with exactly: zeus-live-ok. Then, on a new line, say which model you are.',
      )
    await page.getByTestId('byok-send').click()
    // Read the *assistant* turn, not the whole thread: the prompt contains the
    // token too, so matching the thread would pass before a single byte of the
    // reply arrived.
    const lastAssistant = `(() => {
      const bodies = [
        ...document.querySelectorAll('article[data-author="assistant"] [data-testid="byok-body"]'),
      ]
      return bodies.length ? bodies[bodies.length - 1].textContent : ''
    })()`
    await page.waitForFunction(
      `(() => {
        const bodies = [
          ...document.querySelectorAll('article[data-author="assistant"] [data-testid="byok-body"]'),
        ]
        const text = bodies.length ? bodies[bodies.length - 1].textContent : ''
        const error = document.querySelector('[data-testid="byok-error"]')
        return /zeus-live-ok/i.test(text) || (error && !error.hidden)
      })()`,
      null,
      { timeout: 120_000 },
    )
    const firstError = await page.evaluate(
      `(() => {
        const node = document.querySelector('[data-testid="byok-error"]')
        return node && !node.hidden ? node.textContent : ''
      })()`,
    )
    record(
      checks,
      'the first live reply arrives',
      firstError === '',
      String(firstError).slice(0, 240),
    )
    await expectSingleComposer(page, 'byok')
    const firstReply = await page.evaluate(lastAssistant)
    record(
      checks,
      'the reply contains the requested token',
      /zeus-live-ok/i.test(String(firstReply)),
      String(firstReply).slice(0, 240),
    )

    /* ------------------------------------ second turn: context is kept */
    await page
      .getByTestId('byok-input')
      .fill(
        'What did I ask you to reply with in my previous message? Answer with that exact token.',
      )
    await page.getByTestId('byok-send').click()
    // Two assistant turns exist once the second reply starts; wait until the
    // second one has text and the send button is back (the request finished).
    await page.waitForFunction(
      `(() => {
        const bodies = [
          ...document.querySelectorAll('article[data-author="assistant"] [data-testid="byok-body"]'),
        ]
        const sendHidden = document.querySelector('[data-testid="byok-send"]')?.hidden
        return bodies.length >= 2 && (bodies[1].textContent || '').length > 0 && sendHidden === false
      })()`,
      null,
      { timeout: 120_000 },
    )
    const secondReply = await page.evaluate(lastAssistant)
    if (recorded) {
      const chats = recorded.filter(entry => entry.messages !== undefined)
      const last = chats[chats.length - 1]?.messages ?? []
      record(
        checks,
        'the second request carries user/assistant/user history',
        last.length === 3 &&
          last[0]?.role === 'user' &&
          last[1]?.role === 'assistant' &&
          last[2]?.role === 'user',
        JSON.stringify(last.map(message => message.role)),
      )
    } else {
      record(
        checks,
        'the second turn still knows the first one',
        /zeus-live-ok/i.test(String(secondReply)),
        String(secondReply).slice(0, 240),
      )
    }

    /* -------------------------- reload: the conversation is still there */
    // Count assistant turns only, so the post-reload comparison is like for
    // like with the wait below (user bubbles share the same test id).
    const savedMessages = await page
      .locator('article[data-author="assistant"] [data-testid="byok-body"]')
      .count()
    await page.reload()
    await selectMode(page, 'byok')
    await page.getByTestId('byok-chat').waitFor({ timeout: 30_000 })
    await page.waitForFunction(
      count =>
        document.querySelectorAll(
          'article[data-author="assistant"] [data-testid="byok-body"]',
        ).length >= count,
      savedMessages,
      { timeout: 20_000 },
    )
    record(checks, 'the conversation survives a reload', true)

    // A reload drops the derived key, which is the vault doing its job. Any
    // further send needs it back, so unlock through the same UI a person uses.
    // The panel renders its vault bar asynchronously, so wait for the state
    // instead of assuming the button exists on the first frame.
    await page.getByTestId('open-settings').click()
    await page.getByTestId('settings-page').waitFor()
    // The bar renders once with its initial state and again when the stored
    // salt has been read. Reading the first frame would see "empty" for a
    // vault that exists but is locked, and skip the unlock entirely.
    await page.waitForFunction(
      () => {
        const status = document
          .querySelector('[data-testid="vault-state"]')
          ?.getAttribute('data-status')
        return status === 'locked' || status === 'unlocked'
      },
      null,
      { timeout: 30_000 },
    )
    const vaultStatus = await page
      .getByTestId('vault-state')
      .getAttribute('data-status')
    if (vaultStatus === 'locked') {
      await page.getByTestId('vault-unlock').click()
      await page.getByTestId('vault-field-passphrase').fill(config.passphrase)
      await page.getByTestId('vault-form').getByRole('button').first().click()
    }
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="vault-state"]')
          ?.getAttribute('data-status') === 'unlocked',
      null,
      { timeout: 60_000 },
    )
    await page.getByTestId('settings-back').click()
    record(checks, 'the vault unlocks again after a reload', true)

    /* ------------------------------------ Stop mid-stream, then recover */
    // Ask for a long answer so there is something to stop. The point is not
    // speed but that Stop aborts the real request and the UI leaves the busy
    // state with a visible marker on the turn.
    await page
      .getByTestId('byok-input')
      .fill(
        'Write a 500 word essay about the history of the number seven. Plain prose, no lists.',
      )
    await page.getByTestId('byok-send').click()
    const streaming = await page
      .waitForFunction(
        `(() => {
          const bodies = [
            ...document.querySelectorAll('article[data-author="assistant"] [data-testid="byok-body"]'),
          ]
          const last = bodies.length ? bodies[bodies.length - 1].textContent : ''
          // Reasoning can run for tens of seconds before the first answer
          // token, so the wait covers that phase too.
          return (last || '').length > 20
        })()`,
        null,
        { timeout: 180_000 },
      )
      .then(() => true)
      .catch(() => false)
    record(checks, 'a long answer starts streaming', streaming === true)

    /*
     * Click Stop from inside the page while the answer is still growing.
     * A click issued over CDP can land after the model has already finished,
     * which says nothing about the product; the provider picks its own speed.
     * Two attempts are made, then the check is reported as skipped with the
     * reason, because cancellation is already proven deterministically by
     * `mock-slow` in check:ai-workbench-byok.
     */
    const stopOnce = async () =>
      (await page.evaluate(
        `(async () => {
          const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
          const bodyText = () => {
            const bodies = [
              ...document.querySelectorAll(
                'article[data-author="assistant"] [data-testid="byok-body"]',
              ),
            ]
            return bodies.length ? bodies[bodies.length - 1].textContent || '' : ''
          }
          const stop = document.querySelector('[data-testid="byok-stop"]')
          if (!stop) return { clicked: false, reason: 'no stop button' }
          let last = bodyText().length
          for (let tick = 0; tick < 3000; tick += 1) {
            const now = bodyText()
            if (!stop.hidden && now.length > last) {
              stop.click()
              return { clicked: true, clickedAt: now.length }
            }
            if (stop.hidden) {
              return { clicked: false, reason: 'stream ended first', len: now.length }
            }
            last = Math.max(last, now.length)
            await delay(10)
          }
          return { clicked: false, reason: 'timed out' }
        })()`,
      )) as {
        clicked: boolean
        clickedAt?: number
        reason?: string
        len?: number
      }

    let stopOutcome = await stopOnce()
    if (!stopOutcome.clicked) {
      // One retry with a prompt that takes longer to produce.
      await page
        .getByTestId('byok-input')
        .fill(
          'Write a detailed 900 word essay about the history of the number seven. Plain prose, no lists.',
        )
      await page.getByTestId('byok-send').click()
      await page
        .waitForFunction(
          `(() => {
            const bodies = [
              ...document.querySelectorAll('article[data-author="assistant"] [data-testid="byok-body"]'),
            ]
            const text = bodies.length ? bodies[bodies.length - 1].textContent : ''
            return (text || '').length > 20
          })()`,
          null,
          { timeout: 180_000 },
        )
        .catch(() => undefined)
      stopOutcome = await stopOnce()
    }

    if (!stopOutcome.clicked) {
      checks.push({
        name: 'Stop is clicked while the stream is still running',
        ok: true,
        skipped: true,
        detail: JSON.stringify(stopOutcome),
      })
      checks.push({
        name: 'Stop ends the stream and marks the turn',
        ok: true,
        skipped: true,
        detail:
          'provider finished before Stop could land; cancellation is covered by mock-slow in check:ai-workbench-byok',
      })
    } else {
      record(
        checks,
        'Stop is clicked while the stream is still running',
        true,
        JSON.stringify(stopOutcome),
      )
      await page.waitForFunction(
        `(() => {
          const send = document.querySelector('[data-testid="byok-send"]')
          const stop = document.querySelector('[data-testid="byok-stop"]')
          return send && !send.hidden && stop && stop.hidden
        })()`,
        null,
        { timeout: 20_000 },
      )
      await page.waitForTimeout(800)
      const stoppedText = await page.evaluate(
        `(() => {
          const nodes = [...document.querySelectorAll('[data-testid="byok-turn-error"]')]
          return nodes.length ? nodes[nodes.length - 1].textContent : ''
        })()`,
      )
      record(
        checks,
        'Stop ends the stream and marks the turn',
        /stop/i.test(String(stoppedText)),
        String(stoppedText).slice(0, 160),
      )
      const settledText = await page.evaluate(
        `(() => {
          const bodies = [
            ...document.querySelectorAll(
              'article[data-author="assistant"] [data-testid="byok-body"]',
            ),
          ]
          return bodies.length ? bodies[bodies.length - 1].textContent || '' : ''
        })()`,
      )
      record(
        checks,
        'the answer stops growing after Stop',
        String(settledText).length <= (stopOutcome.clickedAt ?? 0) + 400,
        `atStop=${stopOutcome.clickedAt} settled=${String(settledText).length}`,
      )

      // The next send must still work: an aborted request must not wedge the
      // view in its busy state.
      await page
        .getByTestId('byok-input')
        .fill('Reply with exactly: zeus-live-ok')
      await page.getByTestId('byok-send').click()
      const recovered = await page
        .waitForFunction(
          `(() => {
            const bodies = [
              ...document.querySelectorAll(
                'article[data-author="assistant"] [data-testid="byok-body"]',
              ),
            ]
            const text = bodies.length ? bodies[bodies.length - 1].textContent : ''
            const send = document.querySelector('[data-testid="byok-send"]')
            return /zeus-live-ok/i.test(text) && send && !send.hidden
          })()`,
          null,
          { timeout: 120_000 },
        )
        .then(() => true)
        .catch(() => false)
      record(checks, 'a send after Stop works again', recovered === true)
    }

    /* ----------------------------------------- a wrong model is explained */
    // 404 from a real gateway is the classic "typed the model id wrong" case.
    // It must come back as a readable message, not a silent spinner, and the
    // view must stay usable afterwards.
    await page.getByTestId('open-settings').click()
    await page
      .getByTestId('provider-field-model')
      .fill('definitely-not-a-model')
    await page.getByTestId('provider-save').click()
    await page.waitForTimeout(600)
    await page.getByTestId('settings-back').click()
    await page.getByTestId('byok-input').fill('does this model exist?')
    expectGatewayFailure = true
    await page.getByTestId('byok-send').click()
    const wrongModel = await page
      .waitForFunction(
        `(() => {
          const line = document.querySelector('[data-testid="byok-error"]')
          if (!line || line.hidden) return false
          return /404|not found|model|503/i.test(line.textContent || '')
        })()`,
        null,
        { timeout: 60_000 },
      )
      .then(() => true)
      .catch(() => false)
    expectGatewayFailure = false
    record(checks, 'an unknown model is reported as such', wrongModel === true)
    const wrongModelText = await page.evaluate(
      `(() => {
        const line = document.querySelector('[data-testid="byok-error"]')
        return line && !line.hidden ? line.textContent || '' : ''
      })()`,
    )
    record(
      checks,
      'the model error names the model, not a generic outage',
      /model/i.test(String(wrongModelText)) &&
        !/gateway returned 503\.?$/i.test(String(wrongModelText)),
      String(wrongModelText).slice(0, 200),
    )
    // Restore the real model for any later step.
    await page.getByTestId('open-settings').click()
    await page.getByTestId('provider-field-model').fill(config.model)
    await page.getByTestId('provider-save').click()
    await page.waitForTimeout(600)
    await page.getByTestId('settings-back').click()
    record(checks, 'the view stays usable after a model error', true)

    /* -------------------------------------- no plaintext key anywhere */
    const leaked = await page.evaluate(
      `(async (needle) => {
        const found = []
        for (const name of ['zeus-byok-vault', 'zeus-byok-profiles']) {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(name)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          for (const store of Array.from(db.objectStoreNames)) {
            const rows = await new Promise((resolve, reject) => {
              const tx = db.transaction(store, 'readonly')
              const request = tx.objectStore(store).getAll()
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(request.error)
            })
            if (JSON.stringify(rows).includes(needle)) found.push(name + '/' + store)
          }
          db.close()
        }
        if (JSON.stringify({ ...localStorage }).includes(needle)) found.push('localStorage')
        if (JSON.stringify({ ...sessionStorage }).includes(needle)) found.push('sessionStorage')
        if (location.href.includes(needle)) found.push('url')
        return found
      })(${JSON.stringify(config.apiKey)})`,
    )
    record(
      checks,
      'the API key is absent from every browser store and the URL',
      (leaked as string[]).length === 0,
      JSON.stringify(leaked),
    )

    record(
      checks,
      'no page exceptions and no gateway failures',
      pageErrors.length === 0 && gatewayErrors.length === 0,
      [...pageErrors.slice(0, 3), ...gatewayErrors.slice(0, 3)].join(' | '),
    )
    return { browser: engine, status: 'passed', checks }
  } catch (error) {
    return {
      browser: engine,
      status: 'failed',
      checks,
      error:
        error instanceof Error ? (error.stack ?? error.message) : String(error),
    }
  } finally {
    await context.close()
    await browser.close()
  }
}

async function main(): Promise<void> {
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const config = readConfig()
  if (!config) {
    console.log(
      JSON.stringify(
        {
          status: 'NOT_RUN',
          reason:
            'ZEUS_LIVE_BASE_URL / ZEUS_LIVE_API_KEY / ZEUS_LIVE_MODEL are not set. Mock results are not a live acceptance run.',
        },
        null,
        2,
      ),
    )
    return
  }

  // A local mock gateway can stand in for the network to prove this harness
  // itself works; a real provider is only reached through the UI.
  const useMock = process.env.ZEUS_LIVE_USE_MOCK === '1'
  const mock = useMock
    ? await startMockGateway({
        apiKeys: [config.apiKey],
        // Let the browser reach it from the workbench origin.
        allowOrigin: `http://127.0.0.1:${WORKBENCH_PORT}`,
      })
    : undefined
  const target: LiveConfig = mock
    ? { ...config, baseUrl: mock.origin, model: 'mock-echo' }
    : config

  process.env.ZEUS_AI_HOST_ORIGIN = `http://127.0.0.1:${HOST_PORT}`
  process.env.ZEUS_AI_UPSTREAM_TOKEN = HOST_TOKEN
  const host = await startAiHost({
    port: HOST_PORT,
    databaseFile: ':memory:',
    workspaceRoot: path.join(outDir, 'workspace'),
    allowedOrigins: [`http://127.0.0.1:${WORKBENCH_PORT}`],
    tokens: [
      {
        token: HOST_TOKEN,
        tenantId: 'reference',
        userId: 'live',
        role: 'admin',
      },
    ],
  })
  const vite = await createServer({
    root: path.join(root, 'examples/ai-workbench'),
    configFile: path.join(root, 'examples/ai-workbench/vite.config.ts'),
    server: { host: '127.0.0.1', port: WORKBENCH_PORT, strictPort: true },
    logLevel: 'warn',
  })
  await vite.listen()

  const results = []
  // Fail closed, exactly like the mock gates: a live run that launched no
  // browser proves nothing about a live gateway, so an empty or unknown
  // selection, or a requested engine that is not installed, throws here.
  const selected = requireBrowsers(process.env.ZEUS_AI_WORKBENCH_BROWSERS, {
    fallback: ['chromium'],
  })
  try {
    for (const engine of selected) {
      results.push(
        await runBrowser(
          engine,
          `http://127.0.0.1:${WORKBENCH_PORT}/`,
          target,
          mock?.requests,
        ),
      )
    }
  } finally {
    await vite.close()
    await host.close()
    await mock?.close()
  }

  const ran = new Set(results.map(entry => entry.browser))
  const absent = selected.filter(engine => !ran.has(engine))
  const passed =
    results.length > 0 &&
    absent.length === 0 &&
    results.every(entry => entry.status === 'passed')
  await fs.writeFile(
    path.join(outDir, 'report.json'),
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          encoding: 'utf8',
        }).trim(),
        // Never write the key itself: only which gateway and model were used.
        gateway: target.baseUrl,
        model: target.model,
        stream: target.stream,
        mock: Boolean(mock),
        results,
        passed,
      },
      null,
      2,
    )}\n`,
  )
  console.log(
    JSON.stringify(
      {
        gateway: target.baseUrl,
        model: target.model,
        mock: Boolean(mock),
        results: results.map(entry => ({
          browser: entry.browser,
          status: entry.status,
          checks: entry.checks.map(
            check =>
              `${check.skipped ? 'SKIP' : check.ok ? 'ok  ' : 'FAIL'} ${check.name}`,
          ),
          ...(entry.error ? { error: entry.error.slice(0, 800) } : {}),
        })),
        passed,
      },
      null,
      2,
    ),
  )
  if (!passed) throw new Error('Live gateway acceptance failed')
}

await main()
