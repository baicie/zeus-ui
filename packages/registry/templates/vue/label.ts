import { Label as LabelPrimitive } from '@zeus-web/label/vue'
import { defineComponent, h } from 'vue'
import { cn } from '@/lib/cn'

export const Label = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        LabelPrimitive,
        {
          ...attrs,
          class: cn(
            'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
            attrs.class as string | undefined,
          ),
        },
        slots,
      )
  },
})
