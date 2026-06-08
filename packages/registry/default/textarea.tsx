import { Textarea as TextareaPrimitive } from '@zeus-web/textarea/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface TextareaProps extends React.ComponentPropsWithoutRef<
  typeof TextareaPrimitive
> {}

export const Textarea = React.forwardRef<HTMLElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <TextareaPrimitive
        ref={ref}
        className={cn(
          'block w-full',
          '[&_[data-slot=textarea]]:min-h-20 [&_[data-slot=textarea]]:w-full [&_[data-slot=textarea]]:rounded-md',
          '[&_[data-slot=textarea]]:border [&_[data-slot=textarea]]:border-input',
          '[&_[data-slot=textarea]]:bg-background [&_[data-slot=textarea]]:px-3 [&_[data-slot=textarea]]:py-2',
          '[&_[data-slot=textarea]]:text-sm [&_[data-slot=textarea]]:shadow-sm',
          '[&_[data-slot=textarea]]:placeholder:text-muted-foreground',
          '[&_[data-slot=textarea]]:focus-visible:outline-none [&_[data-slot=textarea]]:focus-visible:ring-1 [&_[data-slot=textarea]]:focus-visible:ring-ring',
          '[&_[data-slot=textarea]]:disabled:cursor-not-allowed [&_[data-slot=textarea]]:disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)

Textarea.displayName = 'Textarea'
