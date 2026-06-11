import type { ShowcaseIcon } from './types'

export type ShowcaseIconCopyKind = 'react' | 'vue' | 'wc' | 'raw'

export function toShowcaseIconComponentName(name: string): string {
  const pascal = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

  const normalized = pascal || 'Icon'

  return normalized.endsWith('Icon') ? normalized : `${normalized}Icon`
}

export function createShowcaseIconSnippet(
  icon: ShowcaseIcon,
  kind: ShowcaseIconCopyKind,
): string {
  const componentName = toShowcaseIconComponentName(icon.name)

  switch (kind) {
    case 'react':
      return `import { ${componentName} } from '@zeus-web/icons/react'`

    case 'vue':
      return `<script setup lang="ts">
import { ${componentName} } from '@zeus-web/icons/vue'
<\/script>`

    case 'wc':
      return `import '@zeus-web/icons/wc'

<zw-icon-${icon.name}></zw-icon-${icon.name}>`

    case 'raw':
      return `import ${componentName}Svg from '@zeus-web/icons/svg/${icon.name}.svg?raw'`

    default:
      return ''
  }
}
