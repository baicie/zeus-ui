import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'

import { dirname, join, resolve } from 'node:path'

import {
  authorZeusBaselineVersion,
  validateOutputPluginMetadata,
} from '../../../packages/registry/src/author'

/**
 * PR-25 acceptance check: Author & consume third-party packages entirely
 * outside the repository checkout.
 *
 * 1. An empty directory outside the repo authors a WebC package (WC + React +
 *    Vue wrappers + CEM + DTS) plus a third-party output plugin that reads the
 *    public build manifest.
 * 2. `zweb author check` validates the package and detects a consumer Zeus
 *    version conflict.
 * 3. `npm pack` proves the published shape (dist only).
 * 4. A separate external consumer extracts the tarball, registers the custom
 *    element, renders it in jsdom, dispatches an event, and mounts the React
 *    and Vue wrappers.
 *
 * The fixture never imports monorepo-internal runtime paths; only the
 * repository's installed published packages are linked for resolution.
 */

const root = process.cwd()
const cli = resolve(root, 'packages/cli/dist/index.js')
const keepFixtures = process.argv.includes('--keep')

assert(
  existsSync(cli),
  'Build @zeus-web/cli (pnpm --filter @zeus-web/cli build) before running check:author-consumer',
)

const expected = {
  tag: 'x-acme-counter',
  slot: 'label',
  part: 'button',
  event: 'acme-change',
} as const

const requestedPackages = [
  '@zeus-js/bundler-plugin',
  '@zeus-js/output-react-wrapper',
  '@zeus-js/output-vue-wrapper',
  '@zeus-js/output-wc',
  '@zeus-js/runtime-dom',
  '@zeus-js/web-c-runtime',
  '@zeus-js/zeus',
  '@zeus-web/registry',
  'jsdom',
  'react',
  'react-dom',
  'rolldown',
  'vue',
] as const

/** Resolves a package directory from the repository's own install. */
function resolvePackage(specifier: string): string {
  const requesters = [
    'examples/react-showcase/package.json',
    'examples/native-showcase/package.json',
    'packages/cli/package.json',
    'package.json',
  ]
  for (const requester of requesters) {
    const file = resolve(root, requester)
    if (!existsSync(file)) continue
    try {
      const candidate = execFileSync(
        process.execPath,
        [
          '-e',
          `const {createRequire}=require('node:module')
           const r=createRequire(${JSON.stringify(file)})
           process.stdout.write(r.resolve(${JSON.stringify(`${specifier}/package.json`)}))`,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim()
      return realpathSync(dirname(candidate))
    } catch {
      // Try the next requester.
    }
  }

  for (const directory of [
    resolve(root, 'node_modules', specifier),
    resolve(root, 'node_modules/.pnpm/node_modules', specifier),
  ]) {
    if (existsSync(directory)) return realpathSync(directory)
  }

  // Some @zeus-js packages restrict package.json from their exports map; fall
  // back to the pnpm virtual store layout.
  const store = resolve(root, 'node_modules/.pnpm')
  const prefix = `${specifier.replace('/', '+')}@`
  for (const entry of readdirSync(store)) {
    if (!entry.startsWith(prefix)) continue
    const candidate = resolve(store, entry, 'node_modules', specifier)
    if (existsSync(candidate)) return realpathSync(candidate)
  }

  throw new Error(`Cannot resolve ${specifier} from the repository install.`)
}

const packages = Object.fromEntries(
  requestedPackages.map(specifier => [specifier, resolvePackage(specifier)]),
) as Record<(typeof requestedPackages)[number], string>

const zeusVersion = (
  JSON.parse(
    readFileSync(join(packages['@zeus-js/zeus'], 'package.json'), 'utf8'),
  ) as {
    version: string
  }
).version

assert.equal(
  zeusVersion,
  authorZeusBaselineVersion,
  `The author contract baseline (${authorZeusBaselineVersion}) must match the installed Zeus (${zeusVersion}).`,
)

function link(nodeModules: string, specifier: string, target: string): void {
  const destination = join(nodeModules, specifier)
  mkdirSync(dirname(destination), { recursive: true })
  symlinkSync(target, destination, 'dir')
}

/** Links every runtime package a package or consumer may resolve. */
function linkRuntimePackages(nodeModules: string): void {
  for (const specifier of requestedPackages) {
    link(nodeModules, specifier, packages[specifier])
  }
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function run(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): string {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd,
      encoding: 'utf8',
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string }
    throw new Error(
      `${command} ${args.join(' ')} failed in ${options.cwd}:\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`,
    )
  }
}

interface AuthorReport {
  valid: boolean
  packageZeusVersion?: string
  consumerZeusVersion?: string
  diagnostics: Array<{ code: string; path: string; message: string }>
}

function authorCheck(
  packageDir: string,
  extra: string[] = [],
): { report: AuthorReport; status: number; stderr: string } {
  const result = spawnSync(
    process.execPath,
    [cli, 'author', 'check', packageDir, '--json', ...extra],
    { cwd: packageDir, encoding: 'utf8' },
  )
  const stdout = result.stdout ?? ''
  return {
    report: stdout.trim()
      ? (JSON.parse(stdout) as AuthorReport)
      : { valid: false, diagnostics: [] },
    status: result.status ?? 1,
    stderr: result.stderr ?? '',
  }
}

/**
 * Authors the package. Only public entry points are imported: `@zeus-js/*`
 * build tooling, its own wrapper outputs, and the author contract helper.
 */
function buildAuthorPackage(): {
  dir: string
  pluginId: string
  cleanup: () => void
} {
  const packageRoot = mkdtempSync(join(tmpdir(), 'zweb-author-package-'))
  const nodeModules = join(packageRoot, 'node_modules')
  mkdirSync(nodeModules)
  linkRuntimePackages(nodeModules)

  const pluginId = '@acme/zeus-output-report'

  writeJson(join(packageRoot, 'package.json'), {
    name: '@acme/counter-element',
    version: '0.1.0',
    private: true,
    type: 'module',
    files: ['dist'],
    exports: {
      '.': { types: './dist/wc/index.d.ts', import: './dist/wc/index.js' },
      './wc/auto': './dist/wc/auto.js',
      './custom-elements.json': './dist/custom-elements.json',
      './zeus.components.json': './dist/zeus.components.json',
      './react': {
        types: './dist/react/index.d.ts',
        import: './dist/react/index.js',
      },
      './vue': {
        types: './dist/vue/index.d.ts',
        import: './dist/vue/index.js',
      },
    },
    peerDependencies: { '@zeus-js/zeus': zeusVersion },
    dependencies: {
      '@zeus-js/output-react-wrapper': zeusVersion,
      '@zeus-js/output-vue-wrapper': zeusVersion,
      '@zeus-js/runtime-dom': zeusVersion,
      '@zeus-js/web-c-runtime': zeusVersion,
    },
    zeus: {
      kind: 'component-package',
      contractVersion: 1,
      zeusVersion,
      plugins: [
        {
          id: pluginId,
          version: '0.1.0',
          apiVersion: 1,
          capabilities: ['manifest:read'],
          outputs: ['assets'],
          order: 100,
        },
      ],
    },
  })

  mkdirSync(join(packageRoot, 'src'), { recursive: true })
  writeFileSync(
    join(packageRoot, 'src/index.tsx'),
    `import { defineElement, Host, Slot } from '@zeus-js/zeus'

export const AcmeCounter = defineElement(
  '${expected.tag}',
  {
    props: { count: Number, pressed: Boolean },
    emits: { '${expected.event}': { nativeEvent: Event } },
  },
  (props, ctx) => {
    const onClick = (nativeEvent: MouseEvent) => {
      ctx.emit['${expected.event}']({ nativeEvent })
    }
    return (
      <Host data-slot="acme-root">
        <button part="${expected.part}" onClick={onClick}>
          {props.count}
        </button>
        <Slot name="${expected.slot}" />
      </Host>
    )
  },
)
`,
  )

  // A third-party output plugin that reads only the public build context and
  // the public author contract helper.
  writeFileSync(
    join(packageRoot, 'src/output-plugin.ts'),
    `import { createAuthorPluginAsset } from '@zeus-web/registry/author'

export function acmeOutputReport() {
  return {
    name: '${pluginId}',
    generateBundle(context: { manifest: unknown }) {
      return [
        createAuthorPluginAsset({
          id: '${pluginId}',
          version: '0.1.0',
          fileName: 'acme.report.json',
          manifest: context.manifest,
        }),
      ]
    },
  }
}
`,
  )

  writeFileSync(
    join(packageRoot, 'rolldown.config.ts'),
    `import zeus from '@zeus-js/bundler-plugin/rolldown'
import react from '@zeus-js/output-react-wrapper'
import vue from '@zeus-js/output-vue-wrapper'
import wc from '@zeus-js/output-wc'
import { acmeOutputReport } from './src/output-plugin.ts'

export default {
  input: 'src/index.tsx',
  external: [
    '@zeus-js/zeus',
    '@zeus-js/runtime-dom',
    '@zeus-js/web-c-runtime',
    '@zeus-web/registry/author',
  ],
  plugins: [
    zeus({
      root: process.cwd(),
      transpile: true,
      dts: true,
      components: { include: ['src/**/*.tsx'] },
      plugins: [
        wc({
          outDir: 'wc',
          stripPrefix: 'x-',
          manifestFile: 'zeus.components.json',
          customElementsFile: 'custom-elements.json',
          dts: true,
          jsxDts: true,
          index: true,
        }),
        react({
          outDir: 'react',
          stripPrefix: 'x-',
          dts: true,
          index: true,
          namedSlots: 'props',
          wrapper: 'runtime',
        }),
        vue({
          outDir: 'vue',
          stripPrefix: 'x-',
          dts: true,
          globalDts: true,
          index: true,
        }),
        acmeOutputReport(),
      ],
    }),
  ],
}
`,
  )

  run(
    process.execPath,
    [join(packages.rolldown, 'bin/cli.mjs'), '--config', 'rolldown.config.ts'],
    { cwd: packageRoot },
  )

  for (const file of [
    'dist/wc/index.js',
    'dist/wc/auto.js',
    'dist/custom-elements.json',
    'dist/zeus.components.json',
    'dist/react/index.js',
    'dist/vue/index.js',
    'dist/acme.report.json',
  ]) {
    assert(
      existsSync(join(packageRoot, file)),
      `Third-party package build did not emit ${file}`,
    )
  }

  return {
    dir: packageRoot,
    pluginId,
    cleanup: () => rmSync(packageRoot, { recursive: true, force: true }),
  }
}

/** Verifies the generated report asset reflects the public manifest. */
function verifyPluginAsset(packageDir: string, pluginId: string): unknown {
  const report = JSON.parse(
    readFileSync(join(packageDir, 'dist/acme.report.json'), 'utf8'),
  ) as {
    schemaVersion: number
    plugin: { id: string; version: string; apiVersion: number }
    components: Array<{
      tag: string
      events: string[]
      slots: string[]
      parts: string[]
      hostAttributes: string[]
    }>
  }

  assert.equal(report.schemaVersion, 1)
  assert.deepEqual(report.plugin, {
    id: pluginId,
    version: '0.1.0',
    apiVersion: 1,
  })
  assert.deepEqual(report.components, [
    {
      tag: expected.tag,
      events: [expected.event],
      parts: [expected.part],
      slots: [expected.slot],
      hostAttributes: ['data-slot'],
    },
  ])
  return report
}

/** Extracts the packed tarball into an external consumer. */
function createConsumer(tarballPath: string): {
  dir: string
  cleanup: () => void
} {
  const consumerRoot = mkdtempSync(join(tmpdir(), 'zweb-author-consumer-'))
  const nodeModules = join(consumerRoot, 'node_modules')
  mkdirSync(nodeModules)
  linkRuntimePackages(nodeModules)

  const acmeRoot = join(nodeModules, '@acme/counter-element')
  mkdirSync(acmeRoot, { recursive: true })
  execFileSync(
    'tar',
    ['-xzf', tarballPath, '-C', acmeRoot, '--strip-components=1'],
    {
      cwd: consumerRoot,
      stdio: 'ignore',
    },
  )

  writeJson(join(consumerRoot, 'package.json'), {
    name: 'external-author-consumer',
    private: true,
    type: 'module',
  })

  return {
    dir: consumerRoot,
    cleanup: () => rmSync(consumerRoot, { recursive: true, force: true }),
  }
}

function consumeAsWebComponent(consumerDir: string): void {
  const script = join(consumerDir, 'consume-wc.mjs')
  writeFileSync(
    script,
    `import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><x-acme-counter></x-acme-counter></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
const window = dom.window
for (const key of Object.getOwnPropertyNames(window)) {
  if (typeof globalThis[key] === 'undefined') {
    try {
      Object.defineProperty(globalThis, key, { value: window[key], configurable: true })
    } catch {}
  }
}
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent', 'Event', 'MouseEvent', 'Node', 'Element', 'DocumentFragment', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'CSSStyleSheet']) {
  Object.defineProperty(globalThis, key, { value: window[key], configurable: true })
}

await import('@acme/counter-element/wc/auto')
const element = document.querySelector('x-acme-counter')
element.count = 3
element.pressed = true
const slot = document.createElement('span')
slot.setAttribute('slot', '${expected.slot}')
slot.textContent = 'slotted'
element.append(slot)
await new Promise(resolve => setTimeout(resolve, 60))

const button = element.querySelector('button')
const events = []
element.addEventListener('${expected.event}', event => {
  events.push({ type: event.type, detailKeys: Object.keys(event.detail ?? {}) })
})
button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))

console.log(JSON.stringify({
  tag: element.tagName.toLowerCase(),
  upgraded: typeof element.constructor === 'function' && element.constructor.name !== 'HTMLElement',
  buttonText: button?.textContent,
  part: button?.getAttribute('part'),
  hostAttribute: element.getAttribute('data-slot'),
  slotted: element.querySelector('span')?.textContent,
  events,
}))
`,
  )

  const output = run(process.execPath, [script], { cwd: consumerDir })
  const lines = output.trim().split('\n')
  const result = JSON.parse(lines[lines.length - 1] ?? '{}') as {
    tag: string
    upgraded: boolean
    buttonText: string
    part: string
    hostAttribute: string
    slotted: string
    events: Array<{ type: string; detailKeys: string[] }>
  }

  assert.equal(result.tag, expected.tag)
  assert.equal(result.upgraded, true, 'the custom element must upgrade')
  assert.equal(result.buttonText, '3')
  assert.equal(result.part, expected.part)
  assert.equal(result.hostAttribute, 'acme-root')
  assert.equal(result.slotted, 'slotted')
  assert.deepEqual(result.events, [
    { type: expected.event, detailKeys: ['nativeEvent'] },
  ])
}

function consumeAsVue(consumerDir: string): void {
  const script = join(consumerDir, 'consume-vue.mjs')
  writeFileSync(
    script,
    `import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
const window = dom.window
for (const key of Object.getOwnPropertyNames(window)) {
  if (typeof globalThis[key] === 'undefined') {
    try {
      Object.defineProperty(globalThis, key, { value: window[key], configurable: true })
    } catch {}
  }
}
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent', 'Event', 'MouseEvent', 'Node', 'Element', 'DocumentFragment', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'CSSStyleSheet']) {
  Object.defineProperty(globalThis, key, { value: window[key], configurable: true })
}

const { AcmeCounter } = await import('@acme/counter-element/vue')
const { createApp, h } = await import('vue')
const app = createApp({
  render: () => h(AcmeCounter, { count: 7 }, { ${expected.slot}: () => 'vue-slot' }),
})
app.mount(window.document.getElementById('root'))
await new Promise(resolve => setTimeout(resolve, 80))

const element = window.document.querySelector('${expected.tag}')
const result = {
  mounted: Boolean(element),
  text: element?.querySelector('button')?.textContent,
  slot: element?.querySelector('span')?.textContent ?? null,
}
app.unmount()
console.log(JSON.stringify(result))
`,
  )

  const output = run(process.execPath, [script], { cwd: consumerDir })
  const lines = output.trim().split('\n')
  const result = JSON.parse(lines[lines.length - 1] ?? '{}') as {
    mounted: boolean
    text: string
    slot: string | null
  }

  assert.equal(result.mounted, true, 'the Vue wrapper must mount the element')
  assert.equal(result.text, '7')
  assert.equal(
    result.slot,
    'vue-slot',
    'the Vue wrapper must project named slots',
  )
}

function consumeAsReact(consumerDir: string): void {
  const script = join(consumerDir, 'consume-react.mjs')
  writeFileSync(
    script,
    `import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
const window = dom.window
for (const key of Object.getOwnPropertyNames(window)) {
  if (typeof globalThis[key] === 'undefined') {
    try {
      Object.defineProperty(globalThis, key, { value: window[key], configurable: true })
    } catch {}
  }
}
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent', 'Event', 'MouseEvent', 'Node', 'Element', 'DocumentFragment', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'CSSStyleSheet']) {
  Object.defineProperty(globalThis, key, { value: window[key], configurable: true })
}

const { AcmeCounter } = await import('@acme/counter-element/react')
const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')

const container = window.document.getElementById('root')
const reactRoot = createRoot(container)
await act(async () => {
  reactRoot.render(React.createElement(AcmeCounter, { count: 11 }, null))
})
await new Promise(resolve => setTimeout(resolve, 80))

const element = window.document.querySelector('${expected.tag}')
console.log(JSON.stringify({
  mounted: Boolean(element),
  text: element?.querySelector('button')?.textContent,
}))
await act(async () => reactRoot.unmount())
`,
  )

  const output = run(process.execPath, [script], { cwd: consumerDir })
  const lines = output.trim().split('\n')
  const result = JSON.parse(lines[lines.length - 1] ?? '{}') as {
    mounted: boolean
    text: string
  }

  assert.equal(result.mounted, true, 'the React wrapper must mount the element')
  assert.equal(result.text, '11')
}

function main(): void {
  const evidence: Record<string, unknown> = {}
  const built = buildAuthorPackage()
  const consumer = { dir: '', cleanup: () => {} } as ReturnType<
    typeof createConsumer
  >
  void consumer
  try {
    // 1. The third-party output plugin produced its asset from the public
    // build manifest.
    evidence.outputPlugin = verifyPluginAsset(built.dir, built.pluginId)

    // 2. Plugin metadata validates through the public contract.
    const pluginMetadata = validateOutputPluginMetadata({
      zeus: JSON.parse(readFileSync(join(built.dir, 'package.json'), 'utf8'))
        .zeus,
    })
    assert.deepEqual(pluginMetadata, { valid: true, diagnostics: [] })

    // 3. The author package validates through the CLI, including the Zeus pin.
    const valid = authorCheck(built.dir)
    if (valid.status !== 0) {
      throw new Error(
        `zweb author check rejected the authored package:\n${JSON.stringify(valid.report.diagnostics, null, 2)}\n${valid.stderr}`,
      )
    }
    assert.equal(valid.report.valid, true)
    assert.equal(valid.report.packageZeusVersion, zeusVersion)
    assert.equal(valid.report.consumerZeusVersion, zeusVersion)

    // 4. A consumer Zeus version outside the peer pin fails the check.
    const conflict = authorCheck(built.dir, ['--zeus-version', '0.1.0-beta.1'])
    assert.equal(conflict.status, 1)
    assert.equal(conflict.report.valid, false)
    const mismatch = conflict.report.diagnostics.find(
      diagnostic => diagnostic.code === 'ZEUS_AUTHOR_PACKAGE_VERSION_MISMATCH',
    )
    if (!mismatch || !mismatch.message.includes('0.1.0-beta.1')) {
      throw new Error(
        `Expected a Zeus version mismatch diagnostic, got:\n${JSON.stringify(conflict, null, 2)}`,
      )
    }
    evidence.valid = valid.report
    evidence.versionConflict = conflict.report.diagnostics

    // 5. Publish shape: only dist travels in the tarball.
    const packDir = join(built.dir, 'pack')
    mkdirSync(packDir, { recursive: true })
    const packed = run('npm', ['pack', '--pack-destination', packDir], {
      cwd: built.dir,
    })
    const lines = packed.trim().split('\n')
    const tarball = lines[lines.length - 1] ?? ''
    const tarballPath = join(packDir, tarball)
    assert(existsSync(tarballPath), `npm pack did not produce ${tarballPath}`)

    const listing = execFileSync('tar', ['-tzf', tarballPath], {
      encoding: 'utf8',
    })
    assert(
      !listing.includes('node_modules/'),
      'tarball must not include node_modules',
    )
    assert(
      !listing.includes('package/src/'),
      'tarball must not include sources',
    )
    for (const required of [
      'package/dist/wc/auto.js',
      'package/dist/custom-elements.json',
      'package/dist/zeus.components.json',
      'package/dist/react/index.js',
      'package/dist/vue/index.js',
    ]) {
      assert(listing.includes(required), `tarball is missing ${required}`)
    }
    evidence.pack = {
      tarball,
      sha256: sha256(tarballPath),
      files: listing.trim().split('\n').length,
    }

    // 6. External consumer: register, render, dispatch, project, mount wrappers.
    const external = createConsumer(tarballPath)
    try {
      consumeAsWebComponent(external.dir)
      consumeAsVue(external.dir)
      consumeAsReact(external.dir)
      evidence.consumer = {
        directory: external.dir,
        webComponent: 'pass',
        vue: 'pass',
        react: 'pass',
      }
    } finally {
      if (!keepFixtures) external.cleanup()
    }

    console.log(
      JSON.stringify(
        { check: 'author-consumer', status: 'pass', evidence },
        null,
        2,
      ),
    )
  } finally {
    if (!keepFixtures) built.cleanup()
  }
}

main()
