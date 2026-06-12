import type { ComponentProps } from 'react'
import { Input as InputPrimitive } from '@zeus-web/input/react'

import { cn } from '@/lib/cn'

export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps extends ComponentProps<typeof InputPrimitive> {
  size?: InputSize
  className?: string
}

const inputSizeClasses: Record<InputSize, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-3.5 text-sm',
}

export function Input({ className, size = 'md', ...props }: InputProps) {
  return (
    <InputPrimitive
      size={size}
      className={cn(
        'flex w-full min-w-0 rounded-[var(--zeus-radius-md)] border border-[hsl(var(--zeus-input))] bg-[hsl(var(--zeus-background))] text-[hsl(var(--zeus-foreground))]',
        'placeholder:text-[hsl(var(--zeus-muted-foreground))]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zeus-ring)/0.35)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-[hsl(var(--zeus-destructive))] aria-invalid:ring-[hsl(var(--zeus-destructive)/0.35)]',
        inputSizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}
