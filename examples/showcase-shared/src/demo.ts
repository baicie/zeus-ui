import type { ShowcaseSection } from './types'

export interface ShowcaseSectionDefinition {
  id: ShowcaseSection
  label: string
  description: string
  requiredForMvp: boolean
}

export const showcaseSectionOrder: ShowcaseSection[] = [
  'basic',
  'variants',
  'sizes',
  'states',
  'controlled',
  'uncontrolled',
  'events',
  'icons',
  'theme',
  'accessibility',
  'production',
]

export const showcaseSectionDefinitions: Record<
  ShowcaseSection,
  ShowcaseSectionDefinition
> = {
  basic: {
    id: 'basic',
    label: 'Basic',
    description: 'Minimal usage and default rendering.',
    requiredForMvp: true,
  },
  variants: {
    id: 'variants',
    label: 'Variants',
    description: 'Visual and semantic variants.',
    requiredForMvp: false,
  },
  sizes: {
    id: 'sizes',
    label: 'Sizes',
    description: 'Supported size presets.',
    requiredForMvp: false,
  },
  states: {
    id: 'states',
    label: 'States',
    description: 'Disabled, invalid, loading, selected and other states.',
    requiredForMvp: true,
  },
  controlled: {
    id: 'controlled',
    label: 'Controlled',
    description: 'Externally controlled state examples.',
    requiredForMvp: false,
  },
  uncontrolled: {
    id: 'uncontrolled',
    label: 'Uncontrolled',
    description: 'Default value and internal state examples.',
    requiredForMvp: false,
  },
  events: {
    id: 'events',
    label: 'Events',
    description: 'Emitted events and framework callback names.',
    requiredForMvp: false,
  },
  icons: {
    id: 'icons',
    label: 'With icons',
    description: 'Icon composition examples.',
    requiredForMvp: false,
  },
  theme: {
    id: 'theme',
    label: 'Theme tokens',
    description: 'Theme tokens used by the component.',
    requiredForMvp: true,
  },
  accessibility: {
    id: 'accessibility',
    label: 'Accessibility',
    description: 'Accessibility notes and expected keyboard behavior.',
    requiredForMvp: true,
  },
  production: {
    id: 'production',
    label: 'Production patterns',
    description: 'Real-world use cases this component should support.',
    requiredForMvp: true,
  },
}

export function getShowcaseSectionDefinition(
  section: ShowcaseSection,
): ShowcaseSectionDefinition {
  return showcaseSectionDefinitions[section]
}

export function sortShowcaseSections(
  sections: readonly ShowcaseSection[],
): ShowcaseSection[] {
  const enabled = new Set(sections)

  return showcaseSectionOrder.filter(section => enabled.has(section))
}

export function getRequiredShowcaseSections(): ShowcaseSection[] {
  return showcaseSectionOrder.filter(
    section => showcaseSectionDefinitions[section].requiredForMvp,
  )
}
