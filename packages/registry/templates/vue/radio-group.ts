import type { Component } from 'vue'
import {
  RadioGroupItem as RadioGroupItemPrimitive,
  RadioGroup as RadioGroupPrimitive,
} from '@zeus-web/radio-group/vue'
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

export const RadioGroup = styled(RadioGroupPrimitive, 'grid gap-2')
export const RadioGroupItem = styled(
  RadioGroupItemPrimitive,
  'size-4 rounded-full border border-[hsl(var(--zeus-primary))] text-[hsl(var(--zeus-primary))]',
)
