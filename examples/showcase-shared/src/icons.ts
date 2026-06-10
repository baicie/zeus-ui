import type { ShowcaseIcon } from './types'

export const showcaseIcons: ShowcaseIcon[] = [
  { name: 'check', label: 'Check', tags: ['status', 'form', 'action'] },
  { name: 'x', label: 'X', tags: ['close', 'remove', 'dialog'] },
  { name: 'plus', label: 'Plus', tags: ['add', 'create', 'action'] },
  { name: 'minus', label: 'Minus', tags: ['remove', 'collapse', 'action'] },
  {
    name: 'chevron-down',
    label: 'Chevron down',
    tags: ['navigation', 'disclosure'],
  },
  {
    name: 'chevron-up',
    label: 'Chevron up',
    tags: ['navigation', 'disclosure'],
  },
  {
    name: 'chevron-left',
    label: 'Chevron left',
    tags: ['navigation'],
  },
  {
    name: 'chevron-right',
    label: 'Chevron right',
    tags: ['navigation'],
  },
  { name: 'search', label: 'Search', tags: ['input', 'navigation'] },
  { name: 'menu', label: 'Menu', tags: ['navigation', 'layout'] },
  { name: 'settings', label: 'Settings', tags: ['navigation', 'preferences'] },
  { name: 'user', label: 'User', tags: ['avatar', 'profile'] },
  { name: 'copy', label: 'Copy', tags: ['clipboard', 'action'] },
  { name: 'external-link', label: 'External link', tags: ['navigation'] },
  { name: 'info', label: 'Info', tags: ['feedback', 'help'] },
  {
    name: 'alert-triangle',
    label: 'Alert triangle',
    tags: ['warning', 'feedback'],
  },
  {
    name: 'circle-check',
    label: 'Circle check',
    tags: ['success', 'feedback'],
  },
  { name: 'circle-x', label: 'Circle x', tags: ['error', 'feedback'] },
  { name: 'loader', label: 'Loader', tags: ['loading', 'progress'] },
  { name: 'sun', label: 'Sun', tags: ['theme', 'light'] },
  { name: 'moon', label: 'Moon', tags: ['theme', 'dark'] },
  { name: 'eye', label: 'Eye', tags: ['visibility', 'input'] },
  { name: 'eye-off', label: 'Eye off', tags: ['visibility', 'input'] },
  { name: 'trash', label: 'Trash', tags: ['delete', 'danger'] },
]
