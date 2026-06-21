import type {
  DataGridRowKey,
  DataGridSelectionMode,
  DataGridSelectionState,
} from '../types'

function uniqueKeys(keys: DataGridRowKey[]): DataGridRowKey[] {
  return Array.from(new Set(keys))
}

export interface DataGridSelectionModel {
  getState: () => DataGridSelectionState
  setMode: (mode: DataGridSelectionMode) => DataGridSelectionState
  setKeys: (keys: DataGridRowKey[]) => DataGridSelectionState
  select: (key: DataGridRowKey) => DataGridSelectionState
  deselect: (key: DataGridRowKey) => DataGridSelectionState
  toggle: (key: DataGridRowKey) => DataGridSelectionState
  clear: () => DataGridSelectionState
  isSelected: (key: DataGridRowKey) => boolean
}

export function createDataGridSelectionModel(
  mode: DataGridSelectionMode = 'none',
  initialKeys: DataGridRowKey[] = [],
): DataGridSelectionModel {
  let currentMode = mode
  let keys =
    currentMode === 'none'
      ? []
      : currentMode === 'single'
        ? uniqueKeys(initialKeys).slice(0, 1)
        : uniqueKeys(initialKeys)

  const snapshot = (): DataGridSelectionState => ({
    mode: currentMode,
    keys: [...keys],
  })

  const normalizeForMode = (nextKeys: DataGridRowKey[]): DataGridRowKey[] => {
    if (currentMode === 'none') return []
    if (currentMode === 'single') return uniqueKeys(nextKeys).slice(0, 1)
    return uniqueKeys(nextKeys)
  }

  return {
    getState: snapshot,

    setMode(nextMode: DataGridSelectionMode): DataGridSelectionState {
      currentMode = nextMode
      keys = normalizeForMode(keys)
      return snapshot()
    },

    setKeys(nextKeys: DataGridRowKey[]): DataGridSelectionState {
      keys = normalizeForMode(nextKeys)
      return snapshot()
    },

    select(key: DataGridRowKey): DataGridSelectionState {
      if (currentMode === 'none') return snapshot()

      if (currentMode === 'single') {
        keys = [key]
      } else if (!keys.includes(key)) {
        keys = [...keys, key]
      }

      return snapshot()
    },

    deselect(key: DataGridRowKey): DataGridSelectionState {
      keys = keys.filter(item => item !== key)
      return snapshot()
    },

    toggle(key: DataGridRowKey): DataGridSelectionState {
      if (keys.includes(key)) {
        return this.deselect(key)
      }

      return this.select(key)
    },

    clear(): DataGridSelectionState {
      keys = []
      return snapshot()
    },

    isSelected(key: DataGridRowKey): boolean {
      return keys.includes(key)
    },
  }
}
