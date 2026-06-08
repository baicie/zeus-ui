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
    expect(markdown).toContain('## button')
    expect(markdown).toContain('zweb add button')
    expect(markdown).toContain('@/components/ui/button')
  })

  it('renders json guide', () => {
    const json = renderAiJson(aiMetadata)
    const parsed = JSON.parse(json)

    expect(parsed.packageName).toBe('@zeus-web/ai')
    expect(parsed.components).toHaveLength(20)
  })
})
