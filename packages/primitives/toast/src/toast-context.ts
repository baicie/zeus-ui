import type { DOMContext } from '@zeus-web/zeus-compat'
import { createContext } from '@zeus-js/zeus'

export interface ToastContextValue {
  getOpen: () => boolean
  setOpen: (open: boolean, event?: Event) => void
  getTitleId: () => string
  getDescriptionId: () => string
}

export const ToastContext =
  createContext<ToastContextValue>() as DOMContext<ToastContextValue>
