// Aggregated headless Web Components for Zeus Web.
//
// This entry intentionally imports each primitive auto-registration entry,
// so `import '@zeus-web/headless'` registers all MVP primitives.
//
// For smaller bundles, users should import individual primitive entries:
//
//   import '@zeus-web/button/wc/auto'
//   import '@zeus-web/input/wc/auto'

import '@zeus-web/button/wc/auto'
import '@zeus-web/checkbox/wc/auto'
import '@zeus-web/dialog/wc/auto'
import '@zeus-web/input/wc/auto'
import '@zeus-web/switch/wc/auto'
import '@zeus-web/tabs/wc/auto'

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
