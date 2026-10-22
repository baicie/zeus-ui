import type { DOMContext } from '@zeus-web/zeus-compat'
import { createContext } from '@zeus-js/zeus'

export interface DropdownMenuContextValue {
  getOpen: () => boolean
  setOpen: (
    open: boolean,
    event?: Event,
    focusIntent?: 'first' | 'last' | 'trigger',
  ) => void
  select: (value: string | undefined, event: Event) => void
  isDisabled: () => boolean
  getContentId: () => string
  close: (event?: Event, restoreFocus?: boolean) => void
  getEnabledItems: () => HTMLElement[]
  registerTrigger: (element: HTMLElement) => void
  registerContent: (element: HTMLElement) => void
  focusFirstItem: () => void
  focusLastItem: () => void
  focusNextItem: (direction: 1 | -1) => void
  focusTrigger: () => void
}

// Keep one context object for all lazy custom-element entries in this package.
export const DropdownMenuContext =
  createContext<DropdownMenuContextValue>() as DOMContext<DropdownMenuContextValue>
