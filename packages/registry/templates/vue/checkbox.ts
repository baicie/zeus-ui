import { Checkbox as CheckboxPrimitive } from '@zeus-web/checkbox/vue'
import { defineComponent, h } from 'vue'
import { cn } from '@/lib/cn'

export const Checkbox = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        CheckboxPrimitive,
        {
          ...attrs,
          class: cn(
            'inline-flex items-center gap-2 text-sm leading-none',
            'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
            '[&_[data-slot=checkbox-control]]:size-4',
            '[&_[data-slot=checkbox-control]]:rounded-sm',
            '[&_[data-slot=checkbox-control]]:border',
            '[&_[data-slot=checkbox-control]]:border-[hsl(var(--zeus-primary))]',
            '[&_[data-slot=checkbox-control]]:bg-[hsl(var(--zeus-background))]',
            'data-[state=checked]:[&_[data-slot=checkbox-control]]:bg-[hsl(var(--zeus-primary))]',
            'data-[state=indeterminate]:[&_[data-slot=checkbox-control]]:bg-[hsl(var(--zeus-primary))]',
            attrs.class as string | undefined,
          ),
        },
        slots,
      )
  },
})
