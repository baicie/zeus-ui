import type { ComponentProps } from 'react'
import { Input as InputPrimitive } from '@zeus-web/input/react'

import { cn } from '@/lib/cn'

export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps extends ComponentProps<typeof InputPrimitive> {
  size?: InputSize
  className?: string
}

const inputSizeClasses: Record<InputSize, string> = {
  sm: '[&_[part=root]]:h-8 [&_[part=root]]:px-2.5 [&_[part=root]]:text-xs',
  md: '[&_[part=root]]:h-9 [&_[part=root]]:px-3 [&_[part=root]]:text-sm',
  lg: '[&_[part=root]]:h-10 [&_[part=root]]:px-3.5 [&_[part=root]]:text-sm',
}

export function Input({ className, size = 'md', ...props }: InputProps) {
  return (
    <InputPrimitive
      size={size}
      className={cn(
        'block w-full',
        '[&_[part=root]]:flex [&_[part=root]]:w-full [&_[part=root]]:min-w-0 [&_[part=root]]:items-center [&_[part=root]]:rounded-[var(--zeus-radius-md)] [&_[part=root]]:border [&_[part=root]]:border-[hsl(var(--zeus-input))] [&_[part=root]]:bg-[hsl(var(--zeus-background))] [&_[part=root]]:text-[hsl(var(--zeus-foreground))]',
        '[&_[data-slot=input]]:min-w-0 [&_[data-slot=input]]:flex-1 [&_[data-slot=input]]:border-0 [&_[data-slot=input]]:bg-transparent [&_[data-slot=input]]:outline-none [&_[data-slot=input]]:placeholder:text-[hsl(var(--zeus-muted-foreground))]',
        '[&_[part=root]:focus-within]:outline-none [&_[part=root]:focus-within]:ring-2 [&_[part=root]:focus-within]:ring-[hsl(var(--zeus-ring)/0.35)]',
        '[&[data-invalid]_[part=root]]:border-[hsl(var(--zeus-destructive))] [&[data-invalid]_[part=root]:focus-within]:ring-[hsl(var(--zeus-destructive)/0.35)]',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        inputSizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}
