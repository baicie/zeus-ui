// MIGRATION NOTE:
// When @zeus-js/zeus exports @zeus-js/zeus/capabilities, replace the hand-written
// ZEUS_CAPABILITIES below with:
//   export { ZEUS_CAPABILITIES } from '@zeus-js/zeus/capabilities'
//   export type { ZeusCapabilities } from '@zeus-js/zeus/capabilities'
// This file should become a re-export + augmentation only.

const version = '0.1.0-beta.0'

export const ZEUS_CAPABILITIES = {
  packageName: '@zeus-js/zeus',
  version,

  publicApi: {
    state: true,
    computed: true,
    effect: true,
    watch: true,
    scope: true,
    batch: true,
    untrack: true,
    nextTick: true,
    onCleanup: true,

    render: true,
    Show: true,
    For: true,

    createContext: true,
    provide: true,
    inject: true,
    useContext: true,
  },

  jsx: {
    jsxRuntime: true,
    jsxDevRuntime: true,
    fragment: true,
    compiledJsx: true,
  },

  webComponents: {
    defineElement: true,
    Host: true,
    Slot: true,
    shadowDom: true,
    lightDom: true,
    namedSlots: true,
    defaultSlot: true,
    props: true,
    attrs: true,
    reflect: true,
    events: true,
    styles: true,
    context: true,
  },

  stability: {
    main: 'stable',
    advanced: 'advanced',
    internal: 'private',
  },
} as const

export type ZeusCapabilities = typeof ZEUS_CAPABILITIES

export interface ZeusCompatRequirement {
  area: string
  key: string
  expected: true
  actual: unknown
}

const requiredWebComponentFeatures = [
  'defineElement',
  'Host',
  'Slot',
  'props',
  'attrs',
  'events',
  'styles',
] as const

export function getMissingZeusCompatRequirements(): ZeusCompatRequirement[] {
  const missing: ZeusCompatRequirement[] = []

  for (const key of requiredWebComponentFeatures) {
    const actual =
      ZEUS_CAPABILITIES.webComponents[
        key as keyof typeof ZEUS_CAPABILITIES.webComponents
      ]

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
