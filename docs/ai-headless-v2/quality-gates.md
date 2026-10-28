# AI Headless V2 质量门禁（G0–G6）与基线

> 记录时间：2026-10-27。机器：Apple M1 / macOS 15.7.7 / Node 22.12.0。数字来自 `temp/ai-headless-perf.json`
> 与 `temp/ai-pack-report.json`（运行下列命令会重新生成）。所有包仍为 `private`，**本文不代表已发布**。

## 门禁状态

| Gate               | 验收条件（`01` §17.3）                       | 状态    | 证据                                                                                       |
| ------------------ | -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| G0 Domain          | S1/S2/S3 事件 fixture 在纯 Node 重放，无 DOM | ✅      | `packages/ai-core/__tests__/replay.spec.ts`、`compat.spec.ts`（快照 checksum 固定）        |
| G1 Headless        | 控制器有可测意图与状态机；SSR import 正常    | ✅      | `ai-core/__tests__/controllers-*.spec.ts`；`pnpm ai:pack-check` 在 Node 中 import 全部入口 |
| G2 Conversation    | S1 浏览器 E2E，含恢复与 Scroll Follow        | ✅      | `e2e/ai-browser/s1-chat.spec.ts`（Chromium / Firefox / WebKit）                            |
| G3 Agent           | S2 审批与取消完整，未经授权不可执行          | ✅      | `e2e/ai-browser/s2-agent.spec.ts`、`e2e/ai/security.spec.ts`                               |
| G4 Coding          | S3 Diff 审查 / 冲突完整，写入只在 Host       | ✅      | `e2e/ai-browser/s3-coding.spec.ts`                                                         |
| G5 Cross-framework | WC、React、Vue 契约一致                      | ✅      | `e2e/ai/contract.spec.ts`（语义快照逐项相等）、`e2e/ai-browser/frameworks.spec.ts`         |
| G6 Release         | 体积与基准有记录，A11y / 安全 / 发布检查通过 | ⚠️ 部分 | 自动化部分全部通过（见下）；**真实屏幕阅读器人工抽样未做**；包未发布                       |

## 运行方式

```bash
npx vitest run --project unit packages/ai-core packages/ai-adapters packages/ai-primitives   # 领域 / 协议 / 原语
npx vitest run --project unit-jsdom packages/ai-react packages/ai-vue packages/ai-wc        # 三端适配器
npx vitest run --project e2e e2e/ai                  # 契约 / 安全 / axe+键盘 / 性能（jsdom）
pnpm test-e2e:ai                                     # S1/S2/S3 真实浏览器（Chromium、Firefox、WebKit）
pnpm ai:pack-check                                   # npm pack → 独立 consumer：SSR import、d.ts、依赖隔离、体积
```

浏览器 E2E 默认跑三个引擎，`AI_E2E_BROWSERS=chromium` 可缩小范围。Playwright 固定版本的浏览器未安装时
（离线机器），会回退到缓存中同一引擎的其他版本并在 stderr 说明。

## 性能基线（AI2-508）

门禁是结构性的（重建次数、DOM 数、泄漏），在不同机器上稳定；耗时只设数量级上限。

| 场景                                                | React | Vue   | WC     | 门禁                                 |
| --------------------------------------------------- | ----- | ----- | ------ | ------------------------------------ |
| 200 条消息中 1000 个 delta：流式消息之外的 DOM 变更 | 2     | 2     | 2      | ≤ 2（只有 feed 的 `aria-busy` 翻转） |
| 同上：store 处理 1000 个 delta                      | 70 ms | 64 ms | 201 ms | < 5 s                                |
| 2000 条消息挂载：渲染的 article 数                  | 14    | 14    | 14     | < 60（窗口化，`aria-setsize=2000`）  |
| 同上：容器内 DOM 节点                               | 151   | 151   | 208    | 记录                                 |
| 30 次挂载 / 卸载后的 store 订阅数                   | 2 → 2 | 2 → 2 | 2 → 2  | 回到基线                             |

| 核心场景                               | 结果                      | 门禁                                                           |
| -------------------------------------- | ------------------------- | -------------------------------------------------------------- |
| 1 万条消息逐条 ingest                  | 1370 ms（0.14 ms/条）     | < 20 s；集合为持久化 `EntityMap`，单次更新成本不随规模线性增长 |
| 4 个并行 Execution × 1000 个 step 事件 | 2197 ms，未读计数正确隔离 | < 60 s                                                         |
| 1 万行 diff 解析                       | 77 ms                     | < 2 s                                                          |
| 1 万文件变更树                         | 263 ms                    | < 2 s                                                          |

## 包体积（`pnpm ai:pack-check`，入口文件 gzip）

| 包                        | 入口                      | gzip                                        |
| ------------------------- | ------------------------- | ------------------------------------------- |
| `@zeus-web/ai-core`       | `.`                       | 39.9 KB（含 Mock / Replay Host 与 fixture） |
| `@zeus-web/ai-adapters`   | `.`                       | 6.2 KB                                      |
| `@zeus-web/ai-primitives` | `.` / `./extensions`      | 17.7 KB / 1.7 KB                            |
| `@zeus-web/ai-react`      | `.`                       | 6.8 KB                                      |
| `@zeus-web/ai-vue`        | `.`                       | 6.9 KB                                      |
| `@zeus-web/ai-wc`         | `.`（实现位于共享 chunk） | 入口 0.3 KB                                 |

尚未设体积预算：在首次发布前按真实消费方式（tree-shaking 后）再定，避免预填无依据的数字（`01` §15.1）。

## 无障碍（AI2-507）

- 自动：axe-core 覆盖 jsdom 中七类界面 × 三个框架，以及真实浏览器中 S1/S2/S3 三个页面；APG 键盘模式（Combobox、Dialog、Treeview、Feed、Tabs）均有 DOM 测试。
- 浏览器发现并修复：`<textarea>` 不能使用 `role="combobox"`（改为 `aria-haspopup` + `aria-activedescendant`）、run tab 的 `aria-label` 与可见名称不一致、diff 行包含非 cell 子元素。
- **未完成**：真实屏幕阅读器（VoiceOver / NVDA）人工抽样，以及移动端窄屏与 200% 缩放检查。上线前需要人工执行并在此记录。

## 安全（AI2-506）

`e2e/ai/security.spec.ts`：XSS 语料穿过三个渲染器、审批伪造 / 越权 / 离线批准 / 改 DOM 解锁、路径穿越、Host-only 副作用、源码中不得出现 `fs` / `child_process` / 供应商 SDK / `innerHTML` 等注入点、工具参数脱敏。S2 浏览器故事另外验证 Host 拒绝伪造与过期修订的审批命令。
