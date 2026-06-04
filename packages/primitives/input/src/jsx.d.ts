// JSX intrinsic elements for the input package.
// Declares <Host> and other custom/native elements that @zeus-js/zeus does not export.
// This file is part of the package source, so it is included in the tsc compilation scope.
// All JSX intrinsic elements declared here are merged with other declarations in the project.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Custom elements from Zeus
      Host: Record<string, unknown>
      // Native HTML elements
      div: Record<string, unknown>
      span: Record<string, unknown>
      p: Record<string, unknown>
      a: Record<string, unknown>
      button: Record<string, unknown>
      input: Record<string, unknown>
      textarea: Record<string, unknown>
      select: Record<string, unknown>
      option: Record<string, unknown>
      form: Record<string, unknown>
      label: Record<string, unknown>
      ul: Record<string, unknown>
      ol: Record<string, unknown>
      li: Record<string, unknown>
      img: Record<string, unknown>
      slot: Record<string, unknown>
      template: Record<string, unknown>
      style: Record<string, unknown>
    }
  }
}
export {}
