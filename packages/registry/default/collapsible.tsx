import {
  CollapsibleContent as CollapsibleContentPrimitive,
  Collapsible as CollapsiblePrimitive,
  CollapsibleTrigger as CollapsibleTriggerPrimitive,
} from '@zeus-web/collapsible/react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Collapsible = CollapsiblePrimitive

export const CollapsibleTrigger = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CollapsibleTriggerPrimitive>
>(({ className, ...props }, ref) => (
  <CollapsibleTriggerPrimitive
    ref={ref}
    className={cn(
      '[&_[data-slot=collapsible-trigger-button]]:inline-flex [&_[data-slot=collapsible-trigger-button]]:items-center [&_[data-slot=collapsible-trigger-button]]:rounded-md [&_[data-slot=collapsible-trigger-button]]:text-sm [&_[data-slot=collapsible-trigger-button]]:font-medium [&_[data-slot=collapsible-trigger-button]]:transition-colors [&_[data-slot=collapsible-trigger-button]]:focus-visible:outline-none [&_[data-slot=collapsible-trigger-button]]:focus-visible:ring-1 [&_[data-slot=collapsible-trigger-button]]:focus-visible:ring-ring',
      className,
    )}
    {...props}
  />
))
CollapsibleTrigger.displayName = 'CollapsibleTrigger'

export const CollapsibleContent = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CollapsibleContentPrimitive>
>(({ className, ...props }, ref) => (
  <CollapsibleContentPrimitive
    ref={ref}
    className={cn(
      'data-[state=closed]:hidden data-[state=open]:block',
      className,
    )}
    {...props}
  />
))
CollapsibleContent.displayName = 'CollapsibleContent'
