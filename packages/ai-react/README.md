# `@zeus-web/ai-react`

Zeus AI Headless V2 的 React 适配（AI2-501）。**原生 React 渲染**，不依赖 Web Component 运行时；import 时不访问 DOM，可用于 SSR。

- 包状态：**Proposed / 实验性**，`private`。peer：`react >= 18`。

## Hooks

| Hook                                           | 作用                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| `useController(controller, selector?, equal?)` | 通过 `useSyncExternalStore` 订阅控制器 ViewModel 的切片                   |
| `useAiState(store, selector, equal?)`          | 订阅规范化 Store 的切片                                                   |
| `useOwnedController(factory, deps)`            | 组件内创建控制器，卸载时 `dispose`（StrictMode 安全；不会取消 Host 任务） |
| `useIds()`                                     | 基于 `useId` 的稳定 DOM id                                                |
| `AiSessionProvider` / `useAiSession`           | 可选的组合便利                                                            |

## 组件

`AiComposer`（可接 `contextPicker`、`toolbar`）、`AiMessageTimeline`（`renderMessage` 可返回任意 ReactNode）、`AiMessage`、`AiMessageContent`（`renderers` 注册 ReactNode 渲染器，出错自动降级）、`AiAssetImage`、`AiCitationList`、`AiArtifactPreview`、`AiConversationList`、`AiExecutionStatus`、`AiStepList` / `AiPlanOutline` / `AiStep`、`AiToolInvocation`、`AiApprovalPrompt`、`AiRunSwitcher`、`AiWorkspacePicker`、`AiFileChangeTree`、`AiDiffViewer`、`AiHunkComments`、`AiTestReport`、`AiChangesetActions`。

所有组件都渲染 `@zeus-web/ai-primitives` 的共享视图，DOM 结构、角色与键盘行为与 Vue / WC 适配一致。组件不带样式；滚动容器是 `[data-part="scroller"]`，需要由应用设置 `overflow: auto` 与高度。

```ts
import {
  createAiSession,
  createComposerController,
  createConversationController,
} from '@zeus-web/ai-core'
import {
  AiComposer,
  AiMessageTimeline,
  AiSessionProvider,
} from '@zeus-web/ai-react'

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

// <AiSessionProvider session={session}>
//   <AiMessageTimeline conversation={conversation} />
//   <AiComposer controller={composer} />
// </AiSessionProvider>
```
