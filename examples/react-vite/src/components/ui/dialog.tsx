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

export type DialogProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive>
export type DialogTriggerProps = React.ComponentPropsWithoutRef<
  typeof DialogTriggerPrimitive
>
export type DialogContentProps = React.ComponentPropsWithoutRef<
  typeof DialogContentPrimitive
>
export type DialogTitleProps = React.ComponentPropsWithoutRef<
  typeof DialogTitlePrimitive
>
export type DialogDescriptionProps = React.ComponentPropsWithoutRef<
  typeof DialogDescriptionPrimitive
>
export type DialogCloseProps = React.ComponentPropsWithoutRef<
  typeof DialogClosePrimitive
>

export const Dialog = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive>,
  DialogProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive
    ref={ref}
    className={cn('zw-dialog', className)}
    {...props}
  />
))

Dialog.displayName = 'Dialog'

export const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogTriggerPrimitive>,
  DialogTriggerProps
>(({ className, ...props }, ref) => (
  <DialogTriggerPrimitive
    ref={ref}
    className={cn('zw-dialog-trigger', className)}
    {...props}
  />
))

DialogTrigger.displayName = 'DialogTrigger'

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContentPrimitive>,
  DialogContentProps
>(({ className, ...props }, ref) => (
  <DialogContentPrimitive
    ref={ref}
    className={cn('zw-dialog-content', className)}
    {...props}
  />
))

DialogContent.displayName = 'DialogContent'

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogTitlePrimitive>,
  DialogTitleProps
>(({ className, ...props }, ref) => (
  <DialogTitlePrimitive
    ref={ref}
    className={cn('zw-dialog-title', className)}
    {...props}
  />
))

DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogDescriptionPrimitive>,
  DialogDescriptionProps
>(({ className, ...props }, ref) => (
  <DialogDescriptionPrimitive
    ref={ref}
    className={cn('zw-dialog-description', className)}
    {...props}
  />
))

DialogDescription.displayName = 'DialogDescription'

export const DialogClose = React.forwardRef<
  React.ElementRef<typeof DialogClosePrimitive>,
  DialogCloseProps
>(({ className, ...props }, ref) => (
  <DialogClosePrimitive
    ref={ref}
    className={cn('zw-dialog-close', className)}
    {...props}
  />
))

DialogClose.displayName = 'DialogClose'
