// Declaration for @zeus-js/zeus/capabilities — provides types so that zeus-compat
// and its tests type-check locally. When Zeus publishes this module, this file
// should be deleted so TypeScript resolves the real types from the installed package.
declare module '@zeus-js/zeus/capabilities' {
  export interface ZeusCapabilities {
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

  export const ZEUS_CAPABILITIES: ZeusCapabilities
}
