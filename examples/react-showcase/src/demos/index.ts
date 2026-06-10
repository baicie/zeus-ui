import type { ComponentType } from 'react'

import { reactFormsDemoPages } from './forms'
import { p0ReactDemoPages } from './p0'

export const reactShowcaseDemoPages: Record<string, ComponentType> = {
  ...p0ReactDemoPages,
  ...reactFormsDemoPages,
}

export const reactShowcaseDemoNames = Object.keys(reactShowcaseDemoPages)
