import { describe, expect, it } from 'vitest'

import {
  createDataGridRowModel,
  getDataGridCellValue,
  getDataGridRowByKey,
  materializeDataGridRows,
} from '../src/core'

describe('row model', () => {
  it('creates rows with id as key', () => {
    const rows = materializeDataGridRows(
      createDataGridRowModel([
        {
          id: 'a',
          name: 'Alice',
        },
        {
          id: 'b',
          name: 'Bob',
        },
      ]),
    )

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
    const rows = createDataGridRowModel([
      {
        name: 'Alice',
      },
    ])

    expect(rows.getKey(0)).toBe('0')
  })

  it('supports custom row key', () => {
    const rows = createDataGridRowModel(
      [
        {
          uuid: 'u1',
        },
      ],
      row => String(row.uuid),
    )

    expect(rows.getKey(0)).toBe('u1')
  })

  it('rejects duplicate row keys before rendering', () => {
    expect(() =>
      createDataGridRowModel([
        { id: 'duplicate', value: 'first' },
        { id: 'duplicate', value: 'second' },
      ]),
    ).toThrow('[Data Grid] duplicate row key "duplicate" at index 1.')
  })

  it('indexes large row sources without eagerly allocating row wrappers', () => {
    const source = Array.from({ length: 100_000 }, (_, index) => ({
      id: `row-${index}`,
      value: index,
    }))

    const model = createDataGridRowModel(source)

    expect(model.length).toBe(100_000)
    expect(model.wrapperCount).toBe(0)
    expect(model.getIndexByKey('row-99999')).toBe(99_999)
    expect(model.wrapperCount).toBe(0)
    expect(model.getRow(99_999)).toEqual({
      key: 'row-99999',
      index: 99_999,
      data: source[99_999],
    })
    expect(model.wrapperCount).toBe(1)
  })

  it('uses the row index to reject duplicate keys', () => {
    expect(() =>
      createDataGridRowModel([
        { id: 'duplicate', value: 'first' },
        { id: 'duplicate', value: 'second' },
      ]),
    ).toThrow('[Data Grid] duplicate row key "duplicate" at index 1.')
  })

  it('finds row by key', () => {
    const rows = createDataGridRowModel([{ id: 'a' }, { id: 'b' }])

    expect(getDataGridRowByKey(rows, 'b')?.index).toBe(1)
    expect(getDataGridRowByKey(rows, 'missing')).toBeUndefined()
  })

  it('gets cell value', () => {
    const rows = createDataGridRowModel([
      {
        id: 'a',
        name: 'Alice',
      },
    ])

    const row = rows.getRow(0)
    expect(row && getDataGridCellValue(row, 'name')).toBe('Alice')
  })
})
