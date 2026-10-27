/**
 * Combobox + listbox model (WAI-ARIA APG combobox, list autocomplete).
 *
 * Shared by `AiContextPicker` (@ / slash) and `AiCommandPalette`:
 * ArrowDown/ArrowUp move the active option, Home/End jump, Enter selects
 * the active option, Escape closes without selecting, and nothing happens
 * while an input method is composing. Focus stays on the input; the active
 * option is exposed through `aria-activedescendant`.
 */

import type { Controller } from '@zeus-web/ai-core'
import type { IdScope, PartEvent, PartProps } from './parts'

import { createViewStore } from '@zeus-web/ai-core'
import { navigateIndex } from './keyboard'
import { ariaBool, part } from './parts'

export interface ComboboxItem {
  id: string
  label: string
  description?: string
  disabled?: boolean
}

export interface ComboboxViewState<TItem extends ComboboxItem> {
  open: boolean
  query: string
  options: readonly TItem[]
  activeIndex: number
}

export interface ComboboxOptions<TItem extends ComboboxItem> {
  items: () => readonly TItem[]
  /** Default: case-insensitive substring match on label and id. */
  filter?: (item: TItem, query: string) => boolean
  onSelect: (item: TItem) => void
  /** Cap rendered options; keep the listbox short. Default 50. */
  limit?: number
}

export interface ComboboxController<
  TItem extends ComboboxItem,
> extends Controller<ComboboxViewState<TItem>> {
  open: (query?: string) => void
  close: () => void
  setQuery: (query: string) => void
  /** Handle a key while open; returns true when the key was consumed. */
  handleKey: (event: PartEvent) => boolean
  selectIndex: (index: number) => void
}

function defaultFilter(item: ComboboxItem, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    item.label.toLowerCase().includes(needle) ||
    item.id.toLowerCase().includes(needle)
  )
}

export function createCombobox<TItem extends ComboboxItem>(
  options: ComboboxOptions<TItem>,
): ComboboxController<TItem> {
  const filter = options.filter ?? defaultFilter
  const limit = options.limit ?? 50

  function compute(query: string): readonly TItem[] {
    return options
      .items()
      .filter(item => filter(item, query))
      .slice(0, limit)
  }

  const view = createViewStore<ComboboxViewState<TItem>>({
    open: false,
    query: '',
    options: [],
    activeIndex: -1,
  })

  function firstEnabled(list: readonly TItem[]): number {
    return list.findIndex(item => !item.disabled)
  }

  function selectIndex(index: number): void {
    const item = view.getSnapshot().options[index]
    if (!item || item.disabled) return
    view.update({ open: false, activeIndex: -1 })
    options.onSelect(item)
  }

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    open(query = ''): void {
      const list = compute(query)
      view.update({
        open: true,
        query,
        options: list,
        activeIndex: firstEnabled(list),
      })
    },
    close(): void {
      view.update({ open: false, activeIndex: -1 })
    },
    setQuery(query): void {
      const list = compute(query)
      view.update({ query, options: list, activeIndex: firstEnabled(list) })
    },
    selectIndex,
    handleKey(event): boolean {
      const state = view.getSnapshot()
      if (!state.open || event.isComposing) return false

      if (event.key === 'Escape') {
        view.update({ open: false, activeIndex: -1 })
        return true
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (state.activeIndex < 0) return event.key === 'Enter'
        selectIndex(state.activeIndex)
        return true
      }

      const next = navigateIndex(
        event.key,
        state.activeIndex,
        state.options.length,
        {
          wrap: true,
        },
      )
      if (next === undefined) return false
      view.update({ activeIndex: next })
      return true
    },
    dispose(): void {
      view.dispose()
    },
  }
}

export interface ComboboxParts {
  input: PartProps
  listbox: PartProps
  options: PartProps[]
  empty?: PartProps
}

export function getComboboxParts<TItem extends ComboboxItem>(
  view: Readonly<ComboboxViewState<TItem>>,
  controller: Pick<ComboboxController<TItem>, 'selectIndex'>,
  options: { ids: IdScope; label: string; emptyText: string },
): ComboboxParts {
  const listboxId = options.ids.id('listbox')
  const optionId = (index: number): string => options.ids.id(`option-${index}`)
  const active =
    view.open && view.activeIndex >= 0 ? optionId(view.activeIndex) : undefined

  return {
    input: part({
      role: 'combobox',
      'aria-label': options.label,
      'aria-expanded': ariaBool(view.open),
      'aria-controls': listboxId,
      'aria-autocomplete': 'list',
      'aria-activedescendant': active,
    }),
    listbox: part({
      id: listboxId,
      role: 'listbox',
      'aria-label': options.label,
      hidden: !view.open,
    }),
    options: view.options.map((item, index) =>
      part(
        {
          id: optionId(index),
          role: 'option',
          'aria-selected': ariaBool(index === view.activeIndex),
          'aria-disabled': ariaBool(item.disabled === true),
          'data-active': index === view.activeIndex ? '' : undefined,
        },
        {
          // Mouse selection; keyboard selection goes through handleKey.
          click: event => {
            event.preventDefault()
            controller.selectIndex(index)
          },
        },
        item.label,
      ),
    ),
    empty:
      view.open && view.options.length === 0
        ? part({ role: 'presentation' }, undefined, options.emptyText)
        : undefined,
  }
}
