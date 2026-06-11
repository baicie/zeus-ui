import type { ComponentType } from 'react'

import { ButtonDemoPage } from './ButtonDemoPage'
import { CheckboxDemoPage } from './CheckboxDemoPage'
import { DialogDemoPage } from './DialogDemoPage'
import { InputDemoPage } from './InputDemoPage'
import { SwitchDemoPage } from './SwitchDemoPage'
import { TabsDemoPage } from './TabsDemoPage'

export const p0ReactDemoPages: Record<string, ComponentType> = {
  button: ButtonDemoPage,
  input: InputDemoPage,
  checkbox: CheckboxDemoPage,
  switch: SwitchDemoPage,
  tabs: TabsDemoPage,
  dialog: DialogDemoPage,
}

export const p0ReactDemoNames = Object.keys(p0ReactDemoPages)
