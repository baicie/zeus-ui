import '@zeus-js/zeus/jsx'

declare global {
  namespace JSX {
    type Element = import('@zeus-js/runtime-dom').JSXValue
    interface ElementChildrenAttribute {
      children: unknown
    }
  }
}

export {}
