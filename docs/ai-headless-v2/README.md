# Zeus AI Headless V2 — M0 文档集

> **状态：Proposed / Draft（提案，未实现）**
> **文档时点：2026-10-27（Asia/Shanghai）**
> **对应任务：AI2-001 / AI2-002 / AI2-003 / AI2-004（M0 · Product RFC）**
> **维护者：Zeus UI 文档作者（AI Headless V2）**

---

## 0. 一句话结论

V2 的基本公式是 **领域模型（Domain） → 交互控制器（Headless Controller） → 语义原语（Primitive） → 目标框架渲染器（WC / React / Vue）**；
Conversation、Execution、Artifact、Approval、ChangeSet 是**平级领域对象**，不合并为一个万能 Message，也不沿用 `@zeus-web/chat` / `@zeus-web/agent-console` 的容器与数据模型。
（来源：`design-source/01-ARCHITECTURE.md` §0、`design-source/README.md`）

---

## 1. 这份文档集是什么 / 不是什么

### 1.1 是

- M0 阶段的产品与架构**提案**：把设计包里的领域边界、交互规范、安全模型、旧代码处理策略沉淀为可审计的中文文档。
- 每条结论都能回溯到两类来源之一：**设计原文**（`design-source/`，逐字节副本 + SHA-256）或**当前仓库代码事实**（带文件路径与行号）。
- 后续 M1+ 任务的验收依据：`product-stories.md` 定义端到端断言点，`threat-model.md` 定义安全门禁，`legacy-decision.md` 定义旧包处置。

### 1.2 不是（诚实声明）

- **不是"已完成"的记录。** 本仓库**没有** V2 的发布产物：没有 `@zeus-web/ai-primitives` / `ai-react` / `ai-vue` / `ai-wc` / `ai-adapters` / `ai-testing` 的任何包，没有可运行的 V2 示例，没有 V2 的 E2E。（`packages/ai-core` 是 `private` 实验包，见 §0 时点快照说明。）
- **不是 API Stabilization。** 设计原文明确声明"所有 API 名称和代码均为提案"（`design-source/README.md`）；本文档沿用该提案命名，不代表已冻结。
- **不是对 V1 的贬低或替代承诺。** V1 包（`@zeus-web/chat`、`@zeus-web/agent-console` 等）仍在仓库中存在，版本 `0.1.0-beta.34`，`publishConfig.access: public`；本文件不主张删除它们，也未核验其在 npm 上的实际发布状态。
- **不含性能实测数据。** 设计原文 §15.1 只给出"验收目标（非当前实测）"，本文档不虚构帧耗时、内存或包体积。

> **时点快照说明（2026-10-27 10:42 CST 观测）**
> 工作区中已有由**并行 M1 任务**创建的 `packages/ai-core`（`@zeus-web/ai-core`）：`17` 个 `src` 文件 / 约 `3022` 行、`8` 个单测 spec、`private: true`、未发布。该包自己的 [README](../../packages/ai-core/README.md) 声明状态为 **Proposed / 实验性**，并明确"未实现 Controllers、AI 原语、React/Vue/WC adapter、SSE/WebSocket adapter、安全回归 harness"。
> 因此：
>
> 1. 本文档集的四份 M0 文档（AI2-001 / AI2-002 / AI2-003 / AI2-004）**不因该包的存在而升级为 Implemented**；
> 2. 本文档**不评估** `packages/ai-core` 的完成度、正确性与验收结论——以该包 README 与对应 M1 任务记录为准；
> 3. 本文档中"当前仓库没有 X"一律指「没有**可消费的 V2 发布产物/可运行 UI/E2E**」，不指"没有任何代码"。

---

## 2. V2 目标

### 2.1 共享协议与控制器，不强制共享 DOM

- **共享**：Domain Types、Reducer、Selector、Command API、Keyboard Intent、Focus/Selection Model、State Machines。
- **不共享**：React Element / Vue VNode 渲染过程、DOM Portal 实现、虚拟化测量机制、编辑器/终端/预览器挂载策略。
  （来源：`design-source/01-ARCHITECTURE.md` §3.2）

### 2.2 四种产品表面（Surface），同一套核心

| Surface          | 用户目标                     | 关键交互                                       |
| ---------------- | ---------------------------- | ---------------------------------------------- |
| Conversation     | 快速发问、理解答案、继续对话 | Composer、流式答案、来源、附件、分支、编辑重试 |
| Agent Task       | 把目标交给工具执行并控制风险 | 执行状态、计划、工具明细、审批、中断/恢复      |
| Coding Workspace | 对运行产物做有依据的审查     | 仓库/工作树、变更清单、Diff、测试、评论、采纳  |
| Embedded Copilot | 把 AI 放入已有业务系统       | 上下文选择、对话、引用、动作确认、侧边抽屉     |

（来源：`design-source/01-ARCHITECTURE.md` §2.1）

### 2.3 必须先跑通的三条端到端故事

| 故事                             | 一句话                                                                                                                | 详细断言                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **S1 · Conversational Research** | 输入 → 选模型/上下文 → 附件 → 发送（返回**接受确认**） → 流式回答 → 引用与产物 → 停止/重新生成 → 编辑早期消息创建分支 | [product-stories.md](./product-stories.md#story-s1) |
| **S2 · Agent Supervision**       | 创建任务 → 排队 → 计划 → 工具 → 敏感操作**审批** → 批准/拒绝 → 继续/失败/取消 → 可追溯结果                            | [product-stories.md](./product-stories.md#story-s2) |
| **S3 · Coding Review**           | 指定项目/工作树/任务 → 并行执行 → 比较变更 → 按文件/片段评论 → 查看测试 → 显式采纳/丢弃（**写盘只在 Host**）          | [product-stories.md](./product-stories.md#story-s3) |

（来源：`design-source/01-ARCHITECTURE.md` §2.2；任务门禁见 `design-source/03-IMPLEMENTATION-BACKLOG.md` AI2-001）

---

## 3. 与 V1 的差异（设计决议 × 当前代码核实）

设计原文 §1 给出了 V1 假设与 V2 决策的对照。下表在原文基础上增加「当前代码核实」列，便于审计：所有 V1 描述都对应到仓库中的真实文件。

| 维度          | V1 假设（设计原文 §1）                     | 当前代码核实                                                                                                                                                                                                                                              | V2 决策                                    |
| ------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 根容器        | Chat 与 AgentConsole 是两个主组件          | 两个独立 WC 根组件：[chat.tsx](../../packages/advanced/chat/src/components/chat.tsx) `zw-chat`、[agent-console.tsx](../../packages/advanced/agent-console/src/components/agent-console.tsx) `zw-agent-console`                                            | 没有强制主组件，由能力与场景组合           |
| 数据对象      | Message / Tool / Artifact 塞进一个通用对象 | Chat 用 `ChatMessagePart` 联合类型（含 `tool-call`、`artifact`）：[types.ts](../../packages/advanced/chat/src/types.ts#L32-L54)；AgentConsole 用单一 `AgentConsoleState` 五数组：[types.ts](../../packages/advanced/agent-console/src/types.ts#L100-L108) | 各聚合独立、用引用关联                     |
| 状态来源      | 单一 Agent 事件数组即全部状态              | `AgentConsoleEvent` 与 `AgentConsoleState` 并存在同一对象里：[console-state.ts](../../packages/advanced/agent-console/src/core/console-state.ts#L46-L64)                                                                                                  | 规范化实体 + 领域事件 + 衍生时间线         |
| 渲染底座      | WC 是唯一真正的渲染底层                    | 各包以 WC 为主入口，`./react`、`./vue` 为附加导出                                                                                                                                                                                                         | TS Controller 是共享底层；三端各有渲染器   |
| UI → Provider | UI 组件直接调用 Agent Provider             | Provider 契约存在但无审批/序号/ack：[provider/types.ts](../../packages/advanced/agent-console/src/provider/types.ts#L25-L44)                                                                                                                              | UI 只发 Command，Adapter/Host 控制执行     |
| 组件外观      | 所有 UI 元素有固定产品外观                 | 组件大量依赖 `Slot` 由宿主填充（如 `slot="thread"`、`slot="composer"`）                                                                                                                                                                                   | Headless 负责行为/语义/可访问性，Skin 可选 |
| 组件数量      | 先做几十个组件                             | V1 advanced 包共 4 个（chat / agent-console / data-grid / revogrid-adapter，另 virtual 为基础）                                                                                                                                                           | 先跑通 3 个用户故事与底层协议              |

### 3.1 V1 代码中**不存在**的 V2 能力（已用 grep 核实）

| 能力                                        | 核实方式                                                                                                                                                                                                                     | 结论                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Approval（审批聚合/状态机）                 | `grep -ri approval packages --include=*.ts --include=*.tsx` 在 `packages/ai-core` 之外**零命中**                                                                                                                             | V1 无审批概念                  |
| `seq`（流内权威序号）                       | `grep -rw seq packages/advanced` 零命中                                                                                                                                                                                      | V1 无事件序号，无法做 gap 恢复 |
| `DomainEvent` / `schemaVersion`（事件信封） | advanced 目录下无事件信封；`schemaVersion` 仅出现在 data-grid benchmark 清单                                                                                                                                                 | V1 无协议版本化                |
| Command / Ack / `idempotencyKey`            | 无 `Command` 类型；组件用命令式方法与 DOM 事件                                                                                                                                                                               | V1 无 CQRS-lite 语义           |
| Controller / 细粒度 selector                | 无 `subscribe(selector)` 形态；快照每次全量克隆（[chat-store.ts](../../packages/advanced/chat/src/core/chat-store.ts#L40-L56)、[console-state.ts](../../packages/advanced/agent-console/src/core/console-state.ts#L46-L64)） | V1 无细粒度订阅                |

---

## 4. 文档索引

| 文件                                                               | 任务 ID     | 覆盖内容                                                                                             | 状态     |
| ------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------- | -------- |
| [README.md](./README.md)（本文件）                                 | —           | V2 目标、V1 差异、索引、来源与哈希、诚实声明、术语                                                   | Draft    |
| [product-stories.md](./product-stories.md)                         | **AI2-001** | S1/S2/S3 端到端故事：前置输入、事件序列、用户动作、最终状态、失败恢复、E2E 断言点                    | Proposed |
| [adr-001-domain-and-renderer.md](./adr-001-domain-and-renderer.md) | **AI2-003** | ADR：Conversation/Execution 平级、Renderer Registry 与安全边界、React/Vue 不被 WC 强制、领域层零 DOM | Proposed |
| [threat-model.md](./threat-model.md)                               | **AI2-004** | Host Capability 矩阵（12 项能力）+ 35 条威胁（7 类）与可验证防线                                     | Proposed |
| [legacy-decision.md](./legacy-decision.md)                         | **AI2-002** | 旧模块逐个「保留 / 不复用 / 抽取能力 / 迁移」决策与理由                                              | Proposed |
| [design-source/](./design-source/)                                 | —           | 4 份设计原文逐字节副本（含 SHA-256 校验）                                                            | 只读副本 |
| [implementation-status.md](./implementation-status.md)             | 全部 54 项  | 对照 2026-10-27 审查报告的逐项状态（本轮完成 M0 四项 + M1 十项，其余未开始）                         | 事实快照 |
| [audit-2026-10-27.md](./audit-2026-10-27.md)                       | —           | 外部审查报告原文（SHA-256 `cefb0a77…6c7a`），只读存档                                                | 只读副本 |

---

## 5. 设计原文来源与完整性

### 5.1 来源

- 原始设计包解压路径：`zeus/temp/ai-headless-v2-design/zeus-ai-headless-v2/`（**兄弟仓库**，不在 zeus-ui 内）。
- 本目录 `design-source/` 为**逐字节副本**，未做任何改写、重排或翻译。
- 复制方式与校验（可复现）：

```bash
SRC=/path/to/zeus/temp/ai-headless-v2-design/zeus-ai-headless-v2
cp -p "$SRC"/{01-ARCHITECTURE.md,02-INTERACTION-SPEC.md,03-IMPLEMENTATION-BACKLOG.md,README.md} \
      docs/ai-headless-v2/design-source/
cd docs/ai-headless-v2/design-source && shasum -a 256 *.md
# 逐字节比对（macOS/Linux）
for f in 01-ARCHITECTURE.md 02-INTERACTION-SPEC.md 03-IMPLEMENTATION-BACKLOG.md README.md; do
  cmp -s "$SRC/$f" "$f" && echo "OK $f" || echo "DIFF $f"
done
```

### 5.2 SHA-256 登记表

| 文件                                                                         | 字节数 | SHA-256                                                            | 校验结果 |
| ---------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------ | -------- |
| [01-ARCHITECTURE.md](./design-source/01-ARCHITECTURE.md)                     | 43405  | `52a82a01b848ea3eaa3d85eb1f9e0a2518f76d14b7eea247447cf07738b0c456` | 一致     |
| [02-INTERACTION-SPEC.md](./design-source/02-INTERACTION-SPEC.md)             | 18524  | `0c28e0588bf8e4b4fc570dc3315cd5ebb442517dad6431ef6e2a892945182da6` | 一致     |
| [03-IMPLEMENTATION-BACKLOG.md](./design-source/03-IMPLEMENTATION-BACKLOG.md) | 11153  | `fa3d303ec1aac1d2f3a3bfab3b69fa7cf7e6dd9ff22eafddadda10cc5db847b9` | 一致     |
| [README.md](./design-source/README.md)                                       | 1623   | `22f2f1386e2314c66578b63b029b29844f542e75512c59e39af87664d7ceffbe` | 一致     |

> 校验时点：2026-10-27；四份文件与源目录 `cmp` 逐字节相同。若上游设计包更新，必须重做副本并更新本表，**不允许只改哈希不改副本**。

> ⚠️ **格式化工具会破坏本目录的逐字节一致性。** 仓库根 `pnpm format` 会执行 `prettier --write .`，而 `.prettierignore` **没有**排除 `docs/ai-headless-v2/design-source/`；实际发生过一次（2026-10-27 10:40 左右，三份文件被补齐表格空格，哈希变为 `82f0b8fe…`/`fb057208…`/`2131826b…`）。
> 处置：**提交前必须重跑 §5.1 的复制命令并用 `shasum -a 256` 复核**；根治办法是在 `.prettierignore` 增加 `docs/ai-headless-v2/design-source/`（属配置文件改动，需仓库维护者执行，本文档作者未改动该文件）。
> 复核一条命令：
>
> ```bash
> cd docs/ai-headless-v2/design-source && shasum -a 256 *.md | grep -E "52a82a01|0c28e058|fa3d303e|22f2f138" | wc -l   # 期望 4
> ```

### 5.3 文件职责

| 文件                                         | 职责                                                           |
| -------------------------------------------- | -------------------------------------------------------------- |
| `design-source/01-ARCHITECTURE.md`           | 架构 RFC：领域模型、TS API、事件、状态机、包分层、安全与跨框架 |
| `design-source/02-INTERACTION-SPEC.md`       | 交互规范、文本线框、键盘、Streaming、Diff、审批、组件契约      |
| `design-source/03-IMPLEMENTATION-BACKLOG.md` | 分里程碑任务清单、依赖、优先级、验收门禁                       |
| `design-source/README.md`                    | V1→V2 的核心变化、实现建议、免责声明                           |

---

## 6. 当前仓库状态（可核查的 V1 事实）

### 6.1 相关 V1 包

| 包                        | 路径                                                                     | 版本          | 实际职责                                                     |
| ------------------------- | ------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------ |
| `@zeus-web/chat`          | [packages/advanced/chat](../../packages/advanced/chat)                   | 0.1.0-beta.34 | ChatGPT 风格 Headless 聊天 WC + 轻量 store/composer/虚拟线程 |
| `@zeus-web/agent-console` | [packages/advanced/agent-console](../../packages/advanced/agent-console) | 0.1.0-beta.34 | Agent 控制台 WC + 单数组 state + mock/replay provider        |
| `@zeus-web/data-grid`     | [packages/advanced/data-grid](../../packages/advanced/data-grid)         | 0.1.0-beta.34 | 二维虚拟化表格（与 AI 无直接耦合）                           |
| `@zeus-web/virtual`       | [packages/advanced/virtual](../../packages/advanced/virtual)             | 0.1.0-beta.34 | 虚拟化内核（chat 线程虚拟化的底层）                          |
| `@zeus-web/ai`            | [packages/ai](../../packages/ai)                                         | 0.1.0-beta.34 | **LLM 使用指南/组件元数据**，不是 AI UI 运行时               |
| `@zeus-web/headless`      | [packages/headless](../../packages/headless)                             | 0.1.0-beta.34 | 24 个 primitive WC 的聚合注册入口（与 AI 无关）              |

> 注意命名歧义：`@zeus-web/ai` 是"给 AI 编码助手看的组件元数据"，**不是** V2 的 `ai-core`。V2 提案包名为 `@zeus-web/ai-core` / `ai-primitives` / `ai-wc` / `ai-react` / `ai-vue` / `ai-adapters` / `ai-testing`（`design-source/01-ARCHITECTURE.md` §4），发布前需检查 npm 可用性。详见 [legacy-decision.md](./legacy-decision.md#legacy-packages-ai)。

### 6.2 V2 规划包与当前落地偏差

- 设计原文拟议目录是 `packages/ai-v2/{protocol,core,controllers,primitives,wc,react,vue,adapters,testing,themes}`，并标注"尚未创建"（`design-source/01-ARCHITECTURE.md` §4）。
- 当前实际落地**偏离**了该目录形状：M1 选择了独立包 `packages/ai-core`（`@zeus-web/ai-core`，`private`），而不是 `packages/ai-v2/core`。两者如何在 M1/M5 收敛（重命名 / 保留双路径 / 改为 `ai-v2/*` 子目录）**尚无决议**，本文档不预设结论，需在 M1 收尾时补 ADR。
- 仍然**不存在**的包：`ai-primitives`、`ai-controllers`、`ai-wc`、`ai-react`、`ai-vue`、`ai-adapters`、`ai-testing`、`ai-themes`；也**不存在** V2 的示例目录（`examples/ai-conversation` 等）。

---

<a id="glossary"></a>

## 7. 术语表（全文统用）

| 术语             | 含义                                                 | 关键约束                                                                     |
| ---------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| **ai-core**      | V2 纯 Node 领域/协议/Store 层包                      | 不得 import DOM/React/Vue；`import` 时不读 `window`/`document`/`HTMLElement` |
| **Conversation** | 用户与 AI 的交流组织（消息、分支）                   | 与 Execution **平级**，互相关联可选                                          |
| **Execution**    | 一次可取消、可恢复的模型/Agent 执行                  | 7 态机；Retry = **新 ID** + `retryOf`                                        |
| **Approval**     | 高风险操作/外部副作用的授权聚合                      | `approved` ≠ 执行成功；只有 Host 能改事实                                    |
| **ChangeSet**    | 代码变更加载/采纳单元                                | 应用只在 Host；`conflicted` 不得自动忽略                                     |
| **Command**      | 用户意图信封（`idempotencyKey`、`expectedRevision`） | `accepted: true` 不代表执行完成                                              |
| **DomainEvent**  | Host 发出的权威事实（`schemaVersion: 2`）            | 只有它能改 Store 事实                                                        |
| **seq**          | 单个 `streamId` 内单调递增的权威序号，从 1 开始      | 缺口必须触发重放/快照恢复，禁止静默跳过                                      |

（来源：`design-source/01-ARCHITECTURE.md` §5.1、§6、§7、§13）

---

## 8. 阅读顺序与后续任务

### 8.1 建议阅读顺序

1. 本文件（目标 + 差异 + 状态）
2. [product-stories.md](./product-stories.md)（先看用户任务，再看实现）
3. [adr-001-domain-and-renderer.md](./adr-001-domain-and-renderer.md)（领域与渲染边界）
4. [threat-model.md](./threat-model.md)（安全前置，M1 之前必须定）
5. [legacy-decision.md](./legacy-decision.md)（旧资产如何处置）

### 8.2 M0 → M1 门禁（来自设计原文）

| 门禁     | 条件                                                                                               | 来源                               |
| -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M0 完成  | 三个 Surface 的故事、对象边界、危害清单已确认                                                      | `03-IMPLEMENTATION-BACKLOG.md` §M0 |
| M1 前置  | 领域边界未确认前，**不大量写组件**                                                                 | 同上，M0 停线条件                  |
| M1 停线  | 事件不能幂等 + 可重放 → 停止上层 UI，先修协议                                                      | `03-IMPLEMENTATION-BACKLOG.md` §0  |
| 安全红线 | UI 未经服务端授权执行副作用 = P0，禁止发布                                                         | 同上                               |
| 质量门禁 | G0 Domain → G1 Headless → G2 Conversation → G3 Agent → G4 Coding → G5 Cross-framework → G6 Release | `01-ARCHITECTURE.md` §17.3         |

### 8.3 首个公开版只承诺

`AI Headless v0.1.0-beta.0` 建议只承诺：Pure Domain + Event/Command + Mock Host；Composer + Conversation + Markdown Streaming + Attachment + Citations；Execution + Steps + Tool + Approval；React 适配 + 基础 WC 适配；一套 Chat 与一套 Agent 真实消费示例；事件回放/审批/SSR Import/安全与键盘门禁。**不承诺** Coding Diff 全功能、Monaco/Terminal、复杂 Voice、多框架同天发布、完整 Agent Runtime、SSR Hydration。
（来源：`design-source/03-IMPLEMENTATION-BACKLOG.md` §首个公开可用版本的范围）

---

## 9. 维护规则

1. **状态只能随证据升级**：`Proposed → Accepted` 需要对应 M1 任务的合并记录与门禁通过记录；`Accepted → Implemented` 需要发布产物与 E2E 链接。任何"已支持/已完成"的措辞必须附证据。
2. **结论必须可回溯**：新增结论必须给出「设计原文小节」或「代码路径:行号」之一。
3. **不改写设计原文**：`design-source/` 只允许整份替换 + 更新哈希，禁止就地编辑；对原文的异议写成 ADR 或 Open Question。
4. **V1 处置以 [legacy-decision.md](./legacy-decision.md) 为准**：不得因为便利而默认沿用 V1 API（`03-IMPLEMENTATION-BACKLOG.md` AI2-002 验收标准）。
5. **与主仓库分工**：Zeus Compiler/Signal/Runtime 只需提供稳定的 TSX、细粒度绑定、Scope 生命周期与组件发布能力，**不为 AI UI 内建专用语法**；`ai-core` 不得引用 Zeus 私有 Signal 实现（`03-IMPLEMENTATION-BACKLOG.md` §与 Zeus 主仓库的分工、`01-ARCHITECTURE.md` §16）。
