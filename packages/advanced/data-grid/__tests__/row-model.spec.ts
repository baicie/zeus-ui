import { describe, expect, it } from 'vitest'

import {
  createDataGridRowModel,
  getDataGridCellValue,
  getDataGridRowByKey,
  materializeDataGridRows,
  normalizeDataGridColumns,
  sortDataGridRowCollection,
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

  it('reuses recently read wrappers across row and key lookup', () => {
    const model = createDataGridRowModel([{ id: 'a' }, { id: 'b' }])
    const first = model.getRow(0)

    for (let index = 0; index < 100; index += 1) {
      expect(getDataGridRowByKey(model, 'a')).toBe(first)
    }

    expect(model.wrapperCount).toBe(1)
  })

  it('bounds cached wrappers without mutating rows retained by callers', () => {
    const source = Array.from({ length: 10_000 }, (_, index) => ({
      id: `row-${index}`,
      value: index,
    }))
    const model = createDataGridRowModel(source)
    const first = model.getRow(0)

    for (let index = 1; index <= 128; index += 1) {
      model.getRow(index)
    }

    expect(model.getRow(128)).toBe(model.getRow(128))
    expect(model.getRow(0)).not.toBe(first)
    expect(first).toEqual({ key: 'row-0', index: 0, data: source[0] })
    expect(model.wrapperCount).toBe(130)
  })

  it('creates a new wrapper when a source row reference is replaced', () => {
    const source = [{ id: 'a', value: 'old' }]
    const model = createDataGridRowModel(source)
    const previous = model.getRow(0)

    source[0] = { id: 'a', value: 'new' }

    const next = model.getRow(0)

    expect(next).not.toBe(previous)
    expect(previous && getDataGridCellValue(previous, 'value')).toBe('old')
    expect(next && getDataGridCellValue(next, 'value')).toBe('new')
    expect(model.wrapperCount).toBe(2)
  })

  it('reuses source wrappers after sorting without changing their indexes', () => {
    const model = createDataGridRowModel([
      { id: 'a', value: 2 },
      { id: 'b', value: 1 },
    ])
    const first = model.getRow(0)
    const second = model.getRow(1)
    const sorted = sortDataGridRowCollection(
      model,
      normalizeDataGridColumns([{ id: 'value', sortable: true }]),
      { columnId: 'value', direction: 'asc' },
    )

    expect(sorted.getRow(0)).toBe(second)
    expect(sorted.getRow(1)).toBe(first)
    expect(first && first.index).toBe(0)
    expect(second && second.index).toBe(1)
    expect(model.wrapperCount).toBe(2)
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
