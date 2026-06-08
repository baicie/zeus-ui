export type ZeusWebAiComponentName =
  | 'input'
  | 'button'
  | 'checkbox'
  | 'switch'
  | 'tabs'
  | 'dialog'
  | 'label'
  | 'textarea'
  | 'radio-group'
  | 'select'
  | 'card'
  | 'badge'
  | 'separator'
  | 'skeleton'
  | 'alert'
  | 'collapsible'
  | 'accordion'
  | 'tooltip'
  | 'progress'
  | 'avatar'

export type ZeusWebAiThemeName =
  | 'default'
  | 'slate'
  | 'zinc'
  | 'neutral'
  | 'stone'

export interface ZeusWebAiProp {
  name: string
  type: string
  description: string
  values?: string[]
  default?: string
}

export interface ZeusWebAiEvent {
  name: string
  reactName: string
  description: string
  detail: Record<string, string>
}

export interface ZeusWebAiSlot {
  name: string
  description: string
}

export interface ZeusWebAiExample {
  title: string
  code: string
}

export interface ZeusWebAiComponent {
  name: ZeusWebAiComponentName
  description: string
  primitivePackage: string
  registryCommand: string
  installCommand: string
  reactImport: string
  webComponentImport: string
  styledImport: string
  sourceTarget: string
  dependencies: string[]
  props: ZeusWebAiProp[]
  events: ZeusWebAiEvent[]
  slots: ZeusWebAiSlot[]
  examples: ZeusWebAiExample[]
  styling: {
    usesTailwind: boolean
    themeTokens: string[]
    internalSelectors: string[]
  }
  aiRules: {
    do: string[]
    dont: string[]
  }
}

export interface ZeusWebAiIcons {
  packageName: '@zeus-web/icons'
  installCommand: string
  reactImport: string
  vueImport: string
  webComponentImport: string
  rawSvgImport: string
  recommendedIcons: string[]
  aiRules: {
    do: string[]
    dont: string[]
  }
}

export interface ZeusWebAiMetadata {
  schemaVersion: 1
  packageName: '@zeus-web/ai'
  libraryName: 'Zeus Web'
  registryPackage: '@zeus-web/registry'
  cliPackage: '@zeus-web/cli'
  recommendedWorkflow: string[]
  themes: ZeusWebAiThemeName[]
  icons: ZeusWebAiIcons
  globalRules: {
    do: string[]
    dont: string[]
  }
  components: ZeusWebAiComponent[]
}

export interface ZeusWebAiValidationResult {
  valid: boolean
  errors: string[]
}
