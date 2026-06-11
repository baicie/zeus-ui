import {
  AccordionContent as AccordionContentPrimitive,
  AccordionItem as AccordionItemPrimitive,
  Accordion as AccordionPrimitive,
  AccordionTrigger as AccordionTriggerPrimitive,
} from '@zeus-web/accordion/react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Accordion = AccordionPrimitive

export const AccordionItem = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AccordionItemPrimitive>
>(({ className, ...props }, ref) => (
  <AccordionItemPrimitive
    ref={ref}
    className={cn('border-b', className)}
    {...props}
  />
))
AccordionItem.displayName = 'AccordionItem'

export const AccordionTrigger = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AccordionTriggerPrimitive>
>(({ className, ...props }, ref) => (
  <AccordionTriggerPrimitive
    ref={ref}
    className={cn(
      '[&_[data-slot=accordion-trigger-button]]:flex [&_[data-slot=accordion-trigger-button]]:w-full [&_[data-slot=accordion-trigger-button]]:items-center [&_[data-slot=accordion-trigger-button]]:justify-between [&_[data-slot=accordion-trigger-button]]:py-4 [&_[data-slot=accordion-trigger-button]]:text-sm [&_[data-slot=accordion-trigger-button]]:font-medium [&_[data-slot=accordion-trigger-button]]:transition-all [&_[data-slot=accordion-trigger-button]]:hover:underline',
      className,
    )}
    {...props}
  />
))
AccordionTrigger.displayName = 'AccordionTrigger'

export const AccordionContent = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AccordionContentPrimitive>
>(({ className, ...props }, ref) => (
  <AccordionContentPrimitive
    ref={ref}
    className={cn(
      'overflow-hidden text-sm data-[state=closed]:hidden data-[state=open]:block [&>*]:pb-4',
      className,
    )}
    {...props}
  />
))
AccordionContent.displayName = 'AccordionContent'
