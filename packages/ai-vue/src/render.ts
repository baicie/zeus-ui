/**
 * Render neutral views as Vue VNodes. Slots are filled by the component's
 * scoped slots, so complex Vue content renders natively (AI2-502).
 */

import type { PartProps, ViewNode } from '@zeus-web/ai-primitives'
import type { Ref, VNode, VNodeChild } from 'vue'

import { DOM_EVENT_TYPES, partEventFromDom } from '@zeus-web/ai-primitives'
import { Fragment, h } from 'vue'

export type SlotRenderer = (data: unknown, fallback: VNodeChild) => VNodeChild

export interface RenderOptions {
  slots?: Partial<Record<string, SlotRenderer>>
  /** Template refs by `data-part` or `data-action` value. */
  refs?: Partial<Record<string, Ref<HTMLElement | null>>>
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input'])

function handlerName(event: string): string {
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}`
}

export function toVueProps(
  part: PartProps | undefined,
): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  if (!part) return props

  for (const [name, value] of Object.entries(part.attrs)) {
    if (value === undefined) continue
    props[name] = value
  }

  for (const [name, handler] of Object.entries(part.on ?? {})) {
    if (!handler || !DOM_EVENT_TYPES[name]) continue
    props[handlerName(DOM_EVENT_TYPES[name])] = (event: Event) =>
      handler(partEventFromDom(event))
  }

  return props
}

export function renderView(
  node: ViewNode,
  options: RenderOptions = {},
  fallbackKey?: string | number,
): VNodeChild {
  switch (node.type) {
    case 'text':
      return node.text
    case 'slot': {
      const fallback = node.fallback
        ? node.fallback.map((child, index) => renderView(child, options, index))
        : null
      const renderer = options.slots?.[node.name]
      const content = renderer ? renderer(node.data, fallback) : fallback
      return h(Fragment, { key: node.key ?? fallbackKey }, [
        content,
      ] as VNodeChild[])
    }
    case 'element': {
      const props = toVueProps(node.part)
      const marker =
        node.part?.attrs['data-part'] ?? node.part?.attrs['data-action']
      const ref =
        typeof marker === 'string' ? options.refs?.[marker] : undefined
      if (ref) props.ref = ref
      props.key = node.key ?? fallbackKey

      if (VOID_TAGS.has(node.tag)) return h(node.tag, props)

      return h(
        node.tag,
        props,
        (node.children ?? []).map((child, index) =>
          renderView(child, options, index),
        ) as VNodeChild[],
      )
    }
  }
}

/** Render a root view; Vue components need a single VNode. */
export function renderRoot(node: ViewNode, options: RenderOptions = {}): VNode {
  return renderView(node, options) as VNode
}
