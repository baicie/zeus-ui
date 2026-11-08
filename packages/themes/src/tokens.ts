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

export const nativeAliasTokens = [
  'background',
  'foreground',
  'primary',
  'primary-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
] as const
export type NativeAliasToken = (typeof nativeAliasTokens)[number]

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

export interface ThemeColorOverrides {
  light?: Partial<Record<SemanticColorToken, string>>
  dark?: Partial<Record<SemanticColorToken, string>>
}
