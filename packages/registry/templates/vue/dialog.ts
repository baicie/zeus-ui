import type { Component } from 'vue'
import {
  DialogClose as DialogClosePrimitive,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  DialogOverlay as DialogOverlayPrimitive,
  Dialog as DialogPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger as DialogTriggerPrimitive,
} from '@zeus-web/dialog/vue'
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

export const Dialog = DialogPrimitive
export const DialogTrigger = DialogTriggerPrimitive
export const DialogOverlay = styled(
  DialogOverlayPrimitive,
  'fixed inset-0 z-40 bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
)
export const DialogContent = styled(
  DialogContentPrimitive,
  'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-background))] p-6 shadow-lg sm:rounded-[var(--zeus-radius-lg)]',
)
export const DialogTitle = styled(
  DialogTitlePrimitive,
  'text-lg font-semibold leading-none tracking-tight',
)
export const DialogDescription = styled(
  DialogDescriptionPrimitive,
  'text-sm text-[hsl(var(--zeus-muted-foreground))]',
)
export const DialogClose = styled(
  DialogClosePrimitive,
  'absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--zeus-ring))] disabled:pointer-events-none',
)
