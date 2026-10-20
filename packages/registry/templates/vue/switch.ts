import { Switch as SwitchPrimitive } from '@zeus-web/switch/vue'
import { defineComponent, h } from 'vue'
import { cn } from '@/lib/cn'

export const Switch = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        SwitchPrimitive,
        {
          ...attrs,
          class: cn(
            'inline-flex items-center gap-2 text-sm',
            'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
            '[&_[data-slot=switch-track]]:relative',
            '[&_[data-slot=switch-track]]:inline-flex',
            '[&_[data-slot=switch-track]]:h-5',
            '[&_[data-slot=switch-track]]:w-9',
            '[&_[data-slot=switch-track]]:items-center',
            '[&_[data-slot=switch-track]]:rounded-full',
            '[&_[data-slot=switch-track]]:border-2',
            '[&_[data-slot=switch-track]]:border-transparent',
            '[&_[data-slot=switch-track]]:bg-[hsl(var(--zeus-input))]',
            '[&_[data-slot=switch-thumb]]:block',
            '[&_[data-slot=switch-thumb]]:size-4',
            '[&_[data-slot=switch-thumb]]:rounded-full',
            '[&_[data-slot=switch-thumb]]:bg-[hsl(var(--zeus-background))]',
            '[&_[data-slot=switch-thumb]]:shadow-lg',
            '[&_[data-slot=switch-thumb]]:transition-transform',
            'data-[state=checked]:[&_[data-slot=switch-track]]:bg-[hsl(var(--zeus-primary))]',
            'data-[state=checked]:[&_[data-slot=switch-thumb]]:translate-x-4',
            attrs.class as string | undefined,
          ),
        },
        slots,
      )
  },
})
