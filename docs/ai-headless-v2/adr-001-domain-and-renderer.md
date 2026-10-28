# ADR-001：领域模型边界与渲染器分层

> **任务：AI2-003（M0 · P0 · S）**
> 验收标准（`design-source/03-IMPLEMENTATION-BACKLOG.md` §M0）：**决议：Conversation/Execution 不合并，React/Vue 不被 WC 强制依赖**。
> **状态：Proposed（提案，等待 M1 实现验证）**
> **文档时点：2026-10-27** ｜ **决策依据**：`design-source/01-ARCHITECTURE.md` §1、§3、§5、§12、§16、§19 + 当前仓库代码核实

---

## 1. 背景（Context）

### 1.1 设计原文给出的方向

- V2 = **Domain → Headless Controller → Primitive → Renderer（WC / React / Vue）**，编译器、响应式实现与样式不属于领域模型（`01` §0）。
- **硬性约束**：`core` 与 `primitives` 在 Node.js 环境 `import` 时**不得**读取 `window`、`document`、`HTMLElement`；**React/Vue 不依赖 WC 包，WC 包不得依赖 React/Vue**（`01` §3.1）。
- Conversation 与 Execution 是**平级对象**，互相**可选**关联；`ActivityItem` 是从事件与实体推导出的 UI ViewModel，可丢弃重建（`01` §5.1）。
- 复杂内容（Markdown/代码/图像/Artifact/Diff/Terminal）通过 **Renderer 插件**注入，`TNode` 在 React 中是 ReactNode、Vue 中是 VNode、WC 中是 DOM Node（`01` §12）。
- 不保证所有 React/Vue 组件内容都能透过普通 WC slot 无损传递（`01` §1.1 非目标）。

### 1.2 当前仓库的代码事实（V1，约束本次决策）

| 事实                                                                                                                                | 证据                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 两个独立根组件，各自持有自己的数据模型：`zw-chat`（`ChatMessageData[]`）与 `zw-agent-console`（单个 `AgentConsoleState`）           | [chat.tsx](../../packages/advanced/chat/src/components/chat.tsx)、[agent-console.tsx](../../packages/advanced/agent-console/src/components/agent-console.tsx)、[AgentConsoleState 定义](../../packages/advanced/agent-console/src/types.ts#L100-L108) |
| 工具调用与产物是 **Message 的 part**（`tool-call` / `artifact`），不是独立实体                                                      | [chat types.ts](../../packages/advanced/chat/src/types.ts#L32-L54)                                                                                                                                                                                    |
| 无 Approval 聚合                                                                                                                    | `grep -ri approval packages --include=*.ts --include=*.tsx`：`packages/ai-core` 之外零命中                                                                                                                                                            |
| 无 Execution/Step 实体：AgentConsole 只有扁平 `status` 与 `toolCalls[]`，无步骤树、无 `awaiting-approval`/`paused`/`cancelled` 状态 | [agent-console types.ts](../../packages/advanced/agent-console/src/types.ts#L3-L21)、[console-state.ts](../../packages/advanced/agent-console/src/core/console-state.ts)                                                                              |
| **React/Vue 入口是 WC 的包装产物**，包内没有任何 React/Vue 源文件                                                                   | [chat package.json](../../packages/advanced/chat/package.json)：`dependencies` 含 `@zeus-js/output-react-wrapper`、`@zeus-js/output-vue-wrapper`；`exports` 提供 `./react`、`./vue`；`find packages/advanced -name '*.tsx' -path '*react*'` 无结果    |
| 状态快照每次全量克隆                                                                                                                | [chat-store.ts](../../packages/advanced/chat/src/core/chat-store.ts#L40-L56)、[console-state.ts](../../packages/advanced/agent-console/src/core/console-state.ts#L46-L64)                                                                             |

> 结论：V1 的模型与 V2 的决议在**类型层面不可兼容**——不是"改名"能解决的，属于聚合边界不同。

---

## 2. 决策（Decision）

### D1 · Conversation 与 Execution 是平级聚合，不合并为"万能 Message / 万能实体"

**决议**

1. `Conversation` 负责"用户和 AI 如何交流、消息与分支如何组织"；`Execution` 负责"一次可取消、可恢复的执行"；二者各有独立 `id` 与单调递增 `revision`，**互相关联是可选字段**：
   - `Message.conversationId`（必需）、`Message.executionId?`（可缺省）
   - `Execution.conversationId?`（可缺省，支持无会话的纯任务）、`Execution.workspaceId?`
2. **不引入** `MessagePart{type:'tool-call'}` 这类"把执行事实塞进消息"的形状。工具调用是独立实体 `ToolInvocation`，通过 `ExecutionStep.toolInvocationId` 关联；聊天里出现的是**引用**或活动投影项（`02` B2 明确："`tool-call` 不是 Message ContentPart 的默认原始类型"）。
3. `ActivityItem` 是**投影**（ViewModel），不是数据库根实体；可以随时丢弃重建（`01` §5.1、§0）。
4. 大对象（图像、文件、Diff blob、工具输出）一律用 `AssetRef` 引用，不塞进 Snapshot（`01` §5.1）。
5. 事件与实体的关系：`DomainEvent.entity{kind,id}` 负责"事件属于谁"，`seq` 负责"在哪个 stream 内第几条"；**实体版本与流序号是两个概念**，不得互相替代（`01` §5.1、§7.1）。

**被拒绝的替代方案**

| 方案                                                                                               | 拒绝理由                                                                                                                             |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 复用 `AgentConsoleState`（messages/toolCalls/artifacts/diagnostics/events 五数组）作为 V2 Store 根 | 全量克隆 + 单数组事实不适合长期增长（`01` §19 对 `console-state.ts` 的结论）；五数组之间没有引用完整性，无法表达步骤树与审批生命周期 |
| 复用 `ChatMessagePart` 作为通用内容模型（含 tool/artifact part）                                   | 违反 D1-2；会让 Chat 与 Agent 出现两套状态源（`02` B2）                                                                              |
| "一个 Execution 就是一个 Message 的 metadata"                                                      | 无法表达并行 Run、步骤树、审批挂起、跨 turn 的恢复                                                                                   |
| 单一 Agent 事件数组即全部状态（V1 现状）                                                           | 导致反复克隆列表与全量重渲染（`01` §1）                                                                                              |

**后果（Consequences）**

- 正面：Chat 与 Agent 共享同一套 Store/Reducer/Selector；`AiMessageTimeline` 与 `AiStepList` 读不同集合但同源；后续 Coding Review 复用 Execution + ChangeSet 而不新增 Store。
- 负面：需要额外的 selector 把 `Execution` 投影到会话视图（"可选的工具活动摘要"），实现成本高于 V1 的"消息里塞 part"。
- 负面：V1 → V2 无字段级迁移路径，只能走一次性 legacy adapter（`01` §19「迁移策略」），且不得伪造 `seq`/`approval`/工具结果。

### D2 · Renderer Registry 是唯一的复杂内容扩展点，并承担安全边界

**决议**

1. 复杂内容只通过 `ContentRenderer` 扩展点接入：
   ```ts
   interface ContentRenderer<TNode> {
     id: string
     canRender(part: ContentPart): boolean
     render(ctx: ContentRendererContext): TNode
     dispose?(node: TNode): void
   }
   ```
   `TNode` **是框架相关的**（ReactNode / VNode / DOM Node），**不是可跨框架传输的对象**（`01` §12）。
2. `Artifact.rendererHint` 是**提示**，不是授权：Renderer 必须由注册表白名单选择，不得按服务端字符串动态 `eval`/动态 import 任意模块。
3. 安全边界（每条都必须有测试，见 §4）：
   - Markdown **默认严格消毒**，不执行用户/模型返回的脚本；链接协议走白名单，外链 `rel` 明确（`01` §12）。
   - 图像显示 MIME/尺寸/替代文本，加载走**可信 Asset Loader**（鉴权），不盲渲染 `uri`（`01` §5.1 `AssetRef.uri` 注释）。
   - Artifact 图表/动态内容不得把不可信任意 HTML 注入主应用 DOM；危险预览必须沙箱化并遵循 CSP（`01` §12）。
   - Diff 的路径、hunk、行号来自服务端解析或可信 Parser；**不可把 `@@` 等任意文本拼 HTML**（`01` §12）。
   - Terminal 只是日志展示，**不自动具有运行命令权限**（`01` §12）。
4. Renderer 只能"渲染"，不能获得执行能力：它拿到的 context 是 `{part, resolveAsset, capability}`，**没有** Host/Command 通道（`01` §12）。

**后果**

- 正面：核心包不绑定 Monaco / Markdown / Mermaid / Terminal；它们作为可选依赖延迟加载（`01` §9.3 末尾、AI2-504）。
- 正面：三端可以各自用最自然的方式渲染，避免"WC slot 传不了 ReactNode"的硬伤。
- 负面：同一份内容在三端可能出现视觉/行为差异，需要 Contract Suite 兜底（AI2-505）；Markdown 等插件的 XSS 责任被下沉到插件，必须建安全回归基座（AI2-506）。

### D3 · React / Vue 不被 Web Components 强制依赖

**决议**

1. 分层与依赖方向（`01` §4 职责规则表）：
   ```text
   ai-core         → 仅 TS 标准库/轻量可移植工具（禁 React/Vue/WC/DOM/网络 SDK）
   ai-primitives   → ai-core + 浏览器无关 a11y 模型（禁任何单一 UI 框架）
   ai-wc           → ai-core + primitives + Zeus WC Runtime（禁 React/Vue）
   ai-react        → ai-core + primitives + React（禁把 ai-wc 当必要运行时）
   ai-vue          → ai-core + primitives + Vue（禁把 ai-wc 当必要运行时）
   ai-adapters     → ai-core + 传输/供应商 SDK（禁 DOM/UI）
   ai-themes       → CSS Tokens（禁 Agent Runtime/业务后端）
   ```
2. **不把 WC 当跨框架桥梁**：`ai-react` / `ai-vue` 必须是原生适配器（hooks/composables + compound components），不得像 V1 那样用 `output-react-wrapper` / `output-vue-wrapper` 把 WC 包成框架组件。
3. WC 中 Controller / Artifact / FileList / Callback **只能走 DOM Property**，不做 HTML attribute 序列化（`01` §10.3、§16）；自定义事件只用于 `intent` / `view-change`，**不得把完整敏感 state 塞进 `detail`**。
4. 不承诺"所有 Primitive 都发布 WC"：只有通过生命周期、插槽与浏览器适配测试的部分才发布 WC（`01` §20-5、`02` §G）。
5. SSR：`core`、`controllers`、`primitives`、`react`、`vue` 服务端 import 必须安全；WC 的注册放在显式客户端入口，避免顶层读 `HTMLElement`（`01` §16）。

**后果**

- 正面：三端语义一致、DOM 可以不同（`01` §17.2）；复杂 React 内容（自定义 Cell、MDX、Monaco）保留框架语义。
- 负面：三套渲染器 = 三份适配代码与测试；短期成本高于 V1 的"一份 WC + 两个 wrapper"。
- 负面：`ai-react` / `ai-vue` 各自需要 `useSyncExternalStore` / `shallowRef+watch` 订阅桥接（`01` §16），不能共用同一实现。
- 约束：V2 不得以"WC 已验证"作为 React/Vue 已完成的证据（G5 要求三端同一 Fixture 行为一致）。

### D4 · 领域层零 DOM（core / primitives 与平台解耦）

**决议**

1. `ai-core`、`ai-primitives` 不 import 任何 DOM 全局与框架运行时；`import` 时不读 `window`/`document`/`HTMLElement`（`01` §3.1）。
2. Store/Subscription 通过**可注入接口**使用，不直接引入 `@zeus-js/signal/internal`、alien-signals、Vue Reactivity（`01` §16）。
3. Controller 的 `dispose()` 只清理自身订阅与 DOM 临时资源，**不取消已被 Host 接受的后台任务**，除非显式配置（`01` §8.1）。
4. DOM 临时状态（焦点、展开、尺寸、滚动偏移）**不得**回写成领域数据（`01` §3.4）。
5. 键盘/焦点/可访问性以 Props Getter 表达（`01` §8.2），因此 `primitives` 不依赖具体 JSX 特殊语法，标准 TS 是第一公民（`01` §16）。

**后果**

- 正面：S1/S2/S3 的事件 Fixture 可以在纯 Node 里 replay（G0），这是"协议先于 UI"的可行前提。
- 正面：`ai-core` 可被任何框架复用，也降低了未来 Rust/WASM 侧复用的阻力。
- 负面：WC 侧需要额外的 Property Bridge 与生命周期桥接（AI2-503），不能直接复用 Controller 内部的 DOM 假设——而 V1 恰恰把 DOM 假设写进了组件（如 [chat.tsx](../../packages/advanced/chat/src/components/chat.tsx#L76-L80) 直接在 store 变更后 `queueMicrotask` 滚底）。

---

## 3. 现状约束（这些事实限制落地顺序）

| 约束                                                                                                                                                                                                                | 影响                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| V1 组件把"提交即清空""变更即滚底"写进渲染层（[chat-composer.tsx](../../packages/advanced/chat/src/components/chat-composer.tsx#L67-L80)、[chat.tsx](../../packages/advanced/chat/src/components/chat.tsx#L76-L80)） | 这些行为必须搬到 Controller/ViewState，否则 `ai-core` 会被迫知道 DOM                                                                            |
| V1 的 React/Vue 入口是 WC wrapper 产物（无原生适配器源码）                                                                                                                                                          | D3 无法复用 V1 适配层，只能新建；`ai-react`/`ai-vue` 无历史包袱，也无既有测试可继承                                                             |
| V1 无 Approval / 无 seq / 无 Command                                                                                                                                                                                | D1 的"平级聚合"必须与协议（AI2-105/106）同步落地，不能只改类型                                                                                  |
| V1 有 `@zeus-web/virtual` 虚拟化内核（被 chat 线程虚拟化复用）                                                                                                                                                      | Timeline 的"可变高度/锚点"应复用该算法（`01` §19），但 follow/锚点语义归 Controller（D4-4）                                                     |
| 仓库现有 `@zeus-web/ai` 是给 LLM 的元数据包，`@zeus-web/headless` 是 primitive 聚合入口                                                                                                                             | V2 包名 `@zeus-web/ai-*` 与它们语义不同，发布前需检查 npm 可用性并避免混淆（`01` §4 发布建议；详见 [legacy-decision.md](./legacy-decision.md)） |
| 并行 M1 任务已创建 `packages/ai-core`（`private`、实验性，仅领域/协议/Store/Host）                                                                                                                                  | D1/D4 已开始落地；D2/D3 尚无代码，本文档的分层仍需在 M2/M5 验证；完成度以该包 README 为准                                                       |

---

## 4. 如何验证决议被遵守（可执行门禁）

| 决议               | 验证方式                                                                                                      | 关联任务                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------- |
| D1 平级聚合        | 无 DOM 的 Node replay 用例：一份事件流同时驱动 Conversation 视图与 Execution 视图，断言两者互不覆盖           | AI2-102/107/110、G0         |
| D1 无万能 Message  | 类型层断言：`ContentPart` 不含 `tool-call`；`ToolInvocation` 只能经 `step.toolInvocationId` 引用              | AI2-102                     |
| D2 Renderer 安全   | XSS / `javascript:` URI / 恶意 SVG / 路径穿越 / 巨大输出 的安全回归包                                         | AI2-506、`01` §17.2         |
| D2 Renderer 不越权 | Renderer context 中不存在 Host/Command 引用（类型断言 + 单测）                                                | AI2-209/504                 |
| D3 无 WC 强制依赖  | 包依赖 lint：`ai-react` 的 `dependencies` 不含 `ai-wc`；`ai-wc` 不含 `react`/`vue`；`npm pack` 后外部安装可用 | AI2-101/501/502/503/509、G5 |
| D3 原生适配器      | React/Vue SSR import 测试（不得访问 DOM 全局）                                                                | AI2-501/502、F10            |
| D3 三端一致        | 同一 Fixture 在 WC/React/Vue 跑 Composer/Message/Approval/Execution                                           | AI2-505、G5                 |
| D4 零 DOM          | `ai-core`/`ai-primitives` 在纯 Node `import` 成功                                                             | AI2-101、G0/G1              |

---

## 5. 未决问题（不在本 ADR 冻结范围）

1. `ContentPart` 是否需要 `structured` 之外的类型（`01` §5.1 已列 6 种，落协议时可能调整）。
2. Renderer Registry 的注册时机与作用域（全局 / Provider 级 / Conversation 级）——影响 D2 的安全边界粒度。
3. `react` / `vue` 适配器是否共享 `primitives` 的 props getter 语义（三端 API 字面不必相同，但事件含义必须一致，`02` §C "Slot 原则"）。
4. WC 首发范围：`01` §20-5 与 `02` §G 都主张"不是所有 Primitive 都发布 WC"，需在 M5 逐组件确认。
5. `ActivityItem` 投影是否需要独立的 snapshot/缓存层（性能相关，属 M2 的 Timeline 任务）。

---

## 6. 追溯

| 决议 | 设计原文                                                       | 相关任务                                             |
| ---- | -------------------------------------------------------------- | ---------------------------------------------------- |
| D1   | `01` §0、§1、§5.1、§5.3、§19；`02` B2                          | AI2-102、AI2-107、AI2-110                            |
| D2   | `01` §9.3、§12、§13.1（第 2 条）、§17.2                        | AI2-209、AI2-210、AI2-504、AI2-506                   |
| D3   | `01` §1.1、§3.1、§3.2、§4、§10.3、§16、§20-5；`02` §C、§D4、§G | AI2-101、AI2-501、AI2-502、AI2-503、AI2-505、AI2-509 |
| D4   | `01` §3.1、§3.4、§8.1、§8.2、§16；`03` AI2-101/201             | AI2-101、AI2-109、AI2-201                            |
