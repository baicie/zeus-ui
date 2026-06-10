import type { Component } from 'vue'

import { vueFormsDemoPages } from './forms'
import { p0VueDemoPages } from './p0'

export const vueShowcaseDemoPages: Record<string, Component> = {
  ...p0VueDemoPages,
  ...vueFormsDemoPages,
}

export const vueShowcaseDemoNames = Object.keys(vueShowcaseDemoPages)
