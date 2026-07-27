import { componentCatalog } from '../../../apps/docs/.vitepress/data/component-catalog'
import {
  createComponentDocsContext,
  generateComponentDocs,
  renderAdvancedComponentDoc,
  renderComponentDoc,
  renderComponentsIndex,
} from '../component-docs'

describe('component docs generator', () => {
  it('generates the component index and all public component pages', () => {
    const docs = generateComponentDocs()

    expect(docs.map(doc => doc.path)).toEqual([
      'apps/docs/components/index.md',
      ...componentCatalog.map(
        component => `apps/docs/components/${component.name}.md`,
      ),
    ])
  })

  it('renders component index from metadata', () => {
    const context = createComponentDocsContext()
    const source = renderComponentsIndex(context)

    expect(source).toContain('# Components')
    expect(source).toContain('<ComponentDirectory />')
    expect(source).toContain('25 public component packages')
    expect(source).toContain('zweb add button')
    expect(source).toContain('`@/components/ui/<component>`')
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
    expect(source).toContain('## Playground')
    expect(source).toContain('<ComponentPlayground name="button" />')
    expect(source).toContain('@zeus-web/button/wc/auto')
    expect(source).toContain('@zeus-web/button/vue')
    expect(source).toContain('## Props')
    expect(source).toContain('## Events')
    expect(source).toContain('## Registry')
    expect(source).toContain('@zeus-web/button/react')
    expect(source).toContain('components/ui/button.tsx')
  })

  it('renders advanced component metadata beside its live Playground', () => {
    const context = createComponentDocsContext()
    const component = componentCatalog.find(item => item.name === 'data-grid')
    const metadata = context.metadata.advancedComponents.find(
      item => item.name === 'data-grid',
    )

    expect(component).toBeDefined()
    expect(metadata).toBeDefined()

    const source = renderAdvancedComponentDoc(component!, metadata)

    expect(source).toContain('# Data Grid')
    expect(source).toContain('<DataGridPlayground />')
    expect(source).toContain('## When to use')
    expect(source).toContain('## When not to use')
    expect(source).toContain('pnpm add @zeus-web/data-grid')
    expect(source).toContain('## Methods')
    expect(source).toContain('scrollToColumn')
    expect(source).toContain('## Examples')
    expect(source).toContain('## AI usage hints')
  })

  it('renders custom element names in advanced summaries as Markdown code', () => {
    const context = createComponentDocsContext()
    const component = componentCatalog.find(
      item => item.name === 'revogrid-adapter',
    )
    const metadata = context.metadata.advancedComponents.find(
      item => item.name === 'revogrid-adapter',
    )

    expect(component).toBeDefined()
    expect(metadata).toBeDefined()

    const source = renderAdvancedComponentDoc(component!, metadata)

    expect(source).toContain('`<revo-grid>` custom element')
    expect(source).toContain('应用已经注册了 `<revo-grid>`')
    expect(source).toContain('并把 `<revo-grid>` 注册交给应用层')
    expect(source).not.toContain('to a <revo-grid> custom element')
    expect(source).not.toContain('应用已经注册了 <revo-grid>')
  })
})
