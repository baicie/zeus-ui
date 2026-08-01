import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const tsxCli = require.resolve('tsx/cli')
const scriptFile = join(
  process.cwd(),
  'scripts/commands/relax-zeus-peer-ranges.ts',
)
const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, {
      recursive: true,
      force: true,
    })
  }
})

describe('relax-zeus-peer-ranges', () => {
  it('relaxes nested primitive and advanced package peer ranges', () => {
    const root = createTempRoot()

    writePackage(root, 'packages/primitives/button/package.json', {
      name: '@zeus-web/button',
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-canary.1 <0.2.0',
      },
    })
    writePackage(root, 'packages/advanced/virtual/package.json', {
      name: '@zeus-web/virtual',
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-canary.1 <0.2.0',
      },
    })

    execFileSync(process.execPath, [tsxCli, scriptFile], {
      cwd: root,
      stdio: 'pipe',
    })

    expect(
      readPackage(root, 'packages/primitives/button/package.json'),
    ).toMatchObject({
      peerDependencies: {
        '@zeus-js/zeus': '*',
      },
    })
    expect(
      readPackage(root, 'packages/advanced/virtual/package.json'),
    ).toMatchObject({
      peerDependencies: {
        '@zeus-js/zeus': '*',
      },
    })
  })
})

function createTempRoot(): string {
  const root = join(
    tmpdir(),
    `zeus-ui-relax-zeus-peer-ranges-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,
  )

  mkdirSync(root, {
    recursive: true,
  })

  tempRoots.push(root)

  return root
}

function writePackage(
  root: string,
  relativeFile: string,
  value: Record<string, unknown>,
): void {
  const file = join(root, relativeFile)

  mkdirSync(dirname(file), {
    recursive: true,
  })

  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function readPackage(
  root: string,
  relativeFile: string,
): Record<string, unknown> {
  const file = join(root, relativeFile)

  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
}
