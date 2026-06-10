import type { Component } from 'vue'

import ButtonDemoPage from './ButtonDemoPage.vue'
import CheckboxDemoPage from './CheckboxDemoPage.vue'
import DialogDemoPage from './DialogDemoPage.vue'
import InputDemoPage from './InputDemoPage.vue'
import SwitchDemoPage from './SwitchDemoPage.vue'
import TabsDemoPage from './TabsDemoPage.vue'

export const p0VueDemoPages: Record<string, Component> = {
  button: ButtonDemoPage,
  input: InputDemoPage,
  checkbox: CheckboxDemoPage,
  switch: SwitchDemoPage,
  tabs: TabsDemoPage,
  dialog: DialogDemoPage,
}

export const p0VueDemoNames = Object.keys(p0VueDemoPages)
