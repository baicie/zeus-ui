/**
 * Render neutral views (`@zeus-web/ai-primitives`) as React elements.
 *
 * One mapping turns a part's DOM attribute names and neutral handlers into
 * React props; slots are filled with the caller's ReactNodes, so complex
 * React content (custom cells, MDX, editors) renders natively instead of
 * going through a Web Component (01-ARCHITECTURE §16).
 */

import type { PartEvent, PartProps, ViewNode } from '@zeus-web/ai-primitives'
import type {
  ChangeEvent,
  CSSProperties,
  ReactNode,
  Ref,
  SyntheticEvent,
} from 'react'

import { createElement, Fragment } from 'react'

export type SlotRenderer = (data: unknown, fallback: ReactNode) => ReactNode

export interface RenderOptions {
  slots?: Partial<Record<string, SlotRenderer>>
  /** Refs by `data-part` or `data-action` value. */
  refs?: Partial<Record<string, Ref<HTMLElement>>>
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input'])

const REACT_NAMES: Readonly<Record<string, string>> = {
  tabindex: 'tabIndex',
  for: 'htmlFor',
  class: 'className',
  autocomplete: 'autoComplete',
  spellcheck: 'spellCheck',
  readonly: 'readOnly',
  referrerpolicy: 'referrerPolicy',
  colspan: 'colSpan',
}

function parseStyle(value: string): CSSProperties {
  const style: Record<string, string> = {}
  for (const declaration of value.split(';')) {
    const [property, ...rest] = declaration.split(':')
    if (!property || rest.length === 0) continue
    const name = property
      .trim()
      .replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
    style[name] = rest.join(':').trim()
  }
  return style as CSSProperties
}

/** Translate a React synthetic event into the neutral shape. */
export function toPartEvent(event: SyntheticEvent): PartEvent {
  const target = event.currentTarget as HTMLInputElement
  const native = event.nativeEvent as KeyboardEvent & { isComposing?: boolean }
  const keyboard = event as unknown as {
    key?: string
    shiftKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
    altKey?: boolean
    keyCode?: number
  }

  return {
    key: keyboard.key,
    shiftKey: keyboard.shiftKey,
    ctrlKey: keyboard.ctrlKey,
    metaKey: keyboard.metaKey,
    altKey: keyboard.altKey,
    isComposing: native?.isComposing === true || keyboard.keyCode === 229,
    value: typeof target?.value === 'string' ? target.value : undefined,
    checked: typeof target?.checked === 'boolean' ? target.checked : undefined,
    selectionStart:
      typeof target?.selectionStart === 'number'
        ? target.selectionStart
        : undefined,
    preventDefault: () => event.preventDefault(),
  }
}

export function toReactProps(
  part: PartProps | undefined,
): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  if (!part) return props

  for (const [name, value] of Object.entries(part.attrs)) {
    if (value === undefined) continue
    if (name === 'style' && typeof value === 'string') {
      props.style = parseStyle(value)
      continue
    }
    props[REACT_NAMES[name] ?? name] = value
  }

  const on = part.on
  if (!on) return props

  const wrap =
    (handler: (event: PartEvent) => void) => (event: SyntheticEvent) =>
      handler(toPartEvent(event))

  if (on.click) props.onClick = wrap(on.click)
  if (on.keydown) props.onKeyDown = wrap(on.keydown)
  if (on.compositionstart) props.onCompositionStart = wrap(on.compositionstart)
  if (on.compositionend) props.onCompositionEnd = wrap(on.compositionend)
  if (on.focus) props.onFocus = wrap(on.focus)
  if (on.blur) props.onBlur = wrap(on.blur)
  // React's onChange fires on every input for text fields and on toggle for
  // checkboxes, which is what `input` / `change` mean in the neutral model.
  const change = on.input ?? on.change
  if (change)
    props.onChange = (event: ChangeEvent) => change(toPartEvent(event))
  // A controlled field with no change handler must be read-only for React.
  if (!change && ('value' in props || 'checked' in props)) props.readOnly = true

  return props
}

export function renderView(
  node: ViewNode,
  options: RenderOptions = {},
  fallbackKey?: string | number,
): ReactNode {
  switch (node.type) {
    case 'text':
      return node.text
    case 'slot': {
      const fallback = node.fallback
        ? node.fallback.map((child, index) => renderView(child, options, index))
        : null
      const renderer = options.slots?.[node.name]
      return createElement(
        Fragment,
        { key: node.key ?? fallbackKey },
        renderer ? renderer(node.data, fallback) : fallback,
      )
    }
    case 'element': {
      const props = toReactProps(node.part)
      const marker =
        node.part?.attrs['data-part'] ?? node.part?.attrs['data-action']
      const ref =
        typeof marker === 'string' ? options.refs?.[marker] : undefined
      if (ref) props.ref = ref
      props.key = node.key ?? fallbackKey

      if (VOID_TAGS.has(node.tag)) return createElement(node.tag, props)

      const children = (node.children ?? []).map((child, index) =>
        renderView(child, options, index),
      )
      return createElement(node.tag, props, ...children)
    }
  }
}
