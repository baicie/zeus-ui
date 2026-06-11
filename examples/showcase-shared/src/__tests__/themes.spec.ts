import type { SemanticColorToken } from '@zeus-web/themes'
import {
  motionPresetNames,
  radiusPresetNames,
  semanticColorTokens,
  themeNames,
} from '@zeus-web/themes'

import {
  createShowcaseThemeSnippet,
  createShowcaseThemeStyle,
  formatShowcaseThemeTokenCssVar,
  semanticTokens,
  showcaseMotionPresets,
  showcaseRadiusPresets,
  showcaseThemeModes,
  showcaseThemes,
} from '../themes'

describe('showcase themes', () => {
  it('keeps showcase themes aligned with @zeus-web/themes', () => {
    expect(showcaseThemes.map(theme => theme.name)).toEqual(themeNames)
    expect(semanticTokens).toEqual(semanticColorTokens)
    expect(showcaseRadiusPresets.map(item => item.name)).toEqual(
      radiusPresetNames,
    )
    expect(showcaseMotionPresets.map(item => item.name)).toEqual(
      motionPresetNames,
    )
    expect(showcaseThemeModes).toEqual(['light', 'dark'])
  })

  it('creates scoped style with every semantic color token', () => {
    const style = createShowcaseThemeStyle({
      themeName: 'slate',
      mode: 'dark',
      radius: 'lg',
      motion: 'normal',
    })

    for (const token of semanticColorTokens) {
      expect(style[`--${token}`]).toBeTruthy()
    }

    expect(style['--radius']).toBeTruthy()
    expect(style['--zw-duration-normal']).toBeTruthy()
    expect(style['--zw-easing-standard']).toBeTruthy()
  })

  it('formats token usage', () => {
    expect(
      formatShowcaseThemeTokenCssVar('background' as SemanticColorToken),
    ).toBe('hsl(var(--background))')
  })

  it('creates css/html/token snippets', () => {
    const options = {
      themeName: 'zinc',
      mode: 'light',
      radius: 'md',
      motion: 'normal',
    } as const

    expect(createShowcaseThemeSnippet('css', options)).toBe(
      `import '@zeus-web/themes/zinc.css'
import '@zeus-web/themes/components.css'`,
    )
    expect(createShowcaseThemeSnippet('html', options)).toContain(
      'data-theme="zinc"',
    )
    expect(createShowcaseThemeSnippet('tokens', options)).toContain(
      'background: hsl(var(--background));',
    )
  })
})
