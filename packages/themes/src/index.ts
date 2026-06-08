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

export interface ThemeTokensJson {
  themes: readonly ThemeName[]
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
