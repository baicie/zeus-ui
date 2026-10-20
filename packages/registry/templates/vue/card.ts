import type { Component } from 'vue'
import {
  CardContent as CardContentPrimitive,
  CardDescription as CardDescriptionPrimitive,
  CardFooter as CardFooterPrimitive,
  CardHeader as CardHeaderPrimitive,
  Card as CardPrimitive,
  CardTitle as CardTitlePrimitive,
} from '@zeus-web/card/vue'
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

export const Card = styled(
  CardPrimitive,
  'rounded-[var(--zeus-radius-lg)] border border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-background))] text-[hsl(var(--zeus-foreground))] shadow-sm',
)
export const CardHeader = styled(
  CardHeaderPrimitive,
  'flex flex-col space-y-1.5 p-6',
)
export const CardTitle = styled(
  CardTitlePrimitive,
  'font-semibold leading-none tracking-tight',
)
export const CardDescription = styled(
  CardDescriptionPrimitive,
  'text-sm text-[hsl(var(--zeus-muted-foreground))]',
)
export const CardContent = styled(CardContentPrimitive, 'p-6 pt-0')
export const CardFooter = styled(
  CardFooterPrimitive,
  'flex items-center p-6 pt-0',
)
