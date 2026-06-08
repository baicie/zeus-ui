import {
  TooltipContent as TooltipContentPrimitive,
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from '@zeus-web/tooltip/react'
import * as React from 'react'
import { cn } from '@/lib/utils'

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
>(({ className, side = 'top', ...props }, ref) => (
  <TooltipContentPrimitive
    ref={ref}
    side={side}
    className={cn(
      'z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-md data-[state=closed]:hidden data-[state=open]:block data-[side=top]:mb-2 data-[side=bottom]:mt-2 data-[side=left]:mr-2 data-[side=right]:ml-2',
      className,
    )}
    {...props}
  />
))
TooltipContent.displayName = 'TooltipContent'
