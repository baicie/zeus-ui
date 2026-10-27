/**
 * Native DOM event → neutral `PartEvent`, shared by the Vue and Web
 * Component adapters (React has its own synthetic events). Reads only the
 * event passed in; no globals.
 */

import type { PartEvent } from './parts'

export function partEventFromDom(event: Event): PartEvent {
  const target = event.currentTarget as
    | (EventTarget & {
        value?: unknown
        checked?: unknown
        selectionStart?: unknown
      })
    | null
  const keyboard = event as KeyboardEvent

  return {
    key: keyboard.key,
    shiftKey: keyboard.shiftKey,
    ctrlKey: keyboard.ctrlKey,
    metaKey: keyboard.metaKey,
    altKey: keyboard.altKey,
    isComposing: keyboard.isComposing === true || keyboard.keyCode === 229,
    value: typeof target?.value === 'string' ? target.value : undefined,
    checked: typeof target?.checked === 'boolean' ? target.checked : undefined,
    selectionStart:
      typeof target?.selectionStart === 'number'
        ? target.selectionStart
        : undefined,
    preventDefault: () => event.preventDefault(),
  }
}

/** Neutral event name → DOM event type. */
export const DOM_EVENT_TYPES: Readonly<Record<string, string>> = {
  click: 'click',
  input: 'input',
  change: 'change',
  keydown: 'keydown',
  compositionstart: 'compositionstart',
  compositionend: 'compositionend',
  focus: 'focus',
  blur: 'blur',
}
