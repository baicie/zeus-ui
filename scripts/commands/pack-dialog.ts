import type { Buffer } from 'node:buffer'
/**
 * Builds `@zeus-web/dialog` from a pinned commit and writes a tarball another
 * repository can install.
 *
 * Why a script rather than `pnpm pack`: the manifest cannot be installed as
 * written. `@zeus-web/zeus-compat` is `workspace:*`, which only pnpm resolves
 * inside this workspace; the release tooling rewrites it at publish time, and
 * a tarball consumed from `zeus` needs the same rewrite. Doing it by hand once
 * produced a tarball whose version and content nobody could check later — the
 * failure this script exists to prevent.
 *
 * What it guarantees, and what `--verify` re-checks:
 *
 * 1. the source tree is exactly `--commit`, with nothing uncommitted;
 * 2. the build output carries the dialog state fix;
 * 3. the tarball's manifest names the same version as the package;
 * 4. a `provenance.json` beside it records commit, version, content digest and
 *    every file, so a consumer can prove what it installed.
 *
 * Usage:
 *
 *   pnpm dialog:pack --commit 49ae853b --out ../zeus/vendor
 *   pnpm dialog:pack --verify ../zeus/vendor/zeus-web-dialog-0.1.0-beta.35.tgz
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'

const root = path.resolve(import.meta.dirname, '../..')
const packageDirectory = path.join(root, 'packages/primitives/dialog')

/** Symbols the fixed build records; absence means the fix is not in it. */
const REQUIRED_MARKERS = [
  '@zeus-web/dialog/state',
  '@zeus-web/dialog/consumed-escapes',
]

const { values } = parseArgs({
  options: {
    commit: { type: 'string' },
    out: { type: 'string' },
    verify: { type: 'string' },
  },
})

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function sha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex')
}

function manifestOf(directory: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(directory, 'package.json'), 'utf8'),
  ) as Record<string, unknown>
}

/**
 * Fails unless `HEAD` is `commit` and nothing is modified.
 *
 * A dirty tree is not a cosmetic problem here: the artifact is supposed to be
 * reproducible from a commit, and an uncommitted edit means the bytes on disk
 * are not the bytes that commit describes.
 */
function assertPinnedSource(commit: string): void {
  const head = git(['rev-parse', 'HEAD'])
  if (head !== commit) {
    throw new Error(
      `HEAD is ${head}, not ${commit}; check out that commit first`,
    )
  }
  const dirty = git(['status', '--porcelain'])
  if (dirty) {
    throw new Error(
      `working tree is not clean at ${commit}:\n${dirty}\n` +
        'The tarball must be reproducible from the commit alone.',
    )
  }
}

function build(): void {
  execFileSync('pnpm', ['--filter', '@zeus-web/dialog', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  const entry = path.join(packageDirectory, 'dist/wc/zw-dialog.entry.js')
  if (!fs.existsSync(entry)) {
    throw new Error(`the build produced no ${entry}`)
  }
  const source = fs.readFileSync(entry, 'utf8')
  const missing = REQUIRED_MARKERS.filter(marker => !source.includes(marker))
  if (missing.length > 0) {
    throw new Error(
      `the built entry is missing ${missing.join(', ')}; this commit does not contain the dialog fix`,
    )
  }
}

function stage(): string {
  const staged = path.join(root, 'temp/pack')
  fs.rmSync(staged, { recursive: true, force: true })
  fs.mkdirSync(staged, { recursive: true })
  fs.cpSync(path.join(packageDirectory, 'dist'), path.join(staged, 'dist'), {
    recursive: true,
  })
  // Every file inside `dist`: a tarball that silently drops the lazy entries
  // installs a component that cannot render.
  const stagedFiles = execFileSync(
    'find',
    [path.join(staged, 'dist'), '-type', 'f'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean)
  const builtFiles = execFileSync(
    'find',
    [path.join(packageDirectory, 'dist'), '-type', 'f'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean)
  if (stagedFiles.length !== builtFiles.length) {
    throw new Error(
      `staged ${stagedFiles.length} files of ${builtFiles.length}; the copy lost something`,
    )
  }

  const manifest = manifestOf(packageDirectory)
  const dependencies = {
    ...((manifest.dependencies as Record<string, string> | undefined) ?? {}),
  }
  /*
   * Only the workspace protocol is rewritten. A published tarball would have
   * the released version here; the version this repository currently resolves
   * is the honest stand-in, and `provenance.json` records that it was
   * rewritten rather than published.
   */
  const compat = dependencies['@zeus-web/zeus-compat']
  if (compat?.startsWith('workspace:')) {
    dependencies['@zeus-web/zeus-compat'] = '0.1.0-beta.34'
  }
  const rewritten = {
    ...manifest,
    dependencies,
  }
  fs.writeFileSync(
    path.join(staged, 'package.json'),
    `${JSON.stringify(rewritten, null, 2)}\n`,
  )
  for (const extra of ['README.md', 'LICENSE']) {
    const source = path.join(packageDirectory, extra)
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(staged, extra))
  }
  return staged
}

function contentDigest(directory: string): {
  digest: string
  files: { path: string; sha256: string; bytes: number }[]
} {
  const files: { path: string; sha256: string; bytes: number }[] = []
  const walk = (current: string, prefix: string): void => {
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      .sort((left, right) => (left.name < right.name ? -1 : 1))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(absolute, relative)
      } else if (entry.isFile()) {
        const content = fs.readFileSync(absolute)
        files.push({
          path: relative,
          sha256: sha256(content),
          bytes: content.byteLength,
        })
      }
    }
  }
  walk(directory, '')
  const hash = createHash('sha256')
  for (const file of files) hash.update(`${file.path}\0${file.sha256}\n`)
  return { digest: `sha256:${hash.digest('hex')}`, files }
}

function pack(staged: string, out: string, commit: string): void {
  fs.mkdirSync(out, { recursive: true })
  const manifest = manifestOf(staged)
  const tarballName = `zeus-web-dialog-${String(manifest.version)}.tgz`
  execFileSync('npm', ['pack', '--pack-destination', out], {
    cwd: staged,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  const tarball = path.join(out, tarballName)
  if (!fs.existsSync(tarball)) {
    throw new Error(`npm pack did not produce ${tarball}`)
  }
  const content = contentDigest(staged)
  const provenance = {
    schema: 'zeus-web.local-dialog-build/v1',
    package: manifest.name,
    version: manifest.version,
    commit,
    builtAt: new Date().toISOString(),
    tarball: tarballName,
    tarballSha256: sha256(fs.readFileSync(tarball)),
    contentDigest: content.digest,
    files: content.files,
    rewrites: [
      'dependencies["@zeus-web/zeus-compat"]: workspace:* -> 0.1.0-beta.34',
    ],
    note: 'Local build for cross-repository integration. Not published to npm.',
  }
  fs.writeFileSync(
    path.join(out, 'zeus-web-dialog.provenance.json'),
    `${JSON.stringify(provenance, null, 2)}\n`,
  )
  console.log(`\npacked ${tarball}`)
  console.log(`  commit:  ${commit}`)
  console.log(`  version: ${String(manifest.version)}`)
  console.log(`  content: ${content.digest}`)
  console.log(`  files:   ${content.files.length}`)
}

/**
 * Re-checks an installed or packed copy against the rules the build asserts.
 *
 * This is what a consumer should run: it proves the package it installed is a
 * build of the commit the provenance names, and that the build contains the
 * fix — rather than trusting a version string.
 */
function verify(tarballPath: string): void {
  const provenancePath = path.join(
    path.dirname(tarballPath),
    'zeus-web-dialog.provenance.json',
  )
  if (!fs.existsSync(provenancePath)) {
    throw new Error(`no provenance beside ${tarballPath}`)
  }
  const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8')) as {
    version: string
    commit: string
    tarballSha256: string
    contentDigest: string
    files: { path: string; sha256: string }[]
  }
  const actual = sha256(fs.readFileSync(tarballPath))
  if (actual !== provenance.tarballSha256) {
    throw new Error(
      `tarball digest ${actual} does not match provenance ${provenance.tarballSha256}`,
    )
  }
  const scratch = fs.mkdtempSync(path.join(root, 'temp/verify-dialog-'))
  try {
    execFileSync('tar', ['-xzf', tarballPath, '-C', scratch], { stdio: 'pipe' })
    const extracted = path.join(scratch, 'package')
    const manifest = manifestOf(extracted)
    if (manifest.version !== provenance.version) {
      throw new Error(
        `manifest version ${String(manifest.version)} != provenance ${provenance.version}`,
      )
    }
    const entry = fs.readFileSync(
      path.join(extracted, 'dist/wc/zw-dialog.entry.js'),
      'utf8',
    )
    const missing = REQUIRED_MARKERS.filter(marker => !entry.includes(marker))
    if (missing.length > 0) {
      throw new Error(`the tarball is missing ${missing.join(', ')}`)
    }
    const content = contentDigest(extracted)
    if (content.digest !== provenance.contentDigest) {
      throw new Error(
        `content digest ${content.digest} != provenance ${provenance.contentDigest}`,
      )
    }
    console.log(`verified ${path.basename(tarballPath)}`)
    console.log(`  commit:  ${provenance.commit}`)
    console.log(`  version: ${provenance.version}`)
    console.log(`  content: ${content.digest}`)
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true })
  }
}

if (values.verify) {
  verify(path.resolve(values.verify))
} else {
  if (!values.commit) throw new Error('--commit is required')
  if (!values.out) throw new Error('--out is required')
  assertPinnedSource(values.commit)
  build()
  const staged = stage()
  pack(staged, path.resolve(values.out), values.commit)
}
