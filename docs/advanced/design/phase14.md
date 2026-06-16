# Phase 14：Agent Console Foundation

## 目标

Phase 14 新增 `@zeus-web/agent-console` advanced 包，作为 Agent Console 的本地 headless foundation。

它只负责：

1. messages
2. tool calls
3. artifacts
4. diagnostics
5. status
6. event log
7. Web Component 协议

它不负责真实 LLM provider、网络请求、API key、SSE/WebSocket、tool executor。

## 非目标

1. 不接 OpenAI / Anthropic / DeepSeek。
2. 不读取 API key。
3. 不写 fetch。
4. 不写 SSE。
5. 不写 WebSocket。
6. 不执行真实 tool。
7. 不实现 markdown renderer。
8. 不实现 artifact preview。
9. 不接 registry product layer。

## 包结构

```txt
packages/advanced/agent-console/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    core/
      index.ts
      id.ts
      message-model.ts
      tool-call-model.ts
      artifact-model.ts
      diagnostic-model.ts
      event-log-model.ts
      console-state.ts
    components/
      agent-console.tsx
  __tests__/
    id.spec.ts
    message-model.spec.ts
    tool-call-model.spec.ts
    artifact-model.spec.ts
    diagnostic-model.spec.ts
    event-log-model.spec.ts
    console-state.spec.ts
    agent-console.spec.ts
```

## Web Component

标签：

```txt
zw-agent-console
```

### Props

```txt
status
messages
toolCalls
artifacts
diagnostics
selectedArtifactId
maxEvents
ariaLabel
```

### Events

```txt
agent-event
status-change
artifact-select
reset
```

### Methods

```txt
appendMessage(input)
updateMessage(input)
startToolCall(input)
finishToolCall(input)
addArtifact(input)
selectArtifact(artifactId)
addDiagnostic(input)
setStatus(status)
getState(options)
getEvents()
reset()
```

### Slots

```txt
timeline
tools
artifacts
diagnostics
```

### Parts

```txt
root
layout
timeline
tools
artifacts
diagnostics
```

## 状态模型

`AgentConsoleState` 包含：

```txt
status
messages
toolCalls
artifacts
diagnostics
events
selectedArtifactId
```

所有本地写操作都会更新 state，并在必要时追加 event log。

## Controlled / External Props

Phase 14 支持外部属性更新同步：

```txt
messages
toolCalls
artifacts
diagnostics
status
selectedArtifactId
maxEvents
```

组件内部通过 external signature 检测引用变化，并同步到本地 state。

## 安全边界

Phase 14 明确禁止：

```txt
fetch
EventSource
WebSocket
Authorization
Bearer
OPENAI_API_KEY
ANTHROPIC_API_KEY
DEEPSEEK_API_KEY
```

Provider adapter 应在后续阶段单独设计。

## 验收

```bash
pnpm --filter @zeus-web/agent-console check
pnpm --filter @zeus-web/agent-console test
pnpm --filter @zeus-web/agent-console build

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm release:plan
```
