import type { ShowcaseTheme } from './types'

export const showcaseThemes: ShowcaseTheme[] = [
  {
    name: 'default',
    label: 'Default',
    cssImport: '@zeus-web/themes/default.css',
    description: 'Default Zeus Web theme.',
  },
  {
    name: 'slate',
    label: 'Slate',
    cssImport: '@zeus-web/themes/slate.css',
    description: 'Cool neutral theme.',
  },
  {
    name: 'zinc',
    label: 'Zinc',
    cssImport: '@zeus-web/themes/zinc.css',
    description: 'Modern neutral theme.',
  },
  {
    name: 'neutral',
    label: 'Neutral',
    cssImport: '@zeus-web/themes/neutral.css',
    description: 'Balanced neutral theme.',
  },
  {
    name: 'stone',
    label: 'Stone',
    cssImport: '@zeus-web/themes/stone.css',
    description: 'Warm neutral theme.',
  },
]

export const semanticTokens = [
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
