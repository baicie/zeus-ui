import type { Component } from 'vue'

import { vueDisclosureDemoPages } from './disclosure'
import { vueFormsDemoPages } from './forms'
import { p0VueDemoPages } from './p0'
import { vueVisualDemoPages } from './visual'

export const vueShowcaseDemoPages: Record<string, Component> = {
  ...p0VueDemoPages,
  ...vueFormsDemoPages,
  ...vueVisualDemoPages,
  ...vueDisclosureDemoPages,
}

export const vueShowcaseDemoNames = Object.keys(vueShowcaseDemoPages)
