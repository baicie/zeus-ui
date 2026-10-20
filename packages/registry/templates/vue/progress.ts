import { Progress as ProgressPrimitive } from '@zeus-web/progress/vue'
import { defineComponent, h } from 'vue'
import { cn } from '@/lib/cn'

export const Progress = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        ProgressPrimitive,
        {
          ...attrs,
          class: cn(
            'relative h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--zeus-muted))] [&_[part=indicator]]:bg-[hsl(var(--zeus-primary))]',
            attrs.class as string | undefined,
          ),
        },
        slots,
      )
  },
})
