import { Progress as ProgressPrimitive } from '@zeus-web/progress/react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ProgressProps extends React.ComponentPropsWithoutRef<
  typeof ProgressPrimitive
> {}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function resolvePercent(value?: number, max?: number): number {
  const safeMax = Math.max(1, max ?? 100)
  const safeValue = clamp(value ?? 0, 0, safeMax)
  return Math.round((safeValue / safeMax) * 100)
}

export const Progress = React.forwardRef<HTMLElement, ProgressProps>(
  ({ className, style, value, max, indeterminate, ...props }, ref) => {
    const percent = resolvePercent(value, max)
    return (
      <ProgressPrimitive
        ref={ref}
        value={value}
        max={max}
        indeterminate={indeterminate}
        style={
          {
            '--zeus-progress-percent': `${percent}%`,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
          '[&_[data-slot=progress-indicator]]:block',
          '[&_[data-slot=progress-indicator]]:h-full',
          '[&_[data-slot=progress-indicator]]:w-[var(--zeus-progress-percent)]',
          '[&_[data-slot=progress-indicator]]:bg-primary',
          '[&_[data-slot=progress-indicator]]:transition-all',
          'data-[state=indeterminate]:[&_[data-slot=progress-indicator]]:w-1/3',
          className,
        )}
        {...props}
      />
    )
  },
)
Progress.displayName = 'Progress'
