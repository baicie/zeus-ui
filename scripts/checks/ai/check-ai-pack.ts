/**
 * AI2-509 · Build & publish matrix for the AI Headless V2 packages.
 *
 * Builds and packs every `@zeus-web/ai-*` package, installs the tarballs into
 * a throwaway consumer outside the monorepo (no workspace links), and checks:
 *
 * - the tarball ships only `dist`, `package.json`, the README and LICENSE;
 * - no `workspace:` ranges leak into the packed manifest;
 * - dependency isolation: core / adapters / primitives have no UI framework,
 *   React and Vue are optional peers of their adapters only, WC depends on
 *   neither;
 * - every `exports` entry resolves to an ESM file with a `.d.ts` beside it;
 * - importing every entry in plain Node succeeds (SSR / no DOM globals);
 * - a consumer TypeScript file type-checks against the published types;
 * - gzip sizes of each entry, written to temp/ai-pack-report.json.
 *
 * Usage: pnpm ai:pack-check
 */

import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'

const root = resolve(import.meta.dirname, '../../..')

const PACKAGES = [
  { name: 'ai-core', deps: [], peers: [] },
  { name: 'ai-adapters', deps: ['@zeus-web/ai-core'], peers: [] },
  { name: 'ai-primitives', deps: ['@zeus-web/ai-core'], peers: [] },
  {
    name: 'ai-react',
    deps: ['@zeus-web/ai-core', '@zeus-web/ai-primitives'],
    peers: ['react'],
  },
  {
    name: 'ai-vue',
    deps: ['@zeus-web/ai-core', '@zeus-web/ai-primitives'],
    peers: ['vue'],
  },
  {
    name: 'ai-wc',
    deps: ['@zeus-web/ai-core', '@zeus-web/ai-primitives'],
    peers: [],
  },
] as const

const FORBIDDEN_DEPS = [
  'react',
  'react-dom',
  'vue',
  '@zeus-js/zeus',
  '@zeus-web/chat',
  '@zeus-web/agent-console',
]

interface Manifest {
  name: string
  version: string
  type?: string
  files?: string[]
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  exports: Record<string, { types: string; import: string }>
}

const failures: string[] = []
const report: Record<string, unknown> = {}

function fail(message: string): void {
  failures.push(message)
  console.error(`✗ ${message}`)
}

function run(command: string, args: string[], cwd = root): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

const work = mkdtempSync(join(tmpdir(), 'zeus-ai-pack-'))
const tarballs = join(work, 'tarballs')
const consumer = join(work, 'consumer')
mkdirSync(tarballs)
mkdirSync(join(consumer, 'node_modules', '@zeus-web'), { recursive: true })

try {
  for (const pkg of PACKAGES) {
    const dir = join(root, 'packages', pkg.name)
    console.log(`• ${pkg.name}: build + pack`)
    run('pnpm', ['--filter', `@zeus-web/${pkg.name}`, 'build'])
    run('pnpm', ['pack', '--pack-destination', tarballs], dir)

    const tarball = readdirSync(tarballs).find(file =>
      file.startsWith(`zeus-web-${pkg.name}-`),
    )
    if (!tarball) {
      fail(`${pkg.name}: no tarball produced`)
      continue
    }

    const listing = run('tar', ['-tzf', join(tarballs, tarball)])
      .trim()
      .split('\n')
    const unexpected = listing.filter(
      entry =>
        !/^package\/(?:dist\/|package\.json$|README\.md$|LICENSE$)/.test(entry),
    )
    if (unexpected.length > 0)
      fail(`${pkg.name}: tarball ships ${unexpected.join(', ')}`)

    const target = join(consumer, 'node_modules', '@zeus-web', pkg.name)
    mkdirSync(target, { recursive: true })
    run('tar', [
      '-xzf',
      join(tarballs, tarball),
      '-C',
      target,
      '--strip-components=1',
    ])

    const manifest = JSON.parse(
      readFileSync(join(target, 'package.json'), 'utf8'),
    ) as Manifest
    const text = JSON.stringify(manifest)
    if (text.includes('workspace:'))
      fail(`${pkg.name}: packed manifest still has workspace: ranges`)
    if (manifest.type !== 'module')
      fail(`${pkg.name}: not an ES module package`)

    const deps = Object.keys(manifest.dependencies ?? {}).sort()
    if (JSON.stringify(deps) !== JSON.stringify([...pkg.deps].sort())) {
      fail(
        `${pkg.name}: dependencies ${deps.join(', ') || '(none)'} ≠ expected ${pkg.deps.join(', ') || '(none)'}`,
      )
    }
    for (const forbidden of FORBIDDEN_DEPS) {
      if (manifest.dependencies?.[forbidden])
        fail(`${pkg.name}: must not depend on ${forbidden}`)
    }
    const peers = Object.keys(manifest.peerDependencies ?? {}).sort()
    if (JSON.stringify(peers) !== JSON.stringify([...pkg.peers].sort())) {
      fail(
        `${pkg.name}: peers ${peers.join(', ') || '(none)'} ≠ expected ${pkg.peers.join(', ') || '(none)'}`,
      )
    }

    const sizes: Record<string, unknown> = {}
    for (const [entry, target2] of Object.entries(manifest.exports)) {
      const js = join(target, target2.import)
      const dts = join(target, target2.types)
      if (!existsSync(js))
        fail(`${pkg.name}${entry.slice(1)}: missing ${target2.import}`)
      if (!existsSync(dts))
        fail(`${pkg.name}${entry.slice(1)}: missing ${target2.types}`)
      if (existsSync(js)) {
        const bytes = readFileSync(js)
        sizes[entry] = { bytes: bytes.length, gzip: gzipSync(bytes).length }
      }
    }
    report[pkg.name] = { version: manifest.version, sizes }
  }

  // Peer frameworks come from the repo's installs; nothing else is linked.
  for (const peer of [
    'react',
    'react-dom',
    'vue',
    '@vue',
    '@types/react',
    '@types/react-dom',
  ]) {
    const source = [
      join(root, 'packages', 'ai-react', 'node_modules', peer),
      join(root, 'packages', 'ai-vue', 'node_modules', peer),
      join(root, 'node_modules', peer),
    ].find(existsSync)
    if (source) {
      mkdirSync(dirname(join(consumer, 'node_modules', peer)), {
        recursive: true,
      })
      symlinkSync(source, join(consumer, 'node_modules', peer), 'dir')
    }
  }

  // SSR / Node import of every entry (the WC `/define` entry is client-only).
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'consumer', type: 'module', private: true }),
  )
  writeFileSync(
    join(consumer, 'ssr.mjs'),
    `const entries = ${JSON.stringify(
      PACKAGES.flatMap(pkg => {
        const manifest = JSON.parse(
          readFileSync(
            join(
              consumer,
              'node_modules',
              '@zeus-web',
              pkg.name,
              'package.json',
            ),
            'utf8',
          ),
        ) as Manifest
        return Object.keys(manifest.exports)
          .filter(entry => !entry.endsWith('/define'))
          .map(entry => `@zeus-web/${pkg.name}${entry.slice(1)}`)
      }),
    )}
for (const entry of entries) {
  const module = await import(entry)
  if (Object.keys(module).length === 0) throw new Error(entry + ' exports nothing')
}
if (typeof globalThis.document !== 'undefined' || typeof globalThis.HTMLElement !== 'undefined') throw new Error('DOM globals appeared')
console.log('imported', entries.length, 'entries in Node')
`,
  )
  try {
    console.log(`• ${run('node', ['ssr.mjs'], consumer).trim()}`)
  } catch (error) {
    fail(
      `Node / SSR import failed: ${(error as { stderr?: string }).stderr ?? String(error)}`,
    )
  }

  // Consumer type check against the published declarations.
  writeFileSync(
    join(consumer, 'consumer.ts'),
    `import type { AiHostAdapter } from '@zeus-web/ai-core'
import { createAiSession, createComposerController, createMockHost } from '@zeus-web/ai-core'
import { createSseHostAdapter } from '@zeus-web/ai-adapters'
import { parseMarkdown } from '@zeus-web/ai-primitives'
import { formatUsage } from '@zeus-web/ai-primitives/extensions'
import { AiComposer } from '@zeus-web/ai-react'
import { AiComposer as VueComposer } from '@zeus-web/ai-vue'
import { defineAiComposer } from '@zeus-web/ai-wc'

const host: AiHostAdapter = createMockHost()
const sse: AiHostAdapter = createSseHostAdapter({ baseUrl: 'https://host' })
const session = createAiSession({ host, streamId: 's', snapshotScope: { kind: 'conversation', id: 'c' } })
const composer = createComposerController({ session, conversationId: 'c' })
const blocks: number = parseMarkdown('# hi').length
const usage: string = formatUsage({ inputTokens: 1 })
export { AiComposer, blocks, composer, defineAiComposer, sse, usage, VueComposer }
`,
  )
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        types: [],
      },
      files: ['consumer.ts'],
    }),
  )
  try {
    run(
      join(root, 'node_modules', '.bin', 'tsc'),
      ['-p', 'tsconfig.json'],
      consumer,
    )
    console.log('• consumer type check passed against packed declarations')
  } catch (error) {
    fail(
      `consumer type check failed:\n${(error as { stdout?: string }).stdout ?? String(error)}`,
    )
  }

  mkdirSync(join(root, 'temp'), { recursive: true })
  writeFileSync(
    join(root, 'temp', 'ai-pack-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  console.log('• sizes written to temp/ai-pack-report.json')
} finally {
  if (!process.env.AI_PACK_KEEP) rmSync(work, { recursive: true, force: true })
  else console.log(`• kept ${work}`)
}

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s) in the AI publish matrix`)
  process.exit(1)
}
console.log('\nAI publish matrix passed.')
