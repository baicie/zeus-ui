import type { VariantProps } from 'class-variance-authority'
import { Button as ButtonPrimitive } from '@zeus-web/button/react'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_[data-slot=button-prefix]]:inline-flex [&_[data-slot=button-prefix]]:items-center',
    '[&_[data-slot=button-suffix]]:inline-flex [&_[data-slot=button-suffix]]:items-center',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        primary:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        danger:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-xs',
        md: 'h-9 px-4 py-2',
        lg: 'h-10 rounded-md px-8',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends
    React.ComponentPropsWithoutRef<typeof ButtonPrimitive>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <ButtonPrimitive
        ref={ref}
        data-slot="button"
        variant={variant ?? undefined}
        size={size ?? undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'

export { buttonVariants }
