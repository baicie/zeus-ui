import type { DOMContext } from '@zeus-web/zeus-compat'
import { createContext } from '@zeus-js/zeus'

export interface FormFieldContextValue {
  getControlId: () => string
  setControlId: (id: string) => void
  getDescriptionId: () => string
  getMessageId: () => string
  isInvalid: () => boolean
  isDisabled: () => boolean
  isRequired: () => boolean
}

// Keep one context object for all lazy custom-element entries in this package.
export const FormFieldContext =
  createContext<FormFieldContextValue>() as DOMContext<FormFieldContextValue>
