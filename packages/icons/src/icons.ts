import type { IconSource } from '@zeus-js/output-icons'

export interface ZeusWebIconMeta {
  name: ZeusWebIconName
  title: string
  category: 'action' | 'navigation' | 'status' | 'theme' | 'media'
  tags: string[]
}

export const iconSources = [
  {
    name: 'check',
    title: 'Check',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  },
  {
    name: 'x',
    title: 'X',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  },
  {
    name: 'plus',
    title: 'Plus',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  },
  {
    name: 'minus',
    title: 'Minus',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`,
  },
  {
    name: 'chevron-down',
    title: 'Chevron Down',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  },
  {
    name: 'chevron-up',
    title: 'Chevron Up',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`,
  },
  {
    name: 'chevron-left',
    title: 'Chevron Left',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  },
  {
    name: 'chevron-right',
    title: 'Chevron Right',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
  },
  {
    name: 'search',
    title: 'Search',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  },
  {
    name: 'menu',
    title: 'Menu',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>`,
  },
  {
    name: 'settings',
    title: 'Settings',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  },
  {
    name: 'user',
    title: 'User',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21a7 7 0 0 0-14 0"/><circle cx="12" cy="7" r="4"/></svg>`,
  },
  {
    name: 'copy',
    title: 'Copy',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  },
  {
    name: 'external-link',
    title: 'External Link',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
  },
  {
    name: 'info',
    title: 'Info',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  },
  {
    name: 'alert-triangle',
    title: 'Alert Triangle',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  },
  {
    name: 'circle-check',
    title: 'Circle Check',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  },
  {
    name: 'circle-x',
    title: 'Circle X',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
  },
  {
    name: 'loader',
    title: 'Loader',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>`,
  },
  {
    name: 'sun',
    title: 'Sun',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  },
  {
    name: 'moon',
    title: 'Moon',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  },
  {
    name: 'eye',
    title: 'Eye',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.06 12.35a11 11 0 0 1 19.88 0 11 11 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>`,
  },
  {
    name: 'eye-off',
    title: 'Eye Off',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 2 20 20"/><path d="M10.58 10.58A2 2 0 0 0 13.42 13.42"/><path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a16.2 16.2 0 0 1-3.04 4.31"/><path d="M6.61 6.61A16.6 16.6 0 0 0 2 12s3 8 10 8a10.9 10.9 0 0 0 5.39-1.39"/></svg>`,
  },
  {
    name: 'trash',
    title: 'Trash',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
  },
] as const satisfies readonly IconSource[]

export type ZeusWebIconName = (typeof iconSources)[number]['name']

export const iconNames = iconSources.map(icon => icon.name) as ZeusWebIconName[]

export const iconMetadata: Record<ZeusWebIconName, ZeusWebIconMeta> = {
  check: {
    name: 'check',
    title: 'Check',
    category: 'status',
    tags: ['check', 'confirm', 'success'],
  },
  x: {
    name: 'x',
    title: 'X',
    category: 'action',
    tags: ['close', 'dismiss', 'remove'],
  },
  plus: {
    name: 'plus',
    title: 'Plus',
    category: 'action',
    tags: ['add', 'create', 'new'],
  },
  minus: {
    name: 'minus',
    title: 'Minus',
    category: 'action',
    tags: ['remove', 'collapse'],
  },
  'chevron-down': {
    name: 'chevron-down',
    title: 'Chevron Down',
    category: 'navigation',
    tags: ['arrow', 'down', 'select'],
  },
  'chevron-up': {
    name: 'chevron-up',
    title: 'Chevron Up',
    category: 'navigation',
    tags: ['arrow', 'up'],
  },
  'chevron-left': {
    name: 'chevron-left',
    title: 'Chevron Left',
    category: 'navigation',
    tags: ['arrow', 'left', 'previous'],
  },
  'chevron-right': {
    name: 'chevron-right',
    title: 'Chevron Right',
    category: 'navigation',
    tags: ['arrow', 'right', 'next'],
  },
  search: {
    name: 'search',
    title: 'Search',
    category: 'action',
    tags: ['find', 'filter'],
  },
  menu: {
    name: 'menu',
    title: 'Menu',
    category: 'navigation',
    tags: ['hamburger', 'nav'],
  },
  settings: {
    name: 'settings',
    title: 'Settings',
    category: 'action',
    tags: ['config', 'preferences'],
  },
  user: {
    name: 'user',
    title: 'User',
    category: 'action',
    tags: ['account', 'profile'],
  },
  copy: {
    name: 'copy',
    title: 'Copy',
    category: 'action',
    tags: ['clipboard', 'duplicate'],
  },
  'external-link': {
    name: 'external-link',
    title: 'External Link',
    category: 'navigation',
    tags: ['open', 'link'],
  },
  info: {
    name: 'info',
    title: 'Info',
    category: 'status',
    tags: ['help', 'information'],
  },
  'alert-triangle': {
    name: 'alert-triangle',
    title: 'Alert Triangle',
    category: 'status',
    tags: ['warning', 'error'],
  },
  'circle-check': {
    name: 'circle-check',
    title: 'Circle Check',
    category: 'status',
    tags: ['success', 'done'],
  },
  'circle-x': {
    name: 'circle-x',
    title: 'Circle X',
    category: 'status',
    tags: ['error', 'failed'],
  },
  loader: {
    name: 'loader',
    title: 'Loader',
    category: 'status',
    tags: ['loading', 'spinner'],
  },
  sun: {
    name: 'sun',
    title: 'Sun',
    category: 'theme',
    tags: ['light', 'theme'],
  },
  moon: {
    name: 'moon',
    title: 'Moon',
    category: 'theme',
    tags: ['dark', 'theme'],
  },
  eye: {
    name: 'eye',
    title: 'Eye',
    category: 'media',
    tags: ['visible', 'show'],
  },
  'eye-off': {
    name: 'eye-off',
    title: 'Eye Off',
    category: 'media',
    tags: ['hidden', 'hide'],
  },
  trash: {
    name: 'trash',
    title: 'Trash',
    category: 'action',
    tags: ['delete', 'remove'],
  },
}

export const iconsManifest = {
  packageName: '@zeus-web/icons',
  count: iconSources.length,
  names: iconNames,
  icons: iconNames.map(name => iconMetadata[name]),
} as const

export function isIconName(value: string): value is ZeusWebIconName {
  return (iconNames as readonly string[]).includes(value)
}

export function searchIcons(query: string): ZeusWebIconMeta[] {
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return iconNames.map(name => iconMetadata[name])
  }

  return iconNames
    .map(name => iconMetadata[name])
    .filter(icon => {
      return (
        icon.name.includes(normalized) ||
        icon.title.toLowerCase().includes(normalized) ||
        icon.tags.some(tag => tag.includes(normalized))
      )
    })
}
