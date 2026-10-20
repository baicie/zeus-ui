import type { Component } from 'vue'
import {
  CollapsibleContent as CollapsibleContentPrimitive,
  Collapsible as CollapsiblePrimitive,
  CollapsibleTrigger as CollapsibleTriggerPrimitive,
} from '@zeus-web/collapsible/vue'
import { defineComponent, h } from 'vue'
import { cn } from '@/lib/cn'

function styled(component: Component, classes: string) {
  return defineComponent({
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () =>
        h(
          component,
          { ...attrs, class: cn(classes, attrs.class as string | undefined) },
          slots,
        )
    },
  })
}

export const Collapsible = CollapsiblePrimitive
export const CollapsibleTrigger = styled(
  CollapsibleTriggerPrimitive,
  'inline-flex items-center justify-center rounded-[var(--zeus-radius-md)] text-sm font-medium',
)
export const CollapsibleContent = styled(
  CollapsibleContentPrimitive,
  'overflow-hidden text-sm',
)
