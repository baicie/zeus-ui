'use client'

import type { CheckboxElement } from '@zeus-web/checkbox/react'
import { Checkbox as CheckboxPrimitive } from '@zeus-web/checkbox/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface CheckboxProps extends React.ComponentPropsWithoutRef<
  typeof CheckboxPrimitive
> {}

export const Checkbox = React.forwardRef<CheckboxElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <CheckboxPrimitive
        ref={ref}
        className={cn('zw-checkbox', className)}
        {...props}
      />
    )
  },
)

Checkbox.displayName = 'Checkbox'
