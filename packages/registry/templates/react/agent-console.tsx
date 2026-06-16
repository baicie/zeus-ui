import type {
  AgentConsoleArtifact,
  AgentConsoleDiagnostic,
  AgentConsoleMessage,
  AgentConsoleToolCall,
} from '@zeus-web/agent-console'

import type { ComponentProps } from 'react'

import { AgentConsole as AgentConsolePrimitive } from '@zeus-web/agent-console/react'

import { cn } from '@/lib/cn'

export interface AgentConsoleProps extends ComponentProps<
  typeof AgentConsolePrimitive
> {
  className?: string
  messages?: AgentConsoleMessage[]
  toolCalls?: AgentConsoleToolCall[]
  artifacts?: AgentConsoleArtifact[]
  diagnostics?: AgentConsoleDiagnostic[]
}

export const agentConsoleDemoMessages: AgentConsoleMessage[] = [
  {
    id: 'm1',
    role: 'system',
    content: 'Agent Console is running in local demo mode.',
    status: 'complete',
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'm2',
    role: 'assistant',
    content: 'This template does not connect to any LLM provider.',
    status: 'complete',
    createdAt: 2,
    updatedAt: 2,
  },
]

export const agentConsoleDemoArtifacts: AgentConsoleArtifact[] = [
  {
    id: 'a1',
    kind: 'json',
    title: 'Example artifact',
    content: {
      ok: true,
      provider: null,
    },
    createdAt: 3,
    updatedAt: 3,
  },
]

export function AgentConsole({
  className,
  messages = agentConsoleDemoMessages,
  artifacts = agentConsoleDemoArtifacts,
  status = 'idle',
  ...props
}: AgentConsoleProps) {
  return (
    <AgentConsolePrimitive
      className={cn(
        'grid min-h-96 gap-4 rounded-md border bg-background p-4 text-foreground',
        '[&_[data-slot=agent-console-layout]]:grid',
        '[&_[data-slot=agent-console-layout]]:grid-cols-[minmax(0,1fr)_20rem]',
        '[&_[data-slot=agent-console-layout]]:gap-4',
        '[&_[data-slot=agent-console-timeline]]:min-h-72',
        '[&_[data-slot=agent-console-timeline]]:rounded-md',
        '[&_[data-slot=agent-console-timeline]]:border',
        '[&_[data-slot=agent-console-timeline]]:p-3',
        '[&_[data-slot=agent-console-artifacts]]:rounded-md',
        '[&_[data-slot=agent-console-artifacts]]:border',
        '[&_[data-slot=agent-console-artifacts]]:p-3',
        className,
      )}
      messages={messages}
      artifacts={artifacts}
      status={status}
      ariaLabel="Agent console"
      {...props}
    >
      <div slot="timeline" className="space-y-3">
        {messages.map(message => (
          <article
            key={message.id}
            className="rounded-md border bg-muted/40 p-3 text-sm"
            data-role={message.role}
          >
            <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
              {message.role}
            </div>
            <div>{message.content}</div>
          </article>
        ))}
      </div>

      <div slot="tools" className="space-y-2 text-sm">
        <div className="font-medium">Tool calls</div>
        <div className="text-muted-foreground">No tool calls yet.</div>
      </div>

      <div slot="artifacts" className="space-y-2 text-sm">
        <div className="font-medium">Artifacts</div>
        {artifacts.map(artifact => (
          <div key={artifact.id} className="rounded-md border p-2">
            {artifact.title}
          </div>
        ))}
      </div>

      <div slot="diagnostics" className="space-y-2 text-sm">
        <div className="font-medium">Diagnostics</div>
        <div className="text-muted-foreground">No diagnostics.</div>
      </div>
    </AgentConsolePrimitive>
  )
}

export function AgentConsoleDemo() {
  return <AgentConsole />
}
