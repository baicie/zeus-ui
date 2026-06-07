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

export function getThemeCssImport(theme: ThemeName = 'default'): string {
  return themeCssImports[theme]
}

export function isThemeName(value: string): value is ThemeName {
  return (themeNames as readonly string[]).includes(value)
}
