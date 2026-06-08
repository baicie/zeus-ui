import { Skeleton as SkeletonPrimitive } from '@zeus-web/skeleton/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SkeletonProps extends React.ComponentPropsWithoutRef<
  typeof SkeletonPrimitive
> {}

export const Skeleton = React.forwardRef<HTMLElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <SkeletonPrimitive
      ref={ref}
      className={cn(
        'block rounded-md bg-muted',
        'data-[animated]:animate-pulse',
        'data-[variant=circle]:rounded-full',
        'data-[variant=text]:h-4 data-[variant=text]:w-full',
        className,
      )}
      {...props}
    />
  ),
)

Skeleton.displayName = 'Skeleton'
