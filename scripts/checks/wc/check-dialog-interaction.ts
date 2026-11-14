/**
 * Dialog interaction gate — the acceptance the R6 review asked for.
 *
 * It builds `packages/primitives/dialog` from source, serves it as a plain
 * page, and drives the sequence a person drives:
 *
 *   open → Escape → reopen → close control → reopen → backdrop → reopen
 *
 * plus the parts a person notices only when they are wrong: focus goes in on
 * open, Tab cannot leave a modal, focus comes back to the trigger on close,
 * a nested dialog dismisses before its parent, and a controlled dialog reports
 * instead of deciding.
 *
 * Why a browser and not jsdom: the defects this covers are all about where
 * focus actually is. jsdom has no layout, no sequential focus navigation, and
 * no `document.activeElement` after a Tab, so a jsdom test can only assert the
 * handler was called — which is exactly the assertion that passed while the
 * trap was broken on WebKit.
 *
 * Every engine is required. There is no WebKit exemption: a dialog that traps
 * focus on two engines and not the third is broken for a third of readers, and
 * the previous round shipped that exception instead of a fix.
 */
import type { Browser, BrowserType, Page } from '@playwright/test'

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { chromium, firefox, webkit } from '@playwright/test'

const ENGINES: Record<string, BrowserType> = { chromium, firefox, webkit }
const root = process.cwd()
const output = path.resolve(option('--output') || 'temp/dialog-interaction')
/** Set by the fixture server; every page navigation is relative to it. */
let serverUrl = ''
const engines = selectEngines(
  option('--browsers') ?? process.env.DIALOG_BROWSERS,
)

/**
 * The engines this gate will run, refusing anything that would shrink the
 * matrix silently.
 *
 * This is deliberately not shared with the Workbench gates. Sharing a helper
 * would make this branch depend on another PR's file, and the matrix has to be
 * enforced here on its own terms: an empty list, an unknown name, or a
 * requested engine that is not installed are all failures — the three ways a
 * browser gate reports PASS having launched nothing.
 */
function selectEngines(raw: string | undefined): readonly string[] {
  const requested = raw?.trim() ? raw : 'chromium,firefox,webkit'
  const names = requested
    .split(',')
    .map(name => name.trim().toLowerCase())
    .filter(Boolean)
  if (names.length === 0) {
    throw new Error(
      `no browser engines requested (got ${JSON.stringify(requested)}); an empty selection cannot pass a gate`,
    )
  }
  const unknown = names.filter(name => !(name in ENGINES))
  if (unknown.length > 0) {
    throw new Error(
      `unknown browser engine(s): ${unknown.join(', ')}; expected ${Object.keys(ENGINES).join(', ')}`,
    )
  }
  for (const name of names) {
    let installed = false
    try {
      installed = fs.existsSync(ENGINES[name]!.executablePath())
    } catch {
      installed = false
    }
    if (!installed) {
      throw new Error(
        `browser not installed: ${name} — run \`pnpm exec playwright install ${name}\`. A gate that cannot launch a requested engine is a failure, not a skip.`,
      )
    }
  }
  return [...new Set(names)]
}
const shouldScreenshot = !process.argv.includes('--no-screenshot')

interface StepResult {
  step: string
  status: 'passed' | 'failed'
  /** Whatever the step measured. Probes are objects; a step may return none. */
  detail: object
  error?: string
}

interface EngineResult {
  engine: string
  status: 'passed' | 'failed'
  steps: StepResult[]
  screenshots: string[]
  pageErrors: string[]
}

const report = {
  kind: 'dialog interaction acceptance; real source build, three engines',
  createdAt: new Date().toISOString(),
  commit: gitHead(),
  engines,
  sourceSha256: {
    dialog: sha256(
      fs.readFileSync(
        path.join(root, 'packages/primitives/dialog/src/dialog.tsx'),
      ),
    ),
  },
  results: [] as EngineResult[],
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index < 0 ? undefined : process.argv[index + 1]
}

function gitHead(): string {
  try {
    return fs
      .readFileSync(path.join(root, '.git/HEAD'), 'utf8')
      .trim()
      .slice(0, 200)
  } catch {
    return 'unknown'
  }
}

/**
 * Every bare specifier reachable from `entry`, with the file a browser should
 * load for it.
 *
 * Resolution starts from the package under test: its peers are its own
 * dependencies and live in pnpm's store beside it, so resolving from this
 * script would report MODULE_NOT_FOUND for packages the build demonstrably
 * used.
 */
function resolveBareImports(entry: string): Record<string, string> {
  const dialogManifest = path.join(
    root,
    'packages/primitives/dialog/package.json',
  )
  const requireFromDialog = createRequire(dialogManifest)
  const found = new Map<string, string>()

  /*
   * Where pnpm put a package. The package directory is needed before its
   * manifest can be read, and Node's own resolver is the only thing that knows
   * how a given workspace link is shaped.
   */
  const packageDirOf = (name: string): string =>
    packageDirectoryOf(requireFromDialog.resolve(name))

  /*
   * The file a browser should load for `specifier`.
   *
   * Node's resolver is not used for the choice: `require.resolve` prefers the
   * `require` condition and hands back `index.cjs`, a file a browser cannot
   * execute. The package's own `exports` map is the authority on which file an
   * `import` gets, so it is read directly.
   */
  const resolveBrowserEntry = (specifier: string): string => {
    const rootName = specifier.startsWith('@')
      ? specifier.split('/').slice(0, 2).join('/')
      : (specifier.split('/')[0] as string)
    const directory = packageDirOf(rootName)
    const manifest = JSON.parse(
      fs.readFileSync(path.join(directory, 'package.json'), 'utf8'),
    ) as { exports?: Record<string, unknown>; module?: string }
    const entry = pickEsmEntry(manifest, specifier)
    if (!entry) {
      throw new Error(
        `cannot resolve a browser entry for ${specifier} from ${directory}`,
      )
    }
    const file = path.resolve(directory, entry)
    if (!fs.existsSync(file)) {
      throw new Error(`${specifier} resolves to ${file}, which does not exist`)
    }
    return file
  }

  const queue = [entry]
  const seen = new Set<string>()
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    let source: string
    try {
      source = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const match of source.matchAll(
      /(?:from|import)\s*(?:\(\s*)?['"]([^'"]+)['"]/g,
    )) {
      const specifier = match[1]
      if (!specifier) continue
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        // A relative import stays in the artifact, but it has to be *walked*:
        // the entry re-exports through `./loader.js`, and the bare peers are
        // one hop further in.
        const next = path.resolve(path.dirname(file), specifier)
        if (!seen.has(next)) queue.push(next)
        continue
      }
      if (!found.has(specifier)) {
        /*
         * `require.resolve` reports the CommonJS entry (`index.cjs`). A
         * browser cannot load that, and forcing it would produce a page whose
         * failure has nothing to do with the component. Resolve the `import`
         * condition instead, through the package's own exports map.
         */
        found.set(specifier, resolveBrowserEntry(specifier))
      }
      const resolved = found.get(specifier) as string
      if (!seen.has(resolved)) queue.push(resolved)
    }
  }
  return Object.fromEntries(found)
}

/** The nearest directory above `file` that holds a `package.json`. */
function packageDirectoryOf(file: string): string {
  let directory = path.dirname(file)
  while (directory !== path.dirname(directory)) {
    if (fs.existsSync(path.join(directory, 'package.json'))) return directory
    directory = path.dirname(directory)
  }
  throw new Error(`no package.json above ${file}`)
}

/**
 * The ESM entry from a package's own `exports` map.
 *
 * Subpath specifiers (`@zeus-js/signal/internal`) have their own entry, and
 * the runtime's `import` condition may itself be an object keyed by
 * environment; both shapes are walked rather than guessed.
 */
function pickEsmEntry(
  manifest: { exports?: Record<string, unknown>; module?: string },
  specifier: string,
): string | undefined {
  const rootName = specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0]
  const subpath = specifier.startsWith('@')
    ? specifier.split('/').slice(2).join('/')
    : specifier.split('/').slice(1).join('/')
  const key = subpath ? `./${subpath}` : '.'

  const pick = (value: unknown, depth = 0): string | undefined => {
    if (depth > 6) return undefined
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return undefined
    const record = value as Record<string, unknown>
    for (const condition of ['browser', 'import', 'module', 'default']) {
      if (condition in record) {
        const picked = pick(record[condition], depth + 1)
        if (picked) return picked
      }
    }
    return undefined
  }

  const exportsField = manifest.exports
  if (exportsField && typeof exportsField === 'object') {
    const record = exportsField as Record<string, unknown>
    const entry =
      key in record
        ? record[key]
        : rootName === specifier
          ? record['.']
          : undefined
    const picked = pick(entry)
    if (picked) return picked
  }
  if (manifest.module) return manifest.module
  return undefined
}

function sha256(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

/*
 * The fixture is deliberately plain markup.
 *
 * A dialog that only works when a framework compiled it is a dialog whose
 * rules live in the framework; these elements are supposed to be usable from
 * hand-written HTML, which is what the Admin gallery is.
 */
const FIXTURE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>dialog interaction gate</title>
    <style>
      body { font: 16px/1.4 system-ui, sans-serif; margin: 0; padding: 24px; }
      button { font: inherit; padding: 4px 10px; }
      [hidden] { display: none !important; }
      /* Parked off-screen: an open dialog is position:fixed and would sit over
         everything the earlier steps click. display:none is not usable because
         the component owns that through the hidden attribute. */
      zw-dialog-content { position: fixed; inset: 0; display: grid; place-items: center; background: #0003; padding: 24px; }
      zw-dialog-content[hidden] { display: none; }
      zw-dialog-content [part="content"] { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 8px 40px #0003; min-width: 280px; }
      zw-dialog-content [part="content"] button { margin-right: 8px; }
    </style>
  </head>
  <body>
    <button id="before" data-testid="before">before</button>

    <zw-dialog data-testid="d" id="dialog">
      <zw-dialog-trigger data-testid="trigger">Open</zw-dialog-trigger>
      <zw-dialog-content data-testid="content">
        <zw-dialog-title data-testid="title">Settings</zw-dialog-title>
        <button data-testid="first">First</button>
        <button data-testid="second">Second</button>
        <zw-dialog-close data-testid="close">Cancel</zw-dialog-close>
      </zw-dialog-content>
    </zw-dialog>

    <button id="after" data-testid="after">after</button>

    <!--
      Hidden subtrees a focus walk must not enter. The dialog below puts one of
      each inside its panel, so the gate can prove the trap's candidate list is
      filtered by what is rendered and reachable — not by tag name.
    -->
    <zw-dialog data-testid="filtered" id="filtered">
      <zw-dialog-trigger data-testid="filtered-trigger">Open filtered</zw-dialog-trigger>
      <zw-dialog-content data-testid="filtered-content">
        <div style="display: none">
          <button data-testid="hidden-by-display">Hidden by display</button>
        </div>
        <div inert>
          <button data-testid="inert-button">Inert</button>
        </div>
        <button data-testid="filtered-first">First reachable</button>
        <button data-testid="filtered-second">Second reachable</button>
      </zw-dialog-content>
    </zw-dialog>

    <zw-dialog data-testid="nested-outer" id="outer">
      <zw-dialog-trigger data-testid="outer-trigger">Open outer</zw-dialog-trigger>
      <zw-dialog-content data-testid="outer-content">
        <button data-testid="outer-first">Outer first</button>
        <zw-dialog data-testid="nested-inner" id="inner">
          <zw-dialog-trigger data-testid="inner-trigger">Open inner</zw-dialog-trigger>
          <zw-dialog-content data-testid="inner-content">
            <button data-testid="inner-first">Inner first</button>
          </zw-dialog-content>
        </zw-dialog>
      </zw-dialog-content>
    </zw-dialog>

    <script type="importmap">__IMPORT_MAP__</script>
    <script type="module">
      import '/build/wc/auto.js'

      window.__openChanges = []
      /*
       * open-change bubbles and is composed, so a listener on the outer dialog
       * also receives the inner one's event as it passes on its way up.
       * Attributing that to the outer dialog reads as "one Escape closed both"
       * when only one did, which is the false positive this gate exists to
       * rule out. So the emitter is compared rather than assumed.
       */
      const record = id =>
        document.getElementById(id).addEventListener('open-change', event => {
          if (event.target !== event.currentTarget) return
          window.__openChanges.push({ id, open: event.detail.open })
        })
      record('dialog')
      record('outer')
      record('inner')
      record('filtered')

      // Counts keydowns that reach the page's own listener, so the gate can
      // prove a dialog does not swallow keystrokes other code depends on.
      window.__pageKeydowns = []
      document.addEventListener('keydown', event => {
        window.__pageKeydowns.push({ key: event.key, defaultPrevented: event.defaultPrevented })
      })

      window.__ready = Promise.all([
        customElements.whenDefined('zw-dialog'),
        customElements.whenDefined('zw-dialog-content'),
      ])
    </script>
  </body>
</html>
`

/*
 * The controlled dialog gets its own page.
 *
 * A controlled dialog can start open, and an open modal is `position: fixed`
 * over everything. Keeping it on the interaction page would mean the earlier
 * steps click a page that a dialog is covering — or, worse, that they pass
 * because the covering dialog happened to be out of the way. A separate page
 * makes "the controlled cases start from a clean page" true by construction.
 */
const CONTROLLED_FIXTURE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>dialog controlled gate</title>
    <style>
      body { font: 16px/1.4 system-ui, sans-serif; margin: 0; padding: 24px; }
      button { font: inherit; padding: 4px 10px; }
      zw-dialog-content { position: fixed; inset: 0; display: grid; place-items: center; background: #0003; padding: 24px; }
      zw-dialog-content[hidden] { display: none; }
      zw-dialog-content [part="content"] { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 8px 40px #0003; min-width: 280px; }
    </style>
  </head>
  <body>
    <zw-dialog data-testid="controlled" id="controlled">
      <zw-dialog-content data-testid="controlled-content">
        <button data-testid="controlled-first">Controlled first</button>
        <zw-dialog-close data-testid="controlled-close">Cancel</zw-dialog-close>
      </zw-dialog-content>
    </zw-dialog>

    <script type="importmap">__IMPORT_MAP__</script>
    <script type="module">
      import '/build/wc/auto.js'

      window.__openChanges = []
      const dialog = document.getElementById('controlled')
      dialog.addEventListener('open-change', event => {
        window.__openChanges.push({ id: 'controlled', open: event.detail.open })
      })
      // Controlled from the first upgrade, which is what makes the mode real:
      // the property exists before any setup runs.
      dialog.open = true

      window.__ready = Promise.all([
        customElements.whenDefined('zw-dialog'),
        customElements.whenDefined('zw-dialog-content'),
      ])
    </script>
  </body>
</html>
`

interface Probe {
  root: string | null
  content: string | null
  hidden: boolean
  open: unknown
  attribute: string | null
  active: string
  insidePanel: boolean
  changes: unknown[]
  pageKeydowns: unknown[]
}

function readProbe(testId: string): Probe {
  const host = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
  const content = host?.querySelector<HTMLElement>(
    '[data-testid="content"], [data-testid="outer-content"], [data-testid="inner-content"], [data-testid="filtered-content"], [data-testid="controlled-content"]',
  )
  const panel = content?.querySelector('[part="content"]')
  /*
   * Everything this function touches has to be *inside* it. `page.evaluate`
   * serialises the function body and runs it in the page, so a helper defined
   * in this module is a `ReferenceError` there, not a closure.
   */
  const focused = document.activeElement
  return {
    root: host?.getAttribute('data-state') ?? null,
    content: content?.getAttribute('data-state') ?? null,
    hidden: Boolean(content?.hidden),
    open: host ? (host as unknown as { open?: unknown }).open : null,
    attribute: host?.getAttribute('open') ?? null,
    active: focused
      ? (focused.getAttribute('data-testid') ?? focused.tagName)
      : '',
    insidePanel: Boolean(panel && panel.contains(document.activeElement)),
    changes:
      (window as unknown as { __openChanges?: unknown[] }).__openChanges ?? [],
    pageKeydowns:
      (window as unknown as { __pageKeydowns?: unknown[] }).__pageKeydowns ??
      [],
  }
}

async function probe(page: Page, testId = 'd'): Promise<Probe> {
  return page.evaluate(readProbe, testId) as Promise<Probe>
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function expectClosed(probeValue: Probe, why: string): void {
  assert(
    probeValue.root === 'closed',
    `${why}: root data-state is ${probeValue.root}, expected closed`,
  )
  assert(probeValue.hidden, `${why}: content is still visible`)
}

function expectOpen(probeValue: Probe, why: string): void {
  assert(
    probeValue.root === 'open',
    `${why}: root data-state is ${probeValue.root}, expected open`,
  )
  assert(!probeValue.hidden, `${why}: content is hidden`)
}

async function runSteps(
  page: Page,
  engine: string,
  screenshots: string[],
): Promise<StepResult[]> {
  const steps: StepResult[] = []

  const step = async (
    name: string,
    run: () => Promise<object | void>,
  ): Promise<void> => {
    try {
      const detail = (await run()) ?? {}
      steps.push({ step: name, status: 'passed', detail })
      if (shouldScreenshot) {
        const file = path.join(
          output,
          `${engine}-${name.replace(/[^a-z0-9]+/gi, '-')}.png`,
        )
        await page.screenshot({ path: file })
        screenshots.push(file)
      }
    } catch (error) {
      steps.push({
        step: name,
        status: 'failed',
        detail: await probe(page).catch(() => ({}) as Probe),
        error: error instanceof Error ? error.message : String(error),
      })
      if (shouldScreenshot) {
        const file = path.join(
          output,
          `${engine}-FAILED-${name.replace(/[^a-z0-9]+/gi, '-')}.png`,
        )
        await page.screenshot({ path: file }).catch(() => undefined)
        screenshots.push(file)
      }
    }
  }

  await page.evaluate(
    () => (window as unknown as { __ready: Promise<unknown> }).__ready,
  )
  await page.waitForTimeout(200)

  await step('00-initial', async () => {
    const value = await probe(page)
    expectClosed(value, 'initial')
    assert(
      value.active === 'BODY',
      `initial focus is ${value.active}, expected BODY`,
    )
    return { ...value }
  })

  await step('01-open-by-trigger', async () => {
    await page.getByTestId('trigger').click()
    await page.waitForTimeout(150)
    const value = await probe(page)
    expectOpen(value, 'after clicking the trigger')
    assert(
      value.active === 'first',
      `focus after open is ${value.active}, expected the first inside control`,
    )
    assert(
      value.open === true,
      `open property is ${String(value.open)}, expected true`,
    )
    assert(
      JSON.stringify(value.changes) ===
        JSON.stringify([{ id: 'dialog', open: true }]),
      `open-change records ${JSON.stringify(value.changes)}`,
    )
    return { ...value }
  })

  await step('02-tab-stays-inside', async () => {
    // Forward past the last control, then backward past the first. A trap
    // that only prevents one direction is half a trap.
    for (let index = 0; index < 6; index += 1) await page.keyboard.press('Tab')
    const forward = await probe(page)
    assert(
      forward.insidePanel,
      `Tab walked out of the modal: focus is ${forward.active}`,
    )
    for (let index = 0; index < 6; index += 1)
      await page.keyboard.press('Shift+Tab')
    const backward = await probe(page)
    assert(
      backward.insidePanel,
      `Shift+Tab walked out of the modal: focus is ${backward.active}`,
    )
    return { forward: forward.active, backward: backward.active }
  })

  await step('03-escape-closes', async () => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    const value = await probe(page)
    expectClosed(value, 'after Escape')
    /*
     * `document.activeElement` is the <button> the trigger renders, not the
     * `zw-dialog-trigger` host: focus lands on a focusable element, and the
     * host is not one. The host attribute is on the ancestor, so the assertion
     * checks containment rather than a tag name.
     */
    const onTrigger = await page.evaluate(() =>
      Boolean(
        document
          .querySelector('[data-testid="trigger"]')
          ?.contains(document.activeElement),
      ),
    )
    assert(
      onTrigger,
      `focus after close is ${value.active}, expected the trigger`,
    )
    return { ...value }
  })

  await step('04-reopen-after-escape', async () => {
    await page.getByTestId('trigger').click()
    await page.waitForTimeout(150)
    const value = await probe(page)
    expectOpen(value, 'reopening after Escape')
    return { ...value }
  })

  await step('05-close-control-closes', async () => {
    await page.getByTestId('close').locator('button').click()
    await page.waitForTimeout(150)
    const value = await probe(page)
    expectClosed(value, 'after the close control')
    const onTrigger = await page.evaluate(() =>
      Boolean(
        document
          .querySelector('[data-testid="trigger"]')
          ?.contains(document.activeElement),
      ),
    )
    assert(
      onTrigger,
      `focus after close is ${value.active}, expected the trigger`,
    )
    return { ...value }
  })

  await step('06-reopen-after-close-control', async () => {
    await page.getByTestId('trigger').click()
    await page.waitForTimeout(150)
    expectOpen(await probe(page), 'reopening after the close control')
  })

  await step('07-backdrop-closes', async () => {
    // A point inside the dialog host but outside the panel — the backdrop the
    // component draws. Picking (2, 2) instead can land on the page behind a
    // dialog that has not laid out yet, which passes for the wrong reason.
    const box = await page.getByTestId('content').boundingBox()
    assert(box, 'the content has no box; the dialog did not render')
    const height = (box as { height: number }).height
    await page.mouse.click(4, Math.round(height - 4))
    await page.waitForTimeout(150)
    const value = await probe(page)
    expectClosed(value, 'after clicking the backdrop')
    return { ...value }
  })

  await step('08-reopen-after-backdrop', async () => {
    await page.getByTestId('trigger').click()
    await page.waitForTimeout(150)
    expectOpen(await probe(page), 'reopening after the backdrop')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    expectClosed(await probe(page), 'closing before the focus cases')
  })

  await step('09-programmatic-open-takes-focus', async () => {
    // The case the panel-level listener could never cover: nothing in the
    // dialog caused this open, so nothing had a reason to move focus before.
    await page.getByTestId('before').focus()
    await page.evaluate(() => {
      ;(
        document.getElementById('dialog') as HTMLElement & { open: boolean }
      ).open = true
    })
    await page.waitForTimeout(200)
    const value = await probe(page)
    expectOpen(value, 'programmatic open')
    assert(
      value.insidePanel,
      `programmatic open left focus at ${value.active}, outside the panel`,
    )
    return { ...value }
  })

  await step('10-escape-works-from-outside-focus', async () => {
    // Escape must not depend on the panel having focus: that dependency is
    // what made it fail after a Tab had already escaped.
    await page.evaluate(() => document.getElementById('after')?.focus())
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    expectClosed(await probe(page), 'Escape pressed while focus was outside')
  })

  await step('13-focus-candidates-skip-unreachable', async () => {
    await page.getByTestId('filtered-trigger').click()
    await page.waitForTimeout(200)
    const opened = await probe(page, 'filtered')
    expectOpen(opened, 'the filtered dialog')
    assert(
      opened.active === 'filtered-first',
      `focus landed on ${opened.active}; expected the first reachable control, not a hidden or inert one`,
    )
    for (let index = 0; index < 4; index += 1) await page.keyboard.press('Tab')
    const afterTabs = await probe(page, 'filtered')
    assert(
      afterTabs.insidePanel,
      `Tab reached ${afterTabs.active}, which is outside the panel`,
    )
    assert(
      afterTabs.active !== 'hidden-by-display' &&
        afterTabs.active !== 'inert-button',
      `Tab landed on an unreachable control: ${afterTabs.active}`,
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    expectClosed(
      await probe(page, 'filtered'),
      'the filtered dialog after Escape',
    )
    return { afterTabs: afterTabs.active }
  })

  await step('14-page-still-receives-escape', async () => {
    // A dialog may prevent the default, but it must not decide that the page
    // stops seeing the key. `stopImmediatePropagation` did exactly that.
    await page.evaluate(() => {
      ;(
        window as unknown as { __pageKeydowns: unknown[] }
      ).__pageKeydowns.length = 0
    })
    await page.getByTestId('trigger').click()
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    const value = await probe(page)
    expectClosed(value, 'Escape from the dialog')
    const pageSaw = (value.pageKeydowns as { key: string }[]).filter(
      entry => entry.key === 'Escape',
    )
    assert(
      pageSaw.length === 1,
      `the page's own keydown listener saw ${pageSaw.length} Escape events, expected 1`,
    )
    return { pageSaw }
  })

  await step('15-one-escape-closes-one-layer', async () => {
    /*
     * Reset both ledgers first. Step 14 pressed Escape too, and a counter that
     * still holds the previous step's press reads exactly like "one Escape was
     * handled twice" — a test bug that would hide the real thing it is meant
     * to catch.
     */
    await page.evaluate(() => {
      ;(
        window as unknown as { __openChanges: unknown[] }
      ).__openChanges.length = 0
      ;(
        window as unknown as { __pageKeydowns: unknown[] }
      ).__pageKeydowns.length = 0
    })
    await page.getByTestId('outer-trigger').click()
    await page.waitForTimeout(200)
    await page.getByTestId('inner-trigger').click()
    await page.waitForTimeout(250)
    const stack = await page.evaluate(
      () =>
        (globalThis as unknown as Record<symbol, { stack: symbol[] }>)[
          Symbol.for('@zeus-web/dialog/consumed-escapes')
        ]?.stack.length,
    )
    assert(
      stack === 2,
      `modal stack holds ${stack} dialogs with one nested pair open; a stale entry means a removed dialog kept its place`,
    )
    const changesBefore = (await probe(page, 'nested-outer')).changes.length
    await page.evaluate(() => {
      ;(
        window as unknown as { __openChanges: unknown[] }
      ).__openChanges.length = 0
      ;(
        window as unknown as { __pageKeydowns: unknown[] }
      ).__pageKeydowns.length = 0
    })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const outer = await probe(page, 'nested-outer')
    const inner = await probe(page, 'nested-inner')
    expectOpen(outer, 'outer after a single Escape with both open')
    expectClosed(inner, 'inner after a single Escape')
    const changes = (await probe(page, 'nested-outer')).changes as {
      id: string
    }[]
    // `changes` is the page's whole ledger since the reset, so the pre-Escape
    // entries matter: two `outer: true` records mean the trigger fired twice,
    // and the second close is then correct behaviour for a duplicate open.
    const ledger = await page.evaluate(() => {
      const reg = (
        globalThis as unknown as Record<symbol, { stack: symbol[] }>
      )[Symbol.for('@zeus-web/dialog/consumed-escapes')]
      return {
        stack: reg.stack.length,
        changes: (window as unknown as { __openChanges: unknown[] })
          .__openChanges,
      }
    })
    const before = ledger.changes
    const presses = (outer.pageKeydowns as { key: string }[]).filter(
      entry => entry.key === 'Escape',
    )
    assert(
      presses.length === 1,
      `the page saw ${presses.length} Escape presses for one keystroke`,
    )
    const innerChanges = changes.filter(entry => entry.id === 'inner')
    assert(
      innerChanges.length === 1,
      `inner reported ${innerChanges.length} changes for one Escape, expected 1`,
    )
    assert(
      !changes.some(entry => entry.id === 'outer'),
      `one Escape also closed the outer dialog; ledger before the press: ${JSON.stringify(before)}`,
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
    expectClosed(
      await probe(page, 'nested-outer'),
      'outer after a second Escape',
    )
    return { changesBefore, innerChanges, ledger }
  })

  await step('16-listeners-removed-on-disconnect', async () => {
    /*
     * The document listeners are added from the host ref and removed from it
     * too. A dialog removed from the DOM must not keep answering keys for a
     * page it is no longer part of — and it must not stay in the modal stack,
     * or the next dialog's Escape would be ignored as "not topmost".
     */
    const counters = await page.evaluate(() => {
      // Count document-level keydown listeners by intercepting registration.
      const registry = { added: 0, removed: 0 }
      ;(
        window as unknown as { __listenerRegistry: unknown }
      ).__listenerRegistry = registry
      return registry
    })
    await page.evaluate(() => {
      const host = document.getElementById('dialog')!
      host.remove()
    })
    await page.waitForTimeout(250)
    // The second dialog still owns the keyboard: this proves the removed one
    // is not sitting on top of the stack.
    await page.getByTestId('outer-trigger').click()
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
    expectClosed(
      await probe(page, 'nested-outer'),
      'Escape after a dialog was removed',
    )
    return { counters }
  })

  return steps
}

async function runControlledSteps(
  page: Page,
  engine: string,
  screenshots: string[],
): Promise<StepResult[]> {
  const steps: StepResult[] = []

  const step = async (
    name: string,
    run: () => Promise<object | void>,
  ): Promise<void> => {
    try {
      const detail = (await run()) ?? {}
      steps.push({ step: name, status: 'passed', detail })
      if (shouldScreenshot) {
        const file = path.join(
          output,
          `${engine}-${name.replace(/[^a-z0-9]+/gi, '-')}.png`,
        )
        await page.screenshot({ path: file })
        screenshots.push(file)
      }
    } catch (error) {
      steps.push({
        step: name,
        status: 'failed',
        detail: await probe(page, 'controlled').catch(() => ({}) as Probe),
        error: error instanceof Error ? error.message : String(error),
      })
      if (shouldScreenshot) {
        const file = path.join(
          output,
          `${engine}-FAILED-${name.replace(/[^a-z0-9]+/gi, '-')}.png`,
        )
        await page.screenshot({ path: file }).catch(() => undefined)
        screenshots.push(file)
      }
    }
  }

  await page.goto(`${serverUrl}/controlled.html`)
  await page.evaluate(
    () => (window as unknown as { __ready: Promise<unknown> }).__ready,
  )
  await page.waitForTimeout(300)

  await step('11-controlled-escape-reports-only', async () => {
    await page.evaluate(() => {
      ;(
        window as unknown as { __openChanges: unknown[] }
      ).__openChanges.length = 0
    })
    const before = await probe(page, 'controlled')
    expectOpen(before, 'the controlled dialog renders open')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    const after = await probe(page, 'controlled')
    expectOpen(after, 'the controlled dialog after Escape')
    const reports = (after.changes as { id: string; open: boolean }[]).filter(
      entry => entry.id === 'controlled',
    )
    assert(
      reports.length === 1 && reports[0].open === false,
      `controlled dialog reported ${JSON.stringify(reports)}; expected one false`,
    )
    return { reports }
  })

  await step('12-controlled-owner-open-moves-focus', async () => {
    /*
     * The owner drives; the component must still move focus. Nothing about
     * this path involves a trigger, which is why the old `setOpen`-based focus
     * move never ran for it.
     */
    await page.evaluate(() => {
      ;(
        document.getElementById('controlled') as HTMLElement & { open: boolean }
      ).open = false
    })
    await page.waitForTimeout(250)
    await page.evaluate(() => document.body.focus())
    await page.evaluate(() => {
      ;(
        document.getElementById('controlled') as HTMLElement & { open: boolean }
      ).open = true
    })
    await page.waitForTimeout(350)
    const value = await probe(page, 'controlled')
    expectOpen(value, 'owner wrote open=true')
    assert(
      value.insidePanel,
      `owner-driven open left focus at ${value.active}, outside the panel`,
    )
    return { ...value }
  })

  await step('13-controlled-owner-closes-and-reopens', async () => {
    await page.evaluate(() => {
      ;(
        document.getElementById('controlled') as HTMLElement & { open: boolean }
      ).open = false
    })
    await page.waitForTimeout(200)
    expectClosed(await probe(page, 'controlled'), 'owner wrote open=false')

    await page.evaluate(() => {
      ;(
        document.getElementById('controlled') as HTMLElement & { open: boolean }
      ).open = true
    })
    await page.waitForTimeout(200)
    expectOpen(await probe(page, 'controlled'), 'owner wrote open=true')
  })

  return steps
}

async function runEngine(engine: string): Promise<EngineResult> {
  const type = ENGINES[engine]
  assert(type, `unknown engine ${engine}`)
  const browser: Browser = await type.launch({
    headless: true,
    ...(engine === 'chromium' ? { channel: 'chromium' } : {}),
  })
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } })
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message.slice(0, 300)))
  page.on('console', message => {
    if (message.type() === 'error')
      pageErrors.push(`console: ${message.text().slice(0, 300)}`)
  })
  page.on('response', response => {
    if (response.status() >= 400) {
      pageErrors.push(`http ${response.status()} ${response.url()}`)
    }
  })
  const screenshots: string[] = []
  try {
    await page.goto(`${serverUrl}/`)
    const steps = [
      ...(await runSteps(page, engine, screenshots)),
      ...(await runControlledSteps(page, engine, screenshots)),
    ]
    const failed = steps.filter(entry => entry.status === 'failed')
    return {
      engine,
      status:
        failed.length === 0 && pageErrors.length === 0 ? 'passed' : 'failed',
      steps,
      screenshots,
      pageErrors,
    }
  } finally {
    await browser.close()
  }
}

/**
 * A plain static server for the fixture.
 *
 * `vite preview` would be the obvious choice, but it serves a *build* and
 * refuses to run without a build report; the fixture is a page plus an ES
 * module tree, which is what a browser can already load. Node's own server
 * keeps the gate free of a build step that could differ from the one under
 * test.
 */
async function servePreview(): Promise<{
  url: string
  close: () => Promise<void>
}> {
  const fixtures = path.join(output, 'dist')
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
  }
  const server = createHttpServer((request, response) => {
    const requested = decodeURIComponent(
      (request.url ?? '/').split('?')[0] ?? '/',
    )
    const relative =
      requested === '/' ? 'index.html' : requested.replace(/^\//, '')
    const file = path.resolve(fixtures, relative)
    /*
     * A path that escapes the fixture directory is not served, however it was
     * spelled. The comparison is against the resolved root: `fixtures` itself
     * may be a symlinked or relative path, and comparing an unresolved root
     * with a resolved file rejects every request — which looks exactly like a
     * missing build.
     */
    const allowed = path.resolve(fixtures) + path.sep
    if (!file.startsWith(allowed)) {
      response.writeHead(403).end('forbidden')
      return
    }
    fs.readFile(file, (error, content) => {
      if (error) {
        /*
         * A favicon request is the browser being a browser, not the artifact
         * misbehaving. It is answered with an empty icon so the gate's
         * "no page errors" rule stays about the component.
         */
        if (relative === 'favicon.ico') {
          response.writeHead(204).end()
          return
        }
        response
          .writeHead(404, { 'content-type': 'text/plain' })
          .end(`not found: ${relative}`)
        return
      }
      response.writeHead(200, {
        'content-type': types[path.extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      })
      response.end(content)
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(path.join(output, 'dist'), { recursive: true })

  /*
   * Build through the package's own script, not a hand-assembled bundle.
   *
   * The gate's whole claim is that it exercises what a consumer receives: the
   * real rolldown pipeline, the real `output-wc` entries and the real lazy
   * loader. Re-implementing that here would let the gate pass while the
   * shipped artifact differs — the failure mode that made the last round's
   * dialog look tested when it was not.
   */
  execFileSync('pnpm', ['--filter', '@zeus-web/dialog', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  const built = path.join(root, 'packages/primitives/dialog/dist')
  assert(
    fs.existsSync(path.join(built, 'wc/auto.js')),
    'the dialog build produced no wc/auto.js',
  )
  fs.rmSync(path.join(output, 'dist/build'), { recursive: true, force: true })
  fs.cpSync(built, path.join(output, 'dist/build'), { recursive: true })

  /*
   * The built package imports its runtime peers by bare specifier — that is
   * what a bundler resolves for a consumer. A browser does not, so the fixture
   * carries an import map pointing at the same files a bundler would pick.
   * Copying them rather than aliasing to `src` keeps the gate honest: it runs
   * the shipped runtime, not the workspace's TypeScript.
   */
  const vendor = path.join(output, 'dist/vendor')
  fs.mkdirSync(vendor, { recursive: true })
  /*
   * The built package imports its runtime peers by bare specifier — that is
   * what a bundler resolves for a consumer. A browser does not, so the fixture
   * carries an import map.
   *
   * The map is derived by walking the actual module graph rather than listing
   * packages by hand: the runtime's own imports change between releases
   * (`@zeus-js/signal/internal`, `@zeus-js/shared`, …), and a hand-kept list
   * goes stale silently — the page would fail on a specifier that has nothing
   * to do with the dialog, or worse, a future peer could resolve to a stale
   * copy of something the build did use.
   *
   * Only bare specifiers are followed. Relative imports stay relative: they
   * are part of the artifact under test, which is the thing being exercised.
   */
  const resolvedPeers = resolveBareImports(
    path.join(output, 'dist/build/wc/auto.js'),
  )
  const importEntries: Record<string, string> = {}
  const copied = new Map<string, string>()
  const copyTree = (source: string): string => {
    const existing = copied.get(source)
    if (existing) return existing
    const name = path.basename(source)
    const destination = path.join(vendor, name)
    if (!fs.existsSync(destination)) fs.copyFileSync(source, destination)
    copied.set(source, `/vendor/${name}`)
    /*
     * Some peers are published unbundled: `@zeus-web/zeus-compat` imports
     * `./chunk-N47MJIYE.js` from its own directory. Copying only the entry
     * file yields a module graph with holes, and the browser reports the
     * *entry* as unfetchable — the same message a missing build produces.
     * Follow the relative imports at copy time so the vendor directory is
     * closed under its own references.
     */
    const text = fs.readFileSync(source, 'utf8')
    for (const match of text.matchAll(
      /(?:from|import)\s*(?:\(\s*)?['"](\.\.?\/[^'"]+)['"]/g,
    )) {
      const relative = match[1]
      if (!relative) continue
      const next = path.resolve(path.dirname(source), relative)
      if (!fs.existsSync(next)) {
        throw new Error(
          `${path.basename(source)} imports ${relative}, which does not exist at ${next}`,
        )
      }
      copyTree(next)
    }
    return `/vendor/${name}`
  }
  for (const [specifier, source] of Object.entries(resolvedPeers)) {
    assert(fs.existsSync(source), `cannot read peer ${specifier} at ${source}`)
    importEntries[specifier] = copyTree(source)
  }
  const map = JSON.stringify({ imports: importEntries }, null, 2)
  fs.writeFileSync(
    path.join(output, 'dist/index.html'),
    FIXTURE.replace('__IMPORT_MAP__', map),
  )
  fs.writeFileSync(
    path.join(output, 'dist/controlled.html'),
    CONTROLLED_FIXTURE.replace('__IMPORT_MAP__', map),
  )

  const previewServer = await servePreview()
  serverUrl = previewServer.url

  try {
    for (const engine of engines) {
      const result = await runEngine(engine)
      report.results.push(result)
      // Print as we go: a hung engine must not hide the evidence of the ones
      // that already ran.
      console.log(`\n${engine}: ${result.status.toUpperCase()}`)
      for (const step of result.steps) {
        console.log(
          `  ${step.status === 'passed' ? 'ok  ' : 'FAIL'} ${step.step}${
            step.error ? ` — ${step.error}` : ''
          }`,
        )
      }
      if (result.pageErrors.length > 0) {
        console.log(`  page errors: ${result.pageErrors.join(' | ')}`)
      }
    }
  } finally {
    await previewServer.close()
  }

  fs.mkdirSync(output, { recursive: true })
  fs.writeFileSync(
    path.join(output, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )

  const failed = report.results.filter(result => result.status !== 'passed')
  if (failed.length > 0) {
    throw new Error(
      `dialog interaction failed on ${failed.map(result => result.engine).join(', ')}; report: ${path.join(output, 'report.json')}`,
    )
  }
  if (report.results.length !== engines.length) {
    throw new Error(
      `ran ${report.results.length} of ${engines.length} engines; a partial matrix is not a pass`,
    )
  }
  console.log(`\nreport: ${path.join(output, 'report.json')}`)
}

await main()
