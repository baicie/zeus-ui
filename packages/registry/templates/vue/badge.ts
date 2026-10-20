import { Badge as BadgePrimitive } from '@zeus-web/badge/vue'
import { defineComponent, h } from 'vue'
import { cn } from '@/lib/cn'

export const Badge = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        BadgePrimitive,
        {
          ...attrs,
          class: cn(
            'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold',
            attrs.class as string | undefined,
          ),
        },
        slots,
      )
  },
})
