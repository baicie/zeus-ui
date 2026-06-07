import {
  createComponentDocsContext,
  generateComponentDocs,
  renderComponentDoc,
  renderComponentsIndex,
} from '../component-docs'

describe('component docs generator', () => {
  it('generates component index and MVP component pages', () => {
    const docs = generateComponentDocs()

    expect(docs.map(doc => doc.path)).toEqual([
      'apps/docs/components/index.md',
      'apps/docs/components/button.md',
      'apps/docs/components/input.md',
      'apps/docs/components/checkbox.md',
      'apps/docs/components/switch.md',
      'apps/docs/components/tabs.md',
      'apps/docs/components/dialog.md',
    ])
  })

  it('renders component index from metadata', () => {
    const context = createComponentDocsContext()
    const source = renderComponentsIndex(context)

    expect(source).toContain('# Components')
    expect(source).toContain('@zeus-web/ai')
    expect(source).toContain('zweb add button')
  })

  it('renders component page with API and registry information', () => {
    const context = createComponentDocsContext()
    const component = context.metadata.components.find(
      item => item.name === 'button',
    )
    const registryItem = context.registry.items.find(
      item => item.name === 'button',
    )

    expect(component).toBeDefined()

    const source = renderComponentDoc(component!, registryItem)

    expect(source).toContain('# Button')
    expect(source).toContain('## Props')
    expect(source).toContain('## Events')
    expect(source).toContain('## Registry')
    expect(source).toContain('@zeus-web/button/react')
    expect(source).toContain('components/ui/button.tsx')
  })
})
