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

function writeZeusRolldownConfig(file: string) {
  writeFileSync(
    file,
    'import { createPrimitiveRolldownConfig } from "./scripts/rolldown/createPrimitiveRolldownConfig.mjs"\nexport default createPrimitiveRolldownConfig()\n',
  )
}

describe('package rules', () => {
  it('accepts a primitive package using zeus web-c pipeline', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeZeusRolldownConfig(join(root, 'rolldown.config.ts'))
    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rolldown -c ../../../rolldown.config.ts',
      },
      sideEffects: ['./dist/wc/index.js', './dist/wc/*.js'],
      exports: {
        '.': {},
        './wc': {},
        './wc/auto': {},
        './react': {},
        './vue': {},
        './vue/global': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.2 <0.2.0',
      },
      dependencies: {
        '@zeus-js/runtime-dom': '0.1.0-beta.2',
        '@zeus-js/web-c-runtime': '0.1.0-beta.2',
        '@zeus-web/zeus-compat': 'workspace:*',
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

    writeZeusRolldownConfig(join(root, 'rolldown.config.ts'))
    writeFileSync(join(dir, 'src/wc.ts'), 'export {}\n')

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rolldown -c ../../../rolldown.config.ts',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './wc/auto': {},
        './react': {},
        './vue': {},
        './vue/global': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.2 <0.2.0',
      },
      dependencies: {
        '@zeus-web/zeus-compat': 'workspace:*',
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

  it('rejects primitive package without @zeus-js/zeus peer dependency', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeZeusRolldownConfig(join(root, 'rolldown.config.ts'))

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rolldown -c ../../../rolldown.config.ts',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './wc/auto': {},
        './react': {},
        './vue': {},
        './vue/global': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(result.errors.some(error => error.includes('@zeus-js/zeus'))).toBe(
      true,
    )
  })

  it('rejects primitive package without root rolldown.config.ts', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rolldown -c ../../../rolldown.config.ts',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './wc/auto': {},
        './react': {},
        './vue': {},
        './vue/global': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.2 <0.2.0',
      },
      dependencies: {
        '@zeus-web/zeus-compat': 'workspace:*',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error =>
        error.includes('missing root rolldown.config.ts'),
      ),
    ).toBe(true)
  })

  it('rejects primitive package without zeus web-c root rolldown config', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeFileSync(join(root, 'rolldown.config.ts'), 'export default {}\n')
    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rolldown -c ../../../rolldown.config.ts',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './wc/auto': {},
        './react': {},
        './vue': {},
        './vue/global': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.2 <0.2.0',
      },
      dependencies: {
        '@zeus-web/zeus-compat': 'workspace:*',
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

  it('rejects primitive package with fake root createPrimitiveRolldownConfig', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeFileSync(
      join(root, 'rolldown.config.ts'),
      'const createPrimitiveRolldownConfig = () => ({})\nexport default createPrimitiveRolldownConfig()\n',
    )
    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rolldown -c ../../../rolldown.config.ts',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './wc/auto': {},
        './react': {},
        './vue': {},
        './vue/global': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.2 <0.2.0',
      },
      dependencies: {
        '@zeus-web/zeus-compat': 'workspace:*',
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

  it('rejects primitive package with a local rolldown config', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeZeusRolldownConfig(join(root, 'rolldown.config.ts'))
    writeFileSync(join(dir, 'rolldown.config.ts'), 'export default {}\n')
    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rolldown -c ../../../rolldown.config.ts',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './wc/auto': {},
        './react': {},
        './vue': {},
        './vue/global': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.2 <0.2.0',
      },
      dependencies: {
        '@zeus-web/zeus-compat': 'workspace:*',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error =>
        error.includes('must use root rolldown.config.ts'),
      ),
    ).toBe(true)
  })

  it('rejects primitive package optional Zeus runtime dependencies', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/primitives/input')
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeZeusRolldownConfig(join(root, 'rolldown.config.ts'))
    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/input',
      scripts: {
        build: 'rolldown -c ../../../rolldown.config.ts',
      },
      sideEffects: ['./dist/wc/index.js'],
      exports: {
        '.': {},
        './wc': {},
        './wc/auto': {},
        './react': {},
        './vue': {},
        './vue/global': {},
        './custom-elements.json': {},
        './zeus.components.json': {},
      },
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.2 <0.2.0',
      },
      dependencies: {
        '@zeus-web/zeus-compat': 'workspace:*',
      },
      optionalDependencies: {
        '@zeus-js/runtime-dom': '0.1.0-beta.2',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error =>
        error.includes('optionalDependencies.@zeus-js/runtime-dom'),
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
        build: 'rolldown -c',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('accepts a valid zeus-compat package', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/zeus-compat')

    mkdirSync(dir, { recursive: true })

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/zeus-compat',
      exports: {
        '.': {},
        './capabilities': {},
      },
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.2 <0.2.0',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects zeus-compat packages that peer depend on Zeus internals', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/zeus-compat')

    mkdirSync(dir, { recursive: true })

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/zeus-compat',
      exports: {
        '.': {},
        './capabilities': {},
      },
      peerDependencies: {
        '@zeus-js/zeus': '>=0.1.0-beta.2 <0.2.0',
        '@zeus-js/runtime-dom': '0.1.0-beta.2',
        '@zeus-js/signal': '0.1.0-beta.2',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error => error.includes('@zeus-js/runtime-dom')),
    ).toBe(true)
    expect(result.errors.some(error => error.includes('@zeus-js/signal'))).toBe(
      true,
    )
  })

  it('rejects any public package that declares Zeus internal dependencies', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/headless')

    mkdirSync(dir, { recursive: true })

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/headless',
      exports: {
        '.': {},
      },
      dependencies: {
        '@zeus-js/runtime-dom': '0.1.0-beta.2',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error => error.includes('@zeus-js/runtime-dom')),
    ).toBe(true)
  })

  it('rejects public packages that declare Zeus internals as optional dependencies', () => {
    const root = createTempRoot()
    const dir = join(root, 'packages/headless')

    mkdirSync(dir, { recursive: true })

    writeJson(join(dir, 'package.json'), {
      name: '@zeus-web/headless',
      exports: {
        '.': {},
      },
      optionalDependencies: {
        '@zeus-js/runtime-dom': '0.1.0-beta.2',
      },
    })

    const result = validatePackageRules(root, join(dir, 'package.json'))

    expect(result.valid).toBe(false)
    expect(
      result.errors.some(error =>
        error.includes('optionalDependencies.@zeus-js/runtime-dom'),
      ),
    ).toBe(true)
  })
})
