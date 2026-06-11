import {
  AvatarFallback as AvatarFallbackPrimitive,
  AvatarImage as AvatarImagePrimitive,
  Avatar as AvatarPrimitive,
} from '@zeus-web/avatar/react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Avatar = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive
    ref={ref}
    className={cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full data-[shape=square]:rounded-md data-[size=sm]:h-8 data-[size=sm]:w-8 data-[size=lg]:h-12 data-[size=lg]:w-12',
      className,
    )}
    {...props}
  />
))
Avatar.displayName = 'Avatar'

export const AvatarImage = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AvatarImagePrimitive>
>(({ className, ...props }, ref) => (
  <AvatarImagePrimitive
    ref={ref}
    className={cn(
      '[&_[data-slot=avatar-image]]:aspect-square [&_[data-slot=avatar-image]]:h-full [&_[data-slot=avatar-image]]:w-full [&_[data-slot=avatar-image]]:object-cover',
      className,
    )}
    {...props}
  />
))
AvatarImage.displayName = 'AvatarImage'

export const AvatarFallback = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AvatarFallbackPrimitive>
>(({ className, ...props }, ref) => (
  <AvatarFallbackPrimitive
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium',
      className,
    )}
    {...props}
  />
))
AvatarFallback.displayName = 'AvatarFallback'
