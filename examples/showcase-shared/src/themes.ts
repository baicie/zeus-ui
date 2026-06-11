import type {
  MotionPresetName,
  RadiusPresetName,
  SemanticColorToken,
  ThemeName,
} from '@zeus-web/themes'

import type { ShowcaseTheme } from './types'
import {
  darkModeStrategyNames,
  motionPresetNames,
  motionPresets,
  radiusPresetNames,
  radiusPresets,
  semanticColorTokens,
  themeCssImports,
  themeNames,
  themeRegistry,
} from '@zeus-web/themes'

export type ShowcaseThemeName = ThemeName
export type ShowcaseThemeMode = 'light' | 'dark'
export type ShowcaseThemeSnippetKind = 'css' | 'html' | 'tokens'
export type ShowcaseThemeStyle = Record<`--${string}`, string>

export interface ShowcaseThemeStyleOptions {
  themeName: ShowcaseThemeName
  mode: ShowcaseThemeMode
  radius: RadiusPresetName
  motion: MotionPresetName
}

export interface ShowcaseThemeTokenGroup {
  name: string
  tokens: readonly SemanticColorToken[]
}

const themeDescriptions: Record<ThemeName, string> = {
  default: 'Default Zeus Web theme.',
  slate: 'Cool neutral theme.',
  zinc: 'Modern neutral theme.',
  neutral: 'Balanced neutral theme.',
  stone: 'Warm neutral theme.',
}

const themeLabels: Record<ThemeName, string> = {
  default: 'Default',
  slate: 'Slate',
  zinc: 'Zinc',
  neutral: 'Neutral',
  stone: 'Stone',
}

const darkColors: Record<ThemeName, Record<SemanticColorToken, string>> = {
  default: {
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
  },
  slate: {
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
    destructive: '0 62.8% 30.6%',
    'destructive-foreground': '210 40% 98%',
    border: '217.2 32.6% 17.5%',
    input: '217.2 32.6% 17.5%',
    ring: '212.7 26.8% 83.9%',
  },
  zinc: {
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
  },
  neutral: {
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
    destructive: '0 62.8% 30.6%',
    'destructive-foreground': '0 0% 98%',
    border: '0 0% 14.9%',
    input: '0 0% 14.9%',
    ring: '0 0% 83.1%',
  },
  stone: {
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
    destructive: '0 62.8% 30.6%',
    'destructive-foreground': '60 9.1% 97.8%',
    border: '12 6.5% 15.1%',
    input: '12 6.5% 15.1%',
    ring: '24 5.7% 82.9%',
  },
}

export const showcaseThemes: ShowcaseTheme[] = themeNames.map(themeName => ({
  name: themeName,
  label: themeLabels[themeName],
  cssImport: themeCssImports[themeName],
  description: themeDescriptions[themeName],
}))

export const semanticTokens = semanticColorTokens

export const showcaseThemeModes = ['light', 'dark'] as const

export const showcaseRadiusPresets = radiusPresetNames.map(name => ({
  name,
  label: name,
  value: radiusPresets[name],
}))

export const showcaseMotionPresets = motionPresetNames.map(name => ({
  name,
  label: name,
  value: motionPresets[name],
}))

export const showcaseDarkModeStrategies = darkModeStrategyNames.map(name => ({
  name,
  label: name,
}))

export const showcaseThemeTokenGroups: ShowcaseThemeTokenGroup[] = [
  {
    name: 'Surface',
    tokens: [
      'background',
      'foreground',
      'card',
      'card-foreground',
      'popover',
      'popover-foreground',
    ],
  },
  {
    name: 'Brand',
    tokens: [
      'primary',
      'primary-foreground',
      'secondary',
      'secondary-foreground',
      'accent',
      'accent-foreground',
    ],
  },
  {
    name: 'Feedback',
    tokens: ['destructive', 'destructive-foreground', 'ring'],
  },
  {
    name: 'Control',
    tokens: ['border', 'input', 'muted', 'muted-foreground'],
  },
]

export function getShowcaseThemeColors(
  themeName: ShowcaseThemeName,
  mode: ShowcaseThemeMode,
): Record<SemanticColorToken, string> {
  if (mode === 'dark') {
    return darkColors[themeName]
  }

  return themeRegistry[themeName].colors
}

export function createShowcaseThemeStyle(
  options: ShowcaseThemeStyleOptions,
): ShowcaseThemeStyle {
  const colors = getShowcaseThemeColors(options.themeName, options.mode)
  const radius = radiusPresets[options.radius]
  const motion = motionPresets[options.motion]

  const style: ShowcaseThemeStyle = {
    '--radius': radius,
    '--zw-radius': 'var(--radius)',
    '--zw-radius-sm': 'calc(var(--radius) - 4px)',
    '--zw-radius-md': 'calc(var(--radius) - 2px)',
    '--zw-radius-lg': 'var(--radius)',
    '--zw-radius-xl': 'calc(var(--radius) + 4px)',
    '--zw-duration-fast': motion.durationFast,
    '--zw-duration-normal': motion.durationNormal,
    '--zw-duration-slow': motion.durationSlow,
    '--zw-easing-standard': motion.easingStandard,
    '--zw-easing-emphasized': motion.easingEmphasized,
  }

  for (const token of semanticColorTokens) {
    style[`--${token}`] = colors[token]
  }

  style['--zw-background'] = 'var(--background)'
  style['--zw-foreground'] = 'var(--foreground)'
  style['--zw-primary'] = 'var(--primary)'
  style['--zw-primary-foreground'] = 'var(--primary-foreground)'
  style['--zw-border'] = 'var(--border)'
  style['--zw-input'] = 'var(--input)'
  style['--zw-ring'] = 'var(--ring)'

  return style
}

export function createShowcaseThemeSnippet(
  kind: ShowcaseThemeSnippetKind,
  options: ShowcaseThemeStyleOptions,
): string {
  switch (kind) {
    case 'css':
      return `import '${themeCssImports[options.themeName]}'`

    case 'html':
      return `<section
  data-theme="${options.themeName}"
  data-mode="${options.mode}"
  data-motion="${options.motion}"
  style="--radius: ${radiusPresets[options.radius]}"
>
  ...
</section>`

    case 'tokens':
      return `background: hsl(var(--background));
foreground: hsl(var(--foreground));
primary: hsl(var(--primary));
radius: var(--zw-radius-lg);
duration: var(--zw-duration-normal);`

    default:
      return ''
  }
}
