import type { Component } from 'vue'

import AccordionDemoPage from './AccordionDemoPage.vue'
import CollapsibleDemoPage from './CollapsibleDemoPage.vue'
import TooltipDemoPage from './TooltipDemoPage.vue'

export const vueDisclosureDemoPages: Record<string, Component> = {
  collapsible: CollapsibleDemoPage,
  accordion: AccordionDemoPage,
  tooltip: TooltipDemoPage,
}

export const vueDisclosureDemoNames = Object.keys(vueDisclosureDemoPages)
