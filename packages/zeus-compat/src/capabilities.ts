import type { ZeusCapabilities } from '@zeus-js/zeus/capabilities'

import { ZEUS_CAPABILITIES } from '@zeus-js/zeus/capabilities'

export { ZEUS_CAPABILITIES }
export type { ZeusCapabilities }

const requiredWebComponentFeatures = [
  'defineElement',
  'Host',
  'Slot',
  'props',
  'attrs',
  'events',
  'styles',
] as const satisfies readonly (keyof ZeusCapabilities['webComponents'])[]

type RequiredWebComponentFeature = (typeof requiredWebComponentFeatures)[number]

export interface ZeusCompatRequirement {
  area: 'webComponents'
  key: RequiredWebComponentFeature
  expected: true
  actual: unknown
}

export function getMissingZeusCompatRequirements(): ZeusCompatRequirement[] {
  const missing: ZeusCompatRequirement[] = []

  for (const key of requiredWebComponentFeatures) {
    const actual = ZEUS_CAPABILITIES.webComponents[key]

    if (actual !== true) {
      missing.push({
        area: 'webComponents',
        key,
        expected: true,
        actual,
      })
    }
  }

  return missing
}

export function assertZeusCompatRequirements(): void {
  const missing = getMissingZeusCompatRequirements()

  if (missing.length === 0) return

  const details = missing
    .map(
      item =>
        `${item.area}.${item.key}: expected true, got ${String(item.actual)}`,
    )
    .join('\n')

  throw new Error(
    `[zeus-ui] incompatible @zeus-js/zeus capabilities:\n${details}`,
  )
}
