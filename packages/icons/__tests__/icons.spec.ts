import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  iconMetadata,
  iconNames,
  iconsManifest,
  iconSources,
  isIconName,
  searchIcons,
} from '../src'

const testDir = dirname(fileURLToPath(import.meta.url))
const pkgDir = resolve(testDir, '..')

function readPackageFile(path: string): string {
  return readFileSync(resolve(pkgDir, path), 'utf-8')
}

describe('@zeus-web/icons', () => {
  it('exports icon names', () => {
    expect(iconNames.length).toBeGreaterThanOrEqual(20)
    expect(iconNames).toContain('check')
    expect(iconNames).toContain('x')
    expect(iconNames).toContain('search')
    expect(iconNames).toContain('chevron-down')
  })

  it('keeps icon names unique', () => {
    expect(new Set(iconNames).size).toBe(iconNames.length)
  })

  it('keeps metadata aligned with icon sources', () => {
    for (const icon of iconSources) {
      expect(iconMetadata[icon.name]).toBeDefined()
      expect(iconMetadata[icon.name].name).toBe(icon.name)
    }
  })

  it('keeps manifest aligned with icon names', () => {
    expect(iconsManifest.packageName).toBe('@zeus-web/icons')
    expect(iconsManifest.count).toBe(iconNames.length)
    expect(iconsManifest.names).toEqual(iconNames)
    expect(iconsManifest.icons.map(icon => icon.name)).toEqual(iconNames)
  })

  it('uses currentColor and viewBox for all icons', () => {
    for (const icon of iconSources) {
      expect(icon.svg).toContain('viewBox="0 0 24 24"')
      expect(icon.svg).toContain('currentColor')
    }
  })

  it('checks icon name guard', () => {
    expect(isIconName('check')).toBe(true)
    expect(isIconName('unknown')).toBe(false)
  })

  it('searches icons by name, title, and tags', () => {
    expect(searchIcons('check').map(icon => icon.name)).toContain('check')
    expect(searchIcons('warning').map(icon => icon.name)).toContain(
      'alert-triangle',
    )
    expect(searchIcons('theme').map(icon => icon.name)).toEqual(
      expect.arrayContaining(['sun', 'moon']),
    )
  })

  it('declares multi-framework package exports', () => {
    const packageJson = JSON.parse(readPackageFile('package.json')) as {
      exports: Record<string, unknown>
      sideEffects: string[]
    }

    expect(packageJson.exports).toHaveProperty('.')
    expect(packageJson.exports).toHaveProperty('./react')
    expect(packageJson.exports).toHaveProperty('./vue')
    expect(packageJson.exports).toHaveProperty('./wc')
    expect(packageJson.exports).toHaveProperty('./manifest.json')
    expect(packageJson.exports).toHaveProperty('./svg/*')
    expect(packageJson.sideEffects).toEqual(
      expect.arrayContaining(['./dist/wc/index.js', './dist/wc/*.js']),
    )
  })

  it('uses output-icons and keeps icon build output inside dist', () => {
    const source = readPackageFile('scripts/build-icons.ts')

    expect(source).toContain("import icons from '@zeus-js/output-icons'")
    expect(source).toContain("tagPrefix: 'zw-icon-'")
    expect(source).toContain('resolveSafeOutputPath')
    expect(source).not.toContain('@zeus-js/bundler-plugin')
  })
})
