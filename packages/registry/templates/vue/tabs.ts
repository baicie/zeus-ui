import type { Component } from 'vue'
import {
  TabsContent as TabsContentPrimitive,
  TabsList as TabsListPrimitive,
  Tabs as TabsPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
} from '@zeus-web/tabs/vue'
import { defineComponent, h } from 'vue'
import { cn } from '@/lib/cn'

function styled(component: Component, classes: string) {
  return defineComponent({
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () =>
        h(
          component,
          {
            ...attrs,
            class: cn(classes, attrs.class as string | undefined),
          },
          slots,
        )
    },
  })
}

export const Tabs = TabsPrimitive
export const TabsList = styled(
  TabsListPrimitive,
  'inline-flex h-9 items-center justify-center rounded-[var(--zeus-radius-md)] bg-[hsl(var(--zeus-muted))] p-1 text-[hsl(var(--zeus-muted-foreground))]',
)
export const TabsTrigger = styled(
  TabsTriggerPrimitive,
  'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[hsl(var(--zeus-background))] data-[state=active]:text-[hsl(var(--zeus-foreground))] data-[state=active]:shadow',
)
export const TabsContent = styled(
  TabsContentPrimitive,
  'mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zeus-ring)/0.45)]',
)
