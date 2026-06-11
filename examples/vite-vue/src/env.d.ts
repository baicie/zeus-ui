/* eslint-disable */
// Vue SFC 类型声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// @zeus-web/input/vue 的类型声明
// 路径别名指向源文件（仅有 WC 类型），此处手动声明 Vue 3 包装类型
declare module '@zeus-web/input/vue' {
  import type { DefineComponent } from 'vue'

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
  }

  export declare const Input: DefineComponent<
    InputProps,
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
    {
      'value-change': (
        event: CustomEvent<{ value: string; nativeEvent: Event }>,
      ) => void
      'focus-change': (
        event: CustomEvent<{ focused: boolean; nativeEvent: FocusEvent }>,
      ) => void
      'update:value': (value: string) => void
    }
  >
}
