import type { ButtonElement } from '@zeus-web/button/react'

import type { VariantProps } from 'class-variance-authority'
import { Button as ButtonPrimitive } from '@zeus-web/button/react'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva('zw-button', {
  variants: {
    variant: {
      default: 'zw-button--default',
      primary: 'zw-button--default',
      secondary: 'zw-button--secondary',
      outline: 'zw-button--outline',
      ghost: 'zw-button--ghost',
      danger: 'zw-button--danger',
    },
    size: {
      sm: 'zw-button--sm',
      md: 'zw-button--md',
      lg: 'zw-button--lg',
      icon: 'zw-button--icon',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
})

export interface ButtonProps
  extends
    Omit<
      React.ComponentPropsWithoutRef<typeof ButtonPrimitive>,
      'size' | 'variant'
    >,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<ButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <ButtonPrimitive
        ref={ref}
        variant={variant ?? undefined}
        size={size ?? undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'

export { buttonVariants }
