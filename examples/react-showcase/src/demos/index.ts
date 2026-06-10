import type { ComponentType } from 'react'

import { reactFormsDemoPages } from './forms'
import { p0ReactDemoPages } from './p0'
import { reactVisualDemoPages } from './visual'

export const reactShowcaseDemoPages: Record<string, ComponentType> = {
  ...p0ReactDemoPages,
  ...reactFormsDemoPages,
  ...reactVisualDemoPages,
}

export const reactShowcaseDemoNames = Object.keys(reactShowcaseDemoPages)
