import type { NormalizedDataGridColumn } from '../src'

import { describe, expect, it } from 'vitest'

import {
  getDataGridActiveDescendant,
  getDataGridAriaMultiSelectable,
  getDataGridAriaSelected,
  getDataGridAriaSort,
  getDataGridCellTabIndex,
  getDataGridColumnAriaIndex,
  getDataGridDataRowAriaIndex,
  getDataGridHeaderRowAriaIndex,
  getDataGridResizeHandleAriaLabel,
} from '../src/core'

const sortableColumn: NormalizedDataGridColumn = {
  id: 'name',
  header: 'Name',
  field: 'name',
  width: 160,
  minWidth: 48,
  maxWidth: 1000,
  align: 'start',
  sortable: true,
  hidden: false,
  resizable: true,
}

const plainColumn: NormalizedDataGridColumn = {
  ...sortableColumn,
  id: 'role',
  header: 'Role',
  sortable: false,
}

describe('accessibility model', () => {
  it('resolves aria-sort for sortable columns', () => {
    expect(getDataGridAriaSort(sortableColumn, undefined)).toBe('none')

    expect(
      getDataGridAriaSort(sortableColumn, {
        columnId: 'name',
        direction: 'asc',
      }),
    ).toBe('ascending')

    expect(
      getDataGridAriaSort(sortableColumn, {
        columnId: 'name',
        direction: 'desc',
      }),
    ).toBe('descending')

    expect(getDataGridAriaSort(plainColumn, undefined)).toBeUndefined()
  })

  it('resolves row and column aria indexes', () => {
    expect(getDataGridHeaderRowAriaIndex()).toBe(1)
    expect(getDataGridDataRowAriaIndex(0)).toBe(2)
    expect(getDataGridDataRowAriaIndex(3)).toBe(5)
    expect(getDataGridColumnAriaIndex(0)).toBe(1)
    expect(getDataGridColumnAriaIndex(2)).toBe(3)
  })

  it('resolves selection aria state', () => {
    expect(getDataGridAriaMultiSelectable('none')).toBeUndefined()
    expect(getDataGridAriaMultiSelectable('single')).toBeUndefined()
    expect(getDataGridAriaMultiSelectable('multiple')).toBe('true')

    expect(getDataGridAriaSelected('none', true)).toBeUndefined()
    expect(getDataGridAriaSelected('single', true)).toBe('true')
    expect(getDataGridAriaSelected('single', false)).toBe('false')
    expect(getDataGridAriaSelected('multiple', true)).toBe('true')
  })

  it('resolves cell tabindex', () => {
    expect(getDataGridCellTabIndex(false, true)).toBeUndefined()
    expect(getDataGridCellTabIndex(true, true)).toBe(0)
    expect(getDataGridCellTabIndex(true, false)).toBe(-1)
  })

  it('resolves resize handle label', () => {
    expect(getDataGridResizeHandleAriaLabel(sortableColumn)).toBe(
      'Resize Name column',
    )
  })

  it('resolves active descendant', () => {
    expect(
      getDataGridActiveDescendant(
        {
          rowIndex: 0,
          rowKey: 'u1',
          columnId: 'name',
          columnIndex: 0,
        },
        activeCell => `cell-${activeCell.rowKey}-${activeCell.columnId}`,
      ),
    ).toBe('cell-u1-name')

    expect(
      getDataGridActiveDescendant(undefined, () => 'unused'),
    ).toBeUndefined()
  })
})
