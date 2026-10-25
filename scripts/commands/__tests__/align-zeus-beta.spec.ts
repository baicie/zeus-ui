import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { alignZeusBeta } from '../align-zeus-beta'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, {
      recursive: true,
      force: true,
    })
  }
})

describe('alignZeusBeta', () => {
  it('defaults prerelease @zeus-js/zeus peers to the coordinated beta', () => {
    const root = createTempRoot()

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.5',
        '@zeus-js/runtime-dom': '0.1.0-beta.5',
        typescript: '^6.0.3',
      },
    })

    writePackage(root, 'packages/advanced/data-grid/package.json', {
      name: '@zeus-web/data-grid',
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.5 <0.2.0',
        react: '>=18 || >=19',
      },
      dependencies: {
        '@zeus-js/runtime-dom': '0.1.0-beta.5',
        '@zeus-js/web-c-runtime': '0.2.0',
        '@zeus-web/virtual': 'workspace:*',
      },
    })

    const result = alignZeusBeta({ root })

    expect(result.version).toBe('0.1.1-beta.18')
    expect(result.peerRange).toBe('0.1.1-beta.18')
    expect(result.changedFiles).toHaveLength(2)

    expect(readPackage(root, 'package.json')).toMatchObject({
      devDependencies: {
        '@zeus-js/zeus': '0.1.1-beta.18',
        '@zeus-js/runtime-dom': '0.1.1-beta.18',
        typescript: '^6.0.3',
      },
    })

    expect(
      readPackage(root, 'packages/advanced/data-grid/package.json'),
    ).toMatchObject({
      peerDependencies: {
        '@zeus-js/zeus': '0.1.1-beta.18',
        react: '>=18 || >=19',
      },
      dependencies: {
        '@zeus-js/runtime-dom': '0.1.1-beta.18',
        '@zeus-js/web-c-runtime': '0.1.1-beta.18',
        '@zeus-web/virtual': 'workspace:*',
      },
    })
  })

  it('uses a valid peer range when aligning to a dist-tag', () => {
    const root = createTempRoot()

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.8',
      },
    })

    writePackage(root, 'packages/advanced/virtual/package.json', {
      name: '@zeus-web/virtual',
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.8 <0.2.0',
      },
    })

    const result = alignZeusBeta({
      root,
      version: 'canary',
    })

    expect(result.peerRange).toBe('*')
    expect(readPackage(root, 'package.json')).toMatchObject({
      devDependencies: {
        '@zeus-js/zeus': 'canary',
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

  it('keeps a compatible peer range for stable baselines', () => {
    const root = createTempRoot()

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.8',
      },
    })

    writePackage(root, 'packages/advanced/virtual/package.json', {
      name: '@zeus-web/virtual',
      peerDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.8',
      },
    })

    const result = alignZeusBeta({
      root,
      version: '0.1.0',
    })

    expect(result.peerRange).toBe('>=0.1.0 <0.2.0')
    expect(
      readPackage(root, 'packages/advanced/virtual/package.json'),
    ).toMatchObject({
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0 <0.2.0',
      },
    })
  })

  it('does not rewrite package.json files when already aligned', () => {
    const root = createTempRoot()

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.8',
      },
    })

    const result = alignZeusBeta({
      root,
      version: '0.1.0-beta.8',
    })

    expect(result.version).toBe('0.1.0-beta.8')
    expect(result.peerRange).toBe('0.1.0-beta.8')
    expect(result.changedFiles).toEqual([])
  })

  it('does not update non @zeus-js dependencies', () => {
    const root = createTempRoot()

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.5',
        react: '^19.0.0',
        vue: '^3.5.0',
      },
    })

    alignZeusBeta({
      root,
      version: '0.1.0-beta.8',
    })

    expect(readPackage(root, 'package.json')).toMatchObject({
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.8',
        react: '^19.0.0',
        vue: '^3.5.0',
      },
    })
  })

  it('skips package.json files under dist and node_modules', () => {
    const root = createTempRoot()

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.8',
      },
    })

    writePackage(root, 'packages/button/dist/package.json', {
      name: '@zeus-web/button-dist',
      dependencies: {
        '@zeus-js/zeus': '0.1.0-beta.5',
      },
    })

    writePackage(root, 'node_modules/@zeus-js/zeus/package.json', {
      name: '@zeus-js/zeus',
      version: '0.1.0-beta.5',
    })

    const result = alignZeusBeta({
      root,
      version: '0.1.0-beta.8',
    })

    expect(result.changedFiles).toEqual([])
    expect(
      readPackage(root, 'packages/button/dist/package.json'),
    ).toMatchObject({
      dependencies: {
        '@zeus-js/zeus': '0.1.0-beta.5',
      },
    })
  })

  it('only updates root and declared workspace manifests, preserving consumer fixtures', () => {
    const root = createTempRoot()
    const workspaceFiles = [
      'package.json',
      'packages/button/package.json',
      'packages/primitives/input/package.json',
      'packages/advanced/data-grid/package.json',
      'apps/docs/package.json',
      'examples/react/package.json',
      'benchmarks/grid/package.json',
      'tools/new-workspace/package.json',
    ]
    const fixtureFiles = [
      'temp/consumer/package.json',
      'packages/button/__tests__/fixtures/consumer/package.json',
      'examples/react/fixture/package.json',
      'docs/sample/package.json',
      'tools/excluded/package.json',
    ]
    writeFileSync(
      join(root, 'pnpm-workspace.yaml'),
      `packages:\n  - packages/*\n  - packages/primitives/*\n  - packages/advanced/*\n  - apps/*\n  - examples/*\n  - benchmarks/*\n  - tools/*\n  - '!tools/excluded'\n`,
    )
    for (const file of workspaceFiles.concat(fixtureFiles)) {
      writePackage(root, file, {
        name: file,
        dependencies: { '@zeus-js/zeus': '0.1.0-beta.5' },
      })
    }

    const result = alignZeusBeta({ root, version: '0.1.0-beta.8' })

    expect(result.changedFiles).toEqual(
      workspaceFiles.map(file => join(root, file)).sort(),
    )
    for (const file of fixtureFiles) {
      expect(readPackage(root, file)).toMatchObject({
        dependencies: { '@zeus-js/zeus': '0.1.0-beta.5' },
      })
    }
  })
})

function createTempRoot(): string {
  const root = join(
    tmpdir(),
    `zeus-ui-align-zeus-beta-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,
  )

  mkdirSync(root, {
    recursive: true,
  })
  writeFileSync(
    join(root, 'pnpm-workspace.yaml'),
    'packages:\n  - packages/*\n  - packages/primitives/*\n  - packages/advanced/*\n  - apps/*\n  - examples/*\n  - benchmarks/*\n',
  )

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
