<script setup lang="ts">
import type {
  AgentConsoleArtifact,
  AgentConsoleDiagnostic,
  AgentConsoleMessage,
  AgentConsoleStatus,
  AgentConsoleToolCall,
} from '@zeus-web/agent-console'

import { AgentConsole as AgentConsolePrimitive } from '@zeus-web/agent-console/vue'

import { computed } from 'vue'

import { cn } from '@/lib/cn'

const props = withDefaults(
  defineProps<{
    class?: string
    status?: AgentConsoleStatus
    messages?: AgentConsoleMessage[]
    toolCalls?: AgentConsoleToolCall[]
    artifacts?: AgentConsoleArtifact[]
    diagnostics?: AgentConsoleDiagnostic[]
  }>(),
  {
    status: 'idle',
  },
)

const demoMessages: AgentConsoleMessage[] = [
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

const demoArtifacts: AgentConsoleArtifact[] = [
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

const messages = computed(() => props.messages ?? demoMessages)
const artifacts = computed(() => props.artifacts ?? demoArtifacts)

const consoleClass = computed(() =>
  cn(
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
    props.class,
  ),
)
</script>

<template>
  <AgentConsolePrimitive
    :class="consoleClass"
    :messages="messages"
    :artifacts="artifacts"
    :status="props.status"
    aria-label="Agent console"
  >
    <template #timeline>
      <div class="space-y-3">
        <article
          v-for="message in messages"
          :key="message.id"
          class="rounded-md border bg-muted/40 p-3 text-sm"
          :data-role="message.role"
        >
          <div class="mb-1 text-xs font-medium uppercase text-muted-foreground">
            {{ message.role }}
          </div>
          <div>{{ message.content }}</div>
        </article>
      </div>
    </template>

    <template #tools>
      <div class="space-y-2 text-sm">
        <div class="font-medium">Tool calls</div>
        <div class="text-muted-foreground">No tool calls yet.</div>
      </div>
    </template>

    <template #artifacts>
      <div class="space-y-2 text-sm">
        <div class="font-medium">Artifacts</div>
        <div
          v-for="artifact in artifacts"
          :key="artifact.id"
          class="rounded-md border p-2"
        >
          {{ artifact.title }}
        </div>
      </div>
    </template>

    <template #diagnostics>
      <div class="space-y-2 text-sm">
        <div class="font-medium">Diagnostics</div>
        <div class="text-muted-foreground">No diagnostics.</div>
      </div>
    </template>
  </AgentConsolePrimitive>
</template>
