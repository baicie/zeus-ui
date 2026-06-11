export type RegistryItemType =
  | 'registry:ui'
  | 'registry:block'
  | 'registry:lib'
  | 'registry:style'

export type RegistryFileType = 'registry:ui' | 'registry:lib' | 'registry:style'

export interface RegistryItemFile {
  path: string
  target: string
  type: RegistryFileType
}

export interface RegistryItem {
  name: string
  type: RegistryItemType
  description?: string
  dependencies?: string[]
  devDependencies?: string[]
  files: RegistryItemFile[]
}

export interface Registry {
  $schema?: string
  name: string
  homepage?: string
  items: RegistryItem[]
}

export interface RegistryValidationResult {
  valid: boolean
  errors: string[]
}

export * from './validate'
