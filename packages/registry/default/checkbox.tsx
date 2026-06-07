import type { VariantProps } from 'class-variance-authority'
import { Checkbox as CheckboxPrimitive } from '@zeus-web/checkbox/react'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const checkboxVariants = cva(
  [
    'inline-flex items-center gap-2 text-sm leading-none',
    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
    '[&_[data-slot=checkbox-control]]:size-4',
    '[&_[data-slot=checkbox-control]]:rounded-sm',
    '[&_[data-slot=checkbox-control]]:border',
    '[&_[data-slot=checkbox-control]]:border-primary',
    '[&_[data-slot=checkbox-control]]:bg-background',
    '[&_[data-slot=checkbox-control]]:text-primary-foreground',
    '[&_[data-slot=checkbox-control]]:focus-visible:outline-none',
    '[&_[data-slot=checkbox-control]]:focus-visible:ring-1',
    '[&_[data-slot=checkbox-control]]:focus-visible:ring-ring',
    '[&_[data-slot=checkbox-control]]:disabled:cursor-not-allowed',
    '[&_[data-slot=checkbox-control]]:disabled:opacity-50',
    'data-[state=checked]:[&_[data-slot=checkbox-control]]:bg-primary',
    'data-[state=checked]:[&_[data-slot=checkbox-control]]:text-primary-foreground',
    'data-[state=indeterminate]:[&_[data-slot=checkbox-control]]:bg-primary',
    'data-[state=indeterminate]:[&_[data-slot=checkbox-control]]:text-primary-foreground',
  ].join(' '),
  {
    variants: {
      size: {
        sm: '[&_[data-slot=checkbox-control]]:size-3 text-xs',
        md: '[&_[data-slot=checkbox-control]]:size-4 text-sm',
        lg: '[&_[data-slot=checkbox-control]]:size-5 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

export interface CheckboxProps
  extends
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive>,
    VariantProps<typeof checkboxVariants> {}

export const Checkbox = React.forwardRef<HTMLElement, CheckboxProps>(
  ({ className, size, children, ...props }, ref) => {
    return (
      <CheckboxPrimitive
        ref={ref}
        data-slot="checkbox"
        size={size ?? undefined}
        className={cn(checkboxVariants({ size }), className)}
        {...props}
      >
        {children}
      </CheckboxPrimitive>
    )
  },
)

Checkbox.displayName = 'Checkbox'

export { checkboxVariants }
