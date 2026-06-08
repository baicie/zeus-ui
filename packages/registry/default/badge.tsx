import type { VariantProps } from 'class-variance-authority'

import { Badge as BadgePrimitive } from '@zeus-web/badge/react'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'text-foreground',
        danger:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        success: 'border-transparent bg-emerald-600 text-white shadow',
        warning: 'border-transparent bg-amber-500 text-white shadow',
      },
      size: {
        sm: 'px-2 py-0 text-[11px]',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

export interface BadgeProps
  extends
    React.ComponentPropsWithoutRef<typeof BadgePrimitive>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => (
    <BadgePrimitive
      ref={ref}
      variant={variant ?? undefined}
      size={size ?? undefined}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  ),
)

Badge.displayName = 'Badge'

export { badgeVariants }
