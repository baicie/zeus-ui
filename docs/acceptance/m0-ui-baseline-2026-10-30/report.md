# M0 Zeus UI 基线审计（2026-10-30）

对应 Zeus 0.2.0 设计包 PR-02。本记录只写本地实际执行过的命令和读到的文件；远端状态无法核实的项目标为 BLOCKED。

## A. 基线

| 项目          | 值                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 仓库 / 分支   | `zeus-ui` / `codex/m0-ui-baseline`                                                                                      |
| Base          | `7cab4ab0a8bd`（2026-10-28，#119），最后一次成功 fetch 为 2026-10-29 20:39                                              |
| 远端实时 HEAD | BLOCKED：`git fetch` 连不上本地代理，`gh` token 失效，api.github.com 被沙箱拒绝                                         |
| npm registry  | BLOCKED：`npm view` 返回 403                                                                                            |
| 环境          | macOS arm64，Node 24.18.0，pnpm 10.33.4（默认 shell Node 22.12.0 不满足 engines）                                       |
| 未推送的工作  | 主 checkout 的 `codex/ai-headless-ci-gates` 有 `2a24ac5`（AI CI job）和 `bc3023c`（文档去掉 `private`），本切片只读未改 |

设计包 `01-BASELINE-AUDIT.md` 的快照与本地事实的差异：

- 设计包说 AI 包 “`private` 与 `publishConfig` 同时存在”。在 `7cab4ab` 上，6 个 `@zeus-web/ai-*` 包都没有 `private` 字段，都带 `publishConfig {access: public, provenance: true}`，版本 `0.1.0-beta.35`。`scripts/release/workspace.ts` 统计为 46 个可发布包、0 个 private。矛盾在文档：6 个 README 第 5–7 行、`docs/ai-headless-v2/implementation-status.md`、`quality-gates.md`、`migration-guide.md`、`docs/internal/packages.md` 仍写 `private`。`bc3023c` 修的正是这些位置。
- `docs/ai-headless-v2/adr-001-domain-and-renderer.md` 写 `ai-wc → ai-core + primitives + Zeus WC Runtime`。实际 `ai-wc` 的 17 个 `zw-ai-*` 元素由 `packages/ai-wc/src/element.ts` 的 `defineAiElement` 定义，直接继承 `HTMLElement`，渲染到 light DOM，不依赖任何 `@zeus-js/*` 包。`ai-react`、`ai-vue` 不依赖 `ai-wc`，所以 ADR 的核心决定（React/Vue 不被 WC 强制依赖，AI V2 保留独立 renderer）仍然成立，只是依赖描述过时。
- `examples/ai-showcase/src/demo-host.ts`（659 行）确认是浏览器内的脚本化 mock，主应用是 React 19。Vite 配置把 AI 包 alias 到源码，所以 showcase 不是 tarball 消费者。仓库里没有 Node Host 服务端，`ai-adapters` 只有 SSE/WS 客户端适配器。

## B. 变更与逐项状态

| 设计包任务                                     | 状态    | 说明                                 |
| ---------------------------------------------- | ------- | ------------------------------------ |
| 1. UI 包、Registry 与 WebC 包模式的兼容矩阵    | DONE    | 见 D                                 |
| 2. AI V2 六包 private、README、pack、读屏现状  | DONE    | 见 A、C、E；读屏人工验收 NOT_RUN     |
| 3. Native Admin / AI Native Shell 所需组件盘点 | DONE    | 见 E                                 |
| 4. G7 与四产品的最小集成测试和风险台账         | PARTIAL | 风险台账见 F；本切片没有新增集成测试 |

代码修复 `56ff345 fix(checks): cover ui and ai packages in import check`：

- 问题：`check:zeus-imports` 不扫描 `packages/ui` 和 6 个 `ai-*` 包。在 `packages/ai-core/src` 与 `packages/primitives/button/src` 各写一行 `import { ReactiveEffect } from '@zeus-js/signal/internal'`，原实现只报告 button。
- 修复：`scripts/checks/check-zeus-workspace.ts` 的 `ZEUS_IMPORT_CHECKED_ROOTS` 加入这 7 个目录；新增 spec 在修复前失败，修复后通过。
- 这些包目前都没有 import `@zeus-js/*`，所以仓库上的检查结果不变。`packages/icons` 和 `packages/ai` 没有纳入：它们的构建脚本和契约测试 import `@zeus-js/output-icons` 与 `@zeus-js/component-analyzer`，需要先定策略。
- 公开 API、包导出没有变化。

## C. 验证

tsx CLI 会创建 IPC pipe，沙箱拒绝监听（EPERM），所以 `pnpm <script>` 形式的 tsx 脚本改用 `node --import tsx <script>` 运行。

| 命令                                                                                                                                                                                               | 结果                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                                                                                                                                                                       | PASS                                                                                                              |
| `check:zeus-imports`、`check:workspace-overrides`、`check:zeus-baseline`、`check:zeus-beta-alignment`、`check:product-layers`、`check:exports`                                                     | PASS                                                                                                              |
| `check:build-output`、`check:bundle-size`、release readiness                                                                                                                                       | PASS，46 个可发布包                                                                                               |
| registry、ui-package、docs playground、public-docs、i18n、generated-docs、product-contract、advanced contracts、component-coverage、showcase metadata / implementation、examples contract、cli-add | PASS                                                                                                              |
| `check:cli-consumer`（重新构建 cli 后）                                                                                                                                                            | PASS：react、vue、file-registry 三个 consumer                                                                     |
| `ai:pack-check`                                                                                                                                                                                    | PASS：6 个 tarball，Node 下 import 7 个入口，consumer 对打包声明做 tsc 通过                                       |
| vitest unit：ai-core / ai-adapters / ai-primitives                                                                                                                                                 | PASS，19 文件 224 测试                                                                                            |
| vitest unit-jsdom：ai-react / ai-vue / ai-wc                                                                                                                                                       | PASS，3 文件 17 测试                                                                                              |
| vitest `e2e/ai`、`e2e/advanced`                                                                                                                                                                    | PASS，4 文件 86 测试；9 文件 140 测试                                                                             |
| `test-unit:node --maxWorkers=2`                                                                                                                                                                    | FAIL（环境）：132 文件中 128 通过，1050 测试中 1034 通过；16 个失败全部是 tsx pipe 或 `node:http` listen 的 EPERM |
| `test-unit:jsdom --maxWorkers=2`                                                                                                                                                                   | FAIL（环境）：134 文件中 132 通过，1038 测试中 1025 通过；13 个失败同样是 EPERM                                   |
| `test-unit:react-showcase`                                                                                                                                                                         | PASS，11 文件 79 测试                                                                                             |
| ai-showcase `check` 与 `vite build`                                                                                                                                                                | PASS，JS 396.85 kB（gzip 127.82 kB）                                                                              |
| `node --import tsx scripts/examples/sync-showcase-registry.ts --check`                                                                                                                             | FAIL（真实漂移，见 F2）                                                                                           |
| `scripts/checks/examples/check-showcase-registry.ts`                                                                                                                                               | FAIL（孤立检查，见 F3）                                                                                           |
| `test-e2e:ai`、`showcase:e2e`、`data-grid:framework-e2e`、`check:component-mode-parity`、`docs:build`                                                                                              | BLOCKED：不能监听本地端口，Playwright 浏览器服务起不来                                                            |
| 远端 PR / CI、`npm view`                                                                                                                                                                           | BLOCKED                                                                                                           |
| VoiceOver / NVDA 读屏、200% 缩放                                                                                                                                                                   | NOT_RUN，需要人工                                                                                                 |
| 全量 `pnpm lint`、全量 `pnpm build`                                                                                                                                                                | NOT_RUN                                                                                                           |

`data-grid-benchmark-contract.spec.ts` 的 9 个失败单独重跑后复核过：断言收到的错误是子进程 tsx 的 `listen EPERM ... tsx-501/*.pipe`，不是 `packageVersion` 校验逻辑出错。

原始日志保存在执行机的 `$TMPDIR/pr02/`，不进仓库。

## D. 兼容矩阵（本地 lockfile 与 manifest）

| 项目                 | 版本                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------- |
| zeus-ui 根版本       | `0.1.0-beta.35`                                                                              |
| `@zeus-js/*`         | `0.1.1-beta.20`，精确版本，全部来自 registry 并带 integrity；没有 workspace override 或 link |
| peer `@zeus-js/zeus` | 30 个包精确对齐 `0.1.1-beta.20`，与本地 zeus `d853352` 的版本一致                            |
| React                | 19.2.7；`examples/data-grid-react18-consumer` 用 18.3.1                                      |
| Vue                  | 3.5.38                                                                                       |
| Vite                 | 8.3.4（lockfile 中另有 5.4.21、8.0.16 作为传递依赖）                                         |
| TypeScript           | 6.0.3                                                                                        |

Registry 与 WebC 包模式的关系：`packages/registry/registry.json` 有 27 个条目（24 个 component、2 个 utility、1 个 style）。React / Vue 模板 import `@zeus-web/<x>/react|vue` 包装层，模板内没有找到自有状态或事件监听，属于 app-owned 的样式层，行为仍由同一份 CE 实现。另有 12 个模板（`templates/native/*` 和高级组件的 react / vue 模板）不在 `registry.json` 中，也不进 dist。

AI 包发布状态：manifest 是可发布形状，已列入发布矩阵；本地没有 `v0.1.0-beta.35` tag（最新 `v0.1.0-beta.34`），npm 查询 BLOCKED，因此**是否已发布无法核实**。AI 包只有 ESM 产物，没有 AI 专用体积预算，目前适用 `scripts/checks/build/check-bundle-size.ts` 的全局上限 49,152 B gzip。按 2026-10-29 23:15 本地构建的 dist 测得：`ai-core` 40,007 B、`ai-primitives` 22,070 B、`ai-wc` 8,386 B、`ai-vue` 7,062 B、`ai-react` 6,980 B、`ai-adapters` 6,296 B。`ai-core` 已用掉上限的 81%。

G0–G5 在 base 上只有本地证据：base 的 CI 不跑 `e2e/ai`、`ai:pack-check`、`test-e2e:ai`，要等 `2a24ac5` 合入后才进 CI。G6 的读屏人工抽样（AI2-507）仍未完成。

## E. 四产品所需组件盘点

- **Zeus Admin（Native）**：zeus 仓 `examples/admin` 依赖 `@zeus-web/data-grid`、`dialog`、`input` 的 `0.1.0-beta.33`，落后两个版本。缺分页、上传、日期选择、面包屑组件；只有 select 声明了 `formAssociated`；主题没有 RTL；`components.json` 只覆盖 6 个组件。
- **AI Workbench（Native）**：可用 `ai-wc` 的 17 个元素（`defineAiElements()` 直接注册 14 个，`zw-ai-message`、`zw-ai-step`、`zw-ai-tool-invocation` 由父元素的 define 函数连带注册）加 `ai-core` 的 domain / controller。Node Reference Host 需要从零实现，可复用 `ai-core` 的 mock / replay host 与 `ai-adapters` 的 SSE / WS 客户端。

## F. 风险台账与后续输入

1. **已修复**：import 边界检查漏扫 ui 与 ai 包（`56ff345`）。
2. **记录未改**：`examples/react-showcase/zeus-ui.lock.json` 与 `examples/vue-showcase/zeus-ui.lock.json` 第 9–10 行记录 registry `0.1.0-beta.33`（integrity `bf4130a9…`），当前是 `0.1.0-beta.35`。没有 workflow 调用这个检查，`version:packages` 也不会同步这两个文件。交 PR-25。
3. **记录未改**：`scripts/checks/examples/check-showcase-registry.ts` 第 79 行要求 `package.json` 有 `check:showcase-registry` 脚本，但脚本不存在，检查也没接入任何流程。交 PR-25。
4. **契约缺口（跨仓）**：`packages/zeus-compat/src/index.ts` 从 `@zeus-js/runtime-dom` 根入口转发 `provideDOMContext`、`resolveDOMContext`，11 个 primitive 在用；primitive 产物还 import `@zeus-js/web-c-runtime` 和 `@zeus-js/output-*-wrapper/runtime`。这三个入口都不在 zeus `docs/api/downstream-contract.md` 的 Allowed 列表里。需要 zeus 侧决定写进契约还是改从 `@zeus-js/zeus` 导出。交 PR-09 / PR-24。
5. 文档过时：`apps/docs/guide/registry.md` 第 21 行与中文版第 31 行仍写 “Phase 22: cn/globals/button/input”。交 PR-25。
6. AI ADR 依赖描述过时（见 A）。交 PR-26。
7. Canary 门禁建议：`.github/workflows/zeus-canary-compat.yml` 已覆盖 imports、check、lint、test-unit、canary、build、exports、build-output。建议补 `examples:build`、`ai:pack-check`、`vitest e2e e2e/ai`、`check:cli-consumer`，并把 D 的版本矩阵固化为检查。交 PR-24 / PR-35。

后续切片输入：PR-24 处理 F4、E 中的 Admin 组件缺口与主题契约；PR-25 处理 F2、F3、F5、孤立模板与第三方作者模板（目前不存在）；PR-26 需要合入 `bc3023c` 与 `2a24ac5`、补读屏验收、定 AI 体积预算，是否发布与打 tag 需用户授权；PR-32 从零实现 Node Host；PR-33 基于 `ai-wc` 与 `ai-core`。

## G. 停止决定

PARTIAL：代码修复与本证据可审查；远端、npm、浏览器 E2E 与人工读屏未执行。未推送、未创建 PR、未合并、未发布，未使用任何 secret 或付费模型。
