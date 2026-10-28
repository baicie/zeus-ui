# `@zeus-web/ai-wc`

Zeus AI Headless V2 的 Web Component 适配（AI2-503）：`zw-ai-*` 自定义元素。

- 包状态：**Proposed / 实验性**，`private`。不依赖 React / Vue。

## 规则

- **按需注册**：主入口只导出 `defineAiComposer()`、`defineAiMessageTimeline()` 等函数，import 时不定义任何元素、不读 `HTMLElement`（SSR 安全）。客户端也可以 `import '@zeus-web/ai-wc/define'` 一次注册全部。
- **复杂对象只走 Property**：`controller`、`session`、`conversation`、`review`、`renderers` 等只能用 DOM property 设置，不做 attribute 序列化；只有 `label`、`layout`、`follow`、`presentation`、`confirmation-phrase`、`sandbox` 这类简单选项读 attribute。
- **Light DOM 渲染**：元素把共享视图 patch 进自己的 light DOM（无 Shadow 样式），节点按 key 复用，重渲染不丢焦点和光标。页面放在元素里的 `slot="toolbar"` / `slot="actions"` 子节点会被投影到对应位置。
- **断开即清理**：`disconnectedCallback` 释放所有订阅和元素自己创建的控制器；不会取消 Host 已受理的任务。
- **事件不带敏感数据**：`zw-ai-dismiss`（审批面板关闭，审批仍为 pending）、`zw-ai-select`（`{ conversationId }`）。

## 元素

`zw-ai-composer`、`zw-ai-message-timeline`、`zw-ai-message`、`zw-ai-citation-list`、`zw-ai-artifact-preview`、`zw-ai-conversation-list`、`zw-ai-execution-status`、`zw-ai-step-list`、`zw-ai-step`、`zw-ai-tool-invocation`、`zw-ai-approval-prompt`、`zw-ai-run-switcher`、`zw-ai-workspace-picker`、`zw-ai-file-change-tree`、`zw-ai-diff-viewer`、`zw-ai-test-report`、`zw-ai-changeset-actions`。

```ts
import { createComposerController } from '@zeus-web/ai-core'
import { defineAiComposer } from '@zeus-web/ai-wc'

defineAiComposer()
const element = document.querySelector('zw-ai-composer')
element.controller = createComposerController({ session, conversationId }) // property, not attribute
```
