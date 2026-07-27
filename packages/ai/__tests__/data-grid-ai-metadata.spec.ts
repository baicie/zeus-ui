import { describe, expect, it } from 'vitest'

import { aiMetadata, validateAiMetadata } from '../src'

describe('data-grid AI metadata', () => {
  const dataGrid = (aiMetadata.advancedComponents ?? []).find(
    component => component.name === 'data-grid',
  )

  it('still passes full metadata validation', () => {
    const result = validateAiMetadata(aiMetadata)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('registers data-grid as advanced component', () => {
    expect(dataGrid).toBeDefined()
    expect(dataGrid).toMatchObject({
      name: 'data-grid',
      packageName: '@zeus-web/data-grid',
      category: 'advanced',
    })
  })

  it('describes zw-data-grid component', () => {
    expect(dataGrid?.components).toEqual(['zw-data-grid'])
    expect(dataGrid?.summary).toContain('two-axis virtualization')
    expect(dataGrid?.slots['zw-data-grid']).toEqual(['empty'])
    expect(dataGrid?.tags).toEqual(
      expect.arrayContaining([
        'data-grid',
        'table',
        'virtual',
        'advanced',
        'headless',
      ]),
    )
  })

  it('documents events and methods', () => {
    expect(dataGrid?.events['zw-data-grid']).toEqual(
      expect.arrayContaining([
        'range-change',
        'scroll-offset-change',
        'viewport-resize',
        'selection-change',
        'sort-change',
        'row-action',
        'cell-action',
        'column-resize-start',
        'column-resize',
        'column-resize-end',
        'active-cell-change',
      ]),
    )

    expect(dataGrid?.methods['zw-data-grid']).toEqual(
      expect.arrayContaining([
        'setRows',
        'setColumns',
        'getRows',
        'getColumns',
        'getVisibleRows',
        'getSelection',
        'setSelection',
        'clearSelection',
        'toggleRowSelection',
        'setSort',
        'clearSort',
        'getSort',
        'getRange',
        'getItems',
        'getTotalSize',
        'getColumnRange',
        'getColumnItems',
        'getTotalColumnSize',
        'scrollToIndex',
        'scrollToOffset',
        'scrollToColumn',
        'measure',
        'resetMeasurements',
        'resizeColumn',
        'getActiveCell',
        'focusCell',
        'refreshViewport',
      ]),
    )
  })

  it('warns against server datasource and request logic', () => {
    expect(
      dataGrid?.doNotUseFor.some(rule =>
        rule.includes('不要把它当作服务端数据源'),
      ),
    ).toBe(true)

    expect(
      dataGrid?.promptHints.some(rule =>
        rule.includes('业务请求逻辑应该放在应用层'),
      ),
    ).toBe(true)
  })

  it('contains package and native examples', () => {
    const code =
      (dataGrid?.examples ?? []).map(example => example.code).join('\n') ?? ''

    expect(code).toContain('@zeus-web/data-grid/react')
    expect(code).not.toContain('@/components/ui/data-grid')
    expect(code).toContain('@zeus-web/data-grid/wc/auto')
    expect(code).toContain('zw-data-grid')
  })
})
