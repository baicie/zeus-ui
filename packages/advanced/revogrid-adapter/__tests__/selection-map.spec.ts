import { describe, expect, it } from 'vitest'

import {
  mapDataGridRowsToRevoGridSource,
  mapDataGridSelectionToRevoGridSelection,
} from '../src'

describe('revoGrid selection map', () => {
  const source = mapDataGridRowsToRevoGridSource([
    {
      id: 'u1',
      name: 'Ada',
    },
    {
      id: 'u2',
      name: 'Grace',
    },
    {
      id: 'u3',
      name: 'Alan',
    },
  ])

  it('maps multiple selection to row indexes', () => {
    expect(
      mapDataGridSelectionToRevoGridSelection(['u1', 'u3'], source, 'multiple'),
    ).toEqual({
      mode: 'multiple',
      rowKeys: ['u1', 'u3'],
      rowIndexes: [0, 2],
    })
  })

  it('maps single selection to row indexes', () => {
    expect(
      mapDataGridSelectionToRevoGridSelection(['u2'], source, 'single'),
    ).toEqual({
      mode: 'single',
      rowKeys: ['u2'],
      rowIndexes: [1],
    })
  })

  it('clears selection in none mode', () => {
    expect(
      mapDataGridSelectionToRevoGridSelection(['u2'], source, 'none'),
    ).toEqual({
      mode: 'none',
      rowKeys: [],
      rowIndexes: [],
    })
  })

  it('ignores missing selected keys', () => {
    expect(
      mapDataGridSelectionToRevoGridSelection(
        ['missing', 'u3'],
        source,
        'multiple',
      ),
    ).toEqual({
      mode: 'multiple',
      rowKeys: ['u3'],
      rowIndexes: [2],
    })
  })
})
