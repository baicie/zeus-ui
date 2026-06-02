import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validatePackageRules } from '../package-rules'

function createTempRoot() {
  const root = join(tmpdir(), `zeus-ui-${Date.now()}-${Math.random()}`)
  mkdirSync(root, { recursive: true })
  return root
}

function writeJson(file: string, value: unknown) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function writeZeusRollupConfig(file: string) {
  writeFileSync(
    file,
    'import { createPrimitiveRollupConfig } from "../../../scripts/rollup/createPrimitiveRollupConfig.mjs"\nexport default createPrimitiveRollupConfig()\n',
  )
}

describe('package rules', () => {
  it('accepts a primitive package using zeus web-c pipeline', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeZeusRollupConfig(join(dir, 'rollup.config.mjs'))
    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rollup -c',
      },
      sideEffects: ['./dist/wc/index.js', './dist/wc/*.js'],
      exports: {
        '.': {},
        './wc': {},
        './react': {},
        './vue': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/runtime-dom': '^0.1.0-beta.0',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects primitive package with hand-written wc entry', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeZeusRollupConfig(join(dir, 'rollup.config.mjs'))
    writeFileSync(join(dir, 'src/wc.ts'), 'export {}\n')

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rollup -c',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './react': {},
        './vue': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/runtime-dom': '^0.1.0-beta.0',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error =>
        error.includes('must not hand-write src/wc.ts'),
      ),
    ).toBe(true)
  })

  it('rejects primitive package without @zeus-js/runtime-dom peer dependency', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeZeusRollupConfig(join(dir, 'rollup.config.mjs'))

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rollup -c',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './react': {},
        './vue': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error => error.includes('@zeus-js/runtime-dom')),
    ).toBe(true)
  })

  it('rejects primitive package without rollup.config.mjs', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rollup -c',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './react': {},
        './vue': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/runtime-dom': '^0.1.0-beta.0',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error =>
        error.includes('must have rollup.config.mjs'),
      ),
    ).toBe(true)
  })

  it('rejects primitive package without zeus web-c rollup config', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeFileSync(join(dir, 'rollup.config.mjs'), 'export default {}\n')
    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rollup -c',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './react': {},
        './vue': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/runtime-dom': '^0.1.0-beta.0',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error =>
        error.includes('must use Zeus web-c output pipeline'),
      ),
    ).toBe(true)
  })

  it('rejects primitive package with fake local createPrimitiveRollupConfig', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeFileSync(
      join(dir, 'rollup.config.mjs'),
      'const createPrimitiveRollupConfig = () => ({})\nexport default createPrimitiveRollupConfig()\n',
    )
    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rollup -c',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './react': {},
        './vue': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/runtime-dom': '^0.1.0-beta.0',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error =>
        error.includes('must use Zeus web-c output pipeline'),
      ),
    ).toBe(true)
  })

  it('skips private packages', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      private: true,
      scripts: {
        build: 'rollup -c',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })
})
