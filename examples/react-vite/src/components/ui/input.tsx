import type { InputElement } from '@zeus-web/input/react'
import { Input as InputPrimitive } from '@zeus-web/input/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface InputProps extends React.ComponentPropsWithoutRef<
  typeof InputPrimitive
> {}

export const Input = React.forwardRef<InputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <InputPrimitive
        ref={ref}
        className={cn('zw-input', className)}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'
