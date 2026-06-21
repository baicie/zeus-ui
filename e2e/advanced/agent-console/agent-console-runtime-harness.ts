import type {
  AgentConsoleArtifact,
  AgentConsoleArtifactSelectDetail,
  AgentConsoleElement,
  AgentConsoleEventDetail,
  AgentConsoleMessage,
  AgentConsoleResetDetail,
  AgentConsoleStatusChangeDetail,
} from '../../../packages/advanced/agent-console/src'

import { AgentConsole } from '../../../packages/advanced/agent-console/src'

export const runtimeMessages: AgentConsoleMessage[] = [
  {
    id: 'm1',
    role: 'system',
    content: 'Runtime harness ready.',
    status: 'complete',
    createdAt: 1,
    updatedAt: 1,
  },
]

export const runtimeArtifacts: AgentConsoleArtifact[] = [
  {
    id: 'a1',
    kind: 'json',
    title: 'Initial artifact',
    content: { ok: true },
    createdAt: 2,
    updatedAt: 2,
  },
]

export interface EventCollector<T> {
  events: CustomEvent<T>[]
  dispose: () => void
}

export function defineAgentConsoleElement(): void {
  if (!customElements.get('zw-agent-console')) {
    customElements.define('zw-agent-console', AgentConsole)
  }
}

export async function nextFrame(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()

  await new Promise<void>(resolve => {
    setTimeout(resolve, 0)
  })

  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve())
    })
  }
}

export async function mountAgentConsole(
  options: {
    messages?: AgentConsoleMessage[]
    artifacts?: AgentConsoleArtifact[]
    status?: 'idle' | 'running' | 'waiting' | 'complete' | 'error'
    maxEvents?: number
  } = {},
): Promise<AgentConsoleElement> {
  defineAgentConsoleElement()

  const element = document.createElement(
    'zw-agent-console',
  ) as AgentConsoleElement

  element.messages = options.messages ?? runtimeMessages
  element.artifacts = options.artifacts ?? runtimeArtifacts
  element.status = options.status ?? 'idle'
  element.maxEvents = options.maxEvents
  element.setAttribute('aria-label', 'Agent console runtime')

  document.body.append(element)

  await customElements.whenDefined('zw-agent-console')
  await nextFrame()

  return element
}

export function collectEvents<T>(
  target: EventTarget,
  type: string,
): EventCollector<T> {
  const events: CustomEvent<T>[] = []

  const listener = (event: Event) => {
    events.push(event as CustomEvent<T>)
  }

  target.addEventListener(type, listener)

  return {
    events,
    dispose() {
      target.removeEventListener(type, listener)
    },
  }
}

export function cleanupAgentConsoleFixtures(): void {
  document.body.innerHTML = ''
}

export type {
  AgentConsoleEventDetail,
  AgentConsoleStatusChangeDetail,
  AgentConsoleArtifactSelectDetail,
  AgentConsoleResetDetail,
}
