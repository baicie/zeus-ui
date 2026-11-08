import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  createBuiltinThemeFileCss,
  createThemeCss,
  darkModeStrategyNames,
  darkThemeRegistry,
  getThemeColors,
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
  nativeAliasTokens,
  radiusPresetNames,
  radiusPresets,
  semanticColorTokens,
  themeCssExports,
  themeCssImports,
  themeNames,
  themePalettes,
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

  it('exposes package-level component presentation css', () => {
    expect(themeCssExports.components).toBe('@zeus-web/themes/components.css')

    const source = readThemeFile('components.css')
    expect(source).toContain("zw-button[data-variant='primary']")
    expect(source).toContain("zw-input [data-slot='input']")
    expect(source).toContain("zw-dialog-content [part='content']")
  })

  it('splits components.css into per-component files without losing rules', () => {
    const source = readThemeFile('components.css')
    const splitDir = resolve(themesSrcDir, 'components')
    const files = readdirSync(splitDir).filter(file => file.endsWith('.css'))

    expect(files).toContain('button.css')
    expect(files).toContain('data-grid.css')

    const joined = files
      .map(file => readFileSync(resolve(splitDir, file), 'utf-8'))
      .join('\n')
    const normalized = joined.replace(/\s+/g, ' ')

    const selectors = Array.from(source.matchAll(/^([^\n@}][^\n{]*)\{/gm)).map(
      match => match[1].replace(/\s+/g, ' ').trim(),
    )

    expect(selectors.length).toBeGreaterThan(100)

    for (const selector of selectors) {
      const first = selector.split(',')[0].trim()
      expect(normalized).toContain(first)
    }
  })

  it('keeps per-component css free of physical layout properties', () => {
    const splitDir = resolve(themesSrcDir, 'components')
    const physical = [
      /text-align:\s*(left|right);/,
      /border-(left|right)(-[a-z]+)?:/,
      /margin-(left|right):/,
      /padding-(left|right):/,
      /\b(float|direction):\s*(left|right|ltr|rtl);/,
    ]

    for (const file of readdirSync(splitDir)) {
      if (!file.endsWith('.css')) continue

      const source = readFileSync(resolve(splitDir, file), 'utf-8')

      for (const pattern of physical) {
        // Chevron/checkmark glyphs draw with physical borders on purpose: the
        // glyph itself must not mirror, only its placement does.
        const withoutGlyphs = source.replace(
          /border-(left|right): 2px solid currentColor;/g,
          '',
        )

        expect(withoutGlyphs).not.toMatch(pattern)
      }
    }
  })

  it('covers every documented component with default presentation css', () => {
    const source = readThemeFile('components.css')
    const componentTags = [
      'accordion',
      'agent-console',
      'alert',
      'avatar',
      'badge',
      'button',
      'card',
      'chat',
      'checkbox',
      'collapsible',
      'data-grid',
      'dialog',
      'input',
      'label',
      'progress',
      'radio-group',
      'revogrid-adapter',
      'select',
      'separator',
      'skeleton',
      'switch',
      'tabs',
      'textarea',
      'tooltip',
      'virtual-list',
    ]

    for (const tag of componentTags) expect(source).toContain(`zw-${tag}`)
  })

  it('keeps overlays and advanced layouts usable in constrained views', () => {
    const source = readThemeFile('components.css')

    expect(source).toContain("zw-select[data-side='top']")
    expect(source).toContain('--zw-select-available-height')
    expect(source).toContain('overflow-wrap: anywhere;')
    expect(source).toContain(
      'grid-template-rows: auto auto minmax(0, 1fr) auto auto;',
    )
    expect(source).toContain('max-height: calc(100dvh - 2rem);')
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

  it('keeps built-in theme css byte-identical to the generator output', () => {
    for (const theme of themeNames) {
      const expected = createBuiltinThemeFileCss(theme, themePalettes[theme])
      expect(readThemeFile(`${theme}.css`)).toBe(expected)
    }
  })

  it('keeps the color registries in sync with palettes.ts', () => {
    for (const theme of themeNames) {
      expect(themeRegistry[theme].colors).toEqual(themePalettes[theme].light)
      expect(darkThemeRegistry[theme].colors).toEqual(themePalettes[theme].dark)
      expect(getThemeColors(theme, 'light')).toEqual(themePalettes[theme].light)
      expect(getThemeColors(theme, 'dark')).toEqual(themePalettes[theme].dark)
    }
  })

  it('declares every native alias in every theme file', () => {
    for (const theme of themeNames) {
      const source = readThemeFile(`${theme}.css`)
      for (const token of nativeAliasTokens) {
        expect(source).toMatch(
          new RegExp(`--zw-${token}: var\\(--${token}\\);`),
        )
      }
      for (const token of semanticColorTokens) {
        expect(source).toMatch(
          new RegExp(`--zeus-${token}: var\\(--${token}\\);`),
        )
      }
    }
  })

  it('declares color-scheme for light and dark blocks', () => {
    for (const theme of themeNames) {
      const source = readThemeFile(`${theme}.css`)
      expect(source.match(/color-scheme: light;/g)).toHaveLength(1)
      expect(source.match(/color-scheme: dark;/g)).toHaveLength(1)
    }
  })

  it('generates dark selectors for the data and media strategies', () => {
    const dataCss = createThemeCss('brand', 'default', {}, { darkMode: 'data' })
    expect(dataCss).toContain("[data-theme='brand'][data-mode='dark'] {")
    expect(dataCss).not.toContain('.dark')
    expect(dataCss).toContain('color-scheme: dark;')

    const mediaCss = createThemeCss(
      'brand',
      'default',
      {},
      {
        darkMode: 'media',
      },
    )
    expect(mediaCss).toContain('@media (prefers-color-scheme: dark) {')
    expect(mediaCss).not.toContain('.dark')
    expect(mediaCss).toContain('color-scheme: dark;')
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

  it('generates custom light and dark theme CSS from a built-in palette', () => {
    const css = createThemeCss('brand', 'slate', {
      light: { primary: '12 80% 45%' },
      dark: { primary: '12 70% 65%' },
    })

    expect(css).toContain("[data-theme='brand'] {")
    expect(css).toContain('--primary: 12 80% 45%;')
    expect(css).toContain("[data-theme='brand'].dark,")
    expect(css).toContain('--primary: 12 70% 65%;')
    expect(css).toContain('--background: 0 0% 100%;')
    expect(css).toContain('--zw-primary: var(--primary);')
    expect(css).toContain('--zw-ring: var(--ring);')
    expect(css).toContain('--zeus-primary: var(--primary);')
    expect(css).toContain('--zeus-popover: var(--popover);')
    expect(css).toMatch(
      /\[data-theme='brand'\]\.dark,[\s\S]*?--primary: 12 70% 65%;[\s\S]*?--zw-primary: var\(--primary\);[\s\S]*?--zeus-primary: var\(--primary\);/,
    )
  })

  it('rejects unsafe theme names, tokens, and CSS values', () => {
    expect(() => createThemeCss('../brand')).toThrow('Theme name')
    expect(() => createThemeCss('slate')).toThrow('Theme already exists')
    expect(() =>
      createThemeCss('brand', 'default', {
        light: { primary: 'red; } body { display:none' },
      }),
    ).toThrow('Invalid HSL value')
    expect(() =>
      createThemeCss('brand', 'default', {
        light: { unknown: '0 0% 0%' } as never,
      }),
    ).toThrow('Unsupported theme token')
  })
})
