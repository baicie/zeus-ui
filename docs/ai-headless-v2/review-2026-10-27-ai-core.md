# `@zeus-web/ai-core` 实现复审（2026-10-27）

> 复审对象：分支 `codex/ai-headless-v2-core`（`62bdf71`）上的 `packages/ai-core` 与 M0 文档。
> 复审基线：[审计报告](./audit-2026-10-27.md) 的 M1 验收建议，以及 `design-source/01-ARCHITECTURE.md` §5–§7、`03-IMPLEMENTATION-BACKLOG.md` M1 DoD、[threat-model.md](./threat-model.md) 中分配给「协议校验 / Store」层的防线。
> 方法：逐文件阅读源码与测试；对每个疑似缺陷先写最小复现脚本确认，再修复并补回归测试。

## 结论

复审前 51 项单测全绿，但审计报告要求的 M1 Gate 有 4 条实际没有满足：

| M1 Gate（审计报告「验收建议」）    | 复审前                                                                      | 复审后                                       |
| ---------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| 同一事件流得到同一 Canonical State | ✅                                                                          | ✅                                           |
| 重复事件不会重复应用               | ✅（seq 去重）；但 Mock Host 同一幂等键会执行两次                           | ✅                                           |
| 乱序和 Gap 有显式恢复结果          | ❌ 无法应用的事件：直接到达时流永久卡死，从缓冲区取出时被静默跳过           | ✅ 进入 `desynced`，要求快照恢复             |
| 不允许无 Host 认可的状态假成功     | ❌ `approval.requested` 可直接带 `approved`；`execution.started` 可复活终态 | ✅                                           |
| 跨会话 / 多租户事件被拒绝          | ❌ 只校验 `streamId`；信封 `entity.id` 与 payload 不绑定                    | ✅ id 绑定 + 可选 `scope` + 聚合内引用完整性 |

所有问题已修复。第一轮（F1–F12）新增 34 项回归测试，第二轮（F13–F19，见下文）再新增 13 项，均在 [`review-2026-10-27.spec.ts`](../../packages/ai-core/__tests__/review-2026-10-27.spec.ts)；`ai-core` 合同测试共 98 项，在 `unit` 与 `unit-jsdom` 两个 project 下均通过。

## 发现与修复

严重度：**P0** = 破坏安全边界或静默丢/改数据；**P1** = 违反 M1 DoD；**P2** = 健壮性。

| #   | 严重度 | 位置（复审前）                                  | 问题（已复现）                                                                                                                                                                                                           | 修复                                                                                                                                                                                         | 回归测试 |
| --- | ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F1  | P0     | `store/reducers.ts` `applyExecutionStarted`     | 已 `completed` 的执行收到更高 revision 的 `execution.started{status:'running'}` 后被复活；`step.upserted` / `tool.upserted` / `changeset.updated` 也能把终态改回进行中                                                   | 重发实体也必须走状态表；kind / conversationId / workspaceId 等关联字段不可变；新增 `domain/changeset.ts` 迁移表与 step/tool 终态判定；`message.completed` 终态之间不可互转                   | F1 ×5    |
| F2  | P0     | `store/reducers.ts` `applyApprovalRequested`    | `approval.requested` 可以直接创建 `status:'approved'` 的审批，绕过 `approval.resolved`；重发请求可把 `scope:'once'` 改成 `workspace`（T1-4、T3-1）                                                                       | 新审批必须是 `pending`；状态只能由 `approval.resolved` 改；`executionId / toolInvocationId / operation / scope` 请求后不可变；已决审批不能被再次请求                                         | F2 ×5    |
| F3  | P0     | `store/store.ts` `ingest` / `drainBuffered`     | 按序到达但 Reducer 拒绝的事件不推进游标，后续事件全部被报告为（假的）gap，重放同一 seq 永远失败；同样的事件若从缓冲区取出则被跳过并推进游标——静默丢消息                                                                  | 统一失败模型：无法应用的下一个 seq（Reducer 拒绝、越界、结构损坏、未知版本/类型）使流进入 `desynced`，游标停在最后一条好事件，后续事件只缓冲；`loadSnapshot` / `loadHostSnapshot` 恢复后续接 | F3 ×4    |
| F4  | P0     | `protocol/validation.ts`                        | 只检查 payload 键是否存在：`{message:null}` 让 `ingest` 抛 TypeError；信封 `entity.id` 与 payload 不绑定，发给会话 A 的事件可以写会话 B（T5-2）；变更路径不校验（T2-3）                                                  | 每类事件做结构校验（实体字段、枚举、part 唯一 id、delta 二选一）；新增 `entity-id-mismatch`；`ChangedFile.path/oldPath` 必须是不含 `..`、`~`、绝对路径、盘符与控制字符的相对路径             | F4 ×4    |
| F5  | P1     | `store/store.ts`、`store/reducers.ts`           | 无任何作用域约束：子实体可引用不存在的执行，消息可挂到别的会话的父消息下，审计要求的「跨会话事件被拒绝」没有实现                                                                                                         | 聚合内引用完整性（step/tool/approval/changeset 需要其 execution；message 需要其 conversation 与同会话父消息）；`createAiStore({ scope })` 可固定到一个会话或执行，越界事件与快照被拒绝       | F5 ×4    |
| F6  | P0     | `host/mock-host.ts`、`protocol/commands.ts`     | Mock Host 不做幂等：同一 `idempotencyKey` 执行两次、返回两个 `operationId`（T3-2）；追踪器在传输失败后键永远卡在 in-flight，淘汰时会丢掉 in-flight 条目，同键不同命令不报错                                              | Mock Host 校验命令并按键最多执行一次：重试重放同一 Ack，并发重复共享同一次尝试，键复用于不同命令返回 `AI_IDEMPOTENCY_KEY_REUSED`；追踪器新增 `release`、只淘汰已结算条目、按命令指纹判冲突   | F6 ×6    |
| F7  | P0     | `host/replay-host.ts`、`host/mock-host.ts`      | `getSnapshot` 返回「游标 = 最新 seq，state = 空」；客户端按它恢复会静默跳过所有事件；且 `HostSnapshotPayload` 无法载入 Store                                                                                             | 新增 `buildHostSnapshot`，由事件折叠出与游标一致的状态并附校验和，无法折叠时拒绝发布；新增 `snapshotFromHostPayload` 与 `store.loadHostSnapshot`；快照校验集合结构与信封游标一致性           | F7 ×3    |
| F8  | P1     | `store/selectors.ts`                            | `selectExecutionSteps` 读 `activeStepIds`，但没有 Reducer 维护它，结果恒为空；审批列表 selector 每次返回新数组，导致每个 token 都触发审批订阅（违反 AI2-109）；按 id 的模块级缓存永不释放（SSR 泄漏、跨 Store 持有实体） | 新增 `executionStepIds` 索引；`selectActiveExecutionSteps` 保留原语义；列表 memo 改为以状态自身数组/记录为键的 `WeakMap`；审批查询按 approvals 记录缓存；新增 `shallowArrayEqual`            | F8 ×2    |
| F9  | P2     | `store/store.ts` `commit`                       | 一个订阅者抛错会中断循环，其他视图收不到本次提交                                                                                                                                                                         | 隔离监听器异常并发出 `listener-error` 诊断                                                                                                                                                   | F8 ×1    |
| F10 | P2     | `domain/execution.ts`                           | 迁移表比设计多出 `awaiting-approval → paused`（`01-ARCHITECTURE.md` §6.1 无此边）                                                                                                                                        | 与设计对齐                                                                                                                                                                                   | 现有     |
| F11 | P2     | `store/store.ts`                                | `stream-mismatch` 拒绝不发诊断；校验失败诊断缺 `streamId/seq`                                                                                                                                                            | 补齐                                                                                                                                                                                         | —        |
| F12 | P2     | `__tests__/replay.spec.ts`、`selectors.spec.ts` | 重放测试创建了 Replay Host 却从未订阅它；审批 selector 测试因审批被拒而「空通过」                                                                                                                                        | 新测试真正走 `host.subscribe` 与 `getSnapshot`；审批测试先建执行，并断言请求后有 1 条待决                                                                                                    | F7、现有 |

## 第二轮复审（F13–F19）

第一轮修复合入工作区后，又对 `packages/ai-core` 全量重读了一遍。下面 7 个问题在第一轮修复后依然存在，均先用脚本复现。新增的 13 项测试里，12 项在第一轮修复后的代码上失败，修复后全部通过。另 1 项是正向用例：Host 由真实场景生成的快照必须仍能载入。

| #   | 严重度 | 位置（第一轮修复后）                         | 问题（已复现）                                                                                                                                                                                                       | 修复                                                                                                                                                                                               | 回归测试  |
| --- | ------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| F13 | P0     | `store/store.ts`、`store/snapshot.ts`        | Canonical State 直接引用调用方传入的事件与快照对象：`ingest` 后改事件 payload 会静默改写状态，订阅者收不到通知；`getState()` / `exportSnapshot()` 返回的对象可被就地修改。违反「同一事件流得到同一 Canonical State」 | 事件在进入缓冲或应用前、快照在校验时深拷贝并冻结（`internal/stable.ts` `freezeClone`）；Reducer 新建的记录、索引数组和实体都冻结；Store 冻结每次提交的顶层状态。只拷贝新进入的数据，不做全量深克隆 | F13 ×3    |
| F14 | P1     | `store/snapshot.ts`                          | 快照只检查集合是否为对象：`{messages:{m1:null}}`、实体存在错误的 key 下、子实体指向不存在的执行、选中叶子属于别的会话、索引漏列消息（时间线静默丢消息）都能通过                                                      | 新增 `store/integrity.ts`：实体结构复用事件校验器（`validateCanonicalEntity`），key 必须等于实体 id，引用完整性与 Reducer 规则一致，`conversationMessageIds` / `executionStepIds` 必须恰好各列一次 | F14 ×4    |
| F15 | P1     | `store/store.ts` `ingest`                    | 一个损坏的**未来** seq（例如 3）会立刻让流 `desynced`，之后到达的合法 seq 1、2 也只缓冲不应用                                                                                                                        | 只有损坏的帧正好是下一个 seq 时才立即停流；未来 seq 记为「中毒」，前面的合法事件照常应用，推进到该 seq 时才停流。同 seq 的另一份帧不视为修复，快照覆盖后清除                                       | F15 ×1    |
| F16 | P1     | `store/reducers.ts` `applyConversation`      | `selectedLeafMessageId` 可以指向别的会话的消息（T5-2）                                                                                                                                                               | 叶子必须是本会话已存在的消息                                                                                                                                                                       | F16–18 ×1 |
| F17 | P2     | `store/reducers.ts` `applyArtifact`          | 带 `executionId` 的产物可以挂到不存在的执行，与 step/tool/changeset 的规则不一致                                                                                                                                     | 有 `executionId` 时要求该执行已存在                                                                                                                                                                | F16–18 ×1 |
| F18 | P1     | `store/reducers.ts` `applyApprovalRequested` | 待决审批重发时可把 `risk` 从 `high` 降为 `low`，用户读到一半时提示的风险被换掉（T3-5）                                                                                                                               | `risk` 加入请求后不可变字段；Host 重新评估风险应发新的审批                                                                                                                                         | F16–18 ×1 |
| F19 | P2     | `host/mock-host.ts`                          | `onExecute` 同步重入、用同一幂等键再次 `execute` 时，in-flight 尝试尚未登记，同一键会执行两次；长订阅每次等待都往 `AbortSignal` 上挂一个监听器，从不移除                                                             | 在运行脚本前先登记 in-flight 尝试（脚本延后一个微任务）；`operationId` 在登记时确定；等待结束时移除 abort 监听器                                                                                   | F19 ×2    |

## 行为变化（对未来消费者可见）

`ai-core` 仍是 `private` 包，没有外部消费者，以下变化不需要迁移，但后续 Controller 需按新语义实现：

- `AiState` 新增 `executionStepIds`，快照校验和随之变化。
- 子实体必须在其父聚合之后到达（Host 本来就按 seq 控制顺序）；跨聚合的可选关联（message↔execution、execution↔conversation）不要求在同一流内。
- 无法应用的事件不再「拒绝后照常继续」，而是让流进入 `desynced`；`IngestResult` 新增 `desynced` 与 `recovery: 'snapshot-required'`，`AiStore` 新增 `getSyncState()` / `loadHostSnapshot()`。
- 追踪器的 `replay` Ack 使用本次重试的 `commandId`，`operationId` 不变；新增 `conflict` 决策。
- 执行状态机去掉 `awaiting-approval → paused`。
- （第二轮）`getState()`、`exportSnapshot()` 和订阅回调拿到的状态都是冻结的，就地修改在严格模式下抛 `TypeError`；Controller 必须通过 Command / 事件改变状态。
- （第二轮）快照必须通过实体结构与引用完整性校验，`validateSnapshot` 可能返回新的 `invalid-state` 原因。
- （第二轮）`conversation.selectedLeafMessageId` 必须在该消息之后下发；审批 `risk` 请求后不可变；带 `executionId` 的产物需要执行先到达。

## 已知限制（未在本轮处理）

- **未知事件类型同样会停流。** 在 AI2-112（协议兼容策略）定义「可安全跳过的前向兼容事件」之前，这是保守选择：宁可要求快照，也不静默跳号。
- **`scope` 是客户端纵深防御，不是授权。** 订阅与快照的租户/项目鉴权仍必须在 Host（T5-1、T5-4）。
- **Reducer 每次更新会浅拷贝一个集合的键表。** 实体本身不克隆、引用保持稳定；在 1 万条消息量级上每个 delta 是一次 O(n) 键复制。是否换成持久化结构留给 AI2-508 的性能基准决定，不在没有数据时预先优化。
- **审批列表在任一审批变化时重新计算。** 需要完全静默时，订阅方传 `shallowArrayEqual` 作为 `equal`。
- AI2-111（SSE/WebSocket adapter）、AI2-112 仍未开始；M2 及之后的任务不受本次复审影响。

## 验证

```bash
pnpm --filter @zeus-web/ai-core check            # tsc（包）
pnpm check                                       # tsc（仓库）
npx vitest run --project unit packages/ai-core/__tests__ scripts/checks/__tests__/release-workspace.spec.ts   # 103 passed
npx vitest run --project unit-jsdom packages/ai-core/__tests__                                               # 98 passed
pnpm --filter @zeus-web/ai-core build            # 含 DTS
npx eslint packages/ai-core && npx prettier --check packages/ai-core docs/ai-headless-v2
```
