import type { DetailedHTMLProps, HTMLAttributes } from 'react'

import type {
  AgentConsoleElement,
  ChatComposerElement,
  ChatElement,
  ChatMessageElement,
  DataGridElement,
  RevoGridAdapterElement,
  VirtualListElement,
} from './types'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'zw-data-grid': DetailedHTMLProps<
        HTMLAttributes<DataGridElement>,
        DataGridElement
      >
      'zw-chat': DetailedHTMLProps<HTMLAttributes<ChatElement>, ChatElement>
      'zw-chat-message': DetailedHTMLProps<
        HTMLAttributes<ChatMessageElement>,
        ChatMessageElement
      > & {
        'message-id'?: string
        role?: 'system' | 'user' | 'assistant' | 'tool'
        status?: 'idle' | 'streaming' | 'complete' | 'error' | 'aborted'
        selected?: boolean
        interactive?: boolean
      }
      'zw-chat-composer': DetailedHTMLProps<
        HTMLAttributes<ChatComposerElement>,
        ChatComposerElement
      > & {
        'default-value'?: string
        placeholder?: string
        disabled?: boolean
        loading?: boolean
        'submit-on-enter'?: boolean
        rows?: number
        'max-length'?: number
        'aria-label'?: string
      }
      'zw-chat-code-block': DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        filename?: string
        language?: string
        copied?: boolean
      }
      'zw-revogrid-adapter': DetailedHTMLProps<
        HTMLAttributes<RevoGridAdapterElement>,
        RevoGridAdapterElement
      >
      'zw-virtual-list': DetailedHTMLProps<
        HTMLAttributes<VirtualListElement>,
        VirtualListElement
      > & {
        count?: string
        'estimate-size'?: string
        overscan?: string
        horizontal?: boolean
      }
      'zw-agent-console': DetailedHTMLProps<
        HTMLAttributes<AgentConsoleElement>,
        AgentConsoleElement
      >
    }
  }
}
