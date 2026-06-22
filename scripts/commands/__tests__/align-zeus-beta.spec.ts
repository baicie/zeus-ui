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
  it('updates @zeus-js dependency fields and @zeus-js/zeus peer range', () => {
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

    const result = alignZeusBeta({
      root,
      version: '0.1.0-beta.6',
    })

    expect(result.version).toBe('0.1.0-beta.6')
    expect(result.peerRange).toBe('>=0.1.0-beta.6 <0.2.0')
    expect(result.changedFiles).toHaveLength(2)

    expect(readPackage(root, 'package.json')).toMatchObject({
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.6',
        '@zeus-js/runtime-dom': '0.1.0-beta.6',
        typescript: '^6.0.3',
      },
    })

    expect(
      readPackage(root, 'packages/advanced/data-grid/package.json'),
    ).toMatchObject({
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.6 <0.2.0',
        react: '>=18 || >=19',
      },
      dependencies: {
        '@zeus-js/runtime-dom': '0.1.0-beta.6',
        '@zeus-js/web-c-runtime': '0.1.0-beta.6',
        '@zeus-web/virtual': 'workspace:*',
      },
    })
  })

  it('does not rewrite package.json files when already aligned', () => {
    const root = createTempRoot()

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.6',
      },
    })

    const result = alignZeusBeta({
      root,
      version: '0.1.0-beta.6',
    })

    expect(result.version).toBe('0.1.0-beta.6')
    expect(result.peerRange).toBe('>=0.1.0-beta.6 <0.2.0')
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
      version: '0.1.0-beta.6',
    })

    expect(readPackage(root, 'package.json')).toMatchObject({
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.6',
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
        '@zeus-js/zeus': '0.1.0-beta.6',
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
      version: '0.1.0-beta.6',
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
