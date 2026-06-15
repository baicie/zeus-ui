import { describe, expect, it } from 'vitest'

import {
  getRevoGridRowIndex,
  getRevoGridRowKey,
  mapDataGridRowsToRevoGridSource,
  mapDataGridRowToRevoGridSourceRow,
} from '../src/core'
import { ZEUS_REVO_ROW_INDEX, ZEUS_REVO_ROW_KEY } from '../src/types'

describe('revoGrid row map', () => {
  it('maps row metadata from id', () => {
    expect(
      mapDataGridRowToRevoGridSourceRow(
        {
          id: 'u1',
          name: 'Ada',
        },
        0,
      ),
    ).toEqual({
      id: 'u1',
      name: 'Ada',
      [ZEUS_REVO_ROW_KEY]: 'u1',
      [ZEUS_REVO_ROW_INDEX]: 0,
    })
  })

  it('uses custom row key getter', () => {
    expect(
      mapDataGridRowToRevoGridSourceRow(
        {
          uuid: 'x1',
          name: 'Ada',
        },
        2,
        {
          getRowKey: row => String((row as { uuid: string }).uuid),
        },
      ),
    ).toMatchObject({
      [ZEUS_REVO_ROW_KEY]: 'x1',
      [ZEUS_REVO_ROW_INDEX]: 2,
    })
  })

  it('falls back to index when no id or key exists', () => {
    expect(
      mapDataGridRowToRevoGridSourceRow(
        {
          name: 'No id',
        },
        3,
      ),
    ).toMatchObject({
      [ZEUS_REVO_ROW_KEY]: '3',
      [ZEUS_REVO_ROW_INDEX]: 3,
    })
  })

  it('maps rows to RevoGrid source', () => {
    expect(
      mapDataGridRowsToRevoGridSource([
        {
          id: 'u1',
          name: 'Ada',
        },
        {
          id: 'u2',
          name: 'Grace',
        },
      ]).map(row => getRevoGridRowKey(row)),
    ).toEqual(['u1', 'u2'])
  })

  it('reads row key and index helpers', () => {
    const row = mapDataGridRowToRevoGridSourceRow(
      {
        id: 'u1',
      },
      4,
    )

    expect(getRevoGridRowKey(row)).toBe('u1')
    expect(getRevoGridRowIndex(row)).toBe(4)
  })
})
