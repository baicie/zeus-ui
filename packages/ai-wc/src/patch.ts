/**
 * Keyed DOM patcher for neutral views.
 *
 * Custom elements re-render their view on every relevant change; patching
 * reuses existing nodes (matched by key, else by position and tag) so focus,
 * caret position and scroll state survive. Attributes are diffed, `value` /
 * `checked` are set as properties only when they differ from the live
 * element, and each element has one listener per event type that calls the
 * current handler. Text is only ever written with `textContent` / text
 * nodes.
 *
 * Slots render into a `<span data-slot style="display:contents">` wrapper
 * that the slot renderer owns, so per-item custom elements keep their own
 * subscriptions across re-renders.
 */

import type { PartHandler, PartProps, ViewNode } from '@zeus-web/ai-primitives'

import {
  attributeValue,
  BOOLEAN_ATTRS,
  DOM_EVENT_TYPES,
  partEventFromDom,
  PROPERTY_ATTRS,
} from '@zeus-web/ai-primitives'

/** Fill a slot wrapper; called on every render with the same wrapper. */
export type SlotRenderer = (
  wrapper: HTMLElement,
  data: unknown,
  renderFallback: () => void,
) => void

export interface PatchOptions {
  slots?: Partial<Record<string, SlotRenderer>>
}

interface Meta {
  tag: string
  key?: string
  slot?: string
  attrs: Set<string>
  handlers: Partial<Record<string, PartHandler>>
  listening: Set<string>
}

const META = new WeakMap<Node, Meta>()

function metaOf(node: Node): Meta | undefined {
  return META.get(node)
}

function keyOf(node: ViewNode): string | undefined {
  return node.type === 'text' ? undefined : node.key
}

function applyPart(
  element: HTMLElement,
  meta: Meta,
  part: PartProps | undefined,
): void {
  const attrs = part?.attrs ?? {}
  const next = new Set<string>()

  for (const [name, raw] of Object.entries(attrs)) {
    if (PROPERTY_ATTRS.includes(name)) {
      const target = element as unknown as Record<string, unknown>
      const value = name === 'checked' ? raw === true : (raw ?? '')
      if (target[name] !== value)
        target[name] = name === 'value' ? String(value) : value
      continue
    }

    const value = BOOLEAN_ATTRS.includes(name)
      ? raw === true || raw === ''
        ? ''
        : undefined
      : attributeValue(raw)

    if (value === undefined) {
      element.removeAttribute(name)
      continue
    }
    next.add(name)
    if (element.getAttribute(name) !== value) element.setAttribute(name, value)
  }

  for (const name of meta.attrs) {
    if (!next.has(name)) element.removeAttribute(name)
  }
  meta.attrs = next

  meta.handlers = {}
  for (const [name, handler] of Object.entries(part?.on ?? {})) {
    const type = DOM_EVENT_TYPES[name]
    if (!handler || !type) continue
    meta.handlers[type] = handler
    if (!meta.listening.has(type)) {
      meta.listening.add(type)
      element.addEventListener(type, event => {
        META.get(element)?.handlers[type]?.(partEventFromDom(event))
      })
    }
  }
}

function create(doc: Document, node: ViewNode): Node {
  if (node.type === 'text') return doc.createTextNode(node.text)

  const tag = node.type === 'slot' ? 'span' : node.tag
  const element = doc.createElement(tag)
  META.set(element, {
    tag,
    key: node.key,
    slot: node.type === 'slot' ? node.name : undefined,
    attrs: new Set(),
    handlers: {},
    listening: new Set(),
  })
  if (node.type === 'slot') {
    element.setAttribute('data-slot', node.name)
    element.style.display = 'contents'
  }
  return element
}

function matches(existing: Node, node: ViewNode): boolean {
  if (node.type === 'text') return existing.nodeType === 3
  const meta = metaOf(existing)
  if (!meta) return false
  if (node.type === 'slot')
    return meta.slot === node.name && meta.key === node.key
  return (
    meta.tag === node.tag && meta.key === node.key && meta.slot === undefined
  )
}

function update(existing: Node, node: ViewNode, options: PatchOptions): void {
  if (node.type === 'text') {
    if (existing.textContent !== node.text) existing.textContent = node.text
    return
  }

  const element = existing as HTMLElement

  if (node.type === 'slot') {
    const renderFallback = (): void =>
      patchChildren(element, node.fallback ?? [], options)
    const renderer = options.slots?.[node.name]
    if (renderer) renderer(element, node.data, renderFallback)
    else renderFallback()
    return
  }

  applyPart(element, metaOf(element)!, node.part)
  patchChildren(element, node.children ?? [], options)
}

/** Make `parent`'s children match `nodes`, reusing what it can. */
export function patchChildren(
  parent: Element,
  nodes: readonly ViewNode[],
  options: PatchOptions = {},
): void {
  const doc = parent.ownerDocument
  const existing = Array.from(parent.childNodes).filter(
    child => child.nodeType === 3 || metaOf(child) !== undefined,
  )
  const byKey = new Map<string, Node>()
  for (const child of existing) {
    const key = metaOf(child)?.key
    if (key !== undefined) byKey.set(key, child)
  }

  const used = new Set<Node>()
  const result: Node[] = []

  nodes.forEach((node, index) => {
    const key = keyOf(node)
    let candidate: Node | undefined =
      key !== undefined ? byKey.get(key) : existing[index]

    if (!candidate || used.has(candidate) || !matches(candidate, node)) {
      candidate = existing.find(
        child =>
          !used.has(child) &&
          matches(child, node) &&
          keyOf(node) === metaOf(child)?.key,
      )
    }

    const target = candidate ?? create(doc, node)
    used.add(target)
    update(target, node, options)
    result.push(target)
  })

  // Remove nodes we own that are no longer rendered.
  for (const child of existing) {
    if (!used.has(child)) parent.removeChild(child)
  }

  // Order without detaching nodes that are already in place (keeps focus).
  let cursor: ChildNode | null = parent.firstChild
  for (const node of result) {
    while (
      cursor &&
      cursor !== node &&
      !used.has(cursor) &&
      cursor.nodeType !== 3 &&
      !metaOf(cursor)
    ) {
      cursor = cursor.nextSibling
    }
    if (cursor === node) {
      cursor = cursor.nextSibling
      continue
    }
    parent.insertBefore(node, cursor)
  }
}
