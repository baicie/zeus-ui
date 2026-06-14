import { describe, expect, it } from 'vitest'

import {
  createDataGridRows,
  getDataGridCellValue,
  getDataGridRowByKey,
} from '../src/core'

describe('row model', () => {
  it('creates rows with id as key', () => {
    const rows = createDataGridRows([
      {
        id: 'a',
        name: 'Alice',
      },
      {
        id: 'b',
        name: 'Bob',
      },
    ])

    expect(rows).toEqual([
      {
        key: 'a',
        index: 0,
        data: {
          id: 'a',
          name: 'Alice',
        },
      },
      {
        key: 'b',
        index: 1,
        data: {
          id: 'b',
          name: 'Bob',
        },
      },
    ])
  })

  it('falls back to index as key', () => {
    const rows = createDataGridRows([
      {
        name: 'Alice',
      },
    ])

    expect(rows[0].key).toBe('0')
  })

  it('supports custom row key', () => {
    const rows = createDataGridRows(
      [
        {
          uuid: 'u1',
        },
      ],
      row => String(row.uuid),
    )

    expect(rows[0].key).toBe('u1')
  })

  it('finds row by key', () => {
    const rows = createDataGridRows([{ id: 'a' }, { id: 'b' }])

    expect(getDataGridRowByKey(rows, 'b')?.index).toBe(1)
    expect(getDataGridRowByKey(rows, 'missing')).toBeUndefined()
  })

  it('gets cell value', () => {
    const rows = createDataGridRows([
      {
        id: 'a',
        name: 'Alice',
      },
    ])

    expect(getDataGridCellValue(rows[0], 'name')).toBe('Alice')
  })
})
