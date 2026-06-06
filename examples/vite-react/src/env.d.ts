// @zeus-web/input/react 的类型声明
// 路径别名指向源文件（仅有 WC 类型），此处手动声明 React 包装类型
declare module '@zeus-web/input/react' {
  import type * as React from 'react'

  export interface InputProps {
    defaultValue?: string
    disabled?: boolean
    formatter?: (value: string) => string
    invalid?: boolean
    name?: string
    placeholder?: string
    readonly?: boolean
    required?: boolean
    size?: 'sm' | 'md' | 'lg'
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number'
    value?: string

    children?: React.ReactNode
    className?: string
    style?: React.CSSProperties
    onValueChange?: (
      event: CustomEvent<{ value: string; nativeEvent: Event }>,
    ) => void
    onFocusChange?: (
      event: CustomEvent<{ focused: boolean; nativeEvent: FocusEvent }>,
    ) => void
    prefix?: React.ReactNode
    suffix?: React.ReactNode
    message?: React.ReactNode
  }

  export interface InputElement extends HTMLElement {
    defaultValue?: string
    disabled?: boolean
    formatter?: (value: string) => string
    invalid?: boolean
    name?: string
    placeholder?: string
    readonly?: boolean
    required?: boolean
    size?: 'sm' | 'md' | 'lg'
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number'
    value?: string
    focus: () => void
    blur: () => void
    select: () => void
  }

  export declare const Input: React.ForwardRefExoticComponent<
    InputProps & React.RefAttributes<InputElement>
  >
}
