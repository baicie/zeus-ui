import { Label as LabelPrimitive } from '@zeus-web/label/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface LabelProps extends React.ComponentPropsWithoutRef<
  typeof LabelPrimitive
> {}

export const Label = React.forwardRef<HTMLElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <LabelPrimitive
        ref={ref}
        className={cn(
          'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          '[&_[data-slot=label-required-indicator]]:ml-1 [&_[data-slot=label-required-indicator]]:text-destructive',
          className,
        )}
        {...props}
      />
    )
  },
)

Label.displayName = 'Label'
