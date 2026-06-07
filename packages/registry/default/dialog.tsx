import {
  DialogClose as DialogClosePrimitive,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  Dialog as DialogPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger as DialogTriggerPrimitive,
} from '@zeus-web/dialog/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface DialogProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive
> {}

export const Dialog = React.forwardRef<HTMLElement, DialogProps>(
  ({ className, ...props }, ref) => {
    return (
      <DialogPrimitive
        ref={ref}
        data-slot="dialog"
        className={cn('', className)}
        {...props}
      />
    )
  },
)

Dialog.displayName = 'Dialog'

export interface DialogTriggerProps extends React.ComponentPropsWithoutRef<
  typeof DialogTriggerPrimitive
> {}

export const DialogTrigger = React.forwardRef<HTMLElement, DialogTriggerProps>(
  ({ className, ...props }, ref) => {
    return (
      <DialogTriggerPrimitive
        ref={ref}
        data-slot="dialog-trigger"
        className={cn('', className)}
        {...props}
      />
    )
  },
)

DialogTrigger.displayName = 'DialogTrigger'

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogContentPrimitive
> {}

export const DialogContent = React.forwardRef<HTMLElement, DialogContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <DialogContentPrimitive
        ref={ref}
        data-slot="dialog-content"
        className={cn(
          [
            'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg',
            '-translate-x-1/2 -translate-y-1/2 gap-4',
            'border bg-background p-6 shadow-lg duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'sm:rounded-lg',
          ].join(' '),
          className,
        )}
        {...props}
      />
    )
  },
)

DialogContent.displayName = 'DialogContent'

export interface DialogTitleProps extends React.ComponentPropsWithoutRef<
  typeof DialogTitlePrimitive
> {}

export const DialogTitle = React.forwardRef<HTMLElement, DialogTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <DialogTitlePrimitive
        ref={ref}
        data-slot="dialog-title"
        className={cn(
          'text-lg font-semibold leading-none tracking-tight',
          className,
        )}
        {...props}
      />
    )
  },
)

DialogTitle.displayName = 'DialogTitle'

export interface DialogDescriptionProps extends React.ComponentPropsWithoutRef<
  typeof DialogDescriptionPrimitive
> {}

export const DialogDescription = React.forwardRef<
  HTMLElement,
  DialogDescriptionProps
>(({ className, ...props }, ref) => {
  return (
    <DialogDescriptionPrimitive
      ref={ref}
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
})

DialogDescription.displayName = 'DialogDescription'

export interface DialogCloseProps extends React.ComponentPropsWithoutRef<
  typeof DialogClosePrimitive
> {}

export const DialogClose = React.forwardRef<HTMLElement, DialogCloseProps>(
  ({ className, ...props }, ref) => {
    return (
      <DialogClosePrimitive
        ref={ref}
        data-slot="dialog-close"
        className={cn(
          [
            'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity',
            'hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:pointer-events-none',
          ].join(' '),
          className,
        )}
        {...props}
      />
    )
  },
)

DialogClose.displayName = 'DialogClose'
