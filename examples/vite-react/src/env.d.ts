// @zeus-web/input/react 的类型声明
// 路径别名指向源文件（仅有 WC 类型），此处手动声明 React 包装类型
declare module '@zeus-web/input/react' {
  import type * as React from 'react'

  export interface InputProps {
    defaultValue?: string
    disabled?: boolean
    name?: string
    placeholder?: string
    readonly?: boolean
    required?: boolean
    type?: string
    value?: string

    children?: React.ReactNode
    className?: string
    style?: React.CSSProperties
    onValueChange?: (
      event: CustomEvent<{ value: string; nativeEvent: Event }>,
    ) => void
  }

  export interface InputElement extends HTMLElement {
    defaultValue?: string
    disabled?: boolean
    name?: string
    placeholder?: string
    readonly?: boolean
    required?: boolean
    type?: string
    value?: string
  }

  export declare const Input: React.ForwardRefExoticComponent<
    InputProps & React.RefAttributes<InputElement>
  >
}
