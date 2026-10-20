import { Separator as SeparatorPrimitive } from '@zeus-web/separator/vue'
import { defineComponent, h } from 'vue'
import { cn } from '@/lib/cn'

export const Separator = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        SeparatorPrimitive,
        {
          ...attrs,
          class: cn(
            'shrink-0 bg-[hsl(var(--zeus-border))]',
            attrs.class as string | undefined,
          ),
        },
        slots,
      )
  },
})
