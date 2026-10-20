import { Textarea as TextareaPrimitive } from '@zeus-web/textarea/vue'
import { defineComponent, h } from 'vue'
import { cn } from '@/lib/cn'

export const Textarea = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        TextareaPrimitive,
        {
          ...attrs,
          class: cn(
            'flex min-h-20 w-full rounded-[var(--zeus-radius-md)] border border-[hsl(var(--zeus-input))] bg-[hsl(var(--zeus-background))] px-3 py-2 text-sm placeholder:text-[hsl(var(--zeus-muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zeus-ring)/0.45)] disabled:cursor-not-allowed disabled:opacity-50',
            attrs.class as string | undefined,
          ),
        },
        slots,
      )
  },
})
