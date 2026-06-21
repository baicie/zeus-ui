下面把剩余路线一次性收尾为 **Phase 15–18**。前面已经到 `Phase 14：Agent Console Foundation`，所以剩余内容按这 4 步闭环：

```txt
Phase 15：Agent Console Product Layer
Phase 16：Agent Console Runtime Harness
Phase 17：Agent Provider Adapter Contract
Phase 18：Advanced Workspace Final Hardening / Release Contract
```

设计依据：当前 registry 已有 `chat`、`data-grid` 这种 native/react/vue 三端模板注册形态，`data-grid` 的 registry item 就是后续 product layer 的直接参考。 当前 AI 类型里 advanced component union 还只有 `chat | virtual | data-grid`，所以剩余阶段需要继续补 `revogrid-adapter`、`agent-console` 这类 advanced metadata。

---

# Phase 15：Agent Console Product Layer

## 1. 目标

```txt
1. 将 agent-console 接入 registry
2. 新增 native/react/vue 三端模板
3. 更新 registry package exports
4. 更新 AI metadata
5. 新增 agent-console product contract
6. 不接真实 provider
7. 不写 fetch / API key / Authorization / WebSocket / EventSource
```

---

## 2. 修改 `packages/registry/registry.json`

在 `data-grid` 或 `revogrid-adapter` 后追加：

```json
{
  "name": "agent-console",
  "type": "component",
  "description": "Headless agent console product template built on @zeus-web/agent-console. Provides a local foundation for messages, tool calls, artifacts, diagnostics and status without bundling any LLM provider.",
  "frameworks": ["native", "react", "vue"],
  "dependencies": ["@zeus-web/agent-console"],
  "registryDependencies": ["cn", "globals"],
  "files": [
    {
      "framework": "native",
      "source": "templates/native/agent-console.ts",
      "target": "components/agent-console.ts"
    },
    {
      "framework": "react",
      "source": "templates/react/agent-console.tsx",
      "target": "components/ui/agent-console.tsx"
    },
    {
      "framework": "vue",
      "source": "templates/vue/agent-console.vue",
      "target": "components/ui/agent-console.vue"
    }
  ]
}
```

---

## 3. 修改 `packages/registry/package.json`

在 `exports` 增加：

```json
{
  "./templates/native/agent-console.ts": "./dist/templates/native/agent-console.ts",
  "./templates/react/agent-console.tsx": "./dist/templates/react/agent-console.tsx",
  "./templates/vue/agent-console.vue": "./dist/templates/vue/agent-console.vue"
}
```

---

## 4. 新增 `packages/registry/templates/native/agent-console.ts`

```ts
import '@zeus-web/agent-console/wc/auto'

import type {
  AgentConsoleElement,
  AgentConsoleMessage,
} from '@zeus-web/agent-console'

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
```

---

## 5. 新增 `packages/registry/templates/react/agent-console.tsx`

```tsx
import type { ComponentProps } from 'react'

import type {
  AgentConsoleArtifact,
  AgentConsoleDiagnostic,
  AgentConsoleMessage,
  AgentConsoleToolCall,
} from '@zeus-web/agent-console'

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
```

---

## 6. 新增 `packages/registry/templates/vue/agent-console.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'

import type {
  AgentConsoleArtifact,
  AgentConsoleDiagnostic,
  AgentConsoleMessage,
  AgentConsoleStatus,
  AgentConsoleToolCall,
} from '@zeus-web/agent-console'

import { AgentConsole as AgentConsolePrimitive } from '@zeus-web/agent-console/vue'

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
    <div slot="timeline" class="space-y-3">
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

    <div slot="tools" class="space-y-2 text-sm">
      <div class="font-medium">Tool calls</div>
      <div class="text-muted-foreground">No tool calls yet.</div>
    </div>

    <div slot="artifacts" class="space-y-2 text-sm">
      <div class="font-medium">Artifacts</div>
      <div
        v-for="artifact in artifacts"
        :key="artifact.id"
        class="rounded-md border p-2"
      >
        {{ artifact.title }}
      </div>
    </div>

    <div slot="diagnostics" class="space-y-2 text-sm">
      <div class="font-medium">Diagnostics</div>
      <div class="text-muted-foreground">No diagnostics.</div>
    </div>
  </AgentConsolePrimitive>
</template>
```

---

## 7. 修改 `packages/registry/__tests__/registry-package.spec.ts`

追加：

```ts
it('registers agent-console across native/react/vue with safe templates', () => {
  const manifest = readManifest()
  const agentConsole = findRegistryItem(manifest, 'agent-console')

  expect(agentConsole).toBeTruthy()
  expect(agentConsole?.dependencies).toEqual(['@zeus-web/agent-console'])
  expect(agentConsole?.frameworks).toEqual(
    expect.arrayContaining(['native', 'react', 'vue']),
  )

  expect(agentConsole?.files).toEqual(
    expect.arrayContaining([
      {
        framework: 'native',
        source: 'templates/native/agent-console.ts',
        target: 'components/agent-console.ts',
      },
      {
        framework: 'react',
        source: 'templates/react/agent-console.tsx',
        target: 'components/ui/agent-console.tsx',
      },
      {
        framework: 'vue',
        source: 'templates/vue/agent-console.vue',
        target: 'components/ui/agent-console.vue',
      },
    ]),
  )

  const nativeSource = read('templates/native/agent-console.ts')
  const reactSource = read('templates/react/agent-console.tsx')
  const vueSource = read('templates/vue/agent-console.vue')

  expect(nativeSource).toContain("import '@zeus-web/agent-console/wc/auto'")
  expect(nativeSource).toContain("from '@zeus-web/agent-console'")
  expect(nativeSource).toContain('mountAgentConsoleDemo')
  expect(nativeSource).toContain('zw-agent-console')

  expect(reactSource).toContain('@zeus-web/agent-console/react')
  expect(reactSource).toContain("from '@zeus-web/agent-console'")
  expect(reactSource).toContain("import { cn } from '@/lib/cn'")
  expect(reactSource).toContain('AgentConsolePrimitive')
  expect(reactSource).toContain('AgentConsoleDemo')

  expect(vueSource).toContain('@zeus-web/agent-console/vue')
  expect(vueSource).toContain("from '@zeus-web/agent-console'")
  expect(vueSource).toContain("import { cn } from '@/lib/cn'")
  expect(vueSource).toContain('AgentConsolePrimitive')

  for (const source of [nativeSource, reactSource, vueSource]) {
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('EventSource')
    expect(source).not.toContain('WebSocket')
    expect(source).not.toContain('Authorization')
    expect(source).not.toContain('Bearer')
    expect(source).not.toContain('OPENAI_API_KEY')
    expect(source).not.toContain('ANTHROPIC_API_KEY')
    expect(source).not.toContain('DEEPSEEK_API_KEY')
  }
})
```

---

## 8. 修改 `packages/ai/src/types.ts`

```ts
export type ZeusWebAiAdvancedComponentName =
  | 'chat'
  | 'virtual'
  | 'data-grid'
  | 'revogrid-adapter'
  | 'agent-console'
```

---

## 9. 修改 `packages/ai/src/metadata.ts`

在 `aiMetadata.advancedComponents` 里追加：

```ts
{
  name: 'agent-console',
  packageName: '@zeus-web/agent-console',
  category: 'advanced',
  summary:
    'Headless agent console foundation for messages, tool calls, artifacts, diagnostics and local status state.',
  whenToUse: [
    'Use when building an AI assistant console UI.',
    'Use when you need a local state model for messages, tool calls, artifacts and diagnostics.',
    'Use before adding a real provider adapter.',
  ],
  doNotUseFor: [
    'Do not use as a direct OpenAI/Anthropic/DeepSeek client.',
    'Do not use when you only need a basic chat transcript.',
    'Do not put API keys or network transport inside templates.',
  ],
  tags: ['agent', 'console', 'chat', 'tools', 'artifacts', 'diagnostics'],
  components: ['zw-agent-console'],
  slots: {
    'zw-agent-console': ['timeline', 'tools', 'artifacts', 'diagnostics'],
  },
  events: {
    'zw-agent-console': [
      'agent-event',
      'status-change',
      'artifact-select',
      'reset',
    ],
  },
  methods: {
    'zw-agent-console': [
      'appendMessage',
      'updateMessage',
      'startToolCall',
      'finishToolCall',
      'addArtifact',
      'selectArtifact',
      'addDiagnostic',
      'setStatus',
      'getState',
      'getEvents',
      'reset',
    ],
  },
  examples: [
    {
      title: 'React styled usage',
      description: 'Use the registry template as a local styled shell.',
      code: [
        "import { AgentConsole } from '@/components/ui/agent-console'",
        '',
        'export function Example() {',
        '  return <AgentConsole />',
        '}',
      ].join('\n'),
    },
  ],
  promptHints: [
    'Generate local UI only.',
    'Do not add fetch, WebSocket, EventSource or provider SDK usage.',
    'Use appendMessage/startToolCall/addArtifact methods for local state transitions.',
  ],
}
```

---

## 10. 新增 `packages/ai/__tests__/agent-console-ai-metadata.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import { aiMetadata } from '../src/metadata'

describe('agent-console ai metadata', () => {
  const agentConsole = aiMetadata.advancedComponents.find(
    component => component.name === 'agent-console',
  )

  it('registers agent-console as advanced metadata', () => {
    expect(agentConsole).toBeTruthy()
    expect(agentConsole).toMatchObject({
      name: 'agent-console',
      packageName: '@zeus-web/agent-console',
      category: 'advanced',
    })
  })

  it('documents events and methods', () => {
    expect(agentConsole?.events['zw-agent-console']).toEqual(
      expect.arrayContaining([
        'agent-event',
        'status-change',
        'artifact-select',
        'reset',
      ]),
    )

    expect(agentConsole?.methods['zw-agent-console']).toEqual(
      expect.arrayContaining([
        'appendMessage',
        'startToolCall',
        'finishToolCall',
        'addArtifact',
        'setStatus',
        'getState',
      ]),
    )
  })

  it('keeps provider and network logic out of hints', () => {
    const text = JSON.stringify(agentConsole)

    expect(text).toContain('Do not add fetch')
    expect(text).not.toContain('OPENAI_API_KEY')
    expect(text).not.toContain('ANTHROPIC_API_KEY')
    expect(text).not.toContain('DEEPSEEK_API_KEY')
  })
})
```

---

## 11. 新增 `scripts/checks/contract/check-agent-console-product-contract.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface RegistryFile {
  framework: string
  source: string
  target: string
}

interface RegistryItem {
  name: string
  type: string
  frameworks: string[]
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

interface RegistryManifest {
  items: RegistryItem[]
}

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../..')

function read(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`[agent-console-product-contract] ${message}`)
  }
}

function assertContains(source: string, value: string, label: string): void {
  assert(
    source.includes(value),
    `${label} must contain ${JSON.stringify(value)}`,
  )
}

function assertNotContains(source: string, value: string, label: string): void {
  assert(
    !source.includes(value),
    `${label} must not contain ${JSON.stringify(value)}`,
  )
}

function readManifest(): RegistryManifest {
  return JSON.parse(read('packages/registry/registry.json')) as RegistryManifest
}

export function checkAgentConsoleProductContract(): void {
  const manifest = readManifest()
  const item = manifest.items.find(
    registryItem => registryItem.name === 'agent-console',
  )

  assert(item, 'registry.json must contain agent-console')
  assert(item?.type === 'component', 'agent-console must be a component')
  assert(
    JSON.stringify(item?.frameworks) ===
      JSON.stringify(['native', 'react', 'vue']),
    'agent-console frameworks must be native/react/vue',
  )
  assert(
    JSON.stringify(item?.dependencies) ===
      JSON.stringify(['@zeus-web/agent-console']),
    'agent-console dependency must be @zeus-web/agent-console',
  )
  assert(
    item?.registryDependencies.includes('cn'),
    'agent-console must depend on cn',
  )
  assert(
    item?.registryDependencies.includes('globals'),
    'agent-console must depend on globals',
  )

  const expectedFiles: RegistryFile[] = [
    {
      framework: 'native',
      source: 'templates/native/agent-console.ts',
      target: 'components/agent-console.ts',
    },
    {
      framework: 'react',
      source: 'templates/react/agent-console.tsx',
      target: 'components/ui/agent-console.tsx',
    },
    {
      framework: 'vue',
      source: 'templates/vue/agent-console.vue',
      target: 'components/ui/agent-console.vue',
    },
  ]

  for (const expectedFile of expectedFiles) {
    assert(
      item?.files.some(
        file =>
          file.framework === expectedFile.framework &&
          file.source === expectedFile.source &&
          file.target === expectedFile.target,
      ),
      `registry file missing ${expectedFile.source}`,
    )
  }

  const nativeSource = read(
    'packages/registry/templates/native/agent-console.ts',
  )
  const reactSource = read(
    'packages/registry/templates/react/agent-console.tsx',
  )
  const vueSource = read('packages/registry/templates/vue/agent-console.vue')

  assertContains(
    nativeSource,
    "import '@zeus-web/agent-console/wc/auto'",
    'native template',
  )
  assertContains(
    nativeSource,
    "from '@zeus-web/agent-console'",
    'native template',
  )
  assertContains(nativeSource, 'mountAgentConsoleDemo', 'native template')

  assertContains(reactSource, '@zeus-web/agent-console/react', 'react template')
  assertContains(
    reactSource,
    "from '@zeus-web/agent-console'",
    'react template',
  )
  assertContains(reactSource, "import { cn } from '@/lib/cn'", 'react template')

  assertContains(vueSource, '@zeus-web/agent-console/vue', 'vue template')
  assertContains(vueSource, "from '@zeus-web/agent-console'", 'vue template')
  assertContains(vueSource, "import { cn } from '@/lib/cn'", 'vue template')

  for (const [label, source] of [
    ['native template', nativeSource],
    ['react template', reactSource],
    ['vue template', vueSource],
  ] as const) {
    assertNotContains(source, 'fetch(', label)
    assertNotContains(source, 'EventSource', label)
    assertNotContains(source, 'WebSocket', label)
    assertNotContains(source, 'Authorization', label)
    assertNotContains(source, 'Bearer', label)
    assertNotContains(source, 'OPENAI_API_KEY', label)
    assertNotContains(source, 'ANTHROPIC_API_KEY', label)
    assertNotContains(source, 'DEEPSEEK_API_KEY', label)
  }
}

checkAgentConsoleProductContract()
```

---

# Phase 16：Agent Console Runtime Harness

## 1. 修改 `packages/advanced/agent-console/package.json`

把 scripts 改成：

```json
{
  "scripts": {
    "dev": "rolldown -c ../../../rolldown.config.ts --watch",
    "build": "rimraf dist && rolldown -c ../../../rolldown.config.ts",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "pnpm test:unit && pnpm test:e2e",
    "test:unit": "vitest --root ../../.. --project unit packages/advanced/agent-console/__tests__/id.spec.ts packages/advanced/agent-console/__tests__/message-model.spec.ts packages/advanced/agent-console/__tests__/tool-call-model.spec.ts packages/advanced/agent-console/__tests__/artifact-model.spec.ts packages/advanced/agent-console/__tests__/diagnostic-model.spec.ts packages/advanced/agent-console/__tests__/event-log-model.spec.ts packages/advanced/agent-console/__tests__/console-state.spec.ts packages/advanced/agent-console/__tests__/agent-console.spec.ts",
    "test:e2e": "vitest --root ../../.. --project e2e e2e/advanced/agent-console/agent-console-runtime.spec.ts"
  }
}
```

---

## 2. 新增 `e2e/advanced/agent-console/agent-console-runtime-harness.ts`

```ts
import type {
  AgentConsoleElement,
  AgentConsoleMessage,
  AgentConsoleArtifact,
  AgentConsoleEventDetail,
  AgentConsoleStatusChangeDetail,
  AgentConsoleArtifactSelectDetail,
  AgentConsoleResetDetail,
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
```

---

## 3. 新增 `e2e/advanced/agent-console/agent-console-runtime.spec.ts`

```ts
import { afterEach, describe, expect, it } from 'vitest'

import type {
  AgentConsoleArtifactSelectDetail,
  AgentConsoleEventDetail,
  AgentConsoleResetDetail,
  AgentConsoleStatusChangeDetail,
} from './agent-console-runtime-harness'

import {
  cleanupAgentConsoleFixtures,
  collectEvents,
  mountAgentConsole,
  nextFrame,
} from './agent-console-runtime-harness'

describe('zw-agent-console runtime', () => {
  afterEach(() => {
    cleanupAgentConsoleFixtures()
  })

  it('mounts and exposes runtime methods', async () => {
    const consoleElement = await mountAgentConsole()

    expect(consoleElement.tagName.toLowerCase()).toBe('zw-agent-console')
    expect(typeof consoleElement.appendMessage).toBe('function')
    expect(typeof consoleElement.startToolCall).toBe('function')
    expect(typeof consoleElement.addArtifact).toBe('function')
    expect(typeof consoleElement.getState).toBe('function')

    expect(consoleElement.getState().messages).toHaveLength(1)
    expect(consoleElement.getState().artifacts).toHaveLength(1)
  })

  it('appendMessage emits agent-event and updates state', async () => {
    const consoleElement = await mountAgentConsole()
    const collector = collectEvents<AgentConsoleEventDetail>(
      consoleElement,
      'agent-event',
    )

    const message = consoleElement.appendMessage({
      id: 'm2',
      role: 'assistant',
      content: 'Hello',
    })

    await nextFrame()

    expect(message.id).toBe('m2')
    expect(consoleElement.getState().messages).toHaveLength(2)
    expect(collector.events).toHaveLength(1)
    expect(collector.events[0].detail.event.type).toBe('message')
    expect(collector.events[0].detail.event.message?.content).toBe('Hello')

    collector.dispose()
  })

  it('updates messages', async () => {
    const consoleElement = await mountAgentConsole()

    consoleElement.appendMessage({
      id: 'm2',
      role: 'assistant',
      content: 'Draft',
      status: 'streaming',
    })

    consoleElement.updateMessage({
      id: 'm2',
      content: 'Final',
      status: 'complete',
    })

    await nextFrame()

    expect(
      consoleElement.getState().messages.find(message => message.id === 'm2'),
    ).toMatchObject({
      content: 'Final',
      status: 'complete',
    })
  })

  it('tracks tool calls', async () => {
    const consoleElement = await mountAgentConsole()
    const collector = collectEvents<AgentConsoleEventDetail>(
      consoleElement,
      'agent-event',
    )

    const toolId = consoleElement.startToolCall({
      id: 't1',
      name: 'search',
      input: { q: 'zeus' },
    })

    consoleElement.finishToolCall({
      id: toolId,
      output: { ok: true },
    })

    await nextFrame()

    expect(consoleElement.getState().toolCalls[0]).toMatchObject({
      id: 't1',
      status: 'complete',
      output: { ok: true },
    })

    expect(collector.events.map(event => event.detail.event.type)).toEqual([
      'tool-call',
      'tool-result',
    ])

    collector.dispose()
  })

  it('adds artifacts and selects them', async () => {
    const consoleElement = await mountAgentConsole()
    const collector = collectEvents<AgentConsoleArtifactSelectDetail>(
      consoleElement,
      'artifact-select',
    )

    const artifact = consoleElement.addArtifact({
      id: 'a2',
      kind: 'code',
      title: 'Generated code',
      content: 'console.log(1)',
    })

    expect(artifact.id).toBe('a2')

    const selected = consoleElement.selectArtifact('a2')

    await nextFrame()

    expect(selected?.id).toBe('a2')
    expect(consoleElement.selectedArtifactId).toBe('a2')
    expect(collector.events[0].detail.artifactId).toBe('a2')

    collector.dispose()
  })

  it('adds diagnostics', async () => {
    const consoleElement = await mountAgentConsole()

    consoleElement.addDiagnostic({
      id: 'd1',
      level: 'warning',
      message: 'Slow tool call',
      source: 'tool',
    })

    await nextFrame()

    expect(consoleElement.getState().diagnostics).toEqual([
      expect.objectContaining({
        id: 'd1',
        level: 'warning',
        message: 'Slow tool call',
      }),
    ])
  })

  it('emits status-change', async () => {
    const consoleElement = await mountAgentConsole()
    const collector = collectEvents<AgentConsoleStatusChangeDetail>(
      consoleElement,
      'status-change',
    )

    consoleElement.setStatus('running')

    await nextFrame()

    expect(consoleElement.status).toBe('running')
    expect(collector.events).toHaveLength(1)
    expect(collector.events[0].detail).toMatchObject({
      previousStatus: 'idle',
      status: 'running',
    })

    collector.dispose()
  })

  it('caps events by maxEvents', async () => {
    const consoleElement = await mountAgentConsole({
      maxEvents: 2,
    })

    consoleElement.appendMessage({
      id: 'm2',
      role: 'user',
      content: 'A',
    })
    consoleElement.appendMessage({
      id: 'm3',
      role: 'assistant',
      content: 'B',
    })
    consoleElement.appendMessage({
      id: 'm4',
      role: 'assistant',
      content: 'C',
    })

    await nextFrame()

    expect(consoleElement.getEvents().map(event => event.message?.id)).toEqual([
      'm3',
      'm4',
    ])
  })

  it('resets state and emits reset', async () => {
    const consoleElement = await mountAgentConsole()
    const collector = collectEvents<AgentConsoleResetDetail>(
      consoleElement,
      'reset',
    )

    consoleElement.appendMessage({
      id: 'm2',
      role: 'assistant',
      content: 'Hello',
    })

    consoleElement.reset()

    await nextFrame()

    expect(consoleElement.getState().messages).toHaveLength(0)
    expect(consoleElement.getState().events).toHaveLength(0)
    expect(collector.events).toHaveLength(1)

    collector.dispose()
  })
})
```

---

# Phase 17：Agent Provider Adapter Contract

## 1. 目标

Phase 17 只做 provider adapter **协议**，不做真实 provider：

```txt
1. 定义 provider adapter 接口
2. 定义 request / response / event 类型
3. 提供 mock adapter
4. 提供 replay adapter
5. 不写 fetch
6. 不依赖 OpenAI / Anthropic / DeepSeek SDK
7. 单测验证协议与 mock/replay 行为
```

---

## 2. 新增 `packages/advanced/agent-console/src/provider/types.ts`

```ts
import type {
  AgentConsoleArtifact,
  AgentConsoleDiagnostic,
  AgentConsoleMessage,
  AgentConsoleToolCall,
} from '../types'

export type AgentProviderEventType =
  | 'message'
  | 'message-delta'
  | 'tool-call'
  | 'tool-result'
  | 'artifact'
  | 'diagnostic'
  | 'status'
  | 'done'
  | 'error'

export interface AgentProviderRequest {
  input: string
  messages?: AgentConsoleMessage[]
  metadata?: Record<string, unknown>
}

export interface AgentProviderEvent {
  type: AgentProviderEventType
  message?: AgentConsoleMessage
  delta?: string
  toolCall?: AgentConsoleToolCall
  artifact?: AgentConsoleArtifact
  diagnostic?: AgentConsoleDiagnostic
  status?: 'idle' | 'running' | 'waiting' | 'complete' | 'error'
  error?: string
  metadata?: Record<string, unknown>
}

export interface AgentProviderRun {
  events: AsyncIterable<AgentProviderEvent>
  cancel: () => void
}

export interface AgentProviderAdapter {
  name: string
  run: (request: AgentProviderRequest) => AgentProviderRun
}
```

---

## 3. 新增 `packages/advanced/agent-console/src/provider/mock-provider.ts`

```ts
import type {
  AgentProviderAdapter,
  AgentProviderEvent,
  AgentProviderRequest,
  AgentProviderRun,
} from './types'

export interface CreateMockAgentProviderOptions {
  name?: string
  events?: AgentProviderEvent[]
}

async function* iterateEvents(
  events: AgentProviderEvent[],
  signal: { cancelled: boolean },
): AsyncIterable<AgentProviderEvent> {
  for (const event of events) {
    if (signal.cancelled) return

    await Promise.resolve()
    yield event
  }
}

export function createMockAgentProvider(
  options: CreateMockAgentProviderOptions = {},
): AgentProviderAdapter {
  const events = options.events ?? [
    {
      type: 'status',
      status: 'running',
    },
    {
      type: 'message',
      message: {
        id: 'mock-message',
        role: 'assistant',
        content: 'Mock provider response.',
        status: 'complete',
        createdAt: 1,
        updatedAt: 1,
      },
    },
    {
      type: 'done',
      status: 'complete',
    },
  ]

  return {
    name: options.name ?? 'mock',
    run(_request: AgentProviderRequest): AgentProviderRun {
      const signal = {
        cancelled: false,
      }

      return {
        events: iterateEvents(events, signal),
        cancel() {
          signal.cancelled = true
        },
      }
    },
  }
}
```

---

## 4. 新增 `packages/advanced/agent-console/src/provider/replay-provider.ts`

```ts
import type {
  AgentProviderAdapter,
  AgentProviderEvent,
  AgentProviderRequest,
  AgentProviderRun,
} from './types'

async function* replay(
  events: AgentProviderEvent[],
  signal: { cancelled: boolean },
): AsyncIterable<AgentProviderEvent> {
  for (const event of events) {
    if (signal.cancelled) return

    await Promise.resolve()
    yield event
  }
}

export function createReplayAgentProvider(
  name: string,
  events: AgentProviderEvent[],
): AgentProviderAdapter {
  return {
    name,
    run(_request: AgentProviderRequest): AgentProviderRun {
      const signal = {
        cancelled: false,
      }

      return {
        events: replay(events, signal),
        cancel() {
          signal.cancelled = true
        },
      }
    },
  }
}
```

---

## 5. 新增 `packages/advanced/agent-console/src/provider/index.ts`

```ts
export * from './mock-provider'
export * from './replay-provider'
export * from './types'
```

---

## 6. 修改 `packages/advanced/agent-console/src/index.ts`

追加：

```ts
export * from './provider'
```

---

## 7. 新增 `packages/advanced/agent-console/__tests__/provider-contract.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import {
  createMockAgentProvider,
  createReplayAgentProvider,
} from '../src/provider'

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []

  for await (const item of iterable) {
    result.push(item)
  }

  return result
}

describe('agent provider contract', () => {
  it('runs mock provider', async () => {
    const provider = createMockAgentProvider()

    expect(provider.name).toBe('mock')

    const run = provider.run({
      input: 'hello',
    })

    const events = await collect(run.events)

    expect(events.map(event => event.type)).toEqual([
      'status',
      'message',
      'done',
    ])
  })

  it('runs replay provider', async () => {
    const provider = createReplayAgentProvider('replay', [
      {
        type: 'status',
        status: 'running',
      },
      {
        type: 'done',
        status: 'complete',
      },
    ])

    const events = await collect(
      provider.run({
        input: 'x',
      }).events,
    )

    expect(events).toEqual([
      {
        type: 'status',
        status: 'running',
      },
      {
        type: 'done',
        status: 'complete',
      },
    ])
  })

  it('supports cancellation', async () => {
    const provider = createReplayAgentProvider('replay', [
      {
        type: 'status',
        status: 'running',
      },
      {
        type: 'message',
        message: {
          id: 'm1',
          role: 'assistant',
          content: 'after cancel',
          status: 'complete',
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ])

    const run = provider.run({
      input: 'x',
    })

    run.cancel()

    const events = await collect(run.events)

    expect(events).toEqual([])
  })

  it('does not expose network primitives in provider implementation', async () => {
    const provider = createMockAgentProvider()

    expect(JSON.stringify(provider)).not.toContain('fetch')
    expect(JSON.stringify(provider)).not.toContain('WebSocket')
    expect(JSON.stringify(provider)).not.toContain('EventSource')
  })
})
```

---

# Phase 18：Final Hardening / Release Contract

## 1. 新增 `scripts/checks/contract/check-advanced-final-contract.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../..')

const advancedPackages = [
  'virtual',
  'chat',
  'data-grid',
  'revogrid-adapter',
  'agent-console',
]

function read(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`[advanced-final-contract] ${message}`)
  }
}

function assertNotContains(source: string, value: string, label: string): void {
  assert(!source.includes(value), `${label} must not contain ${value}`)
}

export function checkAdvancedFinalContract(): void {
  const registry = read('packages/registry/registry.json')
  const aiTypes = read('packages/ai/src/types.ts')
  const aiMetadata = read('packages/ai/src/metadata.ts')

  for (const packageName of advancedPackages) {
    const packageJsonPath = `packages/advanced/${packageName}/package.json`
    const srcIndexPath = `packages/advanced/${packageName}/src/index.ts`
    const srcTypesPath = `packages/advanced/${packageName}/src/types.ts`

    assert(
      existsSync(resolve(workspaceRoot, packageJsonPath)),
      `${packageName} must have package.json`,
    )
    assert(
      existsSync(resolve(workspaceRoot, srcIndexPath)),
      `${packageName} must have src/index.ts`,
    )
    assert(
      existsSync(resolve(workspaceRoot, srcTypesPath)),
      `${packageName} must have src/types.ts`,
    )

    const packageJson = read(packageJsonPath)

    assert(packageJson.includes('"./wc"'), `${packageName} must export ./wc`)
    assert(
      packageJson.includes('"./wc/auto"'),
      `${packageName} must export ./wc/auto`,
    )
    assert(
      packageJson.includes('"./react"'),
      `${packageName} must export ./react`,
    )
    assert(packageJson.includes('"./vue"'), `${packageName} must export ./vue`)
  }

  for (const registryItem of [
    'chat',
    'data-grid',
    'revogrid-adapter',
    'agent-console',
  ]) {
    assert(
      registry.includes(`"name": "${registryItem}"`),
      `registry must include ${registryItem}`,
    )
  }

  for (const aiItem of [
    'chat',
    'virtual',
    'data-grid',
    'revogrid-adapter',
    'agent-console',
  ]) {
    assert(
      aiTypes.includes(`'${aiItem}'`) ||
        aiMetadata.includes(`name: '${aiItem}'`),
      `AI metadata/types must include ${aiItem}`,
    )
  }

  for (const source of [registry, aiTypes, aiMetadata]) {
    assertNotContains(source, 'OPENAI_API_KEY', 'advanced final source')
    assertNotContains(source, 'ANTHROPIC_API_KEY', 'advanced final source')
    assertNotContains(source, 'DEEPSEEK_API_KEY', 'advanced final source')
    assertNotContains(source, 'Authorization: Bearer', 'advanced final source')
  }
}

checkAdvancedFinalContract()
```

---

## 2. 新增 `scripts/checks/contract/__tests__/check-advanced-final-contract.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import { checkAdvancedFinalContract } from '../check-advanced-final-contract'

describe('advanced final contract', () => {
  it('passes final advanced contract', () => {
    expect(() => checkAdvancedFinalContract()).not.toThrow()
  })
})
```

---

## 3. 新增 `docs/advanced/roadmap.md`

````md
# Zeus Web Advanced Roadmap

## Completed Advanced Route

```txt
Phase 0  Advanced workspace / contract
Phase 1  Virtual foundation
Phase 2  Chat headless
Phase 3  Chat product layer
Phase 4  Chat virtual thread integration
Phase 5  DataGrid Lite
Phase 6  DataGrid product layer
Phase 7  DataGrid column resize + keyboard navigation
Phase 8  DataGrid controlled state hardening
Phase 9  DataGrid DOM runtime tests
Phase 10 DataGrid runtime hardening + accessibility
Phase 11 RevoGrid adapter / interop validation
Phase 12 RevoGrid adapter runtime harness
Phase 13 RevoGrid adapter product layer
Phase 14 Agent Console foundation
Phase 15 Agent Console product layer
Phase 16 Agent Console runtime harness
Phase 17 Agent provider adapter contract
Phase 18 Final hardening / release contract
```
````

## Boundary

Advanced packages are UI/runtime foundations.

They must not include:

```txt
API keys
real LLM provider SDKs
network transport
provider fetch logic
server credentials
```

Provider integrations should be added as explicit opt-in adapters outside the product templates.

## Advanced Packages

```txt
@zeus-web/virtual
@zeus-web/chat
@zeus-web/data-grid
@zeus-web/revogrid-adapter
@zeus-web/agent-console
```

## Release Checklist

```bash
pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm check:product-contract
pnpm check:advanced-final-contract
pnpm release:plan
```

````

---

## 4. 修改根 `package.json`

追加脚本：

```json
{
  "check:agent-console-product-contract": "tsx scripts/checks/contract/check-agent-console-product-contract.ts",
  "check:advanced-final-contract": "tsx scripts/checks/contract/check-advanced-final-contract.ts"
}
````

如果你有聚合脚本，更新为：

```json
{
  "check:product-contract": "pnpm check:chat-product-contract && pnpm check:data-grid-product-contract && pnpm check:revogrid-adapter-product-contract && pnpm check:agent-console-product-contract"
}
```

---

# 最终验收命令

```bash
pnpm --filter @zeus-web/agent-console check
pnpm --filter @zeus-web/agent-console test:unit
pnpm --filter @zeus-web/agent-console test:e2e
pnpm --filter @zeus-web/agent-console test
pnpm --filter @zeus-web/agent-console build

pnpm --filter @zeus-web/revogrid-adapter check
pnpm --filter @zeus-web/revogrid-adapter test
pnpm --filter @zeus-web/revogrid-adapter build

pnpm --filter @zeus-web/registry test
pnpm --filter @zeus-web/ai test

pnpm check:revogrid-adapter-product-contract
pnpm check:agent-console-product-contract
pnpm check:advanced-final-contract

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm check:product-contract
pnpm release:plan
```

---

# 收尾完成标准

```txt
1. revogrid-adapter 已有 runtime harness
2. agent-console 已有 product layer
3. agent-console 已有 runtime harness
4. agent-console provider contract 只定义协议和 mock/replay，不接真实 provider
5. registry 注册 chat / data-grid / revogrid-adapter / agent-console
6. AI metadata 注册 chat / virtual / data-grid / revogrid-adapter / agent-console
7. final contract 检查所有 advanced 包 exports / src/index.ts / src/types.ts
8. templates 不包含 fetch / EventSource / WebSocket / API key / Authorization / Bearer
9. release checklist 可以一键跑完
```

到这里，advanced workspace 的剩余内容就闭环了。后续不要再继续扩 DataGrid 或 Agent Console 的业务能力，下一步应该进入 **发布前真实 review + CI 修复 + 文档整理 + canary 验证**。
