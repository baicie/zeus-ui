import type { ComponentProps } from 'react'
import { Button as ButtonPrimitive } from '@zeus-web/button/react'

import { cn } from '@/lib/cn'

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ComponentProps<typeof ButtonPrimitive> {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

const buttonVariantClasses: Record<ButtonVariant, string> = {
  default:
    'border border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-background))] text-[hsl(var(--zeus-foreground))] hover:bg-[hsl(var(--zeus-accent))] hover:text-[hsl(var(--zeus-accent-foreground))]',
  primary:
    'border border-[hsl(var(--zeus-primary))] bg-[hsl(var(--zeus-primary))] text-[hsl(var(--zeus-primary-foreground))] hover:bg-[hsl(var(--zeus-primary)/0.9)]',
  secondary:
    'border border-transparent bg-[hsl(var(--zeus-secondary))] text-[hsl(var(--zeus-secondary-foreground))] hover:bg-[hsl(var(--zeus-secondary)/0.8)]',
  outline:
    'border border-[hsl(var(--zeus-border))] bg-transparent text-[hsl(var(--zeus-foreground))] hover:bg-[hsl(var(--zeus-accent))] hover:text-[hsl(var(--zeus-accent-foreground))]',
  ghost:
    'border border-transparent bg-transparent text-[hsl(var(--zeus-foreground))] hover:bg-[hsl(var(--zeus-accent))] hover:text-[hsl(var(--zeus-accent-foreground))]',
  danger:
    'border border-[hsl(var(--zeus-destructive))] bg-[hsl(var(--zeus-destructive))] text-[hsl(var(--zeus-destructive-foreground))] hover:bg-[hsl(var(--zeus-destructive)/0.9)]',
}

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-6 text-sm',
  icon: 'h-9 w-9 p-0',
}

export function Button({
  className,
  variant = 'default',
  size = 'md',
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      variant={variant}
      size={size}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--zeus-radius-md)] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zeus-ring)/0.45)] focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        buttonVariantClasses[variant],
        buttonSizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}
