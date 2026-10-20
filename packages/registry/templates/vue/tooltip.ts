import type { Component } from 'vue'
import {
  TooltipContent as TooltipContentPrimitive,
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from '@zeus-web/tooltip/vue'
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

export const Tooltip = TooltipPrimitive
export const TooltipTrigger = styled(TooltipTriggerPrimitive, 'inline-flex')
export const TooltipContent = styled(
  TooltipContentPrimitive,
  'z-50 overflow-hidden rounded-[var(--zeus-radius-md)] border bg-[hsl(var(--zeus-background))] px-3 py-1.5 text-xs shadow-md',
)
