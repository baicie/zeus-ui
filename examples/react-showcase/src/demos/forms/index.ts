import type { ComponentType } from 'react'

import { LabelDemoPage } from './LabelDemoPage'
import { RadioGroupDemoPage } from './RadioGroupDemoPage'
import { SelectDemoPage } from './SelectDemoPage'
import { TextareaDemoPage } from './TextareaDemoPage'

export const reactFormsDemoPages: Record<string, ComponentType> = {
  label: LabelDemoPage,
  textarea: TextareaDemoPage,
  'radio-group': RadioGroupDemoPage,
  select: SelectDemoPage,
}

export const reactFormsDemoNames = Object.keys(reactFormsDemoPages)
