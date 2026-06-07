import type { VariantProps } from 'class-variance-authority'
import { Button as ButtonPrimitive } from '@zeus-web/button/react'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex',
    '[&_[data-slot=button]]:inline-flex',
    '[&_[data-slot=button]]:items-center',
    '[&_[data-slot=button]]:justify-center',
    '[&_[data-slot=button]]:gap-2',
    '[&_[data-slot=button]]:whitespace-nowrap',
    '[&_[data-slot=button]]:rounded-md',
    '[&_[data-slot=button]]:text-sm',
    '[&_[data-slot=button]]:font-medium',
    '[&_[data-slot=button]]:transition-colors',
    '[&_[data-slot=button]]:border-0',
    '[&_[data-slot=button]]:appearance-none',
    '[&_[data-slot=button]]:focus-visible:outline-none',
    '[&_[data-slot=button]]:focus-visible:ring-1',
    '[&_[data-slot=button]]:focus-visible:ring-ring',
    '[&_[data-slot=button]]:disabled:pointer-events-none',
    '[&_[data-slot=button]]:disabled:opacity-50',
    '[&_[data-slot=button-prefix]]:inline-flex',
    '[&_[data-slot=button-prefix]]:items-center',
    '[&_[data-slot=button-suffix]]:inline-flex',
    '[&_[data-slot=button-suffix]]:items-center',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          '[&_[data-slot=button]]:bg-primary [&_[data-slot=button]]:text-primary-foreground [&_[data-slot=button]]:shadow [&_[data-slot=button]]:hover:bg-primary/90',
        primary:
          '[&_[data-slot=button]]:bg-primary [&_[data-slot=button]]:text-primary-foreground [&_[data-slot=button]]:shadow [&_[data-slot=button]]:hover:bg-primary/90',
        secondary:
          '[&_[data-slot=button]]:bg-secondary [&_[data-slot=button]]:text-secondary-foreground [&_[data-slot=button]]:shadow-sm [&_[data-slot=button]]:hover:bg-secondary/80',
        outline:
          '[&_[data-slot=button]]:border [&_[data-slot=button]]:border-input [&_[data-slot=button]]:bg-background [&_[data-slot=button]]:shadow-sm [&_[data-slot=button]]:hover:bg-accent [&_[data-slot=button]]:hover:text-accent-foreground',
        ghost:
          '[&_[data-slot=button]]:bg-transparent [&_[data-slot=button]]:hover:bg-accent [&_[data-slot=button]]:hover:text-accent-foreground',
        danger:
          '[&_[data-slot=button]]:bg-destructive [&_[data-slot=button]]:text-destructive-foreground [&_[data-slot=button]]:shadow-sm [&_[data-slot=button]]:hover:bg-destructive/90',
      },
      size: {
        sm: '[&_[data-slot=button]]:h-8 [&_[data-slot=button]]:rounded-md [&_[data-slot=button]]:px-3 [&_[data-slot=button]]:text-xs',
        md: '[&_[data-slot=button]]:h-9 [&_[data-slot=button]]:px-4 [&_[data-slot=button]]:py-2',
        lg: '[&_[data-slot=button]]:h-10 [&_[data-slot=button]]:rounded-md [&_[data-slot=button]]:px-8',
        icon: '[&_[data-slot=button]]:size-9',
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
    VariantProps<typeof buttonVariants> {}

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
