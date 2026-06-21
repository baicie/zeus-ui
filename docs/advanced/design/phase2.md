# Phase 2：`@zeus-web/chat` Headless Chat 组件族

## 目标

Phase 2 负责实现 `@zeus-web/chat` 的 headless 能力层，使 Zeus UI 拥有可跨 Native Web Component、React、Vue 使用的 Chat 组件族。

本阶段只实现结构、状态、事件、方法、slots、parts、core 状态模型和单元测试。

```txt
packages/advanced/chat
  @zeus-web/chat
```

## 非目标

本阶段不做：

1. 不接入任何模型服务（OpenAI / DeepSeek / Anthropic 等）。
2. 不实现请求层、鉴权层或会话持久化。
3. 不实现 registry styled source。
4. 不实现 `@zeus-web/ui/chat` 默认样式入口。
5. 不实现 Markdown 渲染器。
6. 不实现代码高亮。
7. 不实现附件上传传输层。
8. 不集成 virtual thread。

## 包结构

```txt
packages/advanced/chat/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    core/
      index.ts
      message-model.ts
      chat-store.ts
      composer-state.ts
      stream-buffer.ts
    components/
      chat.tsx
      chat-thread.tsx
      chat-message.tsx
      chat-composer.tsx
      chat-code-block.tsx
      chat-tool-call.tsx
      chat-artifact.tsx
      chat-typing.tsx
  __tests__/
    message-model.spec.ts
    chat-store.spec.ts
    composer-state.spec.ts
    stream-buffer.spec.ts
    chat-components.spec.ts
```

## 组件清单

| Tag                  | 职责                                                        |
| -------------------- | ----------------------------------------------------------- |
| `zw-chat`            | Chat 根容器。聚合 store 方法、emit 事件、转发到子组件事件。 |
| `zw-chat-thread`     | 消息滚动区域，承载虚拟滚动状态。                            |
| `zw-chat-message`    | 单条消息结构容器，可触发 message-action。                   |
| `zw-chat-composer`   | 输入区，处理输入、提交、IME 保护。                          |
| `zw-chat-code-block` | 代码块结构容器，可触发 code-action。                        |
| `zw-chat-tool-call`  | 工具调用结构容器。                                          |
| `zw-chat-artifact`   | Artifact / Canvas 结构容器，可触发 artifact-open。          |
| `zw-chat-typing`     | typing 状态提示。                                           |

## Core 模块

| 模块                | 职责                                |
| ------------------- | ----------------------------------- |
| `message-model.ts`  | 消息标准化、patch、parts 拼接。     |
| `chat-store.ts`     | 不依赖框架的消息 store。            |
| `composer-state.ts` | Composer value 与 attachment 状态。 |
| `stream-buffer.ts`  | 流式文本分帧合并。                  |

### Core 设计原则

1. **不可变**：所有 update 方法返回新数组，不修改入参。
2. **深拷贝克隆**：调用方持有 store 引用时无法通过返回值反向修改内部状态。
3. **降级兼容**：`ChatMessageData.content` 自动归一化为 text part；显式传入 `parts` 时优先使用 parts。
4. **流式合并**：`stream-buffer` 走 `requestAnimationFrame`，未提供时降级到 `setTimeout`，便于测试时注入 mock。
5. **IME 保护**：`shouldSubmitFromKeyboardEvent` 识别 `keyCode === 229` 和 `isComposing` 阻止误提交。

## 事件契约

每个事件都必须有稳定的触发路径：声明 emit 就必须有对应的 method 或上下文回调能 fire 该事件。

| 事件                | 触发方                         | 触发方法                                              |
| ------------------- | ------------------------------ | ----------------------------------------------------- |
| `send`              | `zw-chat` / `zw-chat-composer` | `chat.emitSend()` / composer 提交                     |
| `abort`             | `zw-chat`                      | `chat.emitAbort()`                                    |
| `regenerate`        | `zw-chat`                      | `chat.emitRegenerate(messageId)`                      |
| `message-action`    | `zw-chat` / `zw-chat-message`  | `chat.emitMessageAction()` / `message.emitAction()`   |
| `artifact-open`     | `zw-chat` / `zw-chat-artifact` | `chat.emitArtifactOpen()` / `artifact.openArtifact()` |
| `value-change`      | `zw-chat-composer`             | composer `input` 事件                                 |
| `attachment-change` | `zw-chat-composer`             | composer `clear` / 提交                               |
| `code-action`       | `zw-chat-code-block`           | `codeBlock.emitAction()`                              |

## 方法契约

每个组件暴露的方法必须能被 React / Vue wrapper 翻译为可调用的命令式 API。

### `zw-chat`

```txt
setMessages(messages: ChatMessageData[]): void
appendMessage(message: ChatMessageData): void
updateMessage(id: string, patch: Partial<ChatMessageData>): void
appendMessagePart(id: string, part: ChatMessagePart): void
clear(): void
getMessages(): NormalizedChatMessageData[]
scrollToBottom(options?: ScrollIntoViewOptions): void
emitSend(value, nativeEvent?, attachments?): void
emitAbort(detail?): void
emitRegenerate(messageId: string): void
emitMessageAction(detail: ChatMessageActionDetail): void
emitArtifactOpen(detail: ChatArtifactOpenDetail): void
```

`setMessages` 用于属性变更时同步外部 `props.messages` 到内部 store。

### `zw-chat-thread`

```txt
scrollToBottom(options?: ScrollIntoViewOptions): void
```

### `zw-chat-message`

```txt
emitAction(action: ChatMessageAction, nativeEvent?: Event): void
```

### `zw-chat-composer`

```txt
focus(): void
clear(): void
submit(): void
```

### `zw-chat-code-block`

```txt
emitAction(action: ChatCodeBlockAction, nativeEvent?: Event): void
```

### `zw-chat-artifact`

```txt
openArtifact(nativeEvent?: Event): void
```

## Props 契约

`zw-chat` props：

```txt
messages?: ChatMessageData[]   // 初始/外部消息，作为初始化来源；变更时调用 setMessages 同步
loading?: boolean
disabled?: boolean
autoScroll?: boolean            // 默认 true
virtual?: boolean
emptyText?: string
```

`autoScroll` 关闭后，所有 store 变更方法不再自动 scrollToBottom，但仍可通过 `scrollToBottom()` 命令式触发。

## Slots 契约

`zw-chat` slots：`header` / `sidebar` / `thread` / `empty` / `loading` / `artifact` / `composer`。

`zw-chat-message` slots：`avatar` / `header` / `default` / `footer` / `actions`。

`zw-chat-composer` slots：`prefix` / `attachments` / `submit` / `suffix`。

`zw-chat-code-block` slots：`filename` / `language` / `actions` / `default`。

`zw-chat-tool-call` slots：`summary` / `input` / `output` / `error` / `actions`。

`zw-chat-artifact` slots：`header` / `default` / `footer` / `actions`。

`zw-chat-typing` slots：`default`（fallback 为 `props.text ?? 'Typing...'`）。

## 验收

```bash
pnpm --filter @zeus-web/chat check
pnpm --filter @zeus-web/chat test
pnpm --filter @zeus-web/chat build

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm release:plan
```

## 完成标准

Phase 2 合格标准：

```txt
1. @zeus-web/chat 可以独立 build
2. @zeus-web/chat 可以独立 test
3. core 单测覆盖消息模型、store、composer、stream buffer
4. component analyzer 能识别所有 Chat 组件
5. 每个组件都有稳定 tag / props / events / methods / slots / parts
6. 所有声明的事件都有可被触发的对应方法
7. 所有声明的方法都通过 component-analyzer 的方法签名分析
8. 不引入 provider 请求逻辑
9. 不引入 registry / ui 样式层
10. React / Vue wrapper 由 output 插件自动生成
```

## 下一阶段

```txt
Phase 3:
  chat registry source + @zeus-web/ui/chat + ai metadata + examples
```
