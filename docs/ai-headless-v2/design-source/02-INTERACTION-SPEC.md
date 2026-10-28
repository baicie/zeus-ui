# Zeus AI Headless V2 — 交互规范与组件契约

> 本文是 `01-ARCHITECTURE.md` 的交互设计附录。只规定用户可观察的行为，不强制字体、颜色、间距和皮肤。图示均是信息架构草图，不是照搬 ChatGPT/Codex 的 UI。

## A. 页面级信息架构

### A1. Conversation Surface（ChatGPT 风格）

```text
┌────────────────────────────────────────────────────────────────┐
│ Workspace / Model / Mode                     Actions / Profile │
├───────────────┬────────────────────────────────────────────────┤
│ Conversation  │                  Conversation                   │
│ search        │  • user message                                 │
│ recent / pin  │  • assistant message [streaming]                │
│ projects      │    └ sources, code, artifacts, actions         │
│ new session   │  • optional tool activity summary              │
│               │                                                │
│               │       [Jump to latest] (when not following)    │
│               ├────────────────────────────────────────────────┤
│               │ [attachments / context chips]                  │
│               │ [Composer: text, @context, /commands]          │
│               │ [mode/model]                 [stop | send]      │
└───────────────┴────────────────────────────────────────────────┘
```

**行为规格：**

- 历史栏只是 Conversation 导航控制器，选择会话不改变其它正在后台执行的任务状态。
- Composer 默认仍允许编辑草稿；是否在生成中允许新消息、队列消息或替代为“停止”取决于 host `sendPolicy`。
- AI 输出的来源、工件、工具摘要通过明确 `Part`/`ArtifactRef` 挂在消息上，不允许用混杂的文本格式猜测其意义。
- 消息“重新生成”创建新 Execution 和新消息分支；原答案不从数据层删除。
- 编辑旧消息有两种可配置策略：`fork-branch`（默认）和 `replace-draft-before-send`；一旦已有后续有效消息，默认不得静默覆写历史。

### A2. Agent Surface（Codex 任务视图）

```text
┌────────────────────────────────────────────────────────────────┐
│ Project / Workspace   Run: #A31 [running]  [pause] [stop]     │
├──────────────────┬──────────────────────┬──────────────────────┤
│ Runs / Search    │ Task timeline        │ Detail inspector     │
│ #A31 running     │ ├ Plan               │ Selected step        │
│ #A30 completed   │ ├ Read files         │ Tool arguments       │
│ #A29 approval    │ ├ Analyze            │ Result / diagnostics │
│                  │ ├ Approval requested │                      │
│                  │ ├ Edit               │                      │
│                  │ └ Tests              │                      │
├──────────────────┴──────────────────────┴──────────────────────┤
│ Follow-up instruction / comments                              │
└────────────────────────────────────────────────────────────────┘
```

- 状态和操作直接关联 `executionId`，多个 Run 的 Stop/Approve 不能串线。
- 每个步骤可展开摘要；工具完整输入/输出默认折叠且脱敏，必要时单独 Asset 加载。
- Pending Approval 必须在任务可见区域有稳定入口，不依赖用户刚好滚到底部。
- 计划内容可改变，但每一项的稳定 ID 与执行结果必须留痕；不可把重新渲染的计划等同于历史消失。
- 高风险操作始终要求用户明确点击意图，不能因切换到另一 Run 自动放行。

### A3. Coding Review Surface

```text
┌────────────────────────────────────────────────────────────────┐
│ Project / Worktree / base revision / Run / review actions     │
├───────────────┬──────────────────────────────┬─────────────────┤
│ changed files │ Diff [unified|split]         │ Comments/Test   │
│ src/a.ts  +3  │  @@ hunk ...                 │ 2 comments      │
│ src/b.ts  -8  │  + new line                  │ Passed 15       │
│ test/...      │  - old line                  │ Failed 2        │
│               │  [+Comment] [mark reviewed]  │                 │
├───────────────┴──────────────────────────────┴─────────────────┤
│ [request revision] [discard draft] [apply authorized changes] │
└────────────────────────────────────────────────────────────────┘
```

- 文件树与 Diff 的当前行定位可使用 URL hash 或 route state；不把行号定位放进服务端业务命令。
- 支持文本 Diff 首版；二进制文件显示 Metadata 和预览/下载入口，不假装可显示行级 Diff。
- 展示 `baseRevision`、目标 Workspace，避免“Review 的内容”和“Apply 的目标工作树”不一致。
- 采纳操作可先检查当前目标版本；若有冲突，进入 `conflicted` 状态并显示差异，绝不能自动忽略冲突。

### A4. Embedded Surface（AIOps / 产品 Copilot）

- 小型侧栏可只显示 `AiComposer + AiMessageTimeline + AiCitationList`。
- 业务系统通过 `ContextSelection` 注入服务、Trace、Dashboard、Incident 等自定义上下文；AI Core 不需知道 OTEL/AIOps 的业务结构。
- 业务 Action 仍以独立 Command + Approval 表示，避免因为“嵌入在可信系统”就默认拥有写操作权限。
- 缩窄布局只改变展示方式（Drawer/Sheet），不改变领域协议、数据状态或命令流程。

## B. 交互约定（产品无关）

### B1. Composer

| 条件 | Enter | Shift+Enter | Ctrl/Meta+Enter | Escape |
|---|---|---|---|---|
| 默认无弹层、无 IME | 发送或换行，按 `submitOnEnter` 配置 | 换行 | 可配置强制发送 | 可配置取消草稿操作，但默认不清空 |
| 中文/日文等 IME 组字 | 不发送；交给输入法 | 不发送 | 不抢输入法 | 不干预输入法 |
| @/Slash 选择菜单展开 | 选中当前条目；不得同时发送 | 仍编辑文本 | 菜单关闭后由策略决定 | 关闭菜单并恢复光标 |
| 草稿为空但有附件 | 如果 policy 允许，发送附件 | 换行 | 允许附件提交 | 无 |
| 提交请求 pending | 拦截同一草稿的重复发送 | 编辑新草稿 | 不复用旧 idempotencyKey 发送新内容 | 不取消已提交后台执行 |

- 上传由 Host 或 Upload Adapter 管理，上传未完成的附件默认不能提交；产品可显式允许 `deferred-asset` 功能。
- `text.trim()` 仅用于判断纯空格是否有效，不得破坏原始 Markdown 文本空白。
- 清空草稿必须基于 `submittedRevision` 检查；提交后用户新输入不可被迟到 Ack 擦除。
- 模型选择和模式切换是可选 `ContextSelection` 或 Capability，控制器不硬编码供应商模型列表。
- 输入组件提供受控/非受控两种模式，切换时警告；附件和上下文 selection 单独有 revision。

### B2. Message / Content

| 操作 | 期望行为 | 持久性 |
|---|---|---|
| 复制 | 复制用户可见部分纯文本（含正确代码文本） | 不持久 |
| 引用跳转 | 展开对应引用详情、允许外部链接 | 可分享的 Source 引用 |
| 再生成 | 创建新的 Execution 与分支 | 持久 |
| 编辑提问 | 预填 Composer 中可编辑的版本 | 提交前本地 |
| 删除历史 | 需要业务宿主策略与服务端确认 | 持久 |
| 展开 Tool Detail | 保留视图展开状态，不能触发再次执行 | 本地 |
| 继续未完成结果 | 需要 Host Capability；通常新 Execution | 持久 |

重要区别：`tool-call` 不是 Message ContentPart 的默认原始类型。聊天展示中可出现 Tool **引用**或 `ActivityViewItem`，但是实际 Tool Invocation 保存在独立实体中，以免造成 Chat 与 Agent 两套状态源。

### B3. Timeline / Autoscroll

- 使用逻辑锚点 `{messageId, withinOffset}` 或 `{itemId, withinOffset}`，可与不同渲染器协作。
- Near-bottom 是可配置像素阈值，如默认由组件高度与 1~2 行文本计算，禁止固定硬编码 100px 为 API 语义。
- 新用户消息产生时，若 host 策略要求可主动滚到该消息；流式 AI 内容仅在 follow 状态滚到底部。
- 重新生成/分支切换默认尝试恢复分支独立锚点。
- 无限历史：向上加载旧消息时保留阅读锚点；虚拟化滚动占位高度在测量后回填。
- 不把 `scrollToBottom` 作为每条 token 都立即执行的副作用；采用节流合并。

### B4. Execution / Tool

- `Stop` 发送 `execution.cancel` Command，UI 立即进入 `cancel-requested` 局部反馈，**不能当场标记 `cancelled`**。
- `Pause` 类似，仅当 Host Capability 声明可用才展示。
- Tools 以步骤列出：名称、目标资源、摘要、状态、起止时间、输出是否被截断；完整数据按需展开。
- Logs 不得自动滚动覆盖用户阅读；拥有单独 follow 模式。
- `retry` 不能盲重放可能具有副作用的工具调用，需要 Host 决策并确保幂等性。

### B5. Approval

**审批必须至少显示：** 准备做什么、对哪个资源做、为何需要批准、此次权限范围、有效期（如有）、操作风险、可展开的参数摘要。

| 场景 | 行为 |
|---|---|
| 两次点击批准 | 第二次被前端 pending 拦截，后端使用同一幂等键 |
| 用户关闭面板 | 保持 pending，不代表拒绝 |
| 用户切到其它 Run | 原审批仍存在并能再次打开 |
| 服务端判定过期 | UI 切换 expired，不允许再次提交 |
| 服务端策略拒绝 | 显示 error；不伪装成用户拒绝 |
| 断线后点击批准 | 如果没有可信在线确认，应保留可恢复/失败状态；禁止离线假批准 |
| 高风险审批 | Host 可强制二次确认或输入确认语，UI 原语可以承载但不能绕过 |

### B6. Diff / Changeset

- `selectedFileId` 和 `selectedHunkId` 是 UI 选择状态；评论有自己的 `commentId`，不可仅存在 DOM 中。
- 悬浮行操作不会覆盖代码选择复制功能。
- 对长文件保持可见片段的语义行号；跳转到某行时必须允许懒加载片段。
- 若一个 hunk 被新 ChangeSet Revision 替换，其旧评论标记为“可能过期”，不自动附着到不相干内容。
- `apply` 必须关联 ChangeSet ID、baseRevision、workspaceId，后端再执行检查。

## C. 组件契约矩阵

| 组件 | 必须 Props / Context | 用户 Intent | 可访问性模式 | 不做的事 |
|---|---|---|---|---|
| `AiComposer` | controller, locale, submitPolicy | send, attach, selectContext | textarea, live error | LLM 请求 |
| `AiContextPicker` | items, activeId, filtering | query, select, dismiss | combobox/listbox | 索引所有文件 |
| `AiConversationList` | items, selectedId | open, search, pin | list + buttons | 数据持久化 |
| `AiMessageTimeline` | visibleItemIds, follow policy | jump, loadMore | list/feed + polite summary | 保证消息顺序 |
| `AiMessage` | messageId, parts selector | copy, regenerate, edit | article/group + actions | 产生回答 |
| `AiCitationList` | source references | open, copy | list with links | 自动验证外部内容 |
| `AiExecutionStatus` | executionId, capabilities | stop, pause, resume | status + buttons | 执行任务 |
| `AiStepList` | stepIds, selection | expand, select | list/tree by shape | tool orchestration |
| `AiToolInvocation` | toolId, redacted preview | inspect, copy safe output | disclosure | 执行 tool |
| `AiApprovalPrompt` | approvalId, risk/scope | approve, reject | alertdialog/dialog | 授权判断 |
| `AiArtifactPreview` | artifactId, renderer registry | open, download | content-specific | 信任未知 HTML |
| `AiFileChangeTree` | changed files | select, navigate | treeview | git filesystem |
| `AiDiffViewer` | diff source + anchors | select, comment | region, navigable rows | patch apply |
| `AiHunkReview` | hunk/comment refs | mark reviewed, comment | editor or form | 审批部署 |

**Slot 原则：** 语义结构以 compound-part 表示；WC 用 named slot，React 用 children/render props，Vue 用 scoped slot。既不强求三端 API 字面完全相同，也不能改变业务事件含义。

## D. 组件 API 与状态适配示例

### D1. 独立 Headless Composer（不需要 Zeus 渲染器）

```ts
const store = createAiStore({ initialSnapshot });
const controller = createComposerController({
  host,
  conversationId,
  submitPolicy: { enter: 'submit', allowAttachmentsOnly: true },
});

const onInput = (text: string) => controller.setText(text);
const unsub = store.subscribe(
  state => state.conversationMessageIds[conversationId],
  () => updateVisibleMessageIds(),
);

// 组件卸载：仅释放 controller 和 subscription，不取消已被 host 接受的任务。
function cleanup() {
  unsub();
  controller.dispose();
}
```

### D2. React Renderer Adapter

```tsx
const controller = useAiComposer({ conversationId });
const view = useAiController(controller, x => x);

return (
  <div data-state={view.submitState}>
    <textarea
      value={view.text}
      onChange={e => controller.setText(e.target.value)}
      onCompositionStart={() => controller.setComposing(true)}
      onCompositionEnd={() => controller.setComposing(false)}
    />
    <button disabled={view.submitState === 'pending'} onClick={() => void controller.submit()}>
      Send
    </button>
  </div>
);
```

上方为交互示例；`setComposing()` 应作为 Core API 在实现时补齐，避免 JSX 示例中的方法与接口定义漂移。

### D3. Vue Adapter

```vue
<script setup lang="ts">
const controller = useAiComposer({ conversationId })
const view = useAiController(controller)
</script>
<template>
  <textarea :value="view.text" @input="controller.setText($event.target.value)" />
  <button :disabled="view.submitState === 'pending'" @click="controller.submit()">Send</button>
</template>
```

### D4. Web Component Adapter

```html
<zw-ai-composer data-density="compact"></zw-ai-composer>
```

```ts
const el = document.querySelector('zw-ai-composer');
el.controller = controller; // property; controller 不是 JSON Attribute
```

禁止将 controller 作为 HTML 字符串属性；WC 要暴露 `value`、`disabled`、`submit` 等稳定基础能力，但后端 Host 不可由 HTML 标签自动注入任意命令权限。

## E. 状态/事件视觉反馈规范

| 状态 | 必须传达 | UI 可以自定义 |
|---|---|---|
| Generating | 正在生成、可停止（若支持） | Spinner / 动画 / 文案 |
| Tool running | 工具名称、等待过程、输出入口 | Timeline / Activity Card |
| Awaiting approval | 明确需要用户参与，风险范围 | Inline Card / Dialog / Tray |
| Failed | 失败原因、恢复/重试（如支持） | Toast + Error Panel |
| Cancel requested | 已提交停止请求，但尚未确认停止 | 微状态文案 |
| Completed | 结果最终版本、可操作产物 | Check / Summary / Link |
| Offline | 数据可能不是最新，待恢复 | Banner / Small status |
| Replaying | 正在恢复丢失事件 | 轻量恢复状态，不假定任务终止 |

## F. 非功能验收脚本（手工 + E2E）

1. 输入中文拼音并回车选词，不能误发送。
2. 连续发送同一条指令，只能产生一个幂等提交；编辑后新提交有新 Key。
3. 发送后在 Ack 到达前继续输入，Ack 只能清理已提交版本，不得清空新增内容。
4. 用户滚到 100 条历史消息之前，新增 500 个 Token，阅读位置保持不变。
5. 用户打开屏幕阅读器，流式更新不逐 token 打断播报。
6. 4 个 Agent 同时运行，各自审批/取消/状态/事件不串线。
7. 用户拒绝权限后，不得出现“已成功执行”状态；晚到旧事件不能将终态逆转。
8. 断开 WebSocket 后重连，消息 Delta 不重复、不断档；gap 缺失触发恢复。
9. Diff 版本变化后评论提示过期；采纳必须经过服务器版本与权限检查。
10. 在 Node SSR 中 import 纯 Core/React/Vue 适配模块，不得访问 DOM 全局变量。
11. 同一测试 Fixture 在原生 WC、React、Vue 中可完成发送、滚动、审批场景。
12. 通过独立 npm pack 安装完整例子，无需直接引用 Monorepo 内源码。

## G. 进一步开放设计问题

- Compose UI 是否要内置语音输入？建议以 Plugin 实现，受浏览器权限与音频处理限制。
- 任务是否必须可暂停？不应承诺，使用 Host `capabilities` 显式支持。
- `AiThinkingSummary` 是否用于公开思维链？**不用于展示模型私有推理**，只能展示已由后端决定公开的过程摘要。
- Agent 运行中的“编辑任务描述”是否会替换执行？优先设计为追加 Follow-up 或带版本的 Resume Command，不擅自改写正在执行的历史输入。
- 是否所有 Primitive 都生成 WC？**不是**；只有已通过生命周期、插槽和浏览器适配测试的部分可发布 WC。
