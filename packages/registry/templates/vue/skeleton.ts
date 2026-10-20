import { Skeleton as SkeletonPrimitive } from '@zeus-web/skeleton/vue'
import { defineComponent, h } from 'vue'
import { cn } from '@/lib/cn'

export const Skeleton = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        SkeletonPrimitive,
        {
          ...attrs,
          class: cn(
            'animate-pulse rounded-[var(--zeus-radius-md)] bg-[hsl(var(--zeus-muted))]',
            attrs.class as string | undefined,
          ),
        },
        slots,
      )
  },
})
