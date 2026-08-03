import type { PackageJsonLike, WorkspacePackage } from '../../release/workspace'

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  checkBuildOutput,
  validateComponentServerImports,
  validateServerImport,
} from '../build/check-build-output'
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

describe('component wrapper SSR contract', () => {
  it('reports browser globals evaluated while importing a server entry', () => {
    const pkg = createPackage()
    writeDistFile(
      pkg,
      'dist/react/index.js',
      'export const ElementClass = HTMLElement\n',
    )

    const error = validateServerImport(join(pkg.dir, 'dist/react/index.js'))

    expect(error).toContain('HTMLElement is not defined')
  })

  it('reports the component entry that is not server import safe', () => {
    const root = mkdtempSync(join(tmpdir(), 'zeus-ui-ssr-imports-'))
    tempRoots.push(root)

    const safeEntry = join(
      root,
      'packages/primitives/button/dist/react/index.js',
    )
    const unsafeEntry = join(root, 'packages/advanced/chat/dist/react/index.js')
    mkdirSync(dirname(safeEntry), { recursive: true })
    mkdirSync(dirname(unsafeEntry), { recursive: true })
    writeFileSync(safeEntry, 'export const Button = {}\n')
    writeFileSync(unsafeEntry, 'export const ElementClass = HTMLElement\n')

    const errors = validateComponentServerImports(root)

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('packages/advanced/chat/dist/react/index.js')
    expect(errors[0]).toContain('HTMLElement is not defined')
  })

  it('runs the server import check from the complete build output gate', () => {
    const root = mkdtempSync(join(tmpdir(), 'zeus-ui-build-output-'))
    const componentRoot = join(root, 'packages/primitives/fixture')
    const requiredOutputs = [
      'dist/wc/index.js',
      'dist/wc/index.d.ts',
      'dist/wc/auto.js',
      'dist/react/index.js',
      'dist/react/index.d.ts',
      'dist/vue/index.js',
      'dist/vue/index.d.ts',
      'dist/vue/global.d.ts',
      'dist/custom-elements.json',
      'dist/zeus.components.json',
    ]

    tempRoots.push(root)
    mkdirSync(componentRoot, { recursive: true })
    writeFileSync(
      join(componentRoot, 'package.json'),
      JSON.stringify({ name: '@fixture/component' }),
    )

    for (const output of requiredOutputs) {
      const source = output.endsWith('.json') ? '{}\n' : 'export {}\n'
      const path = join(componentRoot, output)

      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, source)
    }

    writeFileSync(
      join(componentRoot, 'dist/react/index.js'),
      'export const ElementClass = HTMLElement\n',
    )

    const errors = checkBuildOutput(root)

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain(
      'packages/primitives/fixture/dist/react/index.js',
    )
    expect(errors[0]).toContain('HTMLElement is not defined')
  })
})
