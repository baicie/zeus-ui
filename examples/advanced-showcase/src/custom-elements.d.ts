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
      'zw-data-grid': React.DetailedHTMLProps<
        React.HTMLAttributes<DataGridElement>,
        DataGridElement
      >
      'zw-chat': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatElement>,
        ChatElement
      >
      'zw-chat-message': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatMessageElement>,
        ChatMessageElement
      > & {
        'message-id'?: string
        role?: 'system' | 'user' | 'assistant' | 'tool'
        status?: 'idle' | 'streaming' | 'complete' | 'error' | 'aborted'
        selected?: boolean
        interactive?: boolean
      }
      'zw-chat-composer': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatComposerElement>,
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
      'zw-chat-code-block': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        filename?: string
        language?: string
        copied?: boolean
      }
      'zw-revogrid-adapter': React.DetailedHTMLProps<
        React.HTMLAttributes<RevoGridAdapterElement>,
        RevoGridAdapterElement
      >
      'zw-virtual-list': React.DetailedHTMLProps<
        React.HTMLAttributes<VirtualListElement>,
        VirtualListElement
      > & {
        count?: string
        'estimate-size'?: string
        overscan?: string
        horizontal?: boolean
      }
      'zw-agent-console': React.DetailedHTMLProps<
        React.HTMLAttributes<AgentConsoleElement>,
        AgentConsoleElement
      >
    }
  }
}
