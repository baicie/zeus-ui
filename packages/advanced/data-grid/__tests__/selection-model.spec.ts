import { describe, expect, it } from 'vitest'

import { createDataGridSelectionModel } from '../src/core'

describe('selection model', () => {
  it('does not select rows in none mode', () => {
    const model = createDataGridSelectionModel('none')

    expect(model.select('a')).toEqual({
      mode: 'none',
      keys: [],
    })
  })

  it('selects one row in single mode', () => {
    const model = createDataGridSelectionModel('single')

    model.select('a')
    model.select('b')

    expect(model.getState()).toEqual({
      mode: 'single',
      keys: ['b'],
    })
  })

  it('selects multiple rows in multiple mode', () => {
    const model = createDataGridSelectionModel('multiple')

    model.select('a')
    model.select('b')
    model.select('a')

    expect(model.getState()).toEqual({
      mode: 'multiple',
      keys: ['a', 'b'],
    })
  })

  it('toggles row selection', () => {
    const model = createDataGridSelectionModel('multiple')

    model.toggle('a')
    expect(model.isSelected('a')).toBe(true)

    model.toggle('a')
    expect(model.isSelected('a')).toBe(false)
  })

  it('clears selection', () => {
    const model = createDataGridSelectionModel('multiple', ['a', 'b'])

    expect(model.clear()).toEqual({
      mode: 'multiple',
      keys: [],
    })
  })

  it('normalizes keys when mode changes', () => {
    const model = createDataGridSelectionModel('multiple', ['a', 'b'])

    expect(model.setMode('single')).toEqual({
      mode: 'single',
      keys: ['a'],
    })

    expect(model.setMode('none')).toEqual({
      mode: 'none',
      keys: [],
    })
  })
})
