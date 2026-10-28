# `@zeus-web/ai-vue`

Zeus AI Headless V2 的 Vue 适配（AI2-502）。**原生 Vue 渲染**（render 函数 + scoped slots），不依赖 Web Component 运行时；import 时不访问 DOM，可用于 SSR。

- 包状态：**Proposed / 实验性**，`private`。peer：`vue >= 3.5`。

## Composables

`useController(controller, selector?)`、`useAiState(store, selector)`（返回只读 `shallowRef`，只在切片变化时更新）、`useOwnedController(factory)`（随组件作用域 `dispose`，不取消 Host 任务）、`useIds()`、`provideAiSession` / `useAiSession`。

## 组件与 scoped slots

| 组件                             | scoped slot                                              |
| -------------------------------- | -------------------------------------------------------- |
| `AiComposer`                     | `toolbar`                                                |
| `AiMessageTimeline`              | `message`（`{ messageId }`）                             |
| `AiMessage` / `AiMessageContent` | `block`（`{ block, part }`）、`actions`（`{ message }`） |
| `AiStepList` / `AiPlanOutline`   | `step`（`{ stepId }`）                                   |
| `AiDiffViewer`                   | `hunk-actions`（`{ hunkId }`）                           |

其余：`AiAssetImage`、`AiCitationList`、`AiArtifactPreview`、`AiConversationList`（`@select`）、`AiExecutionStatus`、`AiStep`、`AiToolInvocation`、`AiApprovalPrompt`（`onDismiss` 只关闭、不拒绝）、`AiRunSwitcher`、`AiWorkspacePicker`、`AiFileChangeTree`、`AiHunkComments`、`AiTestReport`、`AiChangesetActions`。

组件渲染 `@zeus-web/ai-primitives` 的共享视图，DOM 结构、角色与键盘行为与 React / WC 一致；不带样式，滚动容器为 `[data-part="scroller"]`。
