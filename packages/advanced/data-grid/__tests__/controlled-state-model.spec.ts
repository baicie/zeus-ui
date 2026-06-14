import { describe, expect, it } from 'vitest'

import {
  createDataGridControlledSortState,
  createDataGridControlledStateController,
} from '../src/core'

const rows = [{ id: 'a', name: 'Ada' }]
const columns = [{ id: 'name' }]

function createSources(overrides = {}) {
  return {
    rows,
    columns,
    sortColumn: 'name',
    sortDirection: 'asc' as const,
    activeRowKey: 'a',
    activeColumnId: 'name',
    rowHeight: 40,
    overscan: 4,
    virtual: true,
    selectionMode: 'multiple' as const,
    resizable: true,
    keyboardNavigation: true,
    ...overrides,
  }
}

describe('controlled state model', () => {
  it('creates controlled sort state from props', () => {
    expect(createDataGridControlledSortState('name', 'asc')).toEqual({
      columnId: 'name',
      direction: 'asc',
    })

    expect(createDataGridControlledSortState(undefined, 'asc')).toBeUndefined()
    expect(createDataGridControlledSortState('name', undefined)).toBeUndefined()
  })

  it('returns no changes for same references and values', () => {
    const controller = createDataGridControlledStateController(createSources())

    expect(controller.update(createSources())).toEqual({
      changed: false,
      reasons: [],
      rowsChanged: false,
      columnsChanged: false,
      selectedKeysChanged: false,
      sortChanged: false,
      activeCellChanged: false,
      layoutChanged: false,
      selectionModeChanged: false,
      interactionChanged: false,
    })
  })

  it('detects rows reference changes even when length is stable', () => {
    const controller = createDataGridControlledStateController(createSources())
    const nextRows = [{ id: 'a', name: 'Ada updated' }]

    const changes = controller.update(createSources({ rows: nextRows }))

    expect(changes.changed).toBe(true)
    expect(changes.rowsChanged).toBe(true)
    expect(changes.reasons).toContain('rows')
  })

  it('detects columns reference changes', () => {
    const controller = createDataGridControlledStateController(createSources())
    const nextColumns = [{ id: 'name', width: 200 }]

    const changes = controller.update(createSources({ columns: nextColumns }))

    expect(changes.changed).toBe(true)
    expect(changes.columnsChanged).toBe(true)
    expect(changes.reasons).toContain('columns')
  })

  it('detects selectedKeys reference changes', () => {
    const controller = createDataGridControlledStateController(createSources())
    const changes = controller.update(createSources({ selectedKeys: ['b'] }))

    expect(changes.changed).toBe(true)
    expect(changes.selectedKeysChanged).toBe(true)
    expect(changes.reasons).toContain('selectedKeys')
  })

  it('detects sort changes', () => {
    const controller = createDataGridControlledStateController(createSources())

    const changes = controller.update(
      createSources({
        sortColumn: 'name',
        sortDirection: 'desc',
      }),
    )

    expect(changes.changed).toBe(true)
    expect(changes.sortChanged).toBe(true)
    expect(changes.reasons).toContain('sort')
  })

  it('detects active cell changes', () => {
    const controller = createDataGridControlledStateController(createSources())

    const changes = controller.update(
      createSources({
        activeRowKey: 'a',
        activeColumnId: 'role',
      }),
    )

    expect(changes.changed).toBe(true)
    expect(changes.activeCellChanged).toBe(true)
    expect(changes.reasons).toContain('activeCell')
  })

  it('detects layout changes', () => {
    const controller = createDataGridControlledStateController(createSources())

    expect(
      controller.update(createSources({ rowHeight: 48 })).layoutChanged,
    ).toBe(true)

    expect(
      controller.update(createSources({ overscan: 8 })).layoutChanged,
    ).toBe(true)

    expect(
      controller.update(createSources({ virtual: false })).layoutChanged,
    ).toBe(true)
  })

  it('detects interaction changes', () => {
    const controller = createDataGridControlledStateController(createSources())

    expect(
      controller.update(createSources({ resizable: false })).interactionChanged,
    ).toBe(true)

    expect(
      controller.update(createSources({ keyboardNavigation: false }))
        .interactionChanged,
    ).toBe(true)
  })

  it('commits state without reporting a change afterwards', () => {
    const controller = createDataGridControlledStateController(createSources())
    const next = createSources({ sortDirection: 'desc' as const })

    expect(controller.update(next).changed).toBe(true)

    controller.commit(next)

    expect(controller.update(next).changed).toBe(false)
  })
})
