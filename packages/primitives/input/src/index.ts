export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'search'
  | 'tel'
  | 'url'
  | 'number'

export interface InputProps {
  value?: string
  defaultValue?: string
  type?: InputType
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  name?: string
}

export interface InputValueChangeDetail {
  value: string
  nativeEvent: Event
}

export const inputTagName = 'zw-input'
