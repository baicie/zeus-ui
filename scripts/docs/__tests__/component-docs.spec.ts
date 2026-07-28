import {
  componentCatalog,
  getComponentCatalog,
} from '../../../apps/docs/.vitepress/data/component-catalog'
import { docsLocaleIds } from '../../../apps/docs/.vitepress/data/docs-i18n'
import {
  createComponentDocsContext,
  generateComponentDocs,
  renderAdvancedComponentDoc,
  renderComponentDoc,
  renderComponentsIndex,
} from '../component-docs'

const HAN_PATTERN = /[\u3400-\u9FFF]/u

function extractCodeBlocks(source: string): string[] {
  return Array.from(source.matchAll(/```[\s\S]*?```/g), match => match[0])
}

describe('component docs generator', () => {
  it('generates the component index and all public pages for both locales', () => {
    const docs = generateComponentDocs()
    const expectedPaths = docsLocaleIds.flatMap(locale => {
      const localePrefix = locale === 'zh' ? 'zh/' : ''

      return [
        `apps/docs/${localePrefix}components/index.md`,
        ...getComponentCatalog(locale).map(
          component =>
            `apps/docs/${localePrefix}components/${component.name}.md`,
        ),
      ]
    })

    expect(docs).toHaveLength(52)
    expect(docs.map(doc => doc.path)).toEqual(expectedPaths)
  })

  it('renders localized component indexes from shared metadata', () => {
    const context = createComponentDocsContext()
    const english = renderComponentsIndex(context)
    const chinese = renderComponentsIndex(context, 'zh')

    expect(english).toContain('# Components')
    expect(english).toContain('<ComponentDirectory />')
    expect(english).toContain('25 public component packages')
    expect(english).toContain('zweb add button')
    expect(english).toContain('`@/components/ui/<component>`')
    expect(english).not.toMatch(HAN_PATTERN)

    expect(chinese).toContain('# 组件')
    expect(chinese).toContain('<ComponentDirectory />')
    expect(chinese).toContain('全部 25 个公开组件包')
    expect(chinese).toContain('zweb add button')
    expect(chinese).toContain('`@/components/ui/<component>`')
    expect(chinese).toMatch(HAN_PATTERN)
  })

  it('renders primitive pages with localized prose and identical code', () => {
    const context = createComponentDocsContext()
    const component = context.metadata.components.find(
      item => item.name === 'button',
    )
    const registryItem = context.registry.items.find(
      item => item.name === 'button',
    )

    expect(component).toBeDefined()

    const english = renderComponentDoc(component!, registryItem)
    const chinese = renderComponentDoc(
      component!,
      registryItem,
      process.cwd(),
      'zh',
    )

    expect(english).toContain('# Button')
    expect(english).toContain('## Playground')
    expect(english).toContain('## Props')
    expect(english).toContain('<br />Values:')
    expect(english).toContain('## Events')
    expect(english).toContain('## Registry')
    expect(english).not.toMatch(HAN_PATTERN)

    expect(chinese).toContain('# 按钮')
    expect(chinese).toContain('## 交互演示')
    expect(chinese).toContain('### 源码')
    expect(chinese).toContain('## 属性')
    expect(chinese).toContain('## 事件')
    expect(chinese).toContain('## Registry')
    expect(chinese).toContain('<br />可选值:')
    expect(chinese).not.toContain('<br />Values:')
    expect(chinese).toContain('视觉样式变体。')

    for (const source of [english, chinese]) {
      expect(source).toContain('<ComponentPlayground name="button" />')
      expect(source).toContain('@zeus-web/button/wc/auto')
      expect(source).not.toContain("import '@zeus-web/button/wc'")
      expect(source).toContain('@zeus-web/button/react')
      expect(source).toContain('@zeus-web/button/vue')
      expect(source).toContain('components/ui/button.tsx')
    }

    expect(extractCodeBlocks(chinese)).toEqual(extractCodeBlocks(english))
  })

  it('documents the package-only Select API without unpublished registry imports', () => {
    const context = createComponentDocsContext()
    const component = context.metadata.components.find(
      item => item.name === 'select',
    )

    expect(component).toBeDefined()

    const english = renderComponentDoc(component!)

    expect(english).toContain('Registry source: not available yet.')
    expect(english).toContain('@zeus-web/select/react')
    expect(english).not.toContain('@/components/ui/select')

    for (const publicMember of [
      'name',
      'size',
      'invalid',
      'ariaDescribedby',
      'ariaErrormessage',
      'focus-change',
    ]) {
      expect(english).toContain(`\`${publicMember}\``)
    }
  })

  it('derives package-only examples from the Registry manifest', () => {
    const context = createComponentDocsContext()
    const registryNames = new Set(
      context.registry.items
        .filter(item => item.type === 'component')
        .map(item => item.name),
    )

    for (const component of context.metadata.components) {
      const registryItem = context.registry.items.find(
        item => item.type === 'component' && item.name === component.name,
      )
      const source = renderComponentDoc(component, registryItem)

      if (registryNames.has(component.name)) {
        expect(source, component.name).toContain(
          `@/components/ui/${component.name}`,
        )
        continue
      }

      expect(source, component.name).not.toContain(
        `@/components/ui/${component.name}`,
      )
      expect(source, component.name).not.toContain(`zweb add ${component.name}`)
    }
  })

  it('renders primitive examples with real line breaks in both locales', () => {
    const docs = generateComponentDocs()

    for (const component of [
      'accordion',
      'avatar',
      'collapsible',
      'progress',
      'tooltip',
    ]) {
      for (const localePrefix of ['', 'zh/']) {
        const path = `apps/docs/${localePrefix}components/${component}.md`
        const doc = docs.find(item => item.path === path)

        expect(doc, path).toBeDefined()
        expect(doc!.content, path).not.toContain('\\n')
      }
    }
  })

  it('renders advanced pages with locale overlays and identical code', () => {
    const context = createComponentDocsContext()
    const englishComponent = componentCatalog.find(
      item => item.name === 'data-grid',
    )
    const chineseComponent = getComponentCatalog('zh').find(
      item => item.name === 'data-grid',
    )
    const metadata = context.metadata.advancedComponents.find(
      item => item.name === 'data-grid',
    )

    expect(englishComponent).toBeDefined()
    expect(chineseComponent).toBeDefined()
    expect(metadata).toBeDefined()

    const english = renderAdvancedComponentDoc(englishComponent!, metadata)
    const chinese = renderAdvancedComponentDoc(
      chineseComponent!,
      metadata,
      process.cwd(),
      'zh',
    )

    expect(english).toContain('# Data Grid')
    expect(english).toContain('<DataGridPlayground />')
    expect(english).toContain('## When to use')
    expect(english).toContain('## When not to use')
    expect(english).toContain('pnpm add @zeus-web/data-grid')
    expect(english).toContain('## Methods')
    expect(english).toContain('scrollToColumn')
    expect(english).toContain('## Examples')
    expect(english).toContain('## AI usage hints')
    expect(english).not.toMatch(HAN_PATTERN)

    expect(chinese).toContain('# 数据表格')
    expect(chinese).toContain('<DataGridPlayground />')
    expect(chinese).toContain('## 何时使用')
    expect(chinese).toContain('## 何时不应使用')
    expect(chinese).toContain('## 方法')
    expect(chinese).toContain('## 示例')
    expect(chinese).toContain('## AI 使用提示')
    expect(chinese).toMatch(HAN_PATTERN)
    expect(extractCodeBlocks(chinese)).toEqual(extractCodeBlocks(english))
  })

  it('labels script-only advanced Web Component examples as TypeScript', () => {
    const docs = generateComponentDocs()

    for (const component of [
      'chat',
      'data-grid',
      'revogrid-adapter',
      'virtual',
    ]) {
      const path = `apps/docs/components/${component}.md`
      const doc = docs.find(item => item.path === path)

      expect(doc, path).toBeDefined()

      const section = doc!.content.match(
        /### Native Web Component usage[\s\S]*?(?=\n### |\n## |$)/,
      )

      expect(section, path).not.toBeNull()
      expect(section![0], path).toContain('```ts')
      expect(section![0], path).not.toContain('```html')
    }
  })

  it('keeps every English generated component page free of Chinese text', () => {
    const docs = generateComponentDocs()
    const englishDocs = docs.filter(doc => !doc.path.includes('/zh/'))

    expect(englishDocs).toHaveLength(26)

    for (const doc of englishDocs) {
      expect(doc.content, doc.path).not.toMatch(HAN_PATTERN)
    }
  })

  it('keeps framework and usage code isomorphic across locales', () => {
    const docs = generateComponentDocs()

    for (const component of componentCatalog) {
      const englishPath = `apps/docs/components/${component.name}.md`
      const chinesePath = `apps/docs/zh/components/${component.name}.md`
      const english = docs.find(doc => doc.path === englishPath)
      const chinese = docs.find(doc => doc.path === chinesePath)

      expect(english, englishPath).toBeDefined()
      expect(chinese, chinesePath).toBeDefined()
      expect(extractCodeBlocks(chinese!.content), chinesePath).toEqual(
        extractCodeBlocks(english!.content),
      )
    }
  })

  it('renders custom element names as Markdown code in both locales', () => {
    const context = createComponentDocsContext()
    const englishComponent = componentCatalog.find(
      item => item.name === 'revogrid-adapter',
    )
    const chineseComponent = getComponentCatalog('zh').find(
      item => item.name === 'revogrid-adapter',
    )
    const metadata = context.metadata.advancedComponents.find(
      item => item.name === 'revogrid-adapter',
    )

    expect(englishComponent).toBeDefined()
    expect(chineseComponent).toBeDefined()
    expect(metadata).toBeDefined()

    const english = renderAdvancedComponentDoc(englishComponent!, metadata)
    const chinese = renderAdvancedComponentDoc(
      chineseComponent!,
      metadata,
      process.cwd(),
      'zh',
    )

    expect(english).toContain('to a `<revo-grid>` custom element')
    expect(english).toContain(
      'application has registered a real `<revo-grid>` implementation',
    )
    expect(english).not.toContain('to a <revo-grid> custom element')
    expect(english).not.toMatch(HAN_PATTERN)

    expect(chinese).toContain('映射到 `<revo-grid>` 自定义元素')
    expect(chinese).toContain('应用已注册真正的 `<revo-grid>` 实现')
    expect(chinese).not.toContain('映射到 <revo-grid> 自定义元素')
  })
})
