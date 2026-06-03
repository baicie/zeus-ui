// Declaration for @zeus-js/zeus/capabilities — the module does not exist in the current
// beta release. This declaration allows the dynamic import in capabilities.ts and
// canary-capabilities.spec.ts to type-check locally.
//
// When Zeus starts exporting this module (including canary builds), this file
// should be deleted so TypeScript resolves the real types from the installed package.

declare module '@zeus-js/zeus/capabilities' {
  const ZEUS_CAPABILITIES: {
    packageName: string
    version: string
    publicApi: Record<string, boolean>
    jsx: Record<string, boolean>
    webComponents: {
      defineElement: boolean
      Host: boolean
      Slot: boolean
      shadowDom: boolean
      lightDom: boolean
      namedSlots: boolean
      defaultSlot: boolean
      props: boolean
      attrs: boolean
      reflect: boolean
      events: boolean
      styles: boolean
      context: boolean
    }
    stability: Record<string, string>
  }

  export { ZEUS_CAPABILITIES }
}
