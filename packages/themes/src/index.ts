export const themePackageName = '@zeus-web/themes'

export const themeNames = [
  'default',
  'slate',
  'zinc',
  'neutral',
  'stone',
] as const
export type ThemeName = (typeof themeNames)[number]

export const themeCssImports: Record<ThemeName, string> = {
  default: '@zeus-web/themes/default.css',
  slate: '@zeus-web/themes/slate.css',
  zinc: '@zeus-web/themes/zinc.css',
  neutral: '@zeus-web/themes/neutral.css',
  stone: '@zeus-web/themes/stone.css',
}

export const themeCssExports = {
  tokens: '@zeus-web/themes/tokens.css',
  components: '@zeus-web/themes/components.css',
  ...themeCssImports,
} as const

export const semanticColorTokens = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
] as const
export type SemanticColorToken = (typeof semanticColorTokens)[number]

export const radiusTokens = [
  'radius',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'radius-xl',
] as const
export type RadiusToken = (typeof radiusTokens)[number]

export const motionTokens = [
  'duration-fast',
  'duration-normal',
  'duration-slow',
  'easing-standard',
  'easing-emphasized',
] as const
export type MotionToken = (typeof motionTokens)[number]

export const radiusPresetNames = ['none', 'sm', 'md', 'lg', 'xl'] as const
export type RadiusPresetName = (typeof radiusPresetNames)[number]

export const radiusPresets: Record<RadiusPresetName, string> = {
  none: '0rem',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
}

export const motionPresetNames = [
  'none',
  'reduced',
  'normal',
  'expressive',
] as const
export type MotionPresetName = (typeof motionPresetNames)[number]

export interface MotionPreset {
  durationFast: string
  durationNormal: string
  durationSlow: string
  easingStandard: string
  easingEmphasized: string
}

export const motionPresets: Record<MotionPresetName, MotionPreset> = {
  none: {
    durationFast: '0ms',
    durationNormal: '0ms',
    durationSlow: '0ms',
    easingStandard: 'linear',
    easingEmphasized: 'linear',
  },
  reduced: {
    durationFast: '80ms',
    durationNormal: '120ms',
    durationSlow: '160ms',
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingEmphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  normal: {
    durationFast: '120ms',
    durationNormal: '180ms',
    durationSlow: '260ms',
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingEmphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  expressive: {
    durationFast: '140ms',
    durationNormal: '220ms',
    durationSlow: '340ms',
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingEmphasized: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
}

export const darkModeStrategyNames = ['class', 'data', 'media'] as const
export type DarkModeStrategyName = (typeof darkModeStrategyNames)[number]

export const themeModeNames = ['light', 'dark'] as const
export type ThemeModeName = (typeof themeModeNames)[number]

export interface ThemeTokenSet {
  name: ThemeName
  cssImport: string
  colors: Record<SemanticColorToken, string>
}

const defaultLightColors: Record<SemanticColorToken, string> = {
  background: '0 0% 100%',
  foreground: '240 10% 3.9%',
  card: '0 0% 100%',
  'card-foreground': '240 10% 3.9%',
  popover: '0 0% 100%',
  'popover-foreground': '240 10% 3.9%',
  primary: '240 5.9% 10%',
  'primary-foreground': '0 0% 98%',
  secondary: '240 4.8% 95.9%',
  'secondary-foreground': '240 5.9% 10%',
  muted: '240 4.8% 95.9%',
  'muted-foreground': '240 3.8% 46.1%',
  accent: '240 4.8% 95.9%',
  'accent-foreground': '240 5.9% 10%',
  destructive: '0 84.2% 60.2%',
  'destructive-foreground': '0 0% 98%',
  border: '240 5.9% 90%',
  input: '240 5.9% 90%',
  ring: '240 5.9% 10%',
}

const defaultDarkColors: Record<SemanticColorToken, string> = {
  background: '240 10% 3.9%',
  foreground: '0 0% 98%',
  card: '240 10% 3.9%',
  'card-foreground': '0 0% 98%',
  popover: '240 10% 3.9%',
  'popover-foreground': '0 0% 98%',
  primary: '0 0% 98%',
  'primary-foreground': '240 5.9% 10%',
  secondary: '240 3.7% 15.9%',
  'secondary-foreground': '0 0% 98%',
  muted: '240 3.7% 15.9%',
  'muted-foreground': '240 5% 64.9%',
  accent: '240 3.7% 15.9%',
  'accent-foreground': '0 0% 98%',
  destructive: '0 62.8% 30.6%',
  'destructive-foreground': '0 0% 98%',
  border: '240 3.7% 15.9%',
  input: '240 3.7% 15.9%',
  ring: '240 4.9% 83.9%',
}

export const themeRegistry: Record<ThemeName, ThemeTokenSet> = {
  default: {
    name: 'default',
    cssImport: themeCssImports.default,
    colors: defaultLightColors,
  },
  slate: {
    name: 'slate',
    cssImport: themeCssImports.slate,
    colors: {
      ...defaultLightColors,
      foreground: '222.2 84% 4.9%',
      primary: '222.2 47.4% 11.2%',
      border: '214.3 31.8% 91.4%',
      input: '214.3 31.8% 91.4%',
      ring: '222.2 84% 4.9%',
    },
  },
  zinc: {
    name: 'zinc',
    cssImport: themeCssImports.zinc,
    colors: {
      ...defaultLightColors,
      foreground: '240 10% 3.9%',
      primary: '240 5.9% 10%',
      border: '240 5.9% 90%',
      input: '240 5.9% 90%',
      ring: '240 5.9% 10%',
    },
  },
  neutral: {
    name: 'neutral',
    cssImport: themeCssImports.neutral,
    colors: {
      ...defaultLightColors,
      foreground: '0 0% 3.9%',
      primary: '0 0% 9%',
      border: '0 0% 89.8%',
      input: '0 0% 89.8%',
      ring: '0 0% 3.9%',
    },
  },
  stone: {
    name: 'stone',
    cssImport: themeCssImports.stone,
    colors: {
      ...defaultLightColors,
      foreground: '20 14.3% 4.1%',
      primary: '24 9.8% 10%',
      border: '20 5.9% 90%',
      input: '20 5.9% 90%',
      ring: '20 14.3% 4.1%',
    },
  },
}

export const darkThemeRegistry: Record<ThemeName, ThemeTokenSet> = {
  default: {
    name: 'default',
    cssImport: themeCssImports.default,
    colors: defaultDarkColors,
  },
  slate: {
    name: 'slate',
    cssImport: themeCssImports.slate,
    colors: {
      ...defaultDarkColors,
      background: '222.2 84% 4.9%',
      foreground: '210 40% 98%',
      card: '222.2 84% 4.9%',
      'card-foreground': '210 40% 98%',
      popover: '222.2 84% 4.9%',
      'popover-foreground': '210 40% 98%',
      primary: '210 40% 98%',
      'primary-foreground': '222.2 47.4% 11.2%',
      secondary: '217.2 32.6% 17.5%',
      'secondary-foreground': '210 40% 98%',
      muted: '217.2 32.6% 17.5%',
      'muted-foreground': '215 20.2% 65.1%',
      accent: '217.2 32.6% 17.5%',
      'accent-foreground': '210 40% 98%',
      border: '217.2 32.6% 17.5%',
      input: '217.2 32.6% 17.5%',
      ring: '212.7 26.8% 83.9%',
    },
  },
  zinc: {
    name: 'zinc',
    cssImport: themeCssImports.zinc,
    colors: defaultDarkColors,
  },
  neutral: {
    name: 'neutral',
    cssImport: themeCssImports.neutral,
    colors: {
      ...defaultDarkColors,
      background: '0 0% 3.9%',
      foreground: '0 0% 98%',
      card: '0 0% 3.9%',
      'card-foreground': '0 0% 98%',
      popover: '0 0% 3.9%',
      'popover-foreground': '0 0% 98%',
      primary: '0 0% 98%',
      'primary-foreground': '0 0% 9%',
      secondary: '0 0% 14.9%',
      'secondary-foreground': '0 0% 98%',
      muted: '0 0% 14.9%',
      'muted-foreground': '0 0% 63.9%',
      accent: '0 0% 14.9%',
      'accent-foreground': '0 0% 98%',
      border: '0 0% 14.9%',
      input: '0 0% 14.9%',
      ring: '0 0% 83.1%',
    },
  },
  stone: {
    name: 'stone',
    cssImport: themeCssImports.stone,
    colors: {
      ...defaultDarkColors,
      background: '20 14.3% 4.1%',
      foreground: '60 9.1% 97.8%',
      card: '20 14.3% 4.1%',
      'card-foreground': '60 9.1% 97.8%',
      popover: '20 14.3% 4.1%',
      'popover-foreground': '60 9.1% 97.8%',
      primary: '60 9.1% 97.8%',
      'primary-foreground': '24 9.8% 10%',
      secondary: '12 6.5% 15.1%',
      'secondary-foreground': '60 9.1% 97.8%',
      muted: '12 6.5% 15.1%',
      'muted-foreground': '24 5.4% 63.9%',
      accent: '12 6.5% 15.1%',
      'accent-foreground': '60 9.1% 97.8%',
      border: '12 6.5% 15.1%',
      input: '12 6.5% 15.1%',
      ring: '24 5.7% 82.9%',
    },
  },
}

export const themeModeRegistry: Record<
  ThemeName,
  Record<ThemeModeName, ThemeTokenSet>
> = {
  default: {
    light: themeRegistry.default,
    dark: darkThemeRegistry.default,
  },
  slate: {
    light: themeRegistry.slate,
    dark: darkThemeRegistry.slate,
  },
  zinc: {
    light: themeRegistry.zinc,
    dark: darkThemeRegistry.zinc,
  },
  neutral: {
    light: themeRegistry.neutral,
    dark: darkThemeRegistry.neutral,
  },
  stone: {
    light: themeRegistry.stone,
    dark: darkThemeRegistry.stone,
  },
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
