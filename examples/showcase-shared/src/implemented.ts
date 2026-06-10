import type { ShowcaseComponent } from './types'
import { showcaseComponents } from './components'

export const showcaseDemoBatches = {
  p0: ['button', 'input', 'checkbox', 'switch', 'tabs', 'dialog'],
  forms: ['label', 'textarea', 'radio-group', 'select'],
  visual: [
    'card',
    'badge',
    'separator',
    'skeleton',
    'alert',
    'progress',
    'avatar',
  ],
  disclosure: ['collapsible', 'accordion', 'tooltip'],
} as const

export type ImplementedShowcaseComponentName =
  | 'button'
  | 'input'
  | 'checkbox'
  | 'switch'
  | 'tabs'
  | 'dialog'
  | 'label'
  | 'textarea'
  | 'radio-group'
  | 'select'
  | 'card'
  | 'badge'
  | 'separator'
  | 'skeleton'
  | 'alert'
  | 'progress'
  | 'avatar'
  | 'collapsible'
  | 'accordion'
  | 'tooltip'

export type ShowcaseDemoBatchName = 'p0' | 'forms' | 'visual' | 'disclosure'

export const implementedShowcaseComponentNames: readonly ImplementedShowcaseComponentName[] =
  [
    'button',
    'input',
    'checkbox',
    'switch',
    'tabs',
    'dialog',
    'label',
    'textarea',
    'radio-group',
    'select',
    'card',
    'badge',
    'separator',
    'skeleton',
    'alert',
    'progress',
    'avatar',
    'collapsible',
    'accordion',
    'tooltip',
  ]

export function isImplementedShowcaseComponent(
  name: string,
): name is ImplementedShowcaseComponentName {
  return (implementedShowcaseComponentNames as readonly string[]).includes(name)
}

export function getImplementedShowcaseComponents(
  components: readonly ShowcaseComponent[] = showcaseComponents,
): ShowcaseComponent[] {
  const names = new Set<string>(implementedShowcaseComponentNames)

  return components.filter(component => names.has(component.name))
}

export function getImplementedShowcasePackageNames(
  components: readonly ShowcaseComponent[] = showcaseComponents,
): string[] {
  const packageNames: string[] = []

  for (const component of getImplementedShowcaseComponents(components)) {
    if (!packageNames.includes(component.packageName)) {
      packageNames.push(component.packageName)
    }
  }

  return packageNames.sort()
}

export function getShowcaseDemoBatchName(
  componentName: string,
): ShowcaseDemoBatchName | undefined {
  if ((showcaseDemoBatches.p0 as readonly string[]).includes(componentName))
    return 'p0'
  if ((showcaseDemoBatches.forms as readonly string[]).includes(componentName))
    return 'forms'
  if ((showcaseDemoBatches.visual as readonly string[]).includes(componentName))
    return 'visual'
  if (
    (showcaseDemoBatches.disclosure as readonly string[]).includes(
      componentName,
    )
  ) {
    return 'disclosure'
  }
  return undefined
}
