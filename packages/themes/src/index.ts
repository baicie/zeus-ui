import type {
  DarkModeStrategyName,
  MotionPreset,
  MotionPresetName,
  MotionToken,
  RadiusPresetName,
  RadiusToken,
  SemanticColorToken,
  ThemeColorOverrides,
  ThemeModeName,
  ThemeName,
  ThemeTokenSet,
} from './tokens'

import { createThemeBlockCss } from './generate'
import { themePalettes } from './palettes'
import {
  darkModeStrategyNames,
  motionPresetNames,
  motionPresets,
  motionTokens,
  radiusPresetNames,
  radiusPresets,
  radiusTokens,
  semanticColorTokens,
  themeCssImports,
  themeModeNames,
  themeNames,
} from './tokens'

export type { ThemeCssOptions } from './generate'
export {
  createBuiltinThemeFileCss,
  createThemeBlockCss,
  generatedThemeCssMarker,
} from './generate'
export { themePalettes } from './palettes'
export type {
  DarkModeStrategyName,
  MotionPreset,
  MotionPresetName,
  NativeAliasToken,
  RadiusPresetName,
  RadiusToken,
  SemanticColorToken,
  ThemeColorOverrides,
  ThemeModeName,
  ThemeName,
  ThemeTokenSet,
} from './tokens'
export {
  darkModeStrategyNames,
  motionPresetNames,
  motionPresets,
  motionTokens,
  nativeAliasTokens,
  radiusPresetNames,
  radiusPresets,
  radiusTokens,
  semanticColorTokens,
  themeCssImports,
  themeModeNames,
  themeNames,
} from './tokens'

export const themePackageName = '@zeus-web/themes'

export const themeCssExports = {
  tokens: '@zeus-web/themes/tokens.css',
  components: '@zeus-web/themes/components.css',
  ...themeCssImports,
} as const

export const themeRegistry: Record<ThemeName, ThemeTokenSet> = {
  default: {
    name: 'default',
    cssImport: themeCssImports.default,
    colors: themePalettes.default.light,
  },
  slate: {
    name: 'slate',
    cssImport: themeCssImports.slate,
    colors: themePalettes.slate.light,
  },
  zinc: {
    name: 'zinc',
    cssImport: themeCssImports.zinc,
    colors: themePalettes.zinc.light,
  },
  neutral: {
    name: 'neutral',
    cssImport: themeCssImports.neutral,
    colors: themePalettes.neutral.light,
  },
  stone: {
    name: 'stone',
    cssImport: themeCssImports.stone,
    colors: themePalettes.stone.light,
  },
}

export const darkThemeRegistry: Record<ThemeName, ThemeTokenSet> = {
  default: {
    name: 'default',
    cssImport: themeCssImports.default,
    colors: themePalettes.default.dark,
  },
  slate: {
    name: 'slate',
    cssImport: themeCssImports.slate,
    colors: themePalettes.slate.dark,
  },
  zinc: {
    name: 'zinc',
    cssImport: themeCssImports.zinc,
    colors: themePalettes.zinc.dark,
  },
  neutral: {
    name: 'neutral',
    cssImport: themeCssImports.neutral,
    colors: themePalettes.neutral.dark,
  },
  stone: {
    name: 'stone',
    cssImport: themeCssImports.stone,
    colors: themePalettes.stone.dark,
  },
}

export const themeModeRegistry: Record<
  ThemeName,
  Record<ThemeModeName, ThemeTokenSet>
> = {
  default: { light: themeRegistry.default, dark: darkThemeRegistry.default },
  slate: { light: themeRegistry.slate, dark: darkThemeRegistry.slate },
  zinc: { light: themeRegistry.zinc, dark: darkThemeRegistry.zinc },
  neutral: { light: themeRegistry.neutral, dark: darkThemeRegistry.neutral },
  stone: { light: themeRegistry.stone, dark: darkThemeRegistry.stone },
}

export function getThemeColors(
  themeName: ThemeName,
  mode: ThemeModeName = 'light',
): Record<SemanticColorToken, string> {
  return themeModeRegistry[themeName][mode].colors
}

export interface ThemeTokensJson {
  themes: readonly ThemeName[]
  themeModes: readonly ThemeModeName[]
  semanticColorTokens: readonly SemanticColorToken[]
  radiusTokens: readonly RadiusToken[]
  motionTokens: readonly MotionToken[]
  radiusPresets: Record<RadiusPresetName, string>
  motionPresets: Record<MotionPresetName, MotionPreset>
  darkModeStrategies: readonly DarkModeStrategyName[]
}

export function getThemeCssImport(theme: ThemeName = 'default'): string {
  return themeCssImports[theme]
}

export function getThemeTokens(theme: ThemeName = 'default'): ThemeTokenSet {
  return themeRegistry[theme]
}

export function getThemeTokensJson(): ThemeTokensJson {
  return {
    themes: themeNames,
    themeModes: themeModeNames,
    semanticColorTokens,
    radiusTokens,
    motionTokens,
    radiusPresets,
    motionPresets,
    darkModeStrategies: darkModeStrategyNames,
  }
}

function assertCustomThemeName(name: string): void {
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(name)) {
    throw new Error(
      'Theme name must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens.',
    )
  }
  if (isThemeName(name)) throw new Error(`Theme already exists: ${name}`)
}

function assertHslValue(token: string, value: string): void {
  if (
    !/^[-+]?\d+(?:\.\d+)?\s+[-+]?\d+(?:\.\d+)?%\s+[-+]?\d+(?:\.\d+)?%$/.test(
      value,
    )
  ) {
    throw new Error(`Invalid HSL value for ${token}: ${value}`)
  }
}

function mergeThemeColors(
  base: Record<SemanticColorToken, string>,
  overrides: Partial<Record<SemanticColorToken, string>> = {},
): Record<SemanticColorToken, string> {
  const colors = { ...base }
  for (const token of Object.keys(overrides)) {
    if (!(semanticColorTokens as readonly string[]).includes(token)) {
      throw new Error(`Unsupported theme token: ${token}`)
    }
    const value = overrides[token as SemanticColorToken]
    if (typeof value !== 'string') {
      throw new TypeError(`Theme token ${token} must be an HSL string`)
    }
    assertHslValue(token, value)
    colors[token as SemanticColorToken] = value
  }
  return colors
}

/**
 * Generates a custom theme block for the requested dark mode strategy.
 *
 * The light block always targets `:root, [data-theme='<name>']`; the dark
 * block follows `class` (`.dark`), `data` (`[data-mode='dark']`) or `media`
 * (`prefers-color-scheme: dark`).
 */
export function createThemeCss(
  name: string,
  baseTheme: ThemeName = 'default',
  overrides: ThemeColorOverrides = {},
  options: { darkMode?: DarkModeStrategyName } = {},
): string {
  assertCustomThemeName(name)

  return createThemeBlockCss({
    name,
    baseTheme,
    darkMode: options.darkMode,
    light: mergeThemeColors(
      getThemeColors(baseTheme, 'light'),
      overrides.light,
    ),
    dark: mergeThemeColors(getThemeColors(baseTheme, 'dark'), overrides.dark),
  })
}

export function isThemeName(value: string): value is ThemeName {
  return (themeNames as readonly string[]).includes(value)
}

export function isRadiusPresetName(value: string): value is RadiusPresetName {
  return (radiusPresetNames as readonly string[]).includes(value)
}

export function isMotionPresetName(value: string): value is MotionPresetName {
  return (motionPresetNames as readonly string[]).includes(value)
}

export function isDarkModeStrategyName(
  value: string,
): value is DarkModeStrategyName {
  return (darkModeStrategyNames as readonly string[]).includes(value)
}
