import type { Component } from 'vue'

import { vueFormsDemoPages } from './forms'
import { p0VueDemoPages } from './p0'
import { vueVisualDemoPages } from './visual'

export const vueShowcaseDemoPages: Record<string, Component> = {
  ...p0VueDemoPages,
  ...vueFormsDemoPages,
  ...vueVisualDemoPages,
}

export const vueShowcaseDemoNames = Object.keys(vueShowcaseDemoPages)
