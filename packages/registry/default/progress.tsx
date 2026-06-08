import { Progress as ProgressPrimitive } from '@zeus-web/progress/react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ProgressProps extends React.ComponentPropsWithoutRef<
  typeof ProgressPrimitive
> {}

export const Progress = React.forwardRef<HTMLElement, ProgressProps>(
  ({ className, ...props }, ref) => (
    <ProgressPrimitive
      ref={ref}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-primary/20 [&_[data-slot=progress-indicator]]:block [&_[data-slot=progress-indicator]]:h-full [&_[data-slot=progress-indicator]]:bg-primary [&_[data-slot=progress-indicator]]:transition-all data-[state=indeterminate]:[&_[data-slot=progress-indicator]]:w-1/3',
        className,
      )}
      {...props}
    />
  ),
)
Progress.displayName = 'Progress'
