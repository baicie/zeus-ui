import { describe, expect, it } from 'vitest'

import { aiMetadata, validateAiMetadata } from '../src'

describe('virtual advanced AI metadata', () => {
  const virtual = (aiMetadata.advancedComponents ?? []).find(
    component => component.name === 'virtual',
  )

  it('passes full metadata validation', () => {
    const result = validateAiMetadata(aiMetadata)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('registers the virtual package and component', () => {
    expect(virtual).toMatchObject({
      name: 'virtual',
      packageName: '@zeus-web/virtual',
      category: 'advanced',
      components: ['zw-virtual-list'],
    })

    expect(virtual?.slots['zw-virtual-list']).toEqual(['default'])
    expect(virtual?.tags).toEqual(
      expect.arrayContaining([
        'virtual',
        'virtual-list',
        'performance',
        'headless',
      ]),
    )
  })

  it('documents range events and imperative scrolling', () => {
    expect(virtual?.events['zw-virtual-list']).toEqual(
      expect.arrayContaining(['range-change', 'scroll-offset-change']),
    )

    expect(virtual?.methods['zw-virtual-list']).toEqual(
      expect.arrayContaining([
        'getRange',
        'getItems',
        'getTotalSize',
        'scrollToIndex',
        'scrollToOffset',
        'measure',
      ]),
    )
  })

  it('documents the headless rendering contract and public entries', () => {
    const code = (virtual?.examples ?? [])
      .map(example => example.code)
      .join('\n')

    expect(virtual?.promptHints.join('\n')).toContain('range-change')
    expect(virtual?.promptHints.join('\n')).toContain(
      'does not render item nodes',
    )
    expect(code).toContain("from '@zeus-web/virtual'")
    expect(code).toContain('@zeus-web/virtual/wc/auto')
    expect(code).toContain('@zeus-web/virtual/react')
  })
})
