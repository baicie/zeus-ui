import type { ComponentType } from 'react'

import { AccordionDemoPage } from './AccordionDemoPage'
import { CollapsibleDemoPage } from './CollapsibleDemoPage'
import { TooltipDemoPage } from './TooltipDemoPage'

export const reactDisclosureDemoPages: Record<string, ComponentType> = {
  collapsible: CollapsibleDemoPage,
  accordion: AccordionDemoPage,
  tooltip: TooltipDemoPage,
}

export const reactDisclosureDemoNames = Object.keys(reactDisclosureDemoPages)
