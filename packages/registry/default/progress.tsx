import { Progress as ProgressPrimitive } from '@zeus-web/progress/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface ProgressProps extends React.ComponentPropsWithoutRef<
  typeof ProgressPrimitive
> {}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function resolvePercent(value: unknown, max: unknown): number {
  const safeMax = Math.max(1, toNumber(max, 100))
  const safeValue = clamp(toNumber(value, 0), 0, safeMax)
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
            ...style,
            '--zeus-progress-percent': `${percent}%`,
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
