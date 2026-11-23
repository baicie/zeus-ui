/**
 * The CLI layer of `align-zeus-beta`, exercised as a process.
 *
 * The function-level tests cannot see this defect: they call `alignZeusBeta`
 * directly, so a `version` argument is whatever they pass. The bug lived in
 * the argument parsing — `parseVersionArg` returned the fallback constant when
 * argv was empty, so the CLI always handed `alignZeusBeta` a version and
 * `resolveWorkspaceZeusVersion` never ran. Aligning a workspace to the
 * previous release looked exactly like aligning it to the current one, as long
 * as the constant happened to match.
 *
 * Reproduced before the fix by setting the constant to `9.9.9-probe`: the
 * command printed `Aligned @zeus-js/* to 9.9.9-probe` against a workspace that
 * pinned 0.2.0-rc.5 everywhere.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const TSX_CLI = require.resolve('tsx/cli')
// `import.meta.url` rather than the injected `__dirname`: this package is
// `"type": "module"`, and the URL form is what Node documents for ESM. It also
// yields a file-URL-derived absolute path on every platform.
const CLI = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../align-zeus-beta.ts',
)

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function createTempRoot(): string {
  const root = join(
    tmpdir(),
    `zeus-align-cli-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(root, { recursive: true })
  tempRoots.push(root)
  return root
}

function writePackage(root: string, file: string, value: unknown): void {
  const target = join(root, file)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * A `pnpm-workspace.yaml` is required, not optional.
 *
 * `listZeusDependencyManifests` asks pnpm itself which packages belong to the
 * workspace (`pnpm --recursive list`). Without a workspace file pnpm answers
 * with a shape that `JSON.parse` rejects, and the CLI dies before it decides
 * anything — which is a property of the fixture, not of the code under test.
 */
function writeWorkspace(root: string): void {
  writeFileSync(
    join(root, 'pnpm-workspace.yaml'),
    'packages:\n  - "packages/*"\n  - "packages/primitives/*"\n',
  )
}

/**
 * Runs the CLI as a real child process, without a shell and without `npx`.
 *
 * `spawnSync('npx', …)` works on POSIX and fails on Windows: `npx` there is
 * `npx.cmd`, and Node cannot execute a `.cmd` without `shell: true`. The
 * process never starts, so `status` is `null`, `stdout`/`stderr` are
 * `undefined`, and the test reports `CLI exited null` — an error that says
 * nothing about the aligner.
 *
 * Resolving `tsx`'s own entry and running it under the current Node binary
 * avoids the whole class: no shell, no `.cmd` shim, no PATH lookup, identical
 * argv on every platform. `process.execPath` is the Node that is already
 * running the tests, so the CLI is exercised on the same runtime.
 */
function runCli(root: string, args: string[]): string {
  const result = spawnSync(process.execPath, [TSX_CLI, CLI, ...args], {
    cwd: root,
    encoding: 'utf8',
  })

  if (result.error) {
    throw new Error(`failed to start CLI: ${result.error.message}`)
  }

  if (result.status !== 0) {
    throw new Error(
      `CLI exited ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    )
  }

  return `${result.stdout}${result.stderr}`
}

describe('align-zeus-beta CLI', () => {
  it('reads the target version from the workspace when no argument is given', () => {
    const root = createTempRoot()
    writeWorkspace(root)

    // A version the fallback constant cannot accidentally equal. Using the
    // same version the fallback happens to hold would make this test pass
    // against the defect, which is exactly how the bug survived: the constant
    // and the workspace agreed until the next release moved only one of them.
    const FROM_WORKSPACE = '0.4.0-rc.9-pin'

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': FROM_WORKSPACE,
        '@zeus-js/runtime-dom': FROM_WORKSPACE,
      },
    })

    writePackage(root, 'packages/primitives/button/package.json', {
      name: '@zeus-web/button',
      dependencies: { '@zeus-js/runtime-dom': '0.1.1-beta.20' },
      peerDependencies: { '@zeus-js/zeus': '0.1.1-beta.20' },
    })

    const output = runCli(root, [])

    expect(output).toContain(`Aligned @zeus-js/* to ${FROM_WORKSPACE}`)

    const button = JSON.parse(
      readFileSync(
        join(root, 'packages/primitives/button/package.json'),
        'utf8',
      ),
    )

    expect(button.dependencies['@zeus-js/runtime-dom']).toBe(FROM_WORKSPACE)
    expect(button.peerDependencies['@zeus-js/zeus']).toBe(FROM_WORKSPACE)
  })

  it('uses the version named on the command line', () => {
    const root = createTempRoot()
    writeWorkspace(root)

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.2.0-rc.5',
        '@zeus-js/runtime-dom': '0.2.0-rc.5',
      },
    })

    writePackage(root, 'packages/primitives/button/package.json', {
      name: '@zeus-web/button',
      dependencies: { '@zeus-js/runtime-dom': '0.2.0-rc.5' },
    })

    const output = runCli(root, ['0.3.0-beta.1'])

    expect(output).toContain('Aligned @zeus-js/* to 0.3.0-beta.1')

    const button = JSON.parse(
      readFileSync(
        join(root, 'packages/primitives/button/package.json'),
        'utf8',
      ),
    )

    expect(button.dependencies['@zeus-js/runtime-dom']).toBe('0.3.0-beta.1')
  })

  it('leaves the independently versioned package alone', () => {
    const root = createTempRoot()
    writeWorkspace(root)

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.2.0-rc.5',
        '@zeus-js/vite-plugin': '0.0.5',
      },
    })

    runCli(root, [])

    const rootPackage = JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    )

    expect(rootPackage.devDependencies['@zeus-js/zeus']).toBe('0.2.0-rc.5')
    expect(rootPackage.devDependencies['@zeus-js/vite-plugin']).toBe('0.0.5')
  })

  it('falls back only when the workspace pins no Zeus dependency', () => {
    const root = createTempRoot()
    writeWorkspace(root)

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: { typescript: '^6.0.3' },
    })

    const output = runCli(root, [])

    // The fallback is a constant, so this asserts the shape rather than a
    // value that moves with every release.
    expect(output).toMatch(/Aligned @zeus-js\/\* to \d+\.\d+\.\d+/)
  })
})
