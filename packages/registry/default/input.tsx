import { Input as InputPrimitive } from '@zeus-web/input/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface InputProps extends React.ComponentPropsWithoutRef<
  typeof InputPrimitive
> {}

export const Input = React.forwardRef<HTMLElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <InputPrimitive
        ref={ref}
        data-slot="input"
        type={type}
        className={cn(
          [
            'block w-full',
            '[&_[part=root]]:flex',
            '[&_[part=root]]:h-9',
            '[&_[part=root]]:w-full',
            '[&_[part=root]]:items-center',
            '[&_[part=root]]:gap-2',
            '[&_[part=root]]:rounded-md',
            '[&_[part=root]]:border',
            '[&_[part=root]]:border-input',
            '[&_[part=root]]:bg-transparent',
            '[&_[part=root]]:px-3',
            '[&_[part=root]]:py-1',
            '[&_[part=root]]:text-sm',
            '[&_[part=root]]:shadow-sm',
            '[&_[part=root]]:transition-colors',
            '[&_[data-slot=input]]:min-w-0',
            '[&_[data-slot=input]]:flex-1',
            '[&_[data-slot=input]]:border-0',
            '[&_[data-slot=input]]:bg-transparent',
            '[&_[data-slot=input]]:outline-none',
            '[&_[data-slot=input]]:placeholder:text-muted-foreground',
            '[&_[data-slot=input]]:disabled:cursor-not-allowed',
            '[&_[data-slot=input]]:disabled:opacity-50',
            '[&_[part=root]:focus-within]:ring-1',
            '[&_[part=root]:focus-within]:ring-ring',
            'data-[disabled]:cursor-not-allowed',
            'data-[disabled]:opacity-50',
          ].join(' '),
          className,
        )}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'
