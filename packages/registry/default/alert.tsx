import type { VariantProps } from 'class-variance-authority'

import {
  AlertDescription as AlertDescriptionPrimitive,
  Alert as AlertPrimitive,
  AlertTitle as AlertTitlePrimitive,
} from '@zeus-web/alert/react'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const alertVariants = cva('relative w-full rounded-lg border p-4 text-sm', {
  variants: {
    variant: {
      default: 'bg-background text-foreground',
      info: 'border-sky-200 bg-sky-50 text-sky-950',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
      warning: 'border-amber-200 bg-amber-50 text-amber-950',
      danger: 'border-destructive/50 text-destructive dark:border-destructive',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface AlertProps
  extends
    React.ComponentPropsWithoutRef<typeof AlertPrimitive>,
    VariantProps<typeof alertVariants> {}

export const Alert = React.forwardRef<HTMLElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <AlertPrimitive
      ref={ref}
      variant={variant ?? undefined}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  ),
)

Alert.displayName = 'Alert'

export const AlertTitle = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AlertTitlePrimitive>
>(({ className, ...props }, ref) => (
  <AlertTitlePrimitive
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
))

AlertTitle.displayName = 'AlertTitle'

export const AlertDescription = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AlertDescriptionPrimitive>
>(({ className, ...props }, ref) => (
  <AlertDescriptionPrimitive
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
))

AlertDescription.displayName = 'AlertDescription'

export { alertVariants }
