import type { ComponentProps } from 'react'
import {
  ChatComposer as ChatComposerPrimitive,
  ChatMessage as ChatMessagePrimitive,
  Chat as ChatPrimitive,
  ChatThread as ChatThreadPrimitive,
} from '@zeus-web/chat/react'

import { cn } from '@/lib/cn'

export interface ChatProps extends ComponentProps<typeof ChatPrimitive> {
  className?: string
}

export function Chat({ className, ...props }: ChatProps) {
  return (
    <ChatPrimitive
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-[var(--zeus-radius-lg)] border border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-background))] text-[hsl(var(--zeus-foreground))]',
        className,
      )}
      {...props}
    />
  )
}

export interface ChatThreadProps extends ComponentProps<
  typeof ChatThreadPrimitive
> {
  className?: string
}

export function ChatThread({ className, ...props }: ChatThreadProps) {
  return (
    <ChatThreadPrimitive
      className={cn(
        'flex-1 overflow-y-auto p-4 [&_[data-slot=chat-message-root]+[data-slot=chat-message-root]]:mt-3',
        className,
      )}
      {...props}
    />
  )
}

export interface ChatMessageProps extends ComponentProps<
  typeof ChatMessagePrimitive
> {
  className?: string
}

export function ChatMessage({ className, ...props }: ChatMessageProps) {
  return (
    <ChatMessagePrimitive
      className={cn(
        'rounded-[var(--zeus-radius-md)] border border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-card))] p-3 text-sm',
        className,
      )}
      {...props}
    />
  )
}

export interface ChatComposerProps extends ComponentProps<
  typeof ChatComposerPrimitive
> {
  className?: string
}

export function ChatComposer({ className, ...props }: ChatComposerProps) {
  return (
    <ChatComposerPrimitive
      className={cn(
        'border-t border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-background))] p-3',
        className,
      )}
      {...props}
    />
  )
}
