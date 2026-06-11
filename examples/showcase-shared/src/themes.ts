/* eslint-disable perfectionist/sort-imports */
import type {
  MotionPresetName,
  RadiusPresetName,
  SemanticColorToken,
  ThemeModeName,
  ThemeName,
} from '@zeus-web/themes'
import {
  darkModeStrategyNames,
  getThemeColors,
  motionPresetNames,
  motionPresets,
  radiusPresetNames,
  radiusPresets,
  semanticColorTokens,
  themeCssImports,
  themeModeNames,
  themeNames,
} from '@zeus-web/themes'

import type { ShowcaseTheme } from './types'

export type { ShowcaseTheme }

export type ShowcaseThemeName = ThemeName
export type ShowcaseThemeMode = ThemeModeName
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

export const showcaseThemes: ShowcaseTheme[] = themeNames.map(themeName => ({
  name: themeName,
  label: themeLabels[themeName],
  cssImport: themeCssImports[themeName],
  description: themeDescriptions[themeName],
}))

export const semanticTokens = semanticColorTokens

export const showcaseThemeModes = themeModeNames

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
  return getThemeColors(themeName, mode)
}

export function formatShowcaseThemeTokenCssVar(
  token: SemanticColorToken,
): string {
  return `hsl(var(--${token}))`
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
