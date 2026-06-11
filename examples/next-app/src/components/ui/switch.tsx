'use client'

import type { SwitchElement } from '@zeus-web/switch/react'
import { Switch as SwitchPrimitive } from '@zeus-web/switch/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SwitchProps extends React.ComponentPropsWithoutRef<
  typeof SwitchPrimitive
> {}

export const Switch = React.forwardRef<SwitchElement, SwitchProps>(
  ({ className, ...props }, ref) => {
    return (
      <SwitchPrimitive
        ref={ref}
        className={cn('zw-switch', className)}
        {...props}
      />
    )
  },
)

Switch.displayName = 'Switch'
