# Product Stories — S1 / S2 / S3

> **任务：AI2-001（M0 · P0 · S）**
> 验收标准（`design-source/03-IMPLEMENTATION-BACKLOG.md` §M0）：**三个 E2E 用例有输入、事件、动作、终态定义**。
> **状态：Proposed（提案）** — 当前仓库**没有可运行的 V2 UI / 端到端实现**，本文档中的故事**不可执行**；`packages/ai-core` 只是实验性领域层（见 [README.md §0](./README.md#0-一句话结论) 时点快照）。相关 E2E 任务见文末追溯表。
> 术语：Conversation / Execution / Approval / ChangeSet / Command / DomainEvent / seq，含义见 [README.md §7](./README.md#glossary)。

---

## 0. 共同前提（三条故事共用）

### 0.1 故事不是 UI 脚本，是「Host 事实 + 用户意图」的序列

- 用户动作只能产生 **Command**；Command 的 `accepted: true` 只表示**受理**，不表示执行完成（`design-source/01-ARCHITECTURE.md` §7.3）。
- 只有 **DomainEvent** 能改变 Store 中的领域事实（§7.1、§7.2）；UI 可以标注乐观投影，但服务端事实优先（§3.3）。
- 每个 `streamId` 独立维护 `seq`，从 1 开始、服务端权威、单调递增；**不得用 `Date.now()` 或网络到达顺序冒充权威顺序**（§7.1）。

### 0.2 命名约定（避免把提议当既有）

| 类别     | 命名                                                                                                                                                                                                                                                        | 来源                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 事件类型 | `message.created`、`message.part.delta`、`message.completed`、`execution.started`、`execution.status.changed`、`step.upserted`、`tool.upserted`、`approval.requested`、`approval.resolved`、`artifact.published`、`changeset.updated`、`snapshot.available` | **原文枚举**（`01-ARCHITECTURE.md` §7.1 表格）                                  |
| 命令     | `execution.cancel`                                                                                                                                                                                                                                          | **原文**（`02-INTERACTION-SPEC.md` B4）                                         |
| 命令     | `approval.resolve`                                                                                                                                                                                                                                          | **原文**（`01-ARCHITECTURE.md` §7.3、§13.2）                                    |
| 命令     | `changeset.apply`                                                                                                                                                                                                                                           | **原文**（`01-ARCHITECTURE.md` §7.3）                                           |
| 命令     | `conversation.send`、`conversation.regenerate`、`conversation.fork`、`execution.resume`、`review.comment`                                                                                                                                                   | **本文件提议**（原文只描述意图，未给字符串名；语义见 `01` §3.3、`02` B2/B5/B6） |
| 事件类型 | `review.comment.upserted`（S3 评论持久化）                                                                                                                                                                                                                  | **本文件提议**（原文要求评论有 `commentId` 且不能只存在 DOM，`02` B6）          |

> 提议命名在 M1 落协议时统一（`AI2-105` Command Envelope、`AI2-106` DomainEvent Schema）；本文档**不主张**这些字符串已冻结。

### 0.3 断言点编号规则

断言点使用 `S<n>-A<m>` 编号，映射到交互规范的手工/E2E 脚本（`02-INTERACTION-SPEC.md` §F，记为 `F1..F12`）与质量门禁（`01-ARCHITECTURE.md` §17.3，记为 `G0..G6`）。

---

<a id="story-s1"></a>

## S1 · Conversational Research

> 原文定义（`01-ARCHITECTURE.md` §2.2）：「编辑输入 → 选择模型/上下文 → 添加附件 → 发送（返回接受确认） → 流式回答 → 查看引用与产物 → 停止/重新生成 → 编辑早期消息后创建分支；滚动时阅读位置不被流打断。」

### S1.1 前置输入

| 输入              | 值（Fixture 约定）                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Host              | 可信 Host + **Mock Adapter**（无真实模型；`01` §7.4 要求 Mock/Replay 是首批工具）                                                        |
| `streamId`        | `conv-1`                                                                                                                                 |
| 已有事实          | `Conversation{id:'conv-1', revision:2, selectedLeafMessageId:'m2'}`；`m1`(user, complete)、`m2`(assistant, complete) 各含 1 个 text part |
| cursor            | `cursors['conv-1'] = 2`                                                                                                                  |
| Host capabilities | `send`、`regenerate`、`branch`、`attachments`、`stop`（未声明者不允许呈现为可用动作，`01` §20-4）                                        |
| Composer 初始状态 | `{text:'', attachments:[], context:[], composing:false, submitState:'idle', draftRevision:0}`                                            |
| 用户              | 普通用户，中文输入法                                                                                                                     |

### S1.2 事件序列（权威事件，`seq` 从 3 起）

| seq | type                       | payload 关键字段                                                                     | 客户端期望                                           |
| --- | -------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 3   | `message.created`          | `message{id:'m3', author:'user', status:'complete', parentMessageId:'m2'}`           | 插入 Message + 索引；Conversation 可见叶子指向 m3    |
| 4   | `message.created`          | `message{id:'m4', author:'assistant', status:'streaming', executionId:'ex-1'}`       | 插入空 assistant 消息（不假设内容）                  |
| 5   | `execution.started`        | `execution{id:'ex-1', kind:'generation', conversationId:'conv-1', status:'running'}` | Execution 事实建立；`AiExecutionStatus` 可显示可停止 |
| 6   | `message.part.delta`       | `{messageId:'m4', partId:'p1', baseRevision:0, nextRevision:1, append:'Zeus'}`       | 仅更新该 part 文本                                   |
| …   | `message.part.delta` × N   | `baseRevision` 严格等于当前 revision                                                 | 逐段追加；重复 revision 丢弃；缺口进入恢复（§7.1）   |
| N+4 | `message.completed`        | `{messageId:'m4', revision:R, status:'complete'}`                                    | 终态；触发终态 flush                                 |
| N+5 | `artifact.published`       | `artifact{id:'a1', kind:'document', asset:{...}}`                                    | 产物可预览（安全 Renderer）                          |
| N+6 | `execution.status.changed` | `{id:'ex-1', from:'running', to:'completed', revision:r}`                            | Execution 收尾；**不由连接断开推断**（§7.2-6）       |

### S1.3 用户动作 → Command

| #   | 用户动作               | 产物                                     | 关键字段                                                                                   | 期望 Ack                                                                    |
| --- | ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 1   | 输入文字（含中文组字） | 本地 controller 状态                     | `text`、`composing`                                                                        | 无（不入 Store 事实）                                                       |
| 2   | 添加附件               | `AssetRef`（上传由 Host/Upload Adapter） | `asset.id`、`mimeType`、`size`                                                             | 无                                                                          |
| 3   | 选择模型/上下文        | `ContextSelection[]`                     | `kind:'file'\|'repository'\|'selection'\|'link'\|'custom'`、`id`、`label`                  | 无                                                                          |
| 4   | 发送                   | `conversation.send`（提议名）            | `idempotencyKey`、`expectedRevision:2`、`draftRevision`、`parts`、`attachments`、`context` | `accepted:true` + `operationId`；**不得**据此标记消息完成                   |
| 5   | 停止                   | `execution.cancel`（原文）               | `target:{kind:'execution', id:'ex-1'}`、`idempotencyKey`                                   | 受理后本地进入 `cancel-requested`                                           |
| 6   | 重新生成               | `conversation.regenerate`（提议名）      | `messageId:'m4'`、`idempotencyKey`                                                         | 受理；**新 Execution ID**，旧回答不删除                                     |
| 7   | 编辑早期消息并提交     | `conversation.fork`（提议名）            | `baseMessageId:'m1'`、新 parts、`idempotencyKey`                                           | 受理；默认策略 `fork-branch`，已有后续有效消息时**不得静默覆写**（`02` A1） |

### S1.4 最终状态（Store 断言）

| 断言                                            | 期望值                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `cursors['conv-1']`                             | `N+6`                                                                               |
| `conversations['conv-1'].selectedLeafMessageId` | `'m4'`（或分支后的新叶子）                                                          |
| `messages['m4'].status`                         | `complete`                                                                          |
| `messages['m4'].parts[0].text`                  | 等于事件 append 序列拼接结果（顺序 = seq 顺序，非到达顺序）                         |
| `executions['ex-1'].status`                     | `completed`                                                                         |
| Composer                                        | `submitState:'idle'`；仅当 `submittedRevision` 与提交时一致且用户未再输入时文本为空 |
| 幂等                                            | 同一 `idempotencyKey` 重发不产生第二条 `message.created`                            |

### S1.5 失败 / 恢复路径

| #   | 场景                                | 期望行为                                                                                                                 | 依据                     |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| 1   | 网络中断，`send` 无 Ack             | `submitState:'failed'` + `lastError`，**草稿不清空**；重试必须复用同一 `idempotencyKey`                                  | `01` §6.2、§7.3          |
| 2   | Ack 迟到 / 用户已继续输入           | Ack 只能清理**已提交版本**（按 `submittedRevision`），不得擦除新输入                                                     | `02` B1、F3              |
| 3   | 事件流 gap（`seq > lastApplied+1`） | 停止应用该 stream → 请求 `after=lastAppliedSeq` 重放；回放不可用则加载**经校验** Snapshot 后续接；**禁止静默跳过序号**   | `01` §7.2                |
| 4   | 附件上传失败                        | 默认不允许提交（除非产品显式允许 `deferred-asset`）；草稿保留                                                            | `02` B1、`01` §6.2       |
| 5   | 停止请求                            | UI 只进入 `cancel-requested`，`cancelled` 必须由 `execution.status.changed` 确认                                         | `02` B4                  |
| 6   | 生成失败                            | `message.completed{status:'failed'}` + `execution.status.changed→failed`；草稿保留；Retry = 新 Execution（带 `retryOf`） | `01` §6.1                |
| 7   | 切换 Conversation                   | 旧 subscription 正确 `dispose`；不取消已受理的后台任务（除非显式配置）                                                   | `01` §8.1、§11.1         |
| 8   | 未知 `schemaVersion` 事件           | 隔离并诊断，不猜测字段、不应用                                                                                           | `01` §17.1、`03` AI2-106 |

### S1.6 E2E 断言点

| ID     | 断言                                                                | 来源                         |
| ------ | ------------------------------------------------------------------- | ---------------------------- |
| S1-A1  | 中文拼音组字回车不发送、不误提交                                    | F1                           |
| S1-A2  | 连续提交同一条内容只产生一次幂等提交；编辑后新提交使用新 Key        | F2                           |
| S1-A3  | Ack 到达前继续输入，Ack 后新输入仍在                                | F3                           |
| S1-A4  | 阅读第 100 条历史时新增 500 token，阅读位置不变（`follow` 退出）    | F4                           |
| S1-A5  | 屏幕阅读器不逐 token 播报（`aria-live` 汇总）                       | F5                           |
| S1-A6  | 断线重连：Delta 不重复、不断档；gap 触发恢复并可见 `Replaying` 状态 | F8                           |
| S1-A7  | 编辑早期消息后：原分支消息仍可访问，新分支独立锚点                  | `01` §17.1 Conversation 用例 |
| S1-A8  | 纯 Core / Controller 在 Node `import` 不访问 DOM 全局               | F10、G1                      |
| S1-A9  | 同一 Fixture 在 WC / React / Vue 三端完成发送与滚动场景             | F11、G5                      |
| S1-A10 | 终态不依赖"连接断开"推断                                            | `01` §7.2-6                  |

---

<a id="story-s2"></a>

## S2 · Agent Supervision

> 原文定义（`01-ARCHITECTURE.md` §2.2）：「创建任务 → 排队 → 计划生成/修改 → 运行工具 → 请求敏感操作审批 → 用户审阅参数与权限范围 → 批准/拒绝 → 任务继续、失败或取消 → 展示可追溯结果。」

### S2.1 前置输入

| 输入              | 值                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| Host              | 可信 Host + Mock Adapter；`permission service` 决定审批                                          |
| `streamId`        | `exec-1`（与 Conversation stream 分离，跨 stream 不承诺全局排序，`01` §7.2-5）                   |
| 已有事实          | `Execution{id:'exec-1', kind:'agent', status:'queued', activeStepIds:[]}`；`cursors['exec-1']=0` |
| Host capabilities | `pause:false`（未支持则不展示 Pause，`02` B4）、`resume:true`、`cancel:true`、`approval:true`    |
| 审批策略          | `shell.exec` 需要审批，`scope:'once'`，`risk:'high'`，`expiresAt` 10 分钟                        |
| 安全环境          | 浏览器不可信；UI 无密钥、无执行权限（`01` §7.4）                                                 |

### S2.2 事件序列

| seq | type                       | payload 关键字段                                                                                                   | 客户端期望                                                   |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1   | `execution.started`        | `execution{status:'running'}`                                                                                      | 任务可见、可停止                                             |
| 2   | `step.upserted`            | `step{kind:'plan', status:'running', label:'Analyze repo'}`                                                        | 计划项出现（有稳定 ID）                                      |
| 3   | `step.upserted`            | `step{kind:'tool', status:'running', toolInvocationId:'ti-1'}`                                                     | 步骤嵌套关系可渲染                                           |
| 4   | `tool.upserted`            | `tool{id:'ti-1', toolName:'fs.read', status:'requested', inputPreview:{（脱敏+限长）}}`                            | 工具明细可展开；**不得**含原始密钥                           |
| 5   | `tool.upserted`            | `tool{id:'ti-1', status:'succeeded', resultAssetId:'as-1'}`                                                        | 结果按需加载                                                 |
| 6   | `execution.status.changed` | `{from:'running', to:'awaiting-approval', revision:r}`                                                             | 状态机校验通过                                               |
| 7   | `approval.requested`       | `approval{id:'ap-1', operation:{kind:'shell.exec', target:'workspace:abc'}, scope:'once', risk:'high', expiresAt}` | 稳定入口展示审批（不依赖滚动位置，`02` A2）                  |
| 8   | `approval.resolved`        | `{approvalId:'ap-1', decision:'approved', revision:r'}`                                                            | 服务端**已记录授权**；不等于命令已执行成功（`01` §5.2 注意） |
| 9   | `execution.status.changed` | `{from:'awaiting-approval', to:'running'}`                                                                         | 恢复执行                                                     |
| 10  | `step.upserted`            | `step{kind:'tool', label:'pnpm test'}` + `tool.upserted{status:'running'}`                                         | 工具进度                                                     |
| 11  | `tool.upserted`            | `{status:'succeeded'}`                                                                                             | 完成                                                         |
| 12  | `execution.status.changed` | `{to:'completed'}`                                                                                                 | 终态 + `outcome.summary`                                     |

### S2.3 用户动作 → Command

| #   | 用户动作     | 产物                                   | 关键字段                                                                                 | 备注                                                |
| --- | ------------ | -------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | 打开审批详情 | 本地 view state                        | `selectedStepId`                                                                         | 展开明细**不得**触发执行（`02` B2）                 |
| 2   | 批准         | `approval.resolve`（原文）             | `payload:{decision:'approved'}`、`target.approval`、`expectedRevision`、`idempotencyKey` | 首次点击后进入 `submitted` 并停用按钮（`01` §6.3）  |
| 3   | 拒绝         | `approval.resolve`                     | `decision:'rejected'`                                                                    | 拒绝后不得出现"已成功执行"（F7）                    |
| 4   | 停止任务     | `execution.cancel`（原文）             | `target.execution`                                                                       | 进入 `cancel-requested`                             |
| 5   | 暂停/恢复    | `pause` / `execution.resume`（提议名） | `target.execution`                                                                       | **仅当 capability 声明可用**才展示                  |
| 6   | 切换 Run     | 本地 view state                        | `selectedExecutionId`                                                                    | 切换**不得**停止任务，也**不得**放行审批（`02` A2） |
| 7   | 关闭审批面板 | 无 Command                             | —                                                                                        | 保持 `pending`，**不代表拒绝**（`02` B5）           |

### S2.4 最终状态

| 断言                          | 期望值                                                                     |
| ----------------------------- | -------------------------------------------------------------------------- |
| `executions['exec-1'].status` | `completed`                                                                |
| `approvals['ap-1'].status`    | `approved`（终态由 `approval.resolved` 驱动，非本地开关）                  |
| 步骤                          | 所有 `step` 处于终态；`activeStepIds` 为空                                 |
| 工具                          | `ti-1` 为 `succeeded`；`resultAssetId` 指向可鉴权加载的 Asset              |
| 审计                          | 审批的 `operation.target`、`scope`、`risk`、`expiresAt` 与最终结果均可回溯 |
| 幂等                          | 同一 `idempotencyKey` 的重复 `approval.resolve` 不产生第二次授权/执行      |

### S2.5 失败 / 恢复路径

| #   | 场景                 | 期望行为                                                                | 依据               |
| --- | -------------------- | ----------------------------------------------------------------------- | ------------------ |
| 1   | 两次点击批准         | 前端 `submitted` 拦截重复点击；后端用同一幂等键去重；不得二次执行       | `02` B5、F2        |
| 2   | 用户切到其它 Run     | 原审批仍存在于 `awaiting-approval`，能再次打开                          | `02` B5            |
| 3   | 审批过期             | `approval.resolved{decision:'expired'}` → UI `expired` 且**不可再提交** | `01` §6.3、`02` B5 |
| 4   | 服务端策略拒绝       | 显示 `error`，**不伪装成用户拒绝**                                      | `02` B5            |
| 5   | 断线后点击批准       | 无可信在线确认时保留可恢复/失败状态；**禁止离线假批准**                 | `02` B5、F7        |
| 6   | 高风险操作           | Host 可要求二次确认/输入确认语；原语可承载但**不可绕过**                | `02` B5            |
| 7   | 取消后的晚到工具事件 | 已 `cancelled` 的 Execution 不被晚到 `tool.upserted` 复活；终态不可逆   | `01` §17.1、F7     |
| 8   | gap / 重连           | 同上 S1.5-3；重连后审批状态以重放事件为准                               | `01` §7.2          |
| 9   | 同 stream 多个执行   | 每个 Execution 独立 cursor/未读；切换 Tab 不停止后台运行                | `01` §11.3         |

### S2.6 E2E 断言点

| ID    | 断言                                                  | 来源             |
| ----- | ----------------------------------------------------- | ---------------- |
| S2-A1 | 两个并发审批互不串线：批准 A 不影响 B 的 `pending`    | `02` A2、F6      |
| S2-A2 | 重复批准只执行一次（含重连后重放同一 Command）        | F2、`03` AI2-303 |
| S2-A3 | 拒绝后不出现"已成功执行"；晚到旧事件不能逆转终态      | F7               |
| S2-A4 | 过期审批不可提交（按钮与命令双拦截）                  | `01` §6.3        |
| S2-A5 | 离线点击批准不产生授权（无假批准）                    | `02` B5          |
| S2-A6 | Stop 只发 `execution.cancel`，UI 不自行置 `cancelled` | `02` B4          |
| S2-A7 | 工具明细默认脱敏，完整输出按需经鉴权 Loader 加载      | `01` §13.1-5     |
| S2-A8 | 4 个 Agent 并行：状态/审批/取消/事件不串线            | F6               |
| S2-A9 | "批准只是前端开关"= 不达标（门禁）                    | G3、`03` AI2-307 |

---

<a id="story-s3"></a>

## S3 · Coding Review

> 原文定义（`01-ARCHITECTURE.md` §2.2）：「指定项目、工作树和任务 → 并行任务执行 → 分别查看进度 → 比较文件变更 → 按文件/片段评论 → 查看测试 → 明确采纳/丢弃操作 → 服务端返回执行结果；**不直接在浏览器由 Diff 组件写磁盘**。」

### S3.1 前置输入

| 输入        | 值                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| 项目/工作区 | `Project{id:'proj-1'}`、`Workspace{id:'ws-1', kind:'worktree', repo:{id:'zeus-ui', ref:'feat/x'}, capabilities:['apply']}` |
| 并行执行    | `exec-1`、`exec-2` 同属 `ws-1`，各自 `streamId`                                                                            |
| 基线        | `ChangeSet{id:'cs-1', baseRevision:'abc123', status:'draft', files:[]}`                                                    |
| 测试数据    | `TestReport` 以 `Artifact` 形式提供（`kind:'document'`/`custom`），失败摘要可定位                                          |
| 安全环境    | 浏览器无写盘能力；`git apply` 只在 Host                                                                                    |

### S3.2 事件序列

| seq | type                              | payload 关键字段                                                                                               | 客户端期望                                 |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | `execution.started` ×2            | `exec-1`、`exec-2`                                                                                             | 两个 Run 可独立查看进度（`AiRunSwitcher`） |
| 2   | `changeset.updated`               | `{id:'cs-1', status:'ready', files:[ChangedFile{path:'src/a.ts', status:'modified', stats:{...}, diffAsset}]}` | 文件树 + 计数                              |
| 3   | `artifact.published`              | `artifact{kind:'document', title:'test-report', asset}`                                                        | 测试报告可打开                             |
| 4   | `step.upserted` / `tool.upserted` | 与 S2 同                                                                                                       | 步骤/工具明细                              |
| 5   | `changeset.updated`               | `{status:'applying'}`                                                                                          | 采纳进行中（不可重复提交 apply）           |
| 6   | `changeset.updated`               | `{status:'applied'}` 或 `{status:'conflicted'}`                                                                | 终态由 Host 决定                           |

### S3.3 用户动作 → Command

| #   | 用户动作             | 产物                                                         | 关键字段                                                                           | 备注                                                                 |
| --- | -------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | 选择项目/工作树      | 本地 view state                                              | —                                                                                  | 切换只改变可见上下文，不与运行中的 Executor 隐式绑定（`03` AI2-401） |
| 2   | 选择文件 / 选中 hunk | 本地 view state                                              | `selectedFileId`、`selectedHunkId`                                                 | 不可作为服务端业务命令字段（`02` A3）                                |
| 3   | 标记已读             | 本地审阅进度                                                 | `unreviewed → reviewing → reviewed`                                                | **不等于**批准应用（`01` §6.4）                                      |
| 4   | 评论                 | `review.comment`（提议名）                                   | `commentId`、`filePath`、`hunkId`、`body`、`baseRevision`                          | 评论必须持久化，不能只存在 DOM（`02` B6）                            |
| 5   | 请求修订             | `conversation.send`-like 或 `review.requestRevision`（提议） | `changesetId`、说明                                                                | 追加 Follow-up，不擅自改写执行中的历史输入（`02` G）                 |
| 6   | 丢弃草稿             | `changeset.reject`（提议名）                                 | `changesetId`、`expectedRevision`                                                  | 状态转 `rejected`                                                    |
| 7   | 采纳                 | `changeset.apply`（原文）                                    | `changesetId`、`baseRevision`、`workspaceId`、`expectedRevision`、`idempotencyKey` | **只有 Host 能写文件**                                               |

### S3.4 最终状态

| 断言                        | 期望值                                                                   |
| --------------------------- | ------------------------------------------------------------------------ |
| `changeSets['cs-1'].status` | `applied` 或 `conflicted`（由 Host 事件决定）                            |
| 工作树                      | 只有 Host 执行写盘；浏览器无文件系统副作用（G4 门禁）                    |
| 评论                        | 每条评论有稳定 `commentId` 与 `baseRevision`；版本变化后标记「可能过期」 |
| Apply 幂等                  | 同一 `idempotencyKey` 重复 apply 不重复落盘                              |
| 审阅进度                    | 本地状态，与服务端 `ChangeSet.status` **分开记录**                       |

### S3.5 失败 / 恢复路径

| #   | 场景                  | 期望行为                                                                | 依据                     |
| --- | --------------------- | ----------------------------------------------------------------------- | ------------------------ |
| 1   | `baseRevision` 已变   | Host 返回 `conflicted`，UI 展示差异并提示重新审阅；**绝不自动忽略冲突** | `02` A3、`03` AI2-405    |
| 2   | Diff 版本替换了 hunk  | 旧评论标记「可能过期」，不自动附着到不相干内容                          | `02` B6、F9              |
| 3   | 二进制文件            | 只显示元数据与预览/下载，不假装行级 Diff                                | `02` A3                  |
| 4   | 大 diff / 100k 行     | 分块 + 懒加载；定位某行允许加载片段（不阻塞交互）                       | `01` §15.1、`02` B6      |
| 5   | 采纳过程中断线        | 不假设成功；从事件/查询确认终态，重连后按 `seq` 续接                    | `01` §7.2-6、F8          |
| 6   | 无 `apply` capability | 不呈现采纳动作（能力缺失即不可用）                                      | `01` §20-4、`03` AI2-301 |
| 7   | 并行任务              | 两个 `exec-1`/`exec-2` 的 Stop/Approve 不串线                           | `02` A2、F6              |

### S3.6 E2E 断言点

| ID    | 断言                                                                 | 来源             |
| ----- | -------------------------------------------------------------------- | ---------------- |
| S3-A1 | 文件树可键盘导航（Treeview）、Diff 片段可键盘定位                    | `01` §14、F11    |
| S3-A2 | 评审进度与 apply 状态分离展示，互不替代                              | `01` §6.4        |
| S3-A3 | Diff 版本变化后评论显示过期提示                                      | F9               |
| S3-A4 | 采纳必须附 `ChangeSet ID + baseRevision + workspaceId`，由 Host 校验 | `02` B6          |
| S3-A5 | 冲突进入 `conflicted` 并可恢复，不静默覆盖                           | F9、`03` AI2-405 |
| S3-A6 | 浏览器不写盘（无 FS 副作用；以 Host 日志为准）                       | G4               |
| S3-A7 | 不可信 diff 文本不被拼成 HTML（`@@`/路径注入）                       | `01` §12         |

---

## 4. 追溯表（故事 → 设计原文 → 后续任务）

| 故事       | 设计原文                                                  | 后续实现/E2E 任务（`03-IMPLEMENTATION-BACKLOG.md`） |
| ---------- | --------------------------------------------------------- | --------------------------------------------------- |
| S1         | `01` §2.2、§6.2、§7.1-7.3、§11.1-11.2；`02` A1、B1-B3、§F | AI2-202/203/204/205/206/208/209/210/**211**         |
| S2         | `01` §5.2、§6.1、§6.3、§13；`02` A2、B4、B5               | AI2-301/302/303/304/305/306/**307**                 |
| S3         | `01` §5.2、§6.4、§12；`02` A3、B6                         | AI2-401/402/403/404/405/406/**407**                 |
| 断言点总闸 | `02` §F（F1-F12）；`01` §17.3（G0-G6）                    | AI2-505/506/507/508                                 |

### 4.1 与门禁的映射

| 门禁               | 对应本文档          | 含义                                           |
| ------------------ | ------------------- | ---------------------------------------------- |
| G0 Domain          | 全部 S1.2/S2.2/S3.2 | 事件 Fixture 可在纯 Node replay，无 DOM        |
| G1 Headless        | S1-A8、S2-A3        | Controller 有可测意图与状态机；SSR import 正常 |
| G2 Conversation    | S1 全部             | S1 浏览器 E2E 完整，支持恢复与 Scroll Follow   |
| G3 Agent           | S2 全部             | 审批与取消完整；**未经授权不可执行**           |
| G4 Coding          | S3 全部             | Diff 审查/冲突完整；**写盘只在 Host**          |
| G5 Cross-framework | S1-A9               | 三端消费同一契约一致                           |

---

## 5. 未确认 / 需要后续决议的点

1. **`conversation.send` 等命令字符串**：原文未给出，需在 AI2-105 冻结命名与字段。
2. **`review.comment` 是否单独成为领域实体**：`02` B6 要求 `commentId` 持久化，但 `01` 的 `AiState` 未列 `comments`。倾向新增 `comments` 集合（需 ADR 补充）。
3. **多 Conversation 共享同一 Execution**：`01` §20-1 仍为 Open Question，S1/S2 暂按 `Execution.conversationId?` 可选处理。
4. **S3 的"请求修订"是命令还是普通 follow-up**：`02` §G 倾向追加 Follow-up 或带版本的 Resume Command，尚未定论。
5. **`TestReport` 的数据形态**：原文只用 `Artifact` 承载，是否需要独立实体（便于失败定位）待 AI2-406 决议。
