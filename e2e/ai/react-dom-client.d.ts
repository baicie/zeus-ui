/** Minimal types for the harness; react-dom is resolved through vitest aliases. */
declare module 'react-dom/client' {
  export function createRoot(container: Element): {
    render: (node: unknown) => void
    unmount: () => void
  }
}
