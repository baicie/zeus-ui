import type { VariantProps } from 'class-variance-authority'
import { Switch as SwitchPrimitive } from '@zeus-web/switch/react'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const switchVariants = cva(
  [
    'inline-flex items-center gap-2 text-sm',
    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
    '[&_[data-slot=switch-track]]:relative',
    '[&_[data-slot=switch-track]]:inline-flex',
    '[&_[data-slot=switch-track]]:shrink-0',
    '[&_[data-slot=switch-track]]:cursor-pointer',
    '[&_[data-slot=switch-track]]:items-center',
    '[&_[data-slot=switch-track]]:rounded-full',
    '[&_[data-slot=switch-track]]:border-2',
    '[&_[data-slot=switch-track]]:border-transparent',
    '[&_[data-slot=switch-track]]:bg-input',
    '[&_[data-slot=switch-track]]:transition-colors',
    '[&_[data-slot=switch-thumb]]:pointer-events-none',
    '[&_[data-slot=switch-thumb]]:block',
    '[&_[data-slot=switch-thumb]]:rounded-full',
    '[&_[data-slot=switch-thumb]]:bg-background',
    '[&_[data-slot=switch-thumb]]:shadow-lg',
    '[&_[data-slot=switch-thumb]]:ring-0',
    '[&_[data-slot=switch-thumb]]:transition-transform',
    'data-[state=checked]:[&_[data-slot=switch-track]]:bg-primary',
  ].join(' '),
  {
    variants: {
      size: {
        sm: [
          '[&_[data-slot=switch-track]]:h-4',
          '[&_[data-slot=switch-track]]:w-7',
          '[&_[data-slot=switch-thumb]]:size-3',
          'data-[state=checked]:[&_[data-slot=switch-thumb]]:translate-x-3',
        ].join(' '),
        md: [
          '[&_[data-slot=switch-track]]:h-5',
          '[&_[data-slot=switch-track]]:w-9',
          '[&_[data-slot=switch-thumb]]:size-4',
          'data-[state=checked]:[&_[data-slot=switch-thumb]]:translate-x-4',
        ].join(' '),
        lg: [
          '[&_[data-slot=switch-track]]:h-6',
          '[&_[data-slot=switch-track]]:w-11',
          '[&_[data-slot=switch-thumb]]:size-5',
          'data-[state=checked]:[&_[data-slot=switch-thumb]]:translate-x-5',
        ].join(' '),
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

export interface SwitchProps
  extends
    React.ComponentPropsWithoutRef<typeof SwitchPrimitive>,
    VariantProps<typeof switchVariants> {}

export const Switch = React.forwardRef<HTMLElement, SwitchProps>(
  ({ className, size, children, ...props }, ref) => {
    return (
      <SwitchPrimitive
        ref={ref}
        data-slot="switch"
        size={size ?? undefined}
        className={cn(switchVariants({ size }), className)}
        {...props}
      >
        {children}
      </SwitchPrimitive>
    )
  },
)

Switch.displayName = 'Switch'

export { switchVariants }
