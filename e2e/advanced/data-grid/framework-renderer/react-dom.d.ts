declare module 'react-dom' {
  import type { ReactNode, ReactPortal } from 'react'

  export function createPortal(
    children: ReactNode,
    container: Element | DocumentFragment,
  ): ReactPortal

  export function flushSync<T>(callback: () => T): T
}

declare module 'react-dom/client' {
  import type { ReactNode } from 'react'

  export interface Root {
    render: (children: ReactNode) => void
    unmount: () => void
  }

  export function createRoot(container: Element | DocumentFragment): Root
}
