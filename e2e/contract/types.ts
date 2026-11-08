export type HostName = 'native' | 'react' | 'vue' | 'wc'

export interface MountedHost {
  host: HostName
  /**
   * The root custom element for the component under test.
   *
   * Wrappers render asynchronously, so read this only after `ready` resolves;
   * every harness accessor does that.
   */
  element: HTMLElement
  /** Resolves once the element has rendered at least once. */
  ready: Promise<void>
  unmount: () => Promise<void>
}
