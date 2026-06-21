import type {
  AgentConsoleElement,
  AgentConsoleMessage,
} from '@zeus-web/agent-console'

import '@zeus-web/agent-console/wc/auto'

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

export interface MountAgentConsoleDemoOptions {
  target: HTMLElement
  messages?: AgentConsoleMessage[]
}

export function mountAgentConsoleDemo(
  options: MountAgentConsoleDemoOptions,
): AgentConsoleElement {
  const consoleElement = document.createElement(
    'zw-agent-console',
  ) as AgentConsoleElement

  consoleElement.messages = options.messages ?? agentConsoleDemoMessages
  consoleElement.status = 'idle'
  consoleElement.setAttribute('aria-label', 'Agent console demo')

  consoleElement.addEventListener('agent-event', event => {
    consoleElement.dispatchEvent(
      new CustomEvent('agent-console-demo-event', {
        bubbles: true,
        composed: true,
        detail: (event as CustomEvent).detail,
      }),
    )
  })

  options.target.append(consoleElement)

  return consoleElement
}
