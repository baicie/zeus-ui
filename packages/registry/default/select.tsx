import { Select as SelectPrimitive } from '@zeus-web/select/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SelectProps extends React.ComponentPropsWithoutRef<
  typeof SelectPrimitive
> {}

export const Select = React.forwardRef<HTMLElement, SelectProps>(
  ({ className, ...props }, ref) => {
    return (
      <SelectPrimitive
        ref={ref}
        className={cn(
          'block w-full',
          '[&_[data-slot=select]]:h-9 [&_[data-slot=select]]:w-full',
          '[&_[data-slot=select]]:rounded-md [&_[data-slot=select]]:border [&_[data-slot=select]]:border-input',
          '[&_[data-slot=select]]:bg-background [&_[data-slot=select]]:px-3 [&_[data-slot=select]]:py-1',
          '[&_[data-slot=select]]:text-sm [&_[data-slot=select]]:shadow-sm',
          '[&_[data-slot=select]]:focus-visible:outline-none [&_[data-slot=select]]:focus-visible:ring-1 [&_[data-slot=select]]:focus-visible:ring-ring',
          '[&_[data-slot=select]]:disabled:cursor-not-allowed [&_[data-slot=select]]:disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)

Select.displayName = 'Select'
