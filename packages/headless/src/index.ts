// Aggregated headless Web Components for Zeus Web.
// Re-exports element type interfaces from all primitives.
// Registration helpers (defineCustomElements / defineLazyElements)
// are intentionally NOT re-exported here to avoid naming conflicts;
// import individual primitive packages for registration.

export type { ButtonElement } from '@zeus-web/button'

export type { CheckboxElement } from '@zeus-web/checkbox'

export type {
  DialogCloseElement,
  DialogContentElement,
  DialogDescriptionElement,
  DialogElement,
  DialogTitleElement,
  DialogTriggerElement,
} from '@zeus-web/dialog'

export type { InputElement } from '@zeus-web/input'

export type { SwitchElement } from '@zeus-web/switch'

export type {
  TabsContentElement,
  TabsElement,
  TabsListElement,
  TabsTriggerElement,
} from '@zeus-web/tabs'
