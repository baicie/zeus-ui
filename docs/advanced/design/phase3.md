# Phase 3：`@zeus-web/chat` 产品化接入层

## 目标

Phase 1 做了 `@zeus-web/virtual`；Phase 2 做了 `@zeus-web/chat` headless 能力层。Phase 3 不继续扩展 chat 底层组件，而是把 `@zeus-web/chat` 接入产品层：

```txt
Phase 3: Chat Product Layer

目标:
  1. 提供 Chat 的 registry 条目
  2. 提供 Chat 的 native / react / vue 模板源码
  3. 提供 Chat 的 AI metadata
  4. 提供检查脚本与单元测试，保证 product layer 不漂移
```

Phase 3 一句话：把 headless chat 变成可被 CLI、文档、AI、showcase、产品层消费的组件资产。

## 非目标

本阶段不做：

1. 不接入任何模型服务（OpenAI / DeepSeek / Anthropic / 自研 LLM 等）。
2. 不实现请求 transport。
3. 不做 Markdown parser / 渲染器。
4. 不做 syntax highlight。
5. 不做文件上传传输层。
6. 不做持久化 session。
7. 不引入 virtual thread（属于 Phase 4）。
8. 不实现 data-grid。
9. **不**接入 `examples/showcase-shared` 的 implemented showcase 列表（chat 暂无独立 React/Vue showcase demo 页面）。

## 仓库结构对齐

仓库已有的产品层与设计假设不一致，本阶段以**现有结构**为权威：

| 角色           | 现有结构                                                                                   | Phase 3 扩展点                                        |
| -------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Registry       | `packages/registry/registry.json` + `packages/registry/templates/<framework>/<name>.<ext>` | 加 `chat` 条目 + 三端模板                             |
| AI metadata    | `packages/ai/src/metadata.ts`（内联对象）                                                  | 加 `advancedComponents: ZeusWebAiAdvancedComponent[]` |
| Contract check | `scripts/checks/contract/*.ts`                                                             | 新增 `check-chat-product-contract.ts` 防漂移          |

## 文件清单

### 修改文件

```txt
docs/advanced/design/phase3.md
packages/registry/registry.json
packages/registry/package.json
packages/registry/__tests__/registry-package.spec.ts
packages/ai/src/types.ts
packages/ai/src/metadata.ts
packages/ai/src/render.ts
packages/ai/src/validate.ts
packages/ai/__tests__/ai.spec.ts
package.json
```

### 新增文件

```txt
packages/registry/templates/native/chat.ts
packages/registry/templates/react/chat.tsx
packages/registry/templates/vue/chat.vue
packages/ai/__tests__/chat-ai-metadata.spec.ts
scripts/checks/contract/check-chat-product-contract.ts
scripts/checks/contract/__tests__/check-chat-product-contract.spec.ts
```

## 分层设计

### Registry 分层

`packages/registry` 存的是**可复制源码组件资产**，不是运行时依赖。

Phase 3 给 `registry.json` 增加 `chat` 条目：

```json
{
  "name": "chat",
  "type": "component",
  "description": "...",
  "frameworks": ["native", "react", "vue"],
  "dependencies": ["@zeus-web/chat"],
  "registryDependencies": ["cn", "globals"],
  "files": [
    {
      "framework": "native",
      "source": "templates/native/chat.ts",
      "target": "components/chat.ts"
    },
    {
      "framework": "react",
      "source": "templates/react/chat.tsx",
      "target": "components/ui/chat.tsx"
    },
    {
      "framework": "vue",
      "source": "templates/vue/chat.vue",
      "target": "components/ui/chat.vue"
    }
  ]
}
```

`templates/` 目录会在 build 时被 `scripts/copy-registry-assets.mjs` 整体复制到 `dist/templates/`，并通过 `package.json` 的 `exports` 暴露。

模板约束：

- `native/chat.ts`：使用 `@zeus-web/chat/wc/auto`，导出 `mountChatDemo(root)` 装配函数，不含 provider 请求逻辑。
- `react/chat.tsx`：使用 `@zeus-web/chat/react` 的薄 wrapper 组件，按 styled 设计（与 button/input 等 registry 模板一致，使用 Tailwind 主题令牌和 `cn` 工具）。
- `vue/chat.vue`：使用 `@zeus-web/chat/vue` 的薄 wrapper 组件，与 react 版语义等价。

### AI metadata 分层

`packages/ai/src/types.ts` 增加新类型 `ZeusWebAiAdvancedComponent`（不与 primitive 组件共享 schema，因为 advanced 组件没有 styled 模板、sourceTarget 约束），并给 `ZeusWebAiMetadata` 增加 `advancedComponents` 字段。

`chatAdvancedMetadata` 至少包含：

- `name: 'chat'`
- `packageName: '@zeus-web/chat'`
- `category: 'advanced'`
- `summary`：一句话说明 chat 是什么。
- `whenToUse`：使用场景。
- `doNotUseFor`：禁止事项（必须包含"不要把它当作模型请求库"）。
- `components`：8 个 chat 子组件 tag（`zw-chat` 等）。
- `slots`、`events`、`methods` 摘要。
- `examples`：至少一个 native 与一个 react 示例。
- `promptHints`：必须包含"业务请求逻辑应该放在应用层"。

`validateAiMetadata` 必须校验 `advancedComponents`，并强制 `doNotUseFor` 含 "不要把它当作模型请求库"、`promptHints` 含 "业务请求逻辑应该放在应用层"。

`renderAiMarkdown` / `renderAiJson` 必须把 `advancedComponents` 输出到对应的章节。

### Contract check 分层

新增 `scripts/checks/contract/check-chat-product-contract.ts`：

```txt
1. registry 有 chat 条目
2. registry chat 引用了 @zeus-web/chat
3. ai metadata 的 advancedComponents 包含 chat
4. showcase / template 包含 native/react/vue 三端
5. 不出现 provider/API key/真实请求逻辑
6. 不在 Phase 3 引入 markdown/highlight/upload transport
```

具体禁止模式（与设计文档一致）：

```txt
OPENAI_API_KEY
ANTHROPIC_API_KEY
DEEPSEEK_API_KEY
apiKey
Authorization
Bearer
fetch(
XMLHttpRequest
EventSource
WebSocket
marked
markdown-it
highlight.js
shiki
prismjs
```

`package.json` 增加 `check:chat-product-contract` script，并把它串入 `check:product-contract`。

## 验收

```bash
pnpm check
pnpm --filter @zeus-web/registry test
pnpm --filter @zeus-web/ai test
pnpm check:chat-product-contract
pnpm test-unit
pnpm check:exports
pnpm check:advanced-contract
pnpm check:product-contract
```

## 完成标准

```txt
1. registry 能发现 chat
2. registry 三端模板可被复制到用户项目
3. AI metadata 能描述 chat 的正确用法
4. contract check 能防止 provider 请求逻辑进入产品层
5. 单测覆盖 registry、ai metadata、contract check
```

## 下一阶段

Phase 4：Chat Virtual Thread Integration。

```txt
@zeus-web/chat 消费 @zeus-web/virtual
zw-chat-thread 支持 virtual 属性
长消息列表只渲染可见区
保留 headless-first
补完整行为测试
```
