import { Select as SelectPrimitive } from '@zeus-web/select/vue'
import { defineComponent, h } from 'vue'
import { cn } from '@/lib/cn'

export const Select = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        SelectPrimitive,
        {
          ...attrs,
          class: cn(
            'relative block w-full',
            '[&_[part=trigger]]:flex [&_[part=trigger]]:h-9 [&_[part=trigger]]:w-full [&_[part=trigger]]:items-center [&_[part=trigger]]:justify-between [&_[part=trigger]]:rounded-[var(--zeus-radius-md)] [&_[part=trigger]]:border [&_[part=trigger]]:bg-[hsl(var(--zeus-background))]',
            attrs.class as string | undefined,
          ),
        },
        slots,
      )
  },
})
