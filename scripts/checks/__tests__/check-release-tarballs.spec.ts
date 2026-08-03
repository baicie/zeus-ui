import type { PackageJsonLike, WorkspacePackage } from '../../release/workspace'

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  validateReactNamedSlotProps,
  validateTarballDependencies,
} from '../release/check-release-tarballs'

const tempRoots: string[] = []

function createPackage(packageJson: PackageJsonLike = {}): WorkspacePackage {
  const dir = mkdtempSync(join(tmpdir(), 'zeus-ui-release-tarball-'))
  tempRoots.push(dir)

  return {
    name: '@fixture/package',
    version: '1.0.0',
    dir,
    relativeDir: 'packages/fixture',
    packageJsonPath: join(dir, 'package.json'),
    packageJson,
    kind: 'package',
    isPrimitive: false,
    isAdvanced: false,
    isPrivate: false,
  }
}

function writeDistFile(pkg: WorkspacePackage, path: string, source: string) {
  const file = join(pkg.dir, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, source)
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('release tarball dependency closure', () => {
  it('rejects an undeclared package imported by a packed dist file', () => {
    const pkg = createPackage()
    writeDistFile(
      pkg,
      'dist/index.js',
      "import runtime from 'missing-runtime/internal'\nexport { runtime }\n",
    )

    expect(validateTarballDependencies(pkg, ['dist/index.js'])).toEqual([
      '@fixture/package: dist/index.js imports undeclared dependency missing-runtime',
    ])
  })

  it('normalizes a scoped package subpath before checking declarations', () => {
    const pkg = createPackage({
      peerDependencies: {
        '@scope/runtime': '^1.0.0',
      },
    })
    writeDistFile(
      pkg,
      'dist/index.d.ts',
      "export type { Runtime } from '@scope/runtime/types'\n",
    )

    expect(validateTarballDependencies(pkg, ['dist/index.d.ts'])).toEqual([])
  })

  it('rejects an undeclared package loaded with dynamic import', () => {
    const pkg = createPackage()
    writeDistFile(
      pkg,
      'dist/lazy.js',
      "export const load = () => import('lazy-runtime/feature')\n",
    )

    expect(validateTarballDependencies(pkg, ['dist/lazy.js'])).toEqual([
      '@fixture/package: dist/lazy.js imports undeclared dependency lazy-runtime',
    ])
  })

  it('rejects an undeclared package loaded with require', () => {
    const pkg = createPackage()
    writeDistFile(
      pkg,
      'dist/index.js',
      "const runtime = require('common-runtime/adapters')\nexport { runtime }\n",
    )

    expect(validateTarballDependencies(pkg, ['dist/index.js'])).toEqual([
      '@fixture/package: dist/index.js imports undeclared dependency common-runtime',
    ])
  })

  it('rejects an undeclared import type in a declaration file', () => {
    const pkg = createPackage()
    writeDistFile(
      pkg,
      'dist/index.d.ts',
      "export declare const runtime: import('types-runtime/contracts').Runtime\n",
    )

    expect(validateTarballDependencies(pkg, ['dist/index.d.ts'])).toEqual([
      '@fixture/package: dist/index.d.ts imports undeclared dependency types-runtime',
    ])
  })

  it('ignores Node.js built-in module imports', () => {
    const pkg = createPackage()
    writeDistFile(
      pkg,
      'dist/index.js',
      "import fs from 'fs'\nimport path from 'node:path'\nexport { fs, path }\n",
    )

    expect(validateTarballDependencies(pkg, ['dist/index.js'])).toEqual([])
  })
})

describe('release tarball React named slot contract', () => {
  it('rejects a component manifest that reuses a prop as a named slot', () => {
    const pkg = createPackage()
    writeDistFile(
      pkg,
      'dist/zeus.components.json',
      JSON.stringify({
        components: [
          {
            tag: 'zw-fixture',
            props: {
              loading: { type: 'boolean' },
            },
            slots: {
              loading: { name: 'loading' },
            },
          },
        ],
      }),
    )

    expect(
      validateReactNamedSlotProps(pkg, ['dist/zeus.components.json']),
    ).toEqual([
      '@fixture/package: zw-fixture uses loading as both a prop and React named slot',
    ])
  })
})
