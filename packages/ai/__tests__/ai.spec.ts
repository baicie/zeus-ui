import {
  aiMetadata,
  renderAiJson,
  renderAiMarkdown,
  validateAiMetadata,
} from '../src'

describe('@zeus-web/ai metadata', () => {
  it('contains required MVP components', () => {
    const expected = [
      'button',
      'input',
      'checkbox',
      'switch',
      'tabs',
      'dialog',
      'label',
      'textarea',
      'radio-group',
      'select',
      'card',
      'badge',
      'separator',
      'skeleton',
      'alert',
      'collapsible',
      'accordion',
      'tooltip',
      'progress',
      'avatar',
    ]

    expect(aiMetadata.components.map(component => component.name)).toEqual(
      expected,
    )
  })

  it('contains phase 14 icon metadata', () => {
    expect(aiMetadata.icons.packageName).toBe('@zeus-web/icons')
    expect(aiMetadata.icons.installCommand).toContain('@zeus-web/icons')
    expect(aiMetadata.icons.reactImport).toContain('@zeus-web/icons/react')
    expect(aiMetadata.icons.vueImport).toContain('@zeus-web/icons/vue')
    expect(aiMetadata.icons.webComponentImport).toContain('@zeus-web/icons/wc')
    expect(aiMetadata.icons.rawSvgImport).toContain('@zeus-web/icons/svg/')
    expect(aiMetadata.icons.recommendedIcons).toEqual(
      expect.arrayContaining(['check', 'x', 'search', 'alert-triangle']),
    )
  })

  it('passes metadata validation', () => {
    const result = validateAiMetadata(aiMetadata)

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('uses per-component primitive packages', () => {
    for (const component of aiMetadata.components) {
      expect(component.primitivePackage).toBe(`@zeus-web/${component.name}`)
      expect(component.registryCommand).toBe(`zweb add ${component.name}`)
      expect(component.reactImport).toContain(
        `@zeus-web/${component.name}/react`,
      )
      expect(component.webComponentImport).toContain(
        `@zeus-web/${component.name}/wc`,
      )
    }
  })

  it('renders markdown guide', () => {
    const markdown = renderAiMarkdown(aiMetadata)

    expect(markdown).toContain('# Zeus Web AI Guide')
    expect(markdown).toContain('## Icons')
    expect(markdown).toContain('@zeus-web/icons/react')
    expect(markdown).toContain('@zeus-web/icons/vue')
    expect(markdown).toContain('@zeus-web/icons/wc')
    expect(markdown).toContain('## button')
    expect(markdown).toContain('zweb add button')
    expect(markdown).toContain('@/components/ui/button')
  })

  it('renders json guide', () => {
    const json = renderAiJson(aiMetadata)
    const parsed = JSON.parse(json)

    expect(parsed.packageName).toBe('@zeus-web/ai')
    expect(parsed.components).toHaveLength(20)
    expect(parsed.icons.packageName).toBe('@zeus-web/icons')
    expect(parsed.icons.recommendedIcons).toContain('check')
  })

  it('includes chat advanced component metadata', () => {
    const advanced = aiMetadata.advancedComponents ?? []
    const chat = advanced.find(component => component.name === 'chat')

    expect(chat).toBeDefined()
    expect(chat?.packageName).toBe('@zeus-web/chat')
    expect(chat?.category).toBe('advanced')

    expect(chat?.doNotUseFor.join('\n')).toContain('不要把它当作模型请求库')
    expect(chat?.promptHints.join('\n')).toContain('业务请求逻辑应该放在应用层')

    expect(chat?.components).toEqual(
      expect.arrayContaining([
        'zw-chat',
        'zw-chat-thread',
        'zw-chat-message',
        'zw-chat-composer',
      ]),
    )

    const code = (chat?.examples ?? []).map(example => example.code).join('\n')

    expect(code).toContain('@zeus-web/chat/wc/auto')
    expect(code).toContain('@zeus-web/chat/react')
  })

  it('renders chat advanced section in markdown', () => {
    const markdown = renderAiMarkdown(aiMetadata)

    expect(markdown).toContain('# Advanced components')
    expect(markdown).toContain('## chat (advanced)')
    expect(markdown).toContain('不要把它当作模型请求库')
    expect(markdown).toContain('业务请求逻辑应该放在应用层')
  })
})
