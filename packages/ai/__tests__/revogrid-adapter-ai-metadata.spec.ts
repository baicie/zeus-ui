import { describe, expect, it } from 'vitest'

import { aiMetadata, validateAiMetadata } from '../src'

describe('revogrid-adapter ai metadata', () => {
  const adapter = (aiMetadata.advancedComponents ?? []).find(
    component => component.name === 'revogrid-adapter',
  )

  it('still passes full metadata validation', () => {
    const result = validateAiMetadata(aiMetadata)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('registers revogrid-adapter as advanced component', () => {
    expect(adapter).toBeDefined()
    expect(adapter).toMatchObject({
      name: 'revogrid-adapter',
      packageName: '@zeus-web/revogrid-adapter',
      category: 'advanced',
    })
  })

  it('describes zw-revogrid-adapter component', () => {
    expect(adapter?.components).toEqual(['zw-revogrid-adapter'])
    expect(adapter?.tags).toEqual(
      expect.arrayContaining([
        'revogrid-adapter',
        'data-grid',
        'revogrid',
        'advanced',
        'headless',
      ]),
    )
  })

  it('documents runtime adapter events and methods', () => {
    expect(adapter?.events['zw-revogrid-adapter']).toEqual(
      expect.arrayContaining(['adapter-ready', 'adapter-change']),
    )

    expect(adapter?.methods['zw-revogrid-adapter']).toEqual(
      expect.arrayContaining([
        'getRevoColumns',
        'getRevoSource',
        'getRevoSort',
        'getRevoSelection',
        'getState',
        'getGridElement',
        'setRows',
        'setColumns',
        'setSelection',
        'setSort',
        'clearSort',
        'refresh',
      ]),
    )
  })

  it('warns against bundling RevoGrid implementation and provider logic', () => {
    expect(
      adapter?.doNotUseFor.some(rule => rule.includes('@revolist/revogrid')),
    ).toBe(true)

    expect(
      adapter?.doNotUseFor.some(rule =>
        rule.includes('不要把它当作模型请求库'),
      ),
    ).toBe(true)

    expect(
      adapter?.promptHints.some(rule =>
        rule.includes('业务请求逻辑应该放在应用层'),
      ),
    ).toBe(true)
  })

  it('contains registry and native examples', () => {
    const code =
      (adapter?.examples ?? []).map(example => example.code).join('\n') ?? ''

    expect(code).toContain('@/components/ui/revogrid-adapter')
    expect(code).toContain('@zeus-web/revogrid-adapter/wc/auto')
    expect(code).toContain('zw-revogrid-adapter')
  })
})
