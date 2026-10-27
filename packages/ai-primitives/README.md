# `@zeus-web/ai-primitives`

Zeus AI Headless V2 的框架无关交互原语（AI2-206 ~ AI2-210、AI2-304 ~ AI2-306、AI2-403 ~ AI2-406、AI2-512）。

- 包状态：**Proposed / 实验性**，`private`。
- 不访问 DOM、不依赖任何 UI 框架，SSR 中 import 安全。

## 原语如何工作

每个原语把 `@zeus-web/ai-core` 控制器的 ViewModel 转成若干 **part**：`attrs`（DOM 属性名：`role`、`aria-*`、`data-*`、`tabindex`…）+ `on`（接收中性事件 `{ key, isComposing, value, preventDefault }` 的处理器）+ `text`（永远是纯文本）。React / Vue / WC 适配器各用一个通用函数把 part 映射到自己的写法，因此三端语义一致。

| 原语                                                                                                               | 函数                                                                                  | 交互模式                                                                      |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `AiComposer` / `AiAttachmentTray`                                                                                  | `getComposerParts`、`getAttachmentTrayParts`                                          | textarea + live 错误说明；IME 与菜单优先于 Enter 发送                         |
| `AiContextPicker` / `AiCommandPalette`                                                                             | `createContextPicker`、`createCombobox`、`getComboboxParts`                           | APG Combobox + Listbox，`aria-activedescendant`                               |
| `AiMessageTimeline` / `AiMessage`                                                                                  | `getTimelineParts`、`getMessageParts`                                                 | APG Feed，PageUp/PageDown，单一 polite live region                            |
| `AiMessageContent`                                                                                                 | `describePart`、`parseMarkdown`、`createRendererRegistry`                             | 安全 Markdown AST；外部 Renderer 可注册，缺失时降级                           |
| `AiCitationList` / `AiArtifactList` / `AiArtifactPreview`                                                          | `getCitationListParts`、`getArtifactListParts`、`getArtifactPreviewParts`             | 外链仅 http(s)，`rel="noopener noreferrer"`                                   |
| `AiExecutionStatus` / `AiStepList` / `AiPlanOutline` / `AiToolInvocation`                                          | `getExecutionStatusParts`、`stepTreeNodes` + `getTreeParts`、`getToolInvocationParts` | 状态文字 + `data-status` 双编码；APG Treeview；工具参数脱敏                   |
| `AiApprovalPrompt`                                                                                                 | `getApprovalPromptParts`                                                              | alertdialog；先展示动作/目标/范围/风险/有效期；可要求确认语；Esc 只关闭不拒绝 |
| `AiRunSwitcher`                                                                                                    | `getRunSwitcherParts`                                                                 | APG Tabs，roving tabindex                                                     |
| `AiWorkspacePicker` / `AiFileChangeTree` / `AiDiffViewer` / `AiHunkReview` / `AiTestReport` / `AiChangesetActions` | `coding.ts`                                                                           | Listbox / Treeview / 带稳定锚点的 diff 行 / n、p 跳 hunk                      |

可选能力（`@zeus-web/ai-primitives/extensions`）：`createVoiceInput`、`createAudioPlayback`、`getThinkingSummaryParts`、`formatUsage`、`createCommandPalette`、`groupRunsForBoard`。均不内置语音/音频 SDK，由宿主注入。

## Markdown 安全规则

- 只产出 AST，不产出 HTML；源文本中的原始 HTML 保持为文字。
- 链接协议白名单：`http`、`https`、`mailto`、页内 `#anchor`；含控制字符/空白的 URL 一律拒绝。
- 图片默认不自动加载（由适配器决定），避免模型借图片 URL 外传数据。
- 未闭合的代码围栏保留为 `closed: false` 的代码块，流式输出时不反复重建。
