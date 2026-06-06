// Aggregated headless Web Components for Zeus Web.
//
// This entry intentionally imports each primitive WC entry for side effects,
// so `import '@zeus-web/headless'` registers all MVP primitives.
//
// For smaller bundles, users should import individual primitive entries:
//
//   import '@zeus-web/button/wc'
//   import '@zeus-web/input/wc'

import '@zeus-web/button/wc'
import '@zeus-web/checkbox/wc'
import '@zeus-web/dialog/wc'
import '@zeus-web/input/wc'
import '@zeus-web/switch/wc'
import '@zeus-web/tabs/wc'

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
