/**
 * Part contract shared by every primitive.
 *
 * A primitive describes each element it needs ("part") as plain data:
 * attributes using DOM names (`aria-*`, `data-*`, `role`, `tabindex`, …) and
 * handlers that take a framework-neutral event. React, Vue and Web Component
 * adapters each translate a part with one generic function, so the three
 * render the same semantics without the primitives knowing any framework or
 * touching the DOM (01-ARCHITECTURE §8.2).
 */

export type AttrValue = string | number | boolean | undefined

export type PartAttrs = Readonly<Record<string, AttrValue>>

export type PartEventName =
  | 'click'
  | 'input'
  | 'change'
  | 'keydown'
  | 'compositionstart'
  | 'compositionend'
  | 'focus'
  | 'blur'

/** The parts of a DOM / React / Vue event that primitives may read. */
export interface PartEvent {
  key?: string
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  /** True while an input method is composing (or keyCode 229). */
  isComposing?: boolean
  /** Current value of the event target for `input` / `change`. */
  value?: string
  checked?: boolean
  preventDefault: () => void
}

export type PartHandler = (event: PartEvent) => void

export interface PartProps {
  attrs: PartAttrs
  on?: Partial<Record<PartEventName, PartHandler>>
  /** Visible text content for leaf parts (always text, never markup). */
  text?: string
}

export function part(
  attrs: PartAttrs,
  on?: Partial<Record<PartEventName, PartHandler>>,
  text?: string,
): PartProps {
  return text === undefined ? { attrs, on } : { attrs, on, text }
}

/** `aria-*` values must be strings; booleans render as "true" / "false". */
export function ariaBool(
  value: boolean | undefined,
): 'true' | 'false' | undefined {
  return value === undefined ? undefined : value ? 'true' : 'false'
}

/** Stable, collision-free DOM ids per primitive instance. */
export interface IdScope {
  id: (name: string) => string
}

let scopeCounter = 0

export function createIdScope(prefix = 'zw-ai'): IdScope {
  scopeCounter += 1
  const base = `${prefix}-${scopeCounter}`
  return {
    id: name => `${base}-${name.replace(/[^\w-]/g, '_')}`,
  }
}

/** A neutral event for programmatic use and tests. */
export function syntheticEvent(
  init: Omit<PartEvent, 'preventDefault'> = {},
): PartEvent & {
  defaultPrevented: boolean
} {
  const event = {
    ...init,
    defaultPrevented: false,
    preventDefault(): void {
      event.defaultPrevented = true
    },
  }
  return event
}
