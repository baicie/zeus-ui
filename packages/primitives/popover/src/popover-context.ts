import type { DOMContext } from '@zeus-web/zeus-compat'
import { createContext } from '@zeus-js/zeus'

export interface PopoverContextValue {
  getOpen: () => boolean
  setOpen: (
    open: boolean,
    event?: Event,
    focusIntent?: 'content' | 'trigger',
  ) => void
  isDisabled: () => boolean
  getContentId: () => string
  registerTrigger: (element: HTMLElement | undefined) => void
  focusTrigger: () => void
  registerContent: (element: HTMLElement) => void
  focusContent: () => void
}

// Keep one context object for all lazy custom-element entries in this package.
export const PopoverContext =
  createContext<PopoverContextValue>() as DOMContext<PopoverContextValue>
