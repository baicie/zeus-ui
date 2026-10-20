import type { Component } from 'vue'
import {
  AlertDescription as AlertDescriptionPrimitive,
  Alert as AlertPrimitive,
  AlertTitle as AlertTitlePrimitive,
} from '@zeus-web/alert/vue'
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

export const Alert = styled(
  AlertPrimitive,
  'relative w-full rounded-[var(--zeus-radius-md)] border border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-background))] p-4 text-[hsl(var(--zeus-foreground))]',
)
export const AlertTitle = styled(
  AlertTitlePrimitive,
  'mb-1 font-medium leading-none tracking-tight',
)
export const AlertDescription = styled(
  AlertDescriptionPrimitive,
  'text-sm text-[hsl(var(--zeus-muted-foreground))]',
)
