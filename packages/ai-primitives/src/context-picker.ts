/**
 * `AiContextPicker` (AI2-207): `@` references and `/` commands inside the
 * composer text.
 *
 * - The trigger is detected at the caret only when it starts a word, so
 *   e-mail addresses and paths do not open the menu.
 * - While the menu is open it owns Enter / Tab / arrows / Escape; the
 *   composer does not send (02-INTERACTION-SPEC B1). IME composition is
 *   left alone.
 * - Selecting an item replaces the typed trigger + query with a readable
 *   token and records a `ContextSelection` on the composer; the host, not the
 *   picker, decides what the reference grants.
 */

import type { ComposerController, ContextSelection } from '@zeus-web/ai-core'
import type { ComboboxController, ComboboxItem } from './combobox'

import { createCombobox } from './combobox'

export type ContextTrigger = '@' | '/'

export interface TriggerMatch {
  trigger: ContextTrigger
  /** Index of the trigger character in the text. */
  start: number
  query: string
}

const QUERY_CHARS = /^[^\s@/]*$/

export function detectTrigger(
  text: string,
  caret: number,
  triggers: readonly ContextTrigger[] = ['@', '/'],
): TriggerMatch | undefined {
  const before = text.slice(0, caret)

  for (let index = before.length - 1; index >= 0; index -= 1) {
    const char = before[index] as ContextTrigger

    if (triggers.includes(char)) {
      const startsWord = index === 0 || /\s/.test(before[index - 1])
      // `/` commands only at the very start of the message.
      if (char === '/' && index !== 0) return undefined
      if (!startsWord) return undefined
      const query = before.slice(index + 1)
      return QUERY_CHARS.test(query)
        ? { trigger: char, start: index, query }
        : undefined
    }

    if (/\s/.test(before[index])) return undefined
  }

  return undefined
}

export interface ContextItem extends ComboboxItem {
  kind: ContextSelection['kind']
  trigger: ContextTrigger
}

export interface ContextPickerOptions {
  composer: Pick<ComposerController, 'getSnapshot' | 'setText' | 'setContext'>
  items: () => readonly ContextItem[]
  /** Caret position provider; adapters read it from the textarea. */
  caret: () => number
  /** Called after insertion with the caret position to restore. */
  onCaret?: (position: number) => void
}

export interface ContextPicker {
  combobox: ComboboxController<ContextItem>
  /** Call on every text / caret change. */
  sync: () => void
  menuOpen: () => boolean
  dispose: () => void
}

export function createContextPicker(
  options: ContextPickerOptions,
): ContextPicker {
  let match: TriggerMatch | undefined

  const combobox = createCombobox<ContextItem>({
    items: () =>
      options.items().filter(item => !match || item.trigger === match.trigger),
    onSelect: item => {
      const current = options.composer.getSnapshot()
      if (!match) return

      const token = item.trigger === '@' ? `@${item.label} ` : `/${item.id} `
      const end = match.start + 1 + match.query.length
      const text = `${current.text.slice(0, match.start)}${token}${current.text.slice(end)}`

      options.composer.setText(text)
      if (!current.context.some(entry => entry.id === item.id)) {
        options.composer.setContext([
          ...current.context,
          { kind: item.kind, id: item.id, label: item.label },
        ])
      }
      options.onCaret?.(match.start + token.length)
      match = undefined
    },
  })

  return {
    combobox,
    sync(): void {
      match = detectTrigger(
        options.composer.getSnapshot().text,
        options.caret(),
      )
      if (!match) {
        if (combobox.getSnapshot().open) combobox.close()
        return
      }
      if (combobox.getSnapshot().open) combobox.setQuery(match.query)
      else combobox.open(match.query)
    },
    menuOpen: () => combobox.getSnapshot().open,
    dispose(): void {
      combobox.dispose()
    },
  }
}
