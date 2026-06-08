import {
  RadioGroupItem as RadioGroupItemPrimitive,
  RadioGroup as RadioGroupPrimitive,
} from '@zeus-web/radio-group/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface RadioGroupProps extends React.ComponentPropsWithoutRef<
  typeof RadioGroupPrimitive
> {}

export const RadioGroup = React.forwardRef<HTMLElement, RadioGroupProps>(
  ({ className, ...props }, ref) => {
    return (
      <RadioGroupPrimitive
        ref={ref}
        className={cn(
          'grid gap-2',
          'data-[orientation=horizontal]:flex data-[orientation=horizontal]:flex-wrap',
          className,
        )}
        {...props}
      />
    )
  },
)

RadioGroup.displayName = 'RadioGroup'

export interface RadioGroupItemProps extends React.ComponentPropsWithoutRef<
  typeof RadioGroupItemPrimitive
> {}

export const RadioGroupItem = React.forwardRef<
  HTMLElement,
  RadioGroupItemProps
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupItemPrimitive
      ref={ref}
      className={cn(
        'inline-flex items-center gap-2',
        '[&_[data-slot=radio-group-control]]:size-4',
        '[&_[data-slot=radio-group-control]]:rounded-full',
        '[&_[data-slot=radio-group-control]]:border [&_[data-slot=radio-group-control]]:border-primary',
        '[&_[data-slot=radio-group-control]]:text-primary',
        '[&_[data-slot=radio-group-control]]:focus-visible:outline-none [&_[data-slot=radio-group-control]]:focus-visible:ring-1 [&_[data-slot=radio-group-control]]:focus-visible:ring-ring',
        '[&_[data-slot=radio-group-label]]:text-sm',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  )
})

RadioGroupItem.displayName = 'RadioGroupItem'
