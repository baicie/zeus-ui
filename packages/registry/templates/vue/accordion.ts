import type { Component } from 'vue'
import {
  AccordionContent as AccordionContentPrimitive,
  AccordionItem as AccordionItemPrimitive,
  Accordion as AccordionPrimitive,
  AccordionTrigger as AccordionTriggerPrimitive,
} from '@zeus-web/accordion/vue'
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

export const Accordion = AccordionPrimitive
export const AccordionItem = styled(
  AccordionItemPrimitive,
  'border-b border-[hsl(var(--zeus-border))]',
)
export const AccordionTrigger = styled(
  AccordionTriggerPrimitive,
  'flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zeus-ring)/0.45)]',
)
export const AccordionContent = styled(
  AccordionContentPrimitive,
  'overflow-hidden pb-4 text-sm',
)
