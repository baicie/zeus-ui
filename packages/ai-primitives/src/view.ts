/**
 * Neutral view descriptions.
 *
 * A view is a small tree of elements (tag + part), text and named slots.
 * Adapters render it with their own machinery — React elements, Vue VNodes,
 * or a keyed DOM patch for Web Components — so every framework produces the
 * same structure, roles and handlers from one definition. Slots are where a
 * framework renders its own native content (a ReactNode, a scoped slot, a
 * light-DOM child) instead of the default.
 *
 * Text is always text: there is no node type that carries markup.
 */

import type { PartProps } from './parts'

export interface ViewElement {
  type: 'element'
  tag: string
  key?: string
  part?: PartProps
  children?: readonly ViewNode[]
}

export interface ViewText {
  type: 'text'
  text: string
}

export interface ViewSlot {
  type: 'slot'
  name: string
  key?: string
  data?: unknown
  /** Rendered when the adapter has no content for this slot. */
  fallback?: readonly ViewNode[]
}

export type ViewNode = ViewElement | ViewText | ViewSlot

export function el(
  tag: string,
  part?: PartProps,
  children?: readonly (ViewNode | false | '' | 0 | undefined | null)[],
  key?: string,
): ViewElement {
  const list = (children ?? []).filter((child): child is ViewNode =>
    Boolean(child),
  )
  if (part?.text !== undefined && part.text !== '') {
    list.unshift({ type: 'text', text: part.text })
  }
  return { type: 'element', tag, key, part, children: list }
}

export function text(value: string): ViewText {
  return { type: 'text', text: value }
}

export function slot(
  name: string,
  data?: unknown,
  key?: string,
  fallback?: readonly ViewNode[],
): ViewSlot {
  return { type: 'slot', name, data, key, fallback }
}

/** Render-time attribute value for a DOM attribute (adapters share this). */
export function attributeValue(
  value: string | number | boolean | undefined,
): string | undefined {
  if (value === undefined || value === false) return undefined
  if (value === true) return ''
  return String(value)
}

/** Attributes that must be set as DOM properties, not attributes. */
export const PROPERTY_ATTRS: readonly string[] = ['value', 'checked']

/** Boolean attributes whose presence alone means "on". */
export const BOOLEAN_ATTRS: readonly string[] = [
  'disabled',
  'hidden',
  'checked',
  'readonly',
  'required',
]
