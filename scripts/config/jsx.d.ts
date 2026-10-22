import '@zeus-js/zeus/jsx'

declare global {
  function once<T>(value: T): T

  namespace JSX {
    type Element = any
    interface ElementChildrenAttribute {
      children: unknown
    }
    interface IntrinsicElements {
      [elemName: string]: Record<string, unknown>
    }
  }
}

export {}
