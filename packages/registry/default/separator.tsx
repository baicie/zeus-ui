import { Separator as SeparatorPrimitive } from '@zeus-web/separator/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SeparatorProps extends React.ComponentPropsWithoutRef<
  typeof SeparatorPrimitive
> {}

export const Separator = React.forwardRef<HTMLElement, SeparatorProps>(
  ({ className, orientation = 'horizontal', ...props }, ref) => (
    <SeparatorPrimitive
      ref={ref}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  ),
)

Separator.displayName = 'Separator'
