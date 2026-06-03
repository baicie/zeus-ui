// MIGRATION NOTE:
// This module attempts to resolve capabilities from @zeus-js/zeus/capabilities first.
// When the Zeus monorepo exports it (including canary builds), the dynamic import
// succeeds and the real capability manifest is used. When unavailable (current beta),
// the local fallback is used instead.
//
// Phase 1 (now):       dynamic import with local fallback
// Phase 2 (future):    delete LOCAL_CAPABILITIES, re-export directly from '@zeus-js/zeus/capabilities'

const LOCAL_CAPABILITIES = {
  packageName: '@zeus-js/zeus',
  version: '0.1.0-beta.0',

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

export type ZeusCapabilities = typeof LOCAL_CAPABILITIES

// Lazily resolved — null until resolveZeusCapabilities() is called.
let _resolved: Readonly<typeof LOCAL_CAPABILITIES> | null = null

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
  const caps = _resolved ?? LOCAL_CAPABILITIES
  const missing: ZeusCompatRequirement[] = []

  for (const key of requiredWebComponentFeatures) {
    const actual = caps.webComponents[key as keyof typeof caps.webComponents]

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

// NOTE: the static ZEUS_CAPABILITIES export is the LOCAL fallback.
// After calling resolveZeusCapabilities(), use getZeusCapabilities() to get
// the resolved value (real Zeus capabilities when available, fallback otherwise).
export const ZEUS_CAPABILITIES = LOCAL_CAPABILITIES

export async function resolveZeusCapabilities(): Promise<void> {
  try {
    const mod = (await import('@zeus-js/zeus/capabilities')) as unknown as {
      ZEUS_CAPABILITIES: typeof LOCAL_CAPABILITIES
    }
    _resolved = mod.ZEUS_CAPABILITIES
  } catch {
    // @zeus-js/zeus/capabilities not available; use local fallback.
    _resolved = LOCAL_CAPABILITIES
  }
}

export function getZeusCapabilities(): Readonly<typeof LOCAL_CAPABILITIES> {
  return _resolved ?? LOCAL_CAPABILITIES
}
