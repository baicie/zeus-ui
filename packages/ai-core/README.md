# `@zeus-web/ai-core`

Zeus AI Headless V2 的领域、协议与规范化 Store 层。**纯 TypeScript，零 DOM / React / Vue / 网络 SDK 依赖**，Node、浏览器、Worker 与 SSR 环境使用同一份代码。

## 状态

- 包状态：**Proposed / 实验性**，`private`，未进入发布计划。完整任务状态见 [implementation-status.md](../../docs/ai-headless-v2/implementation-status.md)。
- 内容：领域类型与状态机、Command/Ack 幂等、DomainEvent 校验与兼容策略、规范化 Store（持久化 `EntityMap` 集合）、seq 去重 / 乱序 / gap / 快照恢复、细粒度选择器与投影、全部 Headless 控制器（Session、Composer、Conversation、Streaming text、Timeline、Execution、Approval、Run switcher、Workspace、Review、ChangeSet actions、Test report、Artifacts）、Diff 解析、Mock / Replay Host 与 S1/S2/S3 fixture、V1 单向导入。
- 渲染层在 `@zeus-web/ai-primitives` 与 `ai-react` / `ai-vue` / `ai-wc`；传输在 `@zeus-web/ai-adapters`。

## 分层

| 目录              | 内容                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain`      | Conversation / Message / Part、Execution / Step / Tool、Approval、Asset / Artifact / ChangeSet / Workspace 类型；审批与执行状态机 |
| `src/protocol`    | `DomainEvent` 信封与校验、`Command` / `CommandAck`、幂等追踪                                                                      |
| `src/store`       | 规范化 `AiState`、按事件 Reducer、Selector、seq 排序与恢复、快照                                                                  |
| `src/host`        | `AiHostAdapter` 边界、事件工厂、Mock Host、Replay Host、S1/S2/S3 fixture                                                          |
| `src/controllers` | Headless 控制器：统一 `getSnapshot` / `subscribe(selector)` / `dispose`，只发 Command，不直接改事实                               |
| `src/diff`        | Unified diff 解析、稳定 hunk id、并排视图、分页                                                                                   |
| `src/legacy`      | V1 Chat / AgentConsole 单向导入（不伪造 seq / 审批 / 工具结果）                                                                   |

## 关键约束

- **Ack 不等于完成**：`accepted: true` 只表示 Host 受理意图，最终状态只来自领域事件。
- **审批是服务端权限决策**：前端状态、按钮禁用、本地角色都不是授权；`approved` 也只表示授权被记录，不代表副作用已执行。
- **不可静默丢事件**：重复 `seq` 去重；`seq > last+1` 时停止应用、报告 gap 并缓冲；跨 stream 事件直接拒绝。下一个 seq 若无法应用（Reducer 拒绝、越界、结构损坏、未知版本/类型），流进入 `desynced`，游标停在最后一条好事件，直到 `loadSnapshot` / `loadHostSnapshot` 恢复——既不跳号，也不无限重放。
- **重发实体不能绕过状态机**：`execution.started` / `step.upserted` / `changeset.updated` 等重发只能沿迁移表前进，终态不可复活；审批只能以 `pending` 创建，只由 `approval.resolved` 改状态，`scope` / `operation` 不可变。
- **作用域**：信封 `entity.id` 必须与 payload 实体一致；子实体必须引用同一流中已存在的父聚合；`createAiStore({ scope: { kind: 'conversation' | 'execution', id } })` 拒绝越界事件与快照（客户端纵深防御，鉴权仍在 Host）。
- **幂等**：Mock Host 对同一 `idempotencyKey` 最多执行一次，重试重放同一 Ack，键复用于不同命令返回 `AI_IDEMPOTENCY_KEY_REUSED`。
- **不制造万能 Message**：Conversation 与 Execution 是平级聚合；大对象一律走 `AssetRef`。
- **无全量克隆**：Reducer 只替换受影响实体，未触碰实体保持对象引用，细粒度订阅因此不会误触发。

## 用法

```ts
import {
  createAiStore,
  createReplayHost,
  createS1ChatScenario,
  selectConversationTimeline,
} from '@zeus-web/ai-core'

const store = createAiStore({ streamId: 'stream-s1' })
const host = createReplayHost(createS1ChatScenario().events)

for await (const event of host.subscribe('stream-s1', 0)) {
  store.ingest(event)
}

const timeline = selectConversationTimeline(store.getState(), 'conv-s1')
```

`createMockHost()` 用于开发期模拟：`execute` 返回 Ack，测试用 `emit` 追加权威事件，`seq` 严格递增。

## 验证

```bash
pnpm --filter @zeus-web/ai-core check
npx vitest --project unit --run packages/ai-core/__tests__
```

合同测试覆盖：状态机合法/非法迁移、Command 重试与幂等、事件校验与隔离、Reducer 引用稳定性、seq 重复/乱序/gap/快照、Selector 精准通知、S1/S2/S3 纯 Node 重放一致性与乱序收敛、零 DOM 依赖；以及 2026-10-27 复审的回归用例（[复审记录](../../docs/ai-headless-v2/review-2026-10-27-ai-core.md)）。
