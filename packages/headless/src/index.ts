// Aggregated headless Web Components for Zeus Web.
//
// This entry intentionally imports each primitive auto-registration entry,
// so `import '@zeus-web/headless'` registers all MVP primitives.
//
// For smaller bundles, users should import individual primitive entries:
//
//   import '@zeus-web/button/wc/auto'
//   import '@zeus-web/input/wc/auto'

import '@zeus-web/accordion/wc/auto'
import '@zeus-web/alert/wc/auto'
import '@zeus-web/avatar/wc/auto'
import '@zeus-web/badge/wc/auto'
import '@zeus-web/button/wc/auto'
import '@zeus-web/card/wc/auto'
import '@zeus-web/checkbox/wc/auto'
import '@zeus-web/collapsible/wc/auto'
import '@zeus-web/dialog/wc/auto'
import '@zeus-web/dropdown-menu/wc/auto'
import '@zeus-web/form-field/wc/auto'
import '@zeus-web/input/wc/auto'
import '@zeus-web/label/wc/auto'
import '@zeus-web/popover/wc/auto'
import '@zeus-web/progress/wc/auto'
import '@zeus-web/radio-group/wc/auto'
import '@zeus-web/select/wc/auto'
import '@zeus-web/separator/wc/auto'
import '@zeus-web/skeleton/wc/auto'
import '@zeus-web/switch/wc/auto'
import '@zeus-web/tabs/wc/auto'
import '@zeus-web/textarea/wc/auto'
import '@zeus-web/toast/wc/auto'
import '@zeus-web/tooltip/wc/auto'

export type {
  AccordionContentElement,
  AccordionElement,
  AccordionItemElement,
  AccordionTriggerElement,
} from '@zeus-web/accordion'

export type {
  AlertDescriptionElement,
  AlertElement,
  AlertTitleElement,
} from '@zeus-web/alert'

export type {
  AvatarElement,
  AvatarFallbackElement,
  AvatarImageElement,
} from '@zeus-web/avatar'

export type { BadgeElement } from '@zeus-web/badge'

export type { ButtonElement } from '@zeus-web/button'

export type {
  CardContentElement,
  CardDescriptionElement,
  CardElement,
  CardFooterElement,
  CardHeaderElement,
  CardTitleElement,
} from '@zeus-web/card'

export type { CheckboxElement } from '@zeus-web/checkbox'

export type {
  CollapsibleContentElement,
  CollapsibleElement,
  CollapsibleTriggerElement,
} from '@zeus-web/collapsible'

export type {
  DialogCloseElement,
  DialogContentElement,
  DialogDescriptionElement,
  DialogElement,
  DialogOverlayElement,
  DialogTitleElement,
  DialogTriggerElement,
} from '@zeus-web/dialog'

export type {
  DropdownMenuContentElement,
  DropdownMenuElement,
  DropdownMenuItemElement,
  DropdownMenuTriggerElement,
} from '@zeus-web/dropdown-menu'

export type {
  FormFieldControlElement,
  FormFieldDescriptionElement,
  FormFieldElement,
  FormFieldLabelElement,
  FormFieldMessageElement,
} from '@zeus-web/form-field'

export type { InputElement } from '@zeus-web/input'

export type { LabelElement } from '@zeus-web/label'

export type {
  PopoverContentElement,
  PopoverElement,
  PopoverTriggerElement,
} from '@zeus-web/popover'

export type { ProgressElement } from '@zeus-web/progress'

export type {
  RadioGroupElement,
  RadioGroupItemElement,
} from '@zeus-web/radio-group'

export type { SelectElement } from '@zeus-web/select'

export type { SeparatorElement } from '@zeus-web/separator'

export type { SkeletonElement } from '@zeus-web/skeleton'

export type { SwitchElement } from '@zeus-web/switch'

export type {
  TabsContentElement,
  TabsElement,
  TabsListElement,
  TabsTriggerElement,
} from '@zeus-web/tabs'

export type { TextareaElement } from '@zeus-web/textarea'

export type {
  ToastCloseElement,
  ToastDescriptionElement,
  ToastElement,
  ToastTitleElement,
  ToastViewportElement,
} from '@zeus-web/toast'

export type {
  TooltipContentElement,
  TooltipElement,
  TooltipTriggerElement,
} from '@zeus-web/tooltip'
