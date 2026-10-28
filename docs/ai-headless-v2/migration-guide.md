# 从 V1 Chat / AgentConsole 迁移到 AI Headless V2（AI2-511）

> 状态：**Proposed**。V2 各包仍为 `private`，旧包 `@zeus-web/chat`、`@zeus-web/agent-console` 保持不变、继续可用（见 [legacy-decision.md](./legacy-decision.md)）。

## 1. 先理解差异

| V1                                                 | V2                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 组件内部持有状态，`setStatus` 等方法直接改 UI 状态 | 状态只来自 Host 事件；UI 只发 Command（意图）                                                                 |
| 一个消息数组承载对话、工具调用、产物               | Conversation / Message、Execution / Step / Tool、Approval、Artifact、ChangeSet 平级                           |
| Provider 是 `AsyncIterable<AgentProviderEvent>`    | `AiHostAdapter`：`execute`（Command → Ack）、`subscribe`（带 seq 的 DomainEvent）、`getSnapshot`、`loadAsset` |
| 发送后立即清空输入框                               | Ack 前保留草稿；只清除提交后未改动的部分                                                                      |
| 无序号、无去重、无断线恢复                         | 每个 stream 有 `seq`，重复去重、缺口重放、`desynced` 后快照恢复                                               |
| 审批是本地按钮                                     | 审批只能由 `approval.resolved` 事件决定；离线不会"假批准"                                                     |

## 2. 迁移步骤

1. **后端：实现 Host 协议。** 把 V1 provider 的事件流改为输出 `DomainEvent`（`schemaVersion: 2`、单调 `seq`、`entity` 与 payload id 一致），命令走 `execute`。现成传输：`@zeus-web/ai-adapters` 的 SSE / WebSocket 适配器，HTTP 与帧格式见其 README。
2. **前端：换成 Session + Controller。**
   ```ts
   const session = createAiSession({
     host,
     streamId,
     snapshotScope: { kind: 'conversation', id },
   })
   session.connect()
   const conversation = createConversationController({
     session,
     conversationId: id,
   })
   const composer = createComposerController({
     session,
     conversationId: id,
     parentMessageId: () => conversation.getSnapshot().leafMessageId,
   })
   ```
3. **渲染：按框架选适配器。** `@zeus-web/ai-react`、`@zeus-web/ai-vue` 或 `@zeus-web/ai-wc`（`zw-ai-*` 元素，数据只走 property）。三者渲染同一份视图，语义一致。
4. **历史数据：一次性导入（可选）。** 见下节。

## 3. 历史数据导入

```ts
import {
  createAiStore,
  importLegacyAgentRun,
  importLegacyChat,
} from '@zeus-web/ai-core'

const { snapshot, diagnostics } = importLegacyChat(v1Messages, {
  conversationId: 'conv-1',
})
const archive = createAiStore({ streamId: snapshot.streamId })
archive.loadSnapshot(snapshot)
```

导入是**单向、显式、保守**的：

| 规则                                                                            | 原因                                                             |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 结果是 `legacy:*` stream 的快照，**没有 cursor**                                | 不伪造 seq；导入数据不能被当作某个真实 stream 的位置，也不能重放 |
| 不创建任何 Approval；V1 的 `waiting` 映射为 `paused` 并给出诊断                 | 不伪造授权事实                                                   |
| V1 工具输出不导入（`tool-output-dropped`）                                      | V2 的工具结果只能通过 Host 授权的 Asset 引用                     |
| V1 产物保存为 `structured` 内容（schema `zeus.legacy-artifact/v1`），URL 不导入 | 未经验证的 URL 不能成为 Asset URI                                |
| 仍在流式中的消息 / 未结束的运行导入为 `cancelled`                               | 导入数据无法续流                                                 |
| 消息按 V1 顺序线性串成父子链                                                    | V1 没有分支；V2 的分支只能由 Host 产生                           |

每一项有损映射都会出现在 `diagnostics` 中（代码见 `LegacyDiagnosticCode`），建议在迁移脚本里记录并人工抽查。

## 4. 不提供的东西

- 不提供 V1 组件 API 的兼容层，也不提供"自动把 V1 provider 包装成 V2 Host"的适配器：V1 事件缺少 seq、命令回执与审批语义，包装只会制造假事实。
- 旧包不会被删除或改写；迁移按页面逐个进行即可。
