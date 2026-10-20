import {
  TooltipContent as TooltipContentPrimitive,
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from '@zeus-web/tooltip/react'
import * as React from 'react'
import { cn } from '@/lib/cn'

export const Tooltip = TooltipPrimitive

export const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof TooltipTriggerPrimitive>
>(({ className, ...props }, ref) => (
  <TooltipTriggerPrimitive
    ref={ref}
    className={cn('inline-flex', className)}
    {...props}
  />
))
TooltipTrigger.displayName = 'TooltipTrigger'

export const TooltipContent = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof TooltipContentPrimitive>
>(({ className, ...props }, ref) => (
  <TooltipContentPrimitive
    ref={ref}
    className={cn(
      'z-50 overflow-hidden rounded-[var(--zeus-radius-md)] border border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-background))] px-3 py-1.5 text-xs text-[hsl(var(--zeus-foreground))] shadow-md data-[state=closed]:hidden data-[state=open]:block',
      className,
    )}
    {...props}
  />
))
TooltipContent.displayName = 'TooltipContent'
