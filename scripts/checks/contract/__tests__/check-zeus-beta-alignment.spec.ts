import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { checkZeusBetaAlignment } from '../check-zeus-beta-alignment'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, {
      recursive: true,
      force: true,
    })
  }
})

describe('checkZeusBetaAlignment', () => {
  it('passes when root and package Zeus versions are aligned to beta.6', () => {
    const root = createTempRoot()

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.6',
        '@zeus-js/runtime-dom': '0.1.0-beta.6',
      },
    })

    writePackage(root, 'packages/advanced/data-grid/package.json', {
      name: '@zeus-web/data-grid',
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.6 <0.2.0',
      },
      dependencies: {
        '@zeus-js/runtime-dom': '0.1.0-beta.6',
        '@zeus-js/web-c-runtime': '0.1.0-beta.6',
      },
    })

    writeFile(
      root,
      'scripts/rolldown/createPrimitiveRolldownConfig.ts',
      `
import zeus from '@zeus-js/bundler-plugin/rolldown'

export function createPrimitiveRolldownConfig() {
  return {
    plugins: [zeus({})],
  }
}
`,
    )

    const result = checkZeusBetaAlignment({
      root,
      expectedVersion: '0.1.0-beta.6',
    })

    expect(result).toEqual({
      ok: true,
      expectedVersion: '0.1.0-beta.6',
      expectedPeerRange: '>=0.1.0-beta.6 <0.2.0',
      problems: [],
    })
  })

  it('fails when root @zeus-js dependencies are still beta.5', () => {
    const root = createTempRoot()

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.5',
        '@zeus-js/runtime-dom': '0.1.0-beta.5',
      },
    })

    writeFile(root, 'scripts/rolldown/createPrimitiveRolldownConfig.ts', '')

    const result = checkZeusBetaAlignment({
      root,
      expectedVersion: '0.1.0-beta.6',
    })

    expect(result.ok).toBe(false)
    expect(result.problems).toContainEqual({
      type: 'zeus-version-mismatch',
      file: 'package.json',
      packageName: 'zeus-ui-workspace',
      field: 'devDependencies',
      dependencyName: '@zeus-js/zeus',
      actual: '0.1.0-beta.5',
      expected: '0.1.0-beta.6',
    })
    expect(result.problems).toContainEqual({
      type: 'zeus-version-mismatch',
      file: 'package.json',
      packageName: 'zeus-ui-workspace',
      field: 'devDependencies',
      dependencyName: '@zeus-js/runtime-dom',
      actual: '0.1.0-beta.5',
      expected: '0.1.0-beta.6',
    })
  })

  it('fails when package peer range still points to beta.5', () => {
    const root = createTempRoot()

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.6',
      },
    })

    writePackage(root, 'packages/primitives/button/package.json', {
      name: '@zeus-web/button',
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.5 <0.2.0',
      },
      dependencies: {
        '@zeus-js/runtime-dom': '0.1.0-beta.6',
        '@zeus-js/web-c-runtime': '0.1.0-beta.6',
      },
    })

    writeFile(root, 'scripts/rolldown/createPrimitiveRolldownConfig.ts', '')

    const result = checkZeusBetaAlignment({
      root,
      expectedVersion: '0.1.0-beta.6',
    })

    expect(result.ok).toBe(false)
    expect(result.problems).toContainEqual({
      type: 'zeus-peer-range-mismatch',
      file: 'packages/primitives/button/package.json',
      packageName: '@zeus-web/button',
      field: 'peerDependencies',
      dependencyName: '@zeus-js/zeus',
      actual: '>=0.1.0-beta.5 <0.2.0',
      expected: '>=0.1.0-beta.6 <0.2.0',
    })
  })

  it('fails when web-c-runtime still uses legacy 0.2.0', () => {
    const root = createTempRoot()

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.6',
      },
    })

    writePackage(root, 'packages/advanced/data-grid/package.json', {
      name: '@zeus-web/data-grid',
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.6 <0.2.0',
      },
      dependencies: {
        '@zeus-js/web-c-runtime': '0.2.0',
      },
    })

    writeFile(root, 'scripts/rolldown/createPrimitiveRolldownConfig.ts', '')

    const result = checkZeusBetaAlignment({
      root,
      expectedVersion: '0.1.0-beta.6',
    })

    expect(result.ok).toBe(false)
    expect(result.problems).toContainEqual({
      type: 'web-c-runtime-legacy-version',
      file: 'packages/advanced/data-grid/package.json',
      packageName: '@zeus-web/data-grid',
      field: 'dependencies',
      dependencyName: '@zeus-js/web-c-runtime',
      actual: '0.2.0',
      expected: '0.1.0-beta.6',
    })
    expect(
      result.problems.filter(
        problem =>
          problem.file === 'packages/advanced/data-grid/package.json' &&
          problem.dependencyName === '@zeus-js/web-c-runtime',
      ),
    ).toHaveLength(1)
  })

  it('fails when the local WC dts patch is still present', () => {
    const root = createTempRoot()

    writePackage(root, 'package.json', {
      name: 'zeus-ui-workspace',
      private: true,
      devDependencies: {
        '@zeus-js/zeus': '0.1.0-beta.6',
      },
    })

    writeFile(
      root,
      'scripts/rolldown/createPrimitiveRolldownConfig.ts',
      `
function fixWcEventListenerDts() {
  return {
    name: 'zeus-ui-fix-wc-event-listener-dts',
  }
}
`,
    )

    const result = checkZeusBetaAlignment({
      root,
      expectedVersion: '0.1.0-beta.6',
    })

    expect(result.ok).toBe(false)
    expect(result.problems).toContainEqual({
      type: 'local-wc-dts-patch-present',
      file: 'scripts/rolldown/createPrimitiveRolldownConfig.ts',
      actual: 'fixWcEventListenerDts',
      expected: 'remove local WC d.ts patch and rely on @zeus-js/component-dts',
    })
    expect(result.problems).toContainEqual({
      type: 'local-wc-dts-patch-present',
      file: 'scripts/rolldown/createPrimitiveRolldownConfig.ts',
      actual: 'zeus-ui-fix-wc-event-listener-dts',
      expected: 'remove local WC d.ts patch and rely on @zeus-js/component-dts',
    })
  })
})

function createTempRoot(): string {
  const root = join(
    tmpdir(),
    `zeus-ui-beta-alignment-${Date.now()}-${Math.random()
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
  writeFile(root, relativeFile, `${JSON.stringify(value, null, 2)}\n`)
}

function writeFile(root: string, relativeFile: string, value: string): void {
  const file = join(root, relativeFile)

  mkdirSync(dirname(file), {
    recursive: true,
  })

  writeFileSync(file, value)
}
