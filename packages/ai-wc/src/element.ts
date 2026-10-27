/**
 * Base for `zw-ai-*` custom elements (AI2-503).
 *
 * - Classes are created by `defineX()` calls, never at import time, so the
 *   package can be imported during SSR without `HTMLElement`.
 * - Data and controllers are DOM properties only; nothing is serialized into
 *   attributes. Plain options (labels, layout) may also come from
 *   attributes.
 * - Subscriptions are opened in `connectedCallback` and released in
 *   `disconnectedCallback`, together with any controller the element owns.
 *   Disconnecting never cancels host work.
 * - Rendering happens into the light DOM (headless: no shadow styles to
 *   fight). Children the page put inside with `slot="name"` are kept and
 *   projected into that slot.
 */

import type { ViewNode } from '@zeus-web/ai-primitives'
import type { PatchOptions, SlotRenderer } from './patch'

import { idScopeFrom } from '@zeus-web/ai-primitives'
import { patchChildren } from './patch'

let instanceCounter = 0

export interface AiElementHooks {
  /** Subscribe to whatever the element needs; return cleanups. */
  connect: () => (() => void)[]
  view: () => ViewNode | null
  slots?: () => Partial<Record<string, SlotRenderer>>
  afterRender?: () => void
}

export interface AiElementInstance extends HTMLElement {
  requestRender: () => void
  /** Re-run subscriptions after a property changed. */
  reconnect: () => void
  readonly ids: ReturnType<typeof idScopeFrom>
  projected: (name: string) => readonly Node[]
}

type HooksFactory = (element: AiElementInstance) => AiElementHooks

/** Define a custom element whose behaviour comes from `hooks`. */
export function defineAiElement(
  tag: string,
  properties: readonly string[],
  hooks: HooksFactory,
  observedAttributes: readonly string[] = [],
  registry: CustomElementRegistry | undefined = (
    globalThis as { customElements?: CustomElementRegistry }
  ).customElements,
): void {
  if (!registry) {
    throw new Error(
      '[AI_WC_NO_REGISTRY] custom elements are not available here',
    )
  }
  if (registry.get(tag)) return

  class AiElement extends HTMLElement {
    static get observedAttributes(): readonly string[] {
      return observedAttributes
    }

    readonly ids = idScopeFrom(`zw-ai-el${(instanceCounter += 1)}`)
    private cleanups: (() => void)[] = []
    private scheduled = false
    private connected = false
    private behaviour: AiElementHooks | undefined
    private slotted = new Map<string, Node[]>()
    private values: Record<string, unknown> = {}

    constructor() {
      super()
      for (const name of properties) {
        // Properties set before the element upgraded live on the instance.
        // `Object.hasOwn` is ES2022; this package targets ES2016.
        // eslint-disable-next-line e18e/prefer-object-has-own
        if (Object.prototype.hasOwnProperty.call(this, name)) {
          this.values[name] = (this as unknown as Record<string, unknown>)[name]
          delete (this as unknown as Record<string, unknown>)[name]
        }
        Object.defineProperty(this, name, {
          configurable: true,
          get: () => this.values[name],
          set: (value: unknown) => {
            if (Object.is(this.values[name], value)) return
            this.values[name] = value
            this.reconnect()
          },
        })
      }
    }

    projected(name: string): readonly Node[] {
      return this.slotted.get(name) ?? []
    }

    connectedCallback(): void {
      if (this.slotted.size === 0) {
        for (const child of Array.from(this.children)) {
          const name = child.getAttribute('slot')
          if (!name) continue
          this.slotted.set(name, [...(this.slotted.get(name) ?? []), child])
          child.remove()
        }
      }
      this.connected = true
      this.behaviour = hooks(this as unknown as AiElementInstance)
      this.cleanups = this.behaviour.connect()
      this.render()
    }

    disconnectedCallback(): void {
      this.connected = false
      for (const cleanup of this.cleanups.splice(0)) cleanup()
    }

    attributeChangedCallback(): void {
      if (this.connected) this.requestRender()
    }

    reconnect(): void {
      if (!this.connected) return
      for (const cleanup of this.cleanups.splice(0)) cleanup()
      this.behaviour = hooks(this as unknown as AiElementInstance)
      this.cleanups = this.behaviour.connect()
      this.requestRender()
    }

    requestRender(): void {
      if (this.scheduled || !this.connected) return
      this.scheduled = true
      queueMicrotask(() => {
        this.scheduled = false
        if (this.connected) this.render()
      })
    }

    render(): void {
      const behaviour = this.behaviour
      if (!behaviour) return
      const node = behaviour.view()
      const options: PatchOptions = { slots: behaviour.slots?.() }
      patchChildren(this, node ? [node] : [], options)
      behaviour.afterRender?.()
    }
  }

  registry.define(tag, AiElement)
}

/** Slot renderer that projects the page's own `slot="name"` children. */
export function projectSlot(
  element: AiElementInstance,
  name: string,
): SlotRenderer {
  return (wrapper, _data, renderFallback) => {
    const nodes = element.projected(name)
    if (nodes.length === 0) {
      renderFallback()
      return
    }
    for (const node of nodes) {
      if (node.parentNode !== wrapper) wrapper.append(node)
    }
  }
}

/**
 * Slot renderer that keeps one child custom element per slot and updates
 * its properties, so per-item elements keep their own subscriptions.
 */
export function elementSlot(
  tag: string,
  properties: (data: unknown) => Record<string, unknown>,
): SlotRenderer {
  return (wrapper, data) => {
    let child = wrapper.firstElementChild as HTMLElement | null
    if (!child || child.localName !== tag) {
      wrapper.textContent = ''
      child = wrapper.ownerDocument.createElement(tag)
      wrapper.append(child)
    }
    Object.assign(child, properties(data))
  }
}

/** Emit a DOM event with a minimal, non-sensitive detail. */
export function emit(
  element: HTMLElement,
  type: string,
  detail?: Record<string, string>,
): void {
  element.dispatchEvent(
    new CustomEvent(type, { bubbles: true, composed: true, detail }),
  )
}
