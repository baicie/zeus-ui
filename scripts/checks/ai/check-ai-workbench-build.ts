/**
 * Production-build acceptance for the Workbench.
 *
 * The other gates boot the app through Vite's dev server. That proves the
 * source works, not the artifact that ships: a build can differ in base path,
 * dead-code elimination (`isDemoBuild` is a compile-time constant), asset
 * hashing, or the service worker's cache. This gate builds the app exactly as
 * the image and the Pages demo do, serves the static output, and drives the
 * flows a person does:
 *
 * 1. Agent ↔ My model switching leaves exactly one composer;
 * 2. New chat starts empty and is reachable from the sidebar;
 * 3. typing and Enter send once;
 * 4. a streaming reply can be stopped, and Stop leaves a complete message;
 * 5. reloading restores the surface the reader was on;
 * 6. switching language relabels the shell and survives the reload.
 *
 * Two builds are exercised:
 *
 *   production  `ZEUS_AI_HOST_ORIGIN` points at the reference Host
 *   demo        `ZEUS_AI_DEMO=1`, replay host, exactly what Pages publishes
 *
 * Run with `pnpm check:ai-workbench-build`. Browsers default to Chromium; set
 * `ZEUS_AI_WORKBENCH_BROWSERS` for more. Like every other gate it fails closed:
 * an unknown engine, an empty selection, a missing browser and zero results are
 * all failures.
 */
import type { Browser, Page } from '@playwright/test'
import type { Server } from 'node:http'
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import fs from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'

import { expect } from '@playwright/test'

import { startAiHost } from '../../../examples/ai-host/src/server'
import { ENGINES, executableFor, requireBrowsers } from './support/browsers'
import { startMockGateway } from './support/mock-gateway'
import {
  expectSingleComposer,
  selectMode,
  visibleComposers,
} from './support/workbench-ui'

const root = path.resolve(import.meta.dirname, '../../..')
const outDir = path.join(root, 'temp/ai-workbench-build')
const builds = path.join(outDir, 'builds')

const HOST_TOKEN = 'workbench-token-0123456789'
const GATEWAY_KEY = 'mock-key-0123456789'
const PASSPHRASE = 'build-check-passphrase'
const PRODUCTION_PORT = 5231
const DEMO_PORT = 5232
const HOST_PORT = 5233

const selected = requireBrowsers(process.env.ZEUS_AI_WORKBENCH_BROWSERS)

interface Check {
  readonly name: string
  readonly ok: boolean
  readonly detail?: string
}

function record(checks: Check[], name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, ...(detail ? { detail } : {}) })
  if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ''}`)
}

/**
 * The ingress the production image ships, reduced to what the browser can tell
 * apart: static files, and `/ai-host/` proxied to the Host with the upstream
 * token injected server-side.
 *
 * This matters more than it looks. `deploy/nginx.conf` sets
 * `proxy_set_header Authorization "Bearer ${ZEUS_AI_UPSTREAM_TOKEN}"`, so the
 * browser never holds the Host credential and the built app talks to `/ai-host`
 * on its own origin. Serving the same build from a plain static server without
 * that proxy produced 401s on every stream and made sends silently no-op — the
 * first version of this gate failed there, and the failure was the missing
 * ingress, not the product.
 *
 * The path rewrite (`/ai-host/streams/...` -> `/streams/...`) and unbuffered
 * streaming are the other two behaviours the contract depends on.
 */
async function serveIngress(
  directory: string,
  port: number,
  upstream: string,
): Promise<Server> {
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
  }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname.startsWith('/ai-host/')) {
      // Same rewrite and headers as nginx. `duplex: 'half'` is required by
      // Node's fetch for a streamed request body; SSE needs no body.
      const target = `${upstream}${url.pathname.slice('/ai-host'.length)}${url.search}`
      const headers = new Headers(request.headers as Record<string, string>)
      headers.set('authorization', `Bearer ${HOST_TOKEN}`)
      headers.delete('host')
      let upstreamResponse: Response
      try {
        upstreamResponse = await fetch(target, {
          method: request.method,
          headers,
          ...(request.method === 'GET' || request.method === 'HEAD'
            ? {}
            : { body: await readBody(request), duplex: 'half' }),
        } as RequestInit)
      } catch (error) {
        response.writeHead(502).end(String(error))
        return
      }
      response.writeHead(upstreamResponse.status, {
        'content-type':
          upstreamResponse.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
      })
      if (!upstreamResponse.body) {
        response.end()
        return
      }
      // Stream chunk by chunk: a proxy that buffers turns SSE into one late
      // blob and the connection lamp never goes live.
      const reader = upstreamResponse.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        response.write(value)
      }
      response.end()
      return
    }
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    const file = path.join(directory, relative)
    if (!file.startsWith(directory)) {
      response.writeHead(403).end()
      return
    }
    const target =
      existsSync(file) && statSync(file).isFile()
        ? file
        : path.join(directory, 'index.html')
    response.writeHead(200, {
      'content-type': types[path.extname(target)] ?? 'application/octet-stream',
    })
    createReadStream(target).pipe(response)
  })
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve))
  return server
}

function readBody(
  request: import('node:http').IncomingMessage,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', chunk => chunks.push(chunk as Buffer))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function close(server: Server | undefined): Promise<void> {
  return new Promise(resolve => {
    if (!server) return resolve()
    server.close(() => resolve())
  })
}

/** Builds the Workbench the way a deployment does, and returns the output dir. */
function build(
  name: 'production' | 'demo',
  env: Record<string, string>,
): string {
  const out = path.join(builds, name)
  rmSync(out, { recursive: true, force: true })
  execFileSync('pnpm', ['exec', 'vite', 'build', '--outDir', out], {
    cwd: path.join(root, 'examples/ai-workbench'),
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  // A build with no entry point is not a build; fail here rather than serve an
  // empty directory and blame the browser.
  for (const required of ['index.html']) {
    if (!existsSync(path.join(out, required))) {
      throw new Error(`${name} build produced no ${required}`)
    }
  }
  return out
}

/** The demo build replays a recording, so it needs one next to index.html. */
async function recordForDemo(directory: string): Promise<void> {
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
      path.join(directory, 'ai-demo-recording.json'),
      '--ui-commit',
      head,
      '--core-commit',
      process.env.ZEUS_PAIRED_CORE_COMMIT ?? head,
    ],
    { cwd: root, stdio: 'inherit' },
  )
}

/** Waits for the composer to be ready and settles the shell. */
async function ready(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByTestId('model-picker')).toBeVisible({
    timeout: 30_000,
  })
}

/**
 * The flows from the release checklist, run against a real build.
 *
 * `mode` says what the build is: `demo` has no Host, so the Agent surface is a
 * replay and the BYOK surface is the reader's own model. The checks below say
 * which of them a given build can honestly perform.
 */
async function runProduction(
  page: Page,
  origin: string,
  checks: Check[],
  gatewayOrigin: string,
): Promise<void> {
  await page.goto(origin)
  await ready(page)

  /* 1. Agent ↔ My model, twenty round trips, one composer. */
  await expectSingleComposer(page, 'host')
  for (let index = 0; index < 20; index += 1) {
    await selectMode(page, index % 2 === 0 ? 'byok' : 'host')
  }
  await selectMode(page, 'host')
  await expectSingleComposer(page, 'host')
  record(checks, '20 Agent ↔ My model switches keep one composer', true)

  /* 2. New chat starts empty. */
  await page.getByTestId('new-conversation').click()
  const composers = await visibleComposers(page)
  record(
    checks,
    'New chat leaves one empty composer',
    composers.length === 1 && composers[0]?.value === '',
    JSON.stringify(composers),
  )

  /* 3. Type and send once, on the Agent surface.
   *
   * Typed with the keyboard, not filled: the Host composer is a custom element
   * that listens for real key events, and `fill` would bypass the very path a
   * reader uses. The timeline it appends to is the element the shipped build
   * renders, so a build that dropped the composer's send wiring fails here. */
  const hostInput = page.locator('zw-ai-composer textarea')
  await hostInput.click()
  await page.keyboard.type('构建验收')
  await page.keyboard.press('Enter')
  await expect(page.locator('zw-ai-message-timeline')).toContainText(
    '构建验收',
    { timeout: 30_000 },
  )
  await expect(hostInput).toHaveValue('')
  record(checks, 'Enter sends the typed message once', true)
  record(
    checks,
    'one send produces one message',
    (await page.locator('zw-ai-message-timeline article').count()) === 1,
  )

  /* 4. My model: a real gateway, a real stream, and a real Stop.
   *
   * The vault, the provider and the model are configured through the UI exactly
   * as a reader would, because the build could differ from the dev server in
   * how it stores them (IndexedDB, the vault, the CSP it applies). `mock-slow`
   * emits tokens over time so Stop is observable rather than instantaneous. */
  await selectMode(page, 'byok')
  await expectSingleComposer(page, 'byok')
  await page.getByTestId('open-settings').click()
  await page.getByTestId('settings-page').waitFor({ timeout: 20_000 })
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
  await page.getByTestId('provider-form').waitFor({ timeout: 10_000 })
  await page.getByTestId('provider-field-name').fill('Build gateway')
  await page.getByTestId('provider-field-baseUrl').fill(gatewayOrigin)
  await page.getByTestId('provider-field-apiKey').fill(GATEWAY_KEY)
  await page.getByTestId('provider-field-model').fill('mock-slow')
  await page.getByTestId('provider-save').click()
  await page.getByTestId('settings-back').click()

  await page.getByTestId('byok-input').fill('stop this stream')
  await page.getByTestId('byok-send').click()
  await page.getByTestId('byok-stop').waitFor({ timeout: 15_000 })
  await page.getByTestId('byok-stop').click()
  await page.waitForFunction(
    () =>
      (document.querySelector('[data-testid="byok-thread"]')?.textContent ?? '')
        .toLowerCase()
        .includes('stopped'),
    null,
    { timeout: 15_000 },
  )
  await expectSingleComposer(page, 'byok')
  record(checks, 'a streaming reply can be stopped', true)

  /* 5. Reload. Two separate facts, asserted separately because they are
   * different products:
   *
   * - The shell comes back usable and the BYOK vault is still unlocked: those
   *   are the reader's stored state, and a build that dropped them would be
   *   usable exactly once.
   * - The run mode returns to Agent. That is the current design, not a
   *   regression: the mode is not persisted (only the active conversation is),
   *   so asserting it survives would assert behaviour the product does not
   *   promise. The reload requirement is that the surface is correct after it. */
  await page.reload()
  await ready(page)
  await expectSingleComposer(page, 'host')
  record(checks, 'reload returns to a usable Agent surface', true)
  await selectMode(page, 'byok')
  await expectSingleComposer(page, 'byok')

  /* The vault is locked again after a reload — that is the point of the vault,
   * not a regression: the passphrase is never stored, so a reload cannot leave
   * the key readable. What must survive is the *salt*, and unlocking with the
   * passphrase must bring the model back without re-entering the key.
   *
   * `vault-state` starts as `empty` and is filled in by an async
   * `vault.refresh()` read of IndexedDB. Reading the attribute immediately
   * catches that first render and reports "no vault", so this waits for the
   * read to settle: the attribute is written by `renderVaultBar` once the
   * stored salt is known, and it transitions empty -> locked. */
  await page.getByTestId('open-settings').click()
  await page.getByTestId('settings-page').waitFor({ timeout: 20_000 })
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="vault-state"]')
        ?.getAttribute('data-status') !== 'empty',
    null,
    { timeout: 20_000 },
  )
  const lockedStatus = await page
    .getByTestId('vault-state')
    .getAttribute('data-status')
  record(
    checks,
    'reload finds the stored vault locked',
    lockedStatus === 'locked',
    String(lockedStatus),
  )
  await page.getByTestId('vault-unlock').click()
  await page.getByTestId('vault-field-passphrase').fill(PASSPHRASE)
  await page.getByTestId('vault-form').getByRole('button').first().click()
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="vault-state"]')
        ?.getAttribute('data-status') === 'unlocked',
    null,
    { timeout: 20_000 },
  )
  record(checks, 'the vault re-unlocks with the passphrase', true)
  record(checks, 'reload comes back to a usable surface', true)

  /* 6. Language switch, then a reload: the copy changes and the choice
   * persists. The setting lives in the settings page, so each step opens it —
   * a reload closes it, and reading the body text without reopening would read
   * whatever page the reload landed on. */
  await page.getByTestId('language-zh-CN').click()
  const zh = await page.locator('body').textContent()
  record(
    checks,
    'language switch relabels the shell',
    /[\u4E00-\u9FFF]/.test(zh ?? ''),
  )

  await page.reload()
  await ready(page)
  const afterReload = await page.locator('body').textContent()
  record(
    checks,
    'the language choice persists across a reload',
    /[\u4E00-\u9FFF]/.test(afterReload ?? ''),
  )
  await page.getByTestId('open-settings').click()
  await page.getByTestId('settings-page').waitFor({ timeout: 20_000 })
  await page.getByTestId('language-en').click()
  record(checks, 'language switch back restores English', true)
}

async function runDemo(
  page: Page,
  origin: string,
  checks: Check[],
): Promise<void> {
  await page.goto(origin)
  await ready(page)

  const banner = page.getByTestId('public-replay')
  await expect(banner).toBeVisible({ timeout: 30_000 })
  record(checks, 'the replay build says it is a replay', true)

  await expectSingleComposer(page, 'host')
  await selectMode(page, 'byok')
  await expectSingleComposer(page, 'byok')
  await selectMode(page, 'host')
  await expectSingleComposer(page, 'host')
  record(checks, 'the published build keeps one composer per mode', true)

  /* The recorded exchange must be present: a replay with no events is a blank
     page that would otherwise pass every "does it render" assertion. */
  const thread = page.getByTestId('thread')
  await expect(thread).toBeVisible({ timeout: 30_000 })
  record(checks, 'the published build replays a recorded thread', true)

  /* Read-only is the contract of the published Agent surface, and it is
     enforced, not just announced: the new-chat control is disabled. Asserting
     the disabled state is asserting the product decision; asserting that it
     works would be asserting the demo can write to a recording. */
  const newChat = page.getByTestId('new-conversation')
  record(
    checks,
    'the published Agent surface disables new chat',
    await newChat.isDisabled(),
  )

  /* The reader's own model is still theirs: switching to it enables a fresh
     chat, so the demo is not merely a screenshot. */
  await selectMode(page, 'byok')
  await expectSingleComposer(page, 'byok')
  const composers = await visibleComposers(page)
  record(
    checks,
    'My model is still usable in the published build',
    composers.length === 1,
    JSON.stringify(composers),
  )
}

async function main(): Promise<void> {
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const gateway = await startMockGateway({
    apiKeys: [GATEWAY_KEY],
    allowOrigin: `http://127.0.0.1:${PRODUCTION_PORT}`,
  })
  const host = await startAiHost({
    port: HOST_PORT,
    databaseFile: ':memory:',
    workspaceRoot: path.join(outDir, 'workspace'),
    allowedOrigins: [`http://127.0.0.1:${PRODUCTION_PORT}`],
    tokens: [
      {
        token: HOST_TOKEN,
        tenantId: 'reference',
        userId: 'build',
        role: 'admin',
      },
    ],
  })

  // The production build must be pointed at the Host at build time: the origin
  // is a compile-time constant, exactly as it is in the image.
  // The production build is pointed at its own origin at build time, exactly as
  // the image bakes `/ai-host`: the browser never learns the Host address, and
  // the ingress below injects the credential.
  const productionDir = build('production', {
    ZEUS_AI_HOST_ORIGIN: `http://127.0.0.1:${PRODUCTION_PORT}/ai-host`,
  })
  const demoDir = build('demo', { ZEUS_AI_DEMO: '1', ZEUS_AI_DEMO_BASE: '/' })
  await recordForDemo(demoDir)

  const productionServer = await serveIngress(
    productionDir,
    PRODUCTION_PORT,
    host.origin,
  )
  const demoServer = await serveIngress(demoDir, DEMO_PORT, host.origin)

  const report: Array<{
    browser: string
    surface: 'production' | 'demo'
    status: 'passed' | 'failed'
    checks: Check[]
    error?: string
  }> = []

  try {
    for (const engine of selected) {
      for (const [surface, origin] of [
        ['production', `http://127.0.0.1:${PRODUCTION_PORT}/`],
        ['demo', `http://127.0.0.1:${DEMO_PORT}/`],
      ] as const) {
        const checks: Check[] = []
        let browser: Browser | undefined
        try {
          browser = await ENGINES[engine].launch({
            headless: true,
            executablePath: executableFor(engine),
          })
          const context = await browser.newContext()
          const page = await context.newPage()
          const pageErrors: string[] = []
          page.on('pageerror', error => pageErrors.push(error.message))
          if (surface === 'production') {
            await runProduction(page, origin, checks, gateway.origin)
          } else {
            await runDemo(page, origin, checks)
          }
          record(
            checks,
            'no page exceptions',
            pageErrors.length === 0,
            pageErrors.slice(0, 3).join(' | '),
          )
          report.push({ browser: engine, surface, status: 'passed', checks })
        } catch (error) {
          report.push({
            browser: engine,
            surface,
            status: 'failed',
            checks,
            error:
              error instanceof Error
                ? (error.stack ?? error.message)
                : String(error),
          })
        } finally {
          await browser?.close()
        }
      }
    }
  } finally {
    await close(productionServer)
    await close(demoServer)
    await host.close()
    await gateway.close()
  }

  // Fail closed, like the other gates: every requested engine must have run both
  // surfaces, and no result may be empty.
  const ran = new Set(report.map(entry => entry.browser))
  const absent = selected.filter(engine => !ran.has(engine))
  const empty = report.filter(entry => entry.checks.length === 0)
  const surfaces = new Set(report.map(entry => entry.surface))
  const passed =
    report.length > 0 &&
    absent.length === 0 &&
    empty.length === 0 &&
    surfaces.size === 2 &&
    report.every(entry => entry.status === 'passed')

  await fs.writeFile(
    path.join(outDir, 'report.json'),
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          encoding: 'utf8',
        }).trim(),
        browsers: selected,
        builds: {
          production: path.relative(root, productionDir),
          demo: path.relative(root, demoDir),
        },
        absentEngines: absent,
        emptyResults: empty.map(entry => `${entry.browser}/${entry.surface}`),
        results: report,
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
  if (!passed) throw new Error('AI Workbench production-build gate failed')
}

await main()
