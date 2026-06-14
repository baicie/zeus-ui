import { describe, expect, it } from 'vitest'

import {
  applyDataGridColumnWidths,
  clampDataGridColumnWidth,
  createDataGridColumnWidthState,
  normalizeDataGridColumns,
  resetDataGridColumnWidths,
  resizeDataGridColumn,
  resizeDataGridColumnByDelta,
} from '../src/core'

describe('column resize model', () => {
  const columns = normalizeDataGridColumns([
    {
      id: 'name',
      width: 160,
      minWidth: 80,
      maxWidth: 240,
    },
    {
      id: 'role',
      width: 120,
      minWidth: 60,
      maxWidth: 200,
    },
    {
      id: 'locked',
      width: 100,
      resizable: false,
    },
  ])

  it('clamps width by min and max', () => {
    expect(clampDataGridColumnWidth(columns[0], 20)).toBe(80)
    expect(clampDataGridColumnWidth(columns[0], 999)).toBe(240)
    expect(clampDataGridColumnWidth(columns[0], 120)).toBe(120)
  })

  it('creates width state from columns', () => {
    expect(createDataGridColumnWidthState(columns)).toEqual({
      name: 160,
      role: 120,
      locked: 100,
    })
  })

  it('applies width state', () => {
    expect(
      applyDataGridColumnWidths(columns, {
        name: 200,
      }).map(column => column.width),
    ).toEqual([200, 120, 100])
  })

  it('resizes a column', () => {
    const result = resizeDataGridColumn(columns, 'name', 220)

    expect(result.width).toBe(220)
    expect(result.previousWidth).toBe(160)
    expect(result.widths.name).toBe(220)
    expect(result.columns.find(column => column.id === 'name')?.width).toBe(220)
  })

  it('clamps resized width', () => {
    expect(resizeDataGridColumn(columns, 'name', 999).width).toBe(240)
    expect(resizeDataGridColumn(columns, 'name', 1).width).toBe(80)
  })

  it('ignores non-resizable columns', () => {
    const result = resizeDataGridColumn(columns, 'locked', 200)

    expect(result.column).toBeUndefined()
    expect(result.width).toBeUndefined()
    expect(result.columns.find(column => column.id === 'locked')?.width).toBe(
      100,
    )
  })

  it('resizes by delta from base width', () => {
    const result = resizeDataGridColumnByDelta({
      columns,
      columnId: 'name',
      baseWidth: 160,
      delta: 32,
    })

    expect(result.width).toBe(192)
  })

  it('resets column widths', () => {
    const resized = resizeDataGridColumn(columns, 'name', 220)
    const reset = resetDataGridColumnWidths(resized.columns)

    expect(reset.widths).toEqual({
      name: 220,
      role: 120,
      locked: 100,
    })
  })
})
