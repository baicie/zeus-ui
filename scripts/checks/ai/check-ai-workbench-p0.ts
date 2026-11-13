/**
 * P0 acceptance gate for the AI Workbench shell.
 *
 * The maintainer's report was not "a test failed"; it was "I cannot use this
 * page". Every check here is therefore about what a person can see and do in a
 * real browser, in all three engines:
 *
 * 1. exactly one visible composer at all times, owned by the mode on screen;
 * 2. typing goes into that composer and Enter sends once — no double send;
 * 3. 20 Agent ↔ My model round trips leave no duplicate node behind;
 * 4. a draft and its caret survive a mode switch, and a new chat starts empty;
 * 5. the published replay build says it is read-only on the Agent surface and
 *    still lets the reader use their own model;
 * 6. screenshots of each state, written next to the report.
 *
 * Run with `pnpm check:ai-workbench-p0`. Browsers default to all three; set
 * `ZEUS_AI_WORKBENCH_BROWSERS` for a subset.
 */
import type { Browser, Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { expect } from '@playwright/test'
import { createServer } from 'vite'

import { startAiHost } from '../../../examples/ai-host/src/server'
import { ENGINES, executableFor, requireBrowsers } from './support/browsers'
import {
  expectSingleComposer,
  selectMode,
  visibleComposers,
} from './support/workbench-ui'

const root = path.resolve(import.meta.dirname, '../../..')
const outDir = path.join(root, 'temp/ai-workbench-p0')
const screenshots = path.join(outDir, 'screenshots')

const HOST_TOKEN = 'workbench-token-0123456789'
const WORKBENCH_PORT = 5199
const HOST_PORT = 5200

/*
 * Browser selection lives in `support/browsers.ts` and throws for an empty or
 * unknown request, and for a requested engine that is not installed. Before
 * R6-B this file filtered the request down to known names and trusted the
 * result: `ZEUS_AI_WORKBENCH_BROWSERS=webkit` without WebKit produced zero
 * results, and `[].every(passed)` is `true` — a green gate that ran nothing.
 */
const selected = requireBrowsers(process.env.ZEUS_AI_WORKBENCH_BROWSERS)
const engines = ENGINES

interface Checks {
  readonly name: string
  readonly ok: boolean
  readonly detail?: string
}

function record(
  checks: Checks[],
  name: string,
  ok: boolean,
  detail?: string,
): void {
  checks.push({ name, ok, ...(detail ? { detail } : {}) })
  if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ''}`)
}

interface ComposerSnapshot {
  readonly kind: 'host' | 'byok'
  readonly value: string
  readonly focused: boolean
}

/** The browser-side fact every check starts from. */
const COMPOSER_STATE = `(() => {
  const visible = []
  for (const node of document.querySelectorAll('textarea')) {
    const rect = node.getBoundingClientRect()
    let hidden = false
    for (let el = node; el; el = el.parentElement) {
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') {
        hidden = true
        break
      }
    }
    if (hidden || rect.width === 0 || rect.height === 0) continue
    visible.push({
      kind: node.closest('zw-ai-composer') ? 'host' : 'byok',
      value: node.value,
      focused: document.activeElement === node,
    })
  }
  return visible
})()`

async function composerState(page: Page): Promise<ComposerSnapshot[]> {
  return page.evaluate(COMPOSER_STATE) as Promise<ComposerSnapshot[]>
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: path.join(screenshots, `${name}.png`),
    fullPage: false,
  })
}

/** Runs the interactive (Host-backed) acceptance path in one engine. */
async function runInteractive(
  engine: keyof typeof engines,
  url: string,
): Promise<Checks[]> {
  const checks: Checks[] = []
  const browser: Browser = await engines[engine].launch({
    executablePath: executableFor(engine),
  })
  const context = await browser.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${HOST_TOKEN}` },
  })
  const page = await context.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') pageErrors.push(message.text())
  })

  try {
    await page.goto(url)
    await expect(page.getByTestId('connection')).toHaveText('live')
    await expect(page.getByTestId('composer')).toBeVisible()

    /* ------------------------------------- 1. initial state: one owner */
    const initial = await visibleComposers(page)
    record(
      checks,
      'initial state shows exactly one composer (Agent)',
      initial.length === 1 && initial[0]?.kind === 'host',
      JSON.stringify(initial),
    )
    await shoot(page, `${engine}-01-agent-empty`)

    /* ------------------------ 2. real typing, IME composition, one send */
    const hostInput = page.locator('zw-ai-composer textarea')
    await hostInput.click()
    record(
      checks,
      'clicking the Agent composer focuses it',
      await page.evaluate(
        'document.activeElement && document.activeElement.tagName === "TEXTAREA"',
      ),
    )
    await page.keyboard.type('first line')
    // A composition session, as a Chinese IME produces. Enter during
    // composition must not send; the committed text must land in the field.
    // A page-level IIFE, not an arrow passed to `locator.evaluate`: the
    // bundler wraps arrow functions with a module helper that does not exist
    // in the page context.
    await page.evaluate(`(() => {
      const node = document.querySelector('zw-ai-composer textarea')
      node.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      node.value = '你好'
      node.dispatchEvent(new InputEvent('input', { bubbles: true, data: '你好', inputType: 'insertCompositionText' }))
      node.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你好' }))
    })()`)
    await expect(hostInput).toHaveValue('你好')
    await page.keyboard.type(' world')
    await expect(hostInput).toHaveValue('你好 world')
    await shoot(page, `${engine}-02-agent-typed`)

    await page.keyboard.press('Enter')
    await expect(page.locator('zw-ai-message-timeline')).toContainText(
      '你好 world',
    )
    record(checks, 'Enter sends the typed text exactly once', true)
    await expect(hostInput).toHaveValue('')
    const hostMessages = await page
      .locator('zw-ai-message-timeline article')
      .count()
    record(
      checks,
      'one send produces one message',
      hostMessages === 1,
      `messages=${hostMessages}`,
    )
    await shoot(page, `${engine}-03-agent-sent`)

    /* ------------------------------------------ 3. switch to My model */
    await selectMode(page, 'byok')
    await page.getByTestId('byok-chat').waitFor()
    await expectSingleComposer(page, 'byok')
    const afterSwitch = await composerState(page)
    record(
      checks,
      'My model shows exactly one composer (BYOK)',
      afterSwitch.length === 1 && afterSwitch[0].kind === 'byok',
      JSON.stringify(afterSwitch),
    )
    const hostStillMounted = await page.locator('zw-ai-composer').count()
    record(
      checks,
      'the Agent composer is detached, not merely hidden',
      hostStillMounted === 0,
      `host composers in DOM: ${hostStillMounted}`,
    )
    await shoot(page, `${engine}-04-byok-empty`)

    await page.getByTestId('byok-input').click()
    await page.keyboard.type('byok draft')
    const byokValue = await composerState(page)
    record(
      checks,
      'typing goes into the BYOK textarea and nowhere else',
      byokValue.length === 1 &&
        byokValue[0].kind === 'byok' &&
        byokValue[0].value === 'byok draft' &&
        byokValue[0].focused === true,
      JSON.stringify(byokValue),
    )
    await shoot(page, `${engine}-05-byok-typed`)

    /* ------------------------------- 4. 20 round trips, draft survives */
    for (let index = 0; index < 20; index += 1) {
      await selectMode(page, 'host')
      const onHost = await composerState(page)
      if (onHost.length !== 1 || onHost[0].kind !== 'host') {
        record(
          checks,
          `round trip ${index + 1}: Agent has one composer`,
          false,
          JSON.stringify(onHost),
        )
      }
      await selectMode(page, 'byok')
      const onByok = await composerState(page)
      if (
        onByok.length !== 1 ||
        onByok[0].kind !== 'byok' ||
        onByok[0].value !== 'byok draft'
      ) {
        record(
          checks,
          `round trip ${index + 1}: My model keeps one composer and its draft`,
          false,
          JSON.stringify(onByok),
        )
      }
    }
    record(checks, '20 Agent ↔ My model round trips keep one composer', true)
    const final = await composerState(page)
    record(
      checks,
      'the draft survives every switch',
      final.length === 1 && final[0].value === 'byok draft',
      JSON.stringify(final),
    )
    const byokNodes = await page.locator('[data-testid="byok-input"]').count()
    record(
      checks,
      'no duplicate BYOK composer accumulates across switches',
      byokNodes === 1,
      `byok inputs: ${byokNodes}`,
    )
    await shoot(page, `${engine}-06-after-round-trips`)

    /* --------------------------------- 5. caret and typing after switch */
    const input = page.getByTestId('byok-input')
    await input.click()
    await page.keyboard.press('End')
    await page.keyboard.type('!')
    await expect(input).toHaveValue('byok draft!')
    record(checks, 'the caret and typing still work after switching', true)

    /* ------------------------------------- 6. new chat starts empty */
    await page.getByTestId('new-conversation').click()
    await expect(input).toHaveValue('')
    const sessionAfterNew = await page.evaluate(
      'window.__aiWorkbench ? window.__aiWorkbench.conversationId : null',
    )
    record(
      checks,
      'New chat keeps the Host controller on the Agent session',
      sessionAfterNew === 'workbench',
      `conversationId=${String(sessionAfterNew)}`,
    )
    const activeByok = await page.evaluate(
      'window.__aiWorkbench.byokActiveConversationId || null',
    )
    record(
      checks,
      'New chat in My model opens a new BYOK conversation',
      typeof activeByok === 'string' && activeByok.length > 0,
      `active=${String(activeByok)}`,
    )
    await shoot(page, `${engine}-07-new-chat`)

    /* --------------------- 7. language switch keeps draft and caret */
    await input.click()
    await page.keyboard.type('draft across language')
    await page.getByTestId('open-settings').click()
    await page.getByTestId('language-zh-CN').click()
    await page.getByTestId('language-en').click()
    await page.getByTestId('settings-back').click()
    await expect(input).toHaveValue('draft across language')
    record(checks, 'a language switch keeps the draft', true)
    await shoot(page, `${engine}-08-language`)

    /* --------------------------------- 8. sending from My model works */
    await input.click()
    await page.keyboard.press('Enter')
    // No provider is configured in this run, so the send must explain itself
    // rather than do nothing: a silent composer is the reported bug.
    await expect(page.getByTestId('byok-error')).toBeVisible()
    const errorText = (await page.getByTestId('byok-error').textContent()) ?? ''
    record(
      checks,
      'sending without a provider explains what to configure',
      /provider|settings/i.test(errorText),
      errorText.slice(0, 120),
    )
    await shoot(page, `${engine}-09-unconfigured-send`)

    record(
      checks,
      'no page or console errors',
      pageErrors.length === 0,
      pageErrors.slice(0, 3).join(' | '),
    )
    return checks
  } finally {
    await context.close()
    await browser.close()
  }
}

/**
 * The published build: static files, replay host, no server. The Agent surface
 * must say it is read-only, and the reader's own model must still be usable.
 */
async function runReplay(
  engine: keyof typeof engines,
  url: string,
): Promise<Checks[]> {
  const checks: Checks[] = []
  const browser = await engines[engine].launch({
    executablePath: executableFor(engine),
  })
  const page = await browser.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  try {
    await page.goto(url)
    // The recording was made from a Host that already had a conversation, so
    // the replay opens on that thread rather than on the welcome block.
    await expect(page.getByTestId('composer')).toBeVisible()
    const state = await composerState(page)
    record(
      checks,
      'replay build starts with one composer',
      state.length === 1 && state[0].kind === 'host',
      JSON.stringify(state),
    )
    await expect(page.getByTestId('public-replay')).toBeVisible()
    record(checks, 'replay build says the Agent surface is read-only', true)
    const disabled = await page.evaluate(`(() => {
      const node = document.querySelector('zw-ai-composer textarea')
      return node ? node.disabled : null
    })()`)
    record(
      checks,
      'the replay composer is disabled, not silently swallowing input',
      disabled === true,
      `disabled=${String(disabled)}`,
    )
    await shoot(page, `${engine}-10-replay-agent`)

    await selectMode(page, 'byok')
    await page.getByTestId('byok-chat').waitFor()
    const byokState = await composerState(page)
    record(
      checks,
      'replay build switches to exactly one BYOK composer',
      byokState.length === 1 && byokState[0].kind === 'byok',
      JSON.stringify(byokState),
    )
    await expect(page.getByTestId('public-replay')).toBeHidden()
    record(
      checks,
      'the read-only notice does not follow the reader into My model',
      true,
    )
    const byokDisabled = await page.evaluate(`(() => {
      const node = document.querySelector('[data-testid="byok-input"]')
      return node ? node.disabled : null
    })()`)
    record(
      checks,
      'the BYOK composer is enabled in the same build',
      byokDisabled === false,
      `disabled=${String(byokDisabled)}`,
    )
    const newChatDisabled = await page
      .getByTestId('new-conversation')
      .isDisabled()
    record(
      checks,
      'New chat is usable in My model',
      newChatDisabled === false,
      'disabled',
    )
    await shoot(page, `${engine}-11-replay-byok`)

    record(
      checks,
      'no page errors in the replay build',
      pageErrors.length === 0,
      pageErrors.slice(0, 3).join(' | '),
    )
    return checks
  } finally {
    await browser.close()
  }
}

/** Serves the built demo site (base `/`) with a tiny static server. */
async function startStatic(dir: string, port: number) {
  const { createReadStream } = await import('node:fs')
  const { createServer: createHttp } = await import('node:http')
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
  }
  const server = createHttp((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    const file = path.join(dir, pathname === '/' ? 'index.html' : pathname)
    if (!file.startsWith(dir)) {
      response.writeHead(403).end()
      return
    }
    createReadStream(file)
      .on('error', () => {
        response.writeHead(404).end('not found')
      })
      .on('open', () => {
        response.writeHead(200, {
          'Content-Type':
            types[path.extname(file)] ?? 'application/octet-stream',
        })
      })
      .pipe(response)
  })
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve))
  return {
    close: () =>
      new Promise<void>(resolve => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

/**
 * Builds the same source the Pages job publishes: `ZEUS_AI_DEMO=1`, base `/`,
 * with a recording made from the real Host. The recording is written after the
 * build because Vite empties the output directory.
 *
 * The commits are the checkout's real ones. The recorder requires full SHAs
 * since R6-A — a placeholder would make the published-metadata contract
 * untestable — and using `git rev-parse HEAD` here means this gate also proves
 * the recorder works against a real repository, which is what the Pages job
 * does.
 */
async function buildReplay(dir: string): Promise<void> {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
  execFileSync(
    'node',
    [
      '--import',
      'tsx',
      'scripts/release/ai-demo-recording.ts',
      '--out',
      path.join(outDir, 'ai-demo-recording.json'),
      '--ui-commit',
      head,
      '--core-commit',
      process.env.ZEUS_PAIRED_CORE_COMMIT ?? head,
    ],
    { cwd: root, stdio: 'inherit' },
  )
  execFileSync('pnpm', ['exec', 'vite', 'build', '--outDir', dir], {
    cwd: path.join(root, 'examples/ai-workbench'),
    stdio: 'inherit',
    env: { ...process.env, ZEUS_AI_DEMO: '1', ZEUS_AI_DEMO_BASE: '/' },
  })
  await fs.copyFile(
    path.join(outDir, 'ai-demo-recording.json'),
    path.join(dir, 'ai-demo-recording.json'),
  )
}

async function main(): Promise<void> {
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(screenshots, { recursive: true })

  process.env.ZEUS_AI_HOST_ORIGIN = `http://127.0.0.1:${HOST_PORT}`
  process.env.ZEUS_AI_UPSTREAM_TOKEN = HOST_TOKEN

  const host = await startAiHost({
    port: HOST_PORT,
    databaseFile: ':memory:',
    workspaceRoot: path.join(outDir, 'workspace'),
    allowedOrigins: [`http://127.0.0.1:${WORKBENCH_PORT}`],
    tokens: [
      { token: HOST_TOKEN, tenantId: 'reference', userId: 'p0', role: 'admin' },
    ],
  })
  const vite = await createServer({
    root: path.join(root, 'examples/ai-workbench'),
    configFile: path.join(root, 'examples/ai-workbench/vite.config.ts'),
    server: { host: '127.0.0.1', port: WORKBENCH_PORT, strictPort: true },
    logLevel: 'warn',
  })
  await vite.listen()

  const report: Array<{
    browser: string
    surface: 'interactive' | 'replay'
    status: 'passed' | 'failed'
    checks: Checks[]
    error?: string
  }> = []

  try {
    for (const engine of selected) {
      try {
        const checks = await runInteractive(
          engine,
          `http://127.0.0.1:${WORKBENCH_PORT}/`,
        )
        report.push({
          browser: engine,
          surface: 'interactive',
          status: 'passed',
          checks,
        })
      } catch (error) {
        report.push({
          browser: engine,
          surface: 'interactive',
          status: 'failed',
          checks: [],
          error:
            error instanceof Error
              ? (error.stack ?? error.message)
              : String(error),
        })
      }
    }

    // The published build is the same source with the replay host, so it gets
    // the same state checks. Building it here keeps the two from drifting.
    const demoDir = path.join(outDir, 'demo')
    mkdirSync(demoDir, { recursive: true })
    await buildReplay(demoDir)
    const demo = await startStatic(demoDir, WORKBENCH_PORT + 2)
    try {
      for (const engine of selected) {
        try {
          const checks = await runReplay(
            engine,
            `http://127.0.0.1:${WORKBENCH_PORT + 2}/`,
          )
          report.push({
            browser: engine,
            surface: 'replay',
            status: 'passed',
            checks,
          })
        } catch (error) {
          report.push({
            browser: engine,
            surface: 'replay',
            status: 'failed',
            checks: [],
            error:
              error instanceof Error
                ? (error.stack ?? error.message)
                : String(error),
          })
        }
      }
    } finally {
      await demo.close()
    }
  } finally {
    await vite.close()
    await host.close()
  }

  // A gate that ran nothing is not a pass. `requireBrowsers` already refuses to
  // hand back an empty list; this is the second line of defence, covering a
  // selection that produced no cases for some other reason (an engine whose
  // whole surface was skipped, a report swallowed by a catch). Every requested
  // engine must have at least one result, and every result must have run at
  // least one check.
  const ran = new Set(report.map(entry => entry.browser))
  const absent = selected.filter(engine => !ran.has(engine))
  const empty = report.filter(entry => entry.checks.length === 0)
  const passed =
    report.length > 0 &&
    absent.length === 0 &&
    empty.length === 0 &&
    report.every(entry => entry.status === 'passed')
  await fs.writeFile(
    path.join(root, 'temp/ai-workbench-p0/report.json'),
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          encoding: 'utf8',
        }).trim(),
        browsers: selected,
        results: report,
        absentEngines: absent,
        emptyResults: empty.map(entry => `${entry.browser}/${entry.surface}`),
        passed,
      },
      null,
      2,
    )}\n`,
  )
  console.log(
    JSON.stringify(
      {
        results: report.map(entry => ({
          browser: entry.browser,
          surface: entry.surface,
          status: entry.status,
          checks: entry.checks.map(
            check => `${check.ok ? 'ok  ' : 'FAIL'} ${check.name}`,
          ),
          ...(entry.error ? { error: entry.error.slice(0, 600) } : {}),
        })),
        passed,
      },
      null,
      2,
    ),
  )
  if (!passed) throw new Error('AI Workbench P0 gate failed')
}

await main()
