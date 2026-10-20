import type { Component } from 'vue'
import {
  AvatarFallback as AvatarFallbackPrimitive,
  AvatarImage as AvatarImagePrimitive,
  Avatar as AvatarPrimitive,
} from '@zeus-web/avatar/vue'
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

export const Avatar = styled(
  AvatarPrimitive,
  'relative flex size-10 shrink-0 overflow-hidden rounded-full',
)
export const AvatarImage = styled(
  AvatarImagePrimitive,
  'aspect-square size-full object-cover',
)
export const AvatarFallback = styled(
  AvatarFallbackPrimitive,
  'flex size-full items-center justify-center rounded-full bg-[hsl(var(--zeus-muted))] text-sm',
)
