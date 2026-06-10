import type { Component } from 'vue'

import LabelDemoPage from './LabelDemoPage.vue'
import RadioGroupDemoPage from './RadioGroupDemoPage.vue'
import SelectDemoPage from './SelectDemoPage.vue'
import TextareaDemoPage from './TextareaDemoPage.vue'

export const vueFormsDemoPages: Record<string, Component> = {
  label: LabelDemoPage,
  textarea: TextareaDemoPage,
  'radio-group': RadioGroupDemoPage,
  select: SelectDemoPage,
}

export const vueFormsDemoNames = Object.keys(vueFormsDemoPages)
