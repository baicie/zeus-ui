import type { BrowserServer } from '@playwright/test'
import type { PreviewServer } from 'vite'
import type { ModeFixtureResult } from './component-mode-fixture'
import type { ComponentModeRun } from './component-mode-parity'

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium, firefox, webkit } from '@playwright/test'
import zeus from '@zeus-js/bundler-plugin/rolldown'
import wc from '@zeus-js/output-wc'
import { rolldown } from 'rolldown'
import { build, preview } from 'vite'

import { verifyComponentModeRuns } from './component-mode-parity'
import {
  boundedOperation,
  ensureFixtureSymlink,
} from './component-mode-resources'

const root = process.cwd()
const sources = [
  'packages/primitives/button/src/button.tsx',
  'packages/primitives/input/src/input.tsx',
  'packages/primitives/dialog/src/dialog.tsx',
  'packages/advanced/data-grid/src/components/data-grid.tsx',
]
const output = path.resolve(option('--output') || 'temp/component-mode-parity')
const browsers = (option('--browsers') || 'chromium,firefox,webkit').split(',')
const engines = { chromium, firefox, webkit }
const channel = option('--chromium-channel')
const modes = ['eager', 'lazy'] as const
const fixture = fileURLToPath(
  new URL('./component-mode-fixture.ts', import.meta.url),
)
const results: ComponentModeRun[] = []
const browserServers = new Set<BrowserServer>()
const previewServers = new Set<PreviewServer>()
const closeTimeoutMs = 5_000
const timeoutMs = Number(option('--timeout-ms') || 600_000)
const webComponentRuntime = fs.realpathSync(
  path.join(
    fs.realpathSync(path.join(root, 'node_modules/@zeus-js/output-wc')),
    '../web-c-runtime',
  ),
)
const report: Record<string, unknown> = {
  kind: 'real-source eager/lazy build and browser parity; not registry acceptance',
  createdAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  node: process.version,
  frameworkVersion: readJson(
    path.join(root, 'node_modules/@zeus-js/zeus/package.json'),
  ).version,
  bundlerVersion: readJson(
    path.join(root, 'node_modules/@zeus-js/bundler-plugin/package.json'),
  ).version,
  webComponentRuntime: {
    path: webComponentRuntime,
    version: readJson(path.join(webComponentRuntime, 'package.json')).version,
  },
  timeoutMs,
  closeTimeoutMs,
  sourceSha256: Object.fromEntries(
    sources.map(source => [
      source,
      sha256(fs.readFileSync(path.join(root, source))),
    ]),
  ),
  browsers,
  chromiumChannel: channel || 'playwright-default',
  results,
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index < 0 ? undefined : process.argv[index + 1]
}
function readJson(filename: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as Record<
    string,
    unknown
  >
}
function sha256(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}
function sequence<T>(
  values: readonly T[],
  callback: (value: T) => Promise<unknown>,
): Promise<void> {
  return values.reduce(
    (pending, value) =>
      pending.then(() => callback(value)).then(() => undefined),
    Promise.resolve(),
  )
}
function buildMode(mode: 'eager' | 'lazy'): Promise<void> {
  const dir = path.join(output, mode)
  const entry = path.join(dir, 'source.ts')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    entry,
    sources
      .map(source => `export * from ${JSON.stringify(path.join(root, source))}`)
      .join('\n'),
  )
  return rolldown({
    input: entry,
    external: id => /^@zeus-js\//.test(id) || id === '@zeus-web/zeus-compat',
    plugins: [
      zeus({
        root,
        transpile: true,
        dts: false,
        components: { include: sources },
        plugins: [
          wc({
            outDir: 'wc',
            stripPrefix: 'zw-',
            manifestFile: 'zeus.components.json',
            customElementsFile: false,
            dts: false,
            jsxDts: false,
            index: true,
            register: mode === 'eager' ? 'side-effect' : 'lazy',
          }),
        ],
      }),
    ],
  })
    .then(bundle =>
      bundle
        .write({ dir: path.join(dir, 'output'), format: 'esm' })
        .finally(() => bundle.close()),
    )
    .then(() => buildConsumer(mode))
}
function buildConsumer(mode: 'eager' | 'lazy'): Promise<void> {
  const dir = path.join(output, mode)
  const dependencies = {
    '@zeus-web/zeus-compat': path.join(root, 'packages/zeus-compat'),
    // Generated loaders consume the same runtime installed for output-wc.
    // pnpm correctly keeps that transitive dependency out of the root scope.
    '@zeus-js/web-c-runtime': webComponentRuntime,
  }
  for (const [name, target] of Object.entries(dependencies)) {
    const dependency = path.join(dir, 'node_modules', name)
    ensureFixtureSymlink(dependency, target)
  }
  const manifest = readJson(path.join(dir, 'output/zeus.components.json'))
  const components = manifest.components as Array<{ tag: string }>
  const tags = components.map(component => component.tag)
  for (const expected of [
    'zw-button',
    'zw-input',
    'zw-dialog',
    'zw-data-grid',
  ]) {
    if (!tags.includes(expected))
      throw new Error(`${mode} omitted the real ${expected} source component`)
  }
  const registration =
    mode === 'lazy'
      ? `() => import('./output/wc/index.js').then(module => { module.defineCustomElements() })`
      : `() => Promise.all([${tags.map(tag => `import(${JSON.stringify(`./output/wc/${tag.slice(3)}.js`)})`).join(',')}]).then(modules => { for (const module of modules) module.defineCustomElement() })`
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<script type="module" src="./consumer.ts"></script>',
  )
  fs.writeFileSync(
    path.join(dir, 'consumer.ts'),
    `import { runComponentModeFixture } from ${JSON.stringify(fixture)}\nrunComponentModeFixture(${registration}).then(result => { window.__componentMode = { passed: true, result } }, error => { window.__componentMode = { passed: false, error: String(error.stack || error) } })\n`,
  )
  return build({
    root: dir,
    configFile: false,
    logLevel: 'warn',
    resolve: {
      dedupe: ['@zeus-js/zeus', '@zeus-js/signal', '@zeus-js/runtime-dom'],
    },
  }).then(() => undefined)
}
function terminateBrowser(server: BrowserServer): void {
  // BrowserServer owns this process and Playwright's kill terminates its process
  // tree. Never search for, or terminate, unrelated browser processes.
  server
    .kill()
    .catch(error => console.error('Owned browser termination failed', error))
}
function terminatePreview(server: PreviewServer): void {
  if ('closeAllConnections' in server.httpServer)
    server.httpServer.closeAllConnections()
  else server.httpServer.close()
}
function writeReport(): void {
  fs.mkdirSync(output, { recursive: true })
  fs.writeFileSync(
    path.join(output, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
}
function browserMode(mode: 'eager' | 'lazy', name: string): Promise<void> {
  const engine = engines[name as keyof typeof engines]
  if (!engine) return Promise.reject(new Error(`Unsupported browser ${name}`))
  const dir = path.join(output, mode)
  return preview({
    root: dir,
    configFile: false,
    logLevel: 'warn',
    preview: { host: '127.0.0.1', port: 0 },
  })
    .then(server => {
      previewServers.add(server)
      return Promise.resolve()
        .then(() => {
          const address = server.httpServer.address()
          if (!address || typeof address === 'string')
            throw new Error('Preview did not bind a port')
          return engine
            .launchServer({
              headless: true,
              channel: name === 'chromium' ? channel : undefined,
              timeout: 30_000,
            })
            .then(browserServer => {
              browserServers.add(browserServer)
              return engine
                .connect(browserServer.wsEndpoint(), { timeout: 10_000 })
                .then(browser => {
                  const errors: string[] = []
                  return browser
                    .newPage()
                    .then(page => {
                      page.on('pageerror', error => errors.push(error.message))
                      return page
                        .goto(`http://127.0.0.1:${address.port}`, {
                          timeout: 30_000,
                        })
                        .then(() =>
                          page.waitForFunction(
                            () =>
                              Boolean(
                                (
                                  window as Window & {
                                    __componentMode?: unknown
                                  }
                                ).__componentMode,
                              ),
                            undefined,
                            { timeout: 30_000 },
                          ),
                        )
                        .then(() =>
                          page.evaluate(
                            () =>
                              (
                                window as Window & {
                                  __componentMode?: {
                                    passed: boolean
                                    result?: ModeFixtureResult
                                    error?: string
                                  }
                                }
                              ).__componentMode,
                          ),
                        )
                        .then(value => {
                          if (
                            !value ||
                            !value.passed ||
                            !value.result ||
                            errors.length
                          ) {
                            throw new Error(JSON.stringify({ value, errors }))
                          }
                          results.push({
                            browser: name,
                            mode,
                            status: 'passed',
                            result: value.result,
                          })
                        })
                    })
                    .finally(() =>
                      boundedOperation(
                        'browser connection close',
                        () => browser.close(),
                        closeTimeoutMs,
                        () => terminateBrowser(browserServer),
                      ),
                    )
                })
                .finally(() =>
                  boundedOperation(
                    'owned browser process close',
                    () => browserServer.close(),
                    closeTimeoutMs,
                    () => terminateBrowser(browserServer),
                  ).then(() => {
                    browserServers.delete(browserServer)
                  }),
                )
            })
        })
        .finally(() =>
          boundedOperation(
            'preview server close',
            () => server.close(),
            closeTimeoutMs,
            () => terminatePreview(server),
          ).then(() => {
            previewServers.delete(server)
          }),
        )
    })
    .catch(error => {
      results.push({
        browser: name,
        mode,
        status: 'failed',
        error: String(error),
      })
    })
}
function checkBrowser(name: string): Promise<void> {
  return sequence(modes, mode => browserMode(mode, name))
}
function run(): Promise<void> {
  fs.mkdirSync(output, { recursive: true })
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    report.status = 'failed'
    report.error = '--timeout-ms must be positive'
    writeReport()
    return Promise.reject(new Error(String(report.error)))
  }
  let timedOut = false
  const watchdog = setTimeout(() => {
    timedOut = true
    report.status = 'failed'
    report.error = `Component mode parity exceeded ${timeoutMs}ms including build and cleanup`
    writeReport()
    for (const server of previewServers) terminatePreview(server)
    for (const server of browserServers) terminateBrowser(server)
    // Native build or browser handles may never settle. The failed evidence is
    // already saved; bound this CLI's own lifetime after terminating its resources.
    setTimeout(() => process.exit(1), 1_000)
  }, timeoutMs)
  return sequence(modes, buildMode)
    .then(() => {
      const eager = fs.readFileSync(
        path.join(output, 'eager/output/zeus.components.json'),
      )
      const lazy = fs.readFileSync(
        path.join(output, 'lazy/output/zeus.components.json'),
      )
      if (sha256(eager) !== sha256(lazy)) {
        throw new Error(
          'The two register modes did not use the same Analyzer Manifest',
        )
      }
      report.manifestSha256 = sha256(eager)
      return sequence(browsers, checkBrowser)
    })
    .then(() => {
      if (timedOut) throw new Error(String(report.error))
      verifyComponentModeRuns(browsers, results)
      report.status = 'passed'
      report.differences = 0
    })
    .catch(error => {
      report.status = 'failed'
      report.error = String(error)
      throw error
    })
    .finally(() => {
      clearTimeout(watchdog)
      writeReport()
      console.info(
        `Component mode parity report: ${path.join(output, 'report.json')}`,
      )
    })
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch(error => {
    console.error(error)
    process.exitCode = 1
    // A failed native build or close may keep handles alive after rejection.
    setTimeout(() => process.exit(1), 1_000).unref()
  })
}
