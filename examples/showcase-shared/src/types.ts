export type ShowcaseFramework = 'react' | 'vue' | 'web-component'

export type ShowcaseComponentGroup =
  | 'Actions'
  | 'Forms'
  | 'Layout'
  | 'Feedback'
  | 'Disclosure'
  | 'Navigation'
  | 'Media'

export type ShowcaseSection =
  | 'basic'
  | 'variants'
  | 'sizes'
  | 'states'
  | 'controlled'
  | 'uncontrolled'
  | 'events'
  | 'icons'
  | 'theme'
  | 'accessibility'
  | 'production'

export interface ShowcaseImportSpec {
  react?: string
  vue?: string
  webComponent?: string
  registry?: string
}

export interface ShowcaseEventSpec {
  name: string
  reactName?: string
  vueName?: string
  description: string
}

export interface ShowcaseComponent {
  name: string
  title: string
  routePath: `/components/${string}`
  packageName: `@zeus-web/${string}`
  group: ShowcaseComponentGroup
  description: string
  registryCommand: string
  imports: ShowcaseImportSpec
  sections: readonly ShowcaseSection[]
  states: string[]
  events: ShowcaseEventSpec[]
  themeTokens: string[]
  iconExamples: string[]
  productionPatterns: string[]
}

export interface ShowcaseTheme {
  name: string
  label: string
  cssImport: string
  description: string
}

export type ShowcaseIconCategory =
  | 'action'
  | 'navigation'
  | 'status'
  | 'theme'
  | 'media'

export interface ShowcaseIcon {
  name: string
  label: string
  category: ShowcaseIconCategory
  tags: string[]
}

export interface ShowcaseRoute {
  path: string
  label: string
  description: string
  group: 'Overview' | 'Components' | 'Foundations' | 'Playground'
  componentName?: string
}

export interface ShowcaseValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
