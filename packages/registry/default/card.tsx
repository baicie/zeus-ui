import {
  CardContent as CardContentPrimitive,
  CardDescription as CardDescriptionPrimitive,
  CardFooter as CardFooterPrimitive,
  CardHeader as CardHeaderPrimitive,
  Card as CardPrimitive,
  CardTitle as CardTitlePrimitive,
} from '@zeus-web/card/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const Card = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CardPrimitive>
>(({ className, ...props }, ref) => (
  <CardPrimitive
    ref={ref}
    className={cn(
      'rounded-xl border bg-card text-card-foreground shadow',
      className,
    )}
    {...props}
  />
))

Card.displayName = 'Card'

export const CardHeader = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CardHeaderPrimitive>
>(({ className, ...props }, ref) => (
  <CardHeaderPrimitive
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
))

CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CardTitlePrimitive>
>(({ className, ...props }, ref) => (
  <CardTitlePrimitive
    ref={ref}
    className={cn('font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))

CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CardDescriptionPrimitive>
>(({ className, ...props }, ref) => (
  <CardDescriptionPrimitive
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))

CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CardContentPrimitive>
>(({ className, ...props }, ref) => (
  <CardContentPrimitive
    ref={ref}
    className={cn('p-6 pt-0', className)}
    {...props}
  />
))

CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CardFooterPrimitive>
>(({ className, ...props }, ref) => (
  <CardFooterPrimitive
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
))

CardFooter.displayName = 'CardFooter'
