import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  darkModeStrategyNames,
  getThemeCssImport,
  getThemeTokens,
  getThemeTokensJson,
  isDarkModeStrategyName,
  isMotionPresetName,
  isRadiusPresetName,
  isThemeName,
  motionPresetNames,
  motionPresets,
  motionTokens,
  radiusPresetNames,
  radiusPresets,
  semanticColorTokens,
  themeCssImports,
  themeNames,
  themeRegistry,
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
    expect(isThemeName('unknown')).toBe(false)
  })

  it('checks phase 13 preset guards', () => {
    expect(isRadiusPresetName('md')).toBe(true)
    expect(isRadiusPresetName('xxl')).toBe(false)
    expect(isMotionPresetName('normal')).toBe(true)
    expect(isMotionPresetName('slow')).toBe(false)
    expect(isDarkModeStrategyName('class')).toBe(true)
    expect(isDarkModeStrategyName('auto')).toBe(false)
  })

  it('keeps css import map aligned with theme names', () => {
    expect(Object.keys(themeCssImports)).toEqual(themeNames)
  })

  it('declares all semantic tokens in default theme', () => {
    const source = readThemeFile('default.css')
    for (const token of semanticColorTokens)
      expect(source).toContain(`--${token}:`)
  })

  it('declares all semantic tokens in every theme file', () => {
    for (const theme of themeNames) {
      const source = readThemeFile(`${theme}.css`)
      for (const token of semanticColorTokens)
        expect(source).toContain(`--${token}:`)
      expect(source).toContain('--zw-background: var(--background);')
      expect(source).toContain('--zw-ring: var(--ring);')
    }
  })

  it('declares Tailwind v4 theme mappings in tokens.css', () => {
    const source = readThemeFile('tokens.css')
    expect(source).toContain('@theme inline')
    expect(source).toContain('--color-background: hsl(var(--background));')
    expect(source).toContain('--color-primary: hsl(var(--primary));')
    expect(source).toContain('--radius-lg: var(--zw-radius-lg);')
    expect(source).toContain('--ease-zeus-standard: var(--zw-easing-standard);')
    expect(source).toContain(
      '--animate-duration-normal: var(--zw-duration-normal);',
    )
  })

  it('declares motion presets in tokens.css', () => {
    const source = readThemeFile('tokens.css')
    for (const token of motionTokens) expect(token).toBeTruthy()
    expect(source).toContain("[data-motion='none']")
    expect(source).toContain("[data-motion='reduced']")
    expect(source).toContain("[data-motion='normal']")
    expect(source).toContain("[data-motion='expressive']")
    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('supports dark mode selectors in every theme file', () => {
    for (const theme of themeNames) {
      const source = readThemeFile(`${theme}.css`)
      expect(source).toContain('.dark')
      expect(source).toContain(`[data-theme='${theme}']`)
    }
  })

  it('exposes phase 13 token registries', () => {
    expect(Object.keys(themeRegistry)).toEqual(themeNames)
    expect(Object.keys(radiusPresets)).toEqual(radiusPresetNames)
    expect(Object.keys(motionPresets)).toEqual(motionPresetNames)
    expect(darkModeStrategyNames).toEqual(['class', 'data', 'media'])
    expect(getThemeTokens('slate').cssImport).toBe('@zeus-web/themes/slate.css')
  })

  it('exports serializable theme tokens json', () => {
    const json = getThemeTokensJson()
    expect(json.themes).toEqual(themeNames)
    expect(json.radiusPresets.md).toBe('0.5rem')
    expect(json.motionPresets.normal.durationNormal).toBe('180ms')
    expect(JSON.parse(JSON.stringify(json))).toEqual(json)
  })
})
