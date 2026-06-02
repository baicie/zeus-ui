export interface RegistryItemFile {
  path: string
  target: string
  type: 'registry:ui' | 'registry:lib' | 'registry:style'
}

export interface RegistryItem {
  name: string
  type: 'registry:ui' | 'registry:block' | 'registry:lib' | 'registry:style'
  dependencies?: string[]
  files: RegistryItemFile[]
}

export interface Registry {
  name: string
  homepage?: string
  items: RegistryItem[]
}
