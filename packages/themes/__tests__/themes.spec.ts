import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getThemeCssImport,
  isThemeName,
  semanticColorTokens,
  themeCssImports,
  themeNames,
} from '../src'

const testDir = dirname(fileURLToPath(import.meta.url))
const themesSrcDir = resolve(testDir, '../src')

function readThemeFile(file: string): string {
  return readFileSync(resolve(themesSrcDir, file), 'utf-8')
}

describe('@zeus-web/themes', () => {
  it('exposes supported theme names', () => {
    expect(themeNames).toEqual(['default', 'slate', 'zinc', 'neutral', 'stone'])
  })

  it('resolves css import path by theme name', () => {
    expect(getThemeCssImport()).toBe('@zeus-web/themes/default.css')
    expect(getThemeCssImport('slate')).toBe('@zeus-web/themes/slate.css')
  })

  it('checks theme name guard', () => {
    expect(isThemeName('default')).toBe(true)
    expect(isThemeName('slate')).toBe(true)
    expect(isThemeName('unknown')).toBe(false)
  })

  it('keeps css import map aligned with theme names', () => {
    expect(Object.keys(themeCssImports)).toEqual(themeNames)
  })

  it('declares all semantic tokens in default theme', () => {
    const source = readThemeFile('default.css')

    for (const token of semanticColorTokens) {
      expect(source).toContain(`--${token}:`)
    }
  })

  it('declares all semantic tokens in every theme file', () => {
    for (const theme of themeNames) {
      const source = readThemeFile(`${theme}.css`)

      for (const token of semanticColorTokens) {
        expect(source).toContain(`--${token}:`)
      }

      expect(source).toContain(`--zw-background: var(--background);`)
      expect(source).toContain(`--zw-ring: var(--ring);`)
    }
  })

  it('declares Tailwind v4 theme mappings in tokens.css', () => {
    const source = readThemeFile('tokens.css')

    expect(source).toContain('@theme inline')
    expect(source).toContain('--color-background: hsl(var(--background));')
    expect(source).toContain('--color-primary: hsl(var(--primary));')
    expect(source).toContain('--radius-lg: var(--zw-radius-lg);')
  })

  it('supports dark mode selectors in every theme file', () => {
    for (const theme of themeNames) {
      const source = readThemeFile(`${theme}.css`)

      expect(source).toContain('.dark')
      expect(source).toContain(`[data-theme='${theme}']`)
    }
  })
})
