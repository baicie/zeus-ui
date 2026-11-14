# R6-B：AI Workbench 产品门禁进入 CI

状态：**Draft PR，未合并、未推送。** 本文记录缺陷、修复、测试与仍未验证的部分。

## 1. 缺陷（P0）

`zeus-ui` 有五个独立的产品验收命令，但 GitHub Actions 只显式执行了其中一个（`product-acceptance.yml` 里的 `pnpm check:ai-workbench`，还只在 Core 的手动工作流里，`chromium` 单引擎）。

| #   | 问题                                                                                  | 位置（修复前）                            |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| B-1 | `check:ai-workbench-p0` / `-byok` / `-csp` / `-visual` / `-live` 不在任何 CI 工作流里 | 全仓库 grep 无引用                        |
| B-2 | 浏览器选择失败会变成 PASS                                                             | 五个脚本各自的 `filter` + `[].every(...)` |
| B-3 | `check-ai-workbench.ts` 未过滤引擎，未知名称抛错但空列表仍通过                        | 同上                                      |
| B-4 | 视觉门禁无截图 artifact，失败后无法人工判断                                           | 无 upload 步骤                            |
| B-5 | 真实网关测试无受控入口                                                                | `-live` 只能本地跑                        |
| B-6 | 没有针对 `vite build` 产物的验收，全部跑在 dev server 上                              | 五个脚本都用 `createServer`               |

### B-2 是可复现的，不只是理论

```text
$ ZEUS_AI_WORKBENCH_BROWSERS=nonexistent pnpm exec tsx -e "..."
selected: []
passed would be: true
```

`report.every(r => r.status === 'passed')` 在 `report` 为空时返回 `true`。触发路径有四种：拼错的引擎名、只有逗号的值、变量为空，以及**请求的引擎未安装**——最后一种在缓存失效的 runner 上最可能出现。

## 2. 修复

### 2.1 `scripts/checks/ai/support/browsers.ts`（新增）

五个门禁共用的选择器，没有返回空列表的代码路径：

| 输入                           | 行为                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| 未设置                         | 用调用方 `fallback`（默认三引擎）                                                        |
| 空 / 只有逗号                  | **抛错**：`no browser engines requested … an empty selection cannot pass a gate`         |
| 未知名称（`webkitt`、`chrom`） | **抛错**：`unknown browser engine(s): …; expected chromium, firefox, webkit`             |
| 已知但未安装                   | **抛错**：`browser(s) not installed: … — run pnpm exec playwright install --with-deps …` |
| 正常                           | 返回去重、小写化的引擎列表                                                               |

可用性判定是**注入的**（`AvailabilityProbe`），不是环境读取：Playwright 在进程内缓存 `executablePath()`，改 `PLAYWRIGHT_BROWSERS_PATH` 不会影响它，所以"描述一台没有 Firefox 的机器"只能通过显式谓词。这也让逻辑可测。

`onMissing` 区分两个合法场景，因为它们回答不同问题：

- `'skip'` — 跑存在的，报告缺失的。探测工具用；**门禁不能用**，因为小矩阵通过不等于矩阵通过。
- `'include'` — 不询问可用性，原样返回。只用于需要"命名"引擎的调用方。

`browserCache()` 支持 `PLAYWRIGHT_BROWSERS_PATH`（含 `0` 这个 Playwright 的特殊值），并按平台回落到默认目录，使本机与 CI 解析一致。

### 2.2 五个门禁接入

| 文件                           | 改动                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `check-ai-workbench.ts`        | `browserNames = requireBrowsers(...)`；`passed` 增加"每个请求引擎都有结果"与 `report.length > 0` |
| `check-ai-workbench-p0.ts`     | 同上；`passed` 再增加 `checks.length > 0`，报告写入 `absentEngines` / `emptyResults`             |
| `check-ai-workbench-byok.ts`   | 同上，默认 `fallback: ['chromium']`                                                              |
| `check-ai-workbench-live.ts`   | 同上                                                                                             |
| `check-ai-workbench-visual.ts` | 通过同一选择器取 Chromium；`passed` 要求 `checks.length > 0`                                     |

### 2.3 `scripts/checks/ai/check-ai-workbench-build.ts`（新增）

现有门禁全部跑在 Vite dev server 上，证明的是源码，不是产物。新门禁构建**两个真实产物**并驱动它们：

| 构建       | 环境                           | 内容                                |
| ---------- | ------------------------------ | ----------------------------------- |
| production | `ZEUS_AI_HOST_ORIGIN=/ai-host` | 真实 Host、真实 SSE、真实 BYOK 网关 |
| demo       | `ZEUS_AI_DEMO=1`               | Pages 发布的那份，回放录制          |

静态服务器复刻了 `examples/ai-workbench/deploy/nginx.conf` 的三条关键行为：`/ai-host/` 反向代理、服务端注入 `Authorization: Bearer <token>`（浏览器不持有凭据）、SSE 逐块转发不缓冲。

**这一点是实测出来的**：第一版用普通静态服务器，每次流请求都 401，发送静默无效。失败的是缺少 ingress，不是产品——但这也正说明"dev server 通过 Vite proxy 注入 token"与"生产由 nginx 注入"是两条不同的路径，只在产物上验证才有意义。

覆盖的流程（R6-B 明确要求的那六项）：

| 流程                  | 断言                                                                                |
| --------------------- | ----------------------------------------------------------------------------------- |
| Agent ↔ My model 切换 | 20 次往返后仍只有一个 composer                                                      |
| 新建聊天              | 留下一个空的 composer                                                               |
| 输入                  | 键盘逐字符输入，`Enter` 发送一次，时间线出现一次消息，输入框清空                    |
| 流式 Stop             | 用 `mock-slow` 让 token 陆续到达，点 Stop 后线程出现 "stopped"，仍只有一个 composer |
| 刷新                  | 回到可用的 Agent 面；vault 重新锁定；用 passphrase 能重新解锁                       |
| 语言切换              | 文案变为中文；**刷新后仍是中文**；切回英文                                          |

demo 构建额外断言：回放横幅可见、录制线程非空、Agent 面 `new-conversation` **被禁用**（只读是产品决定，断言它被禁用才是断言产品，而不是断言 demo 能写）。

### 2.4 `.github/workflows/ai-workbench.yml`（新增）

四个 job，保持并行化收益：

| job             | 内容                                                                  | 为什么这样切                                                                                       |
| --------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `contract`      | 选择器测试 + `ai:pack-check`                                          | 不需要浏览器，最便宜的地方发现"门禁会空跑"                                                         |
| `browser-gates` | P0、BYOK、CSP、build，三引擎，一个 job 内顺序执行                     | 每个独立 job 要多付约 104s 预热与一次 `playwright install --with-deps`；浏览器缓存与安装是公共成本 |
| `visual`        | 仅 Chromium，按变更文件过滤，上传截图                                 | 最易噪声、最需要人看图的 job；与 `contract` 无依赖，不串行                                         |
| `live`          | `workflow_dispatch` + `inputs.live`，`environment: ai-workbench-live` | PR 事件永远到不了这里，密钥不可能进入 PR 日志                                                      |

视觉门禁的变更过滤匹配 `examples/ai-workbench/`、`packages/{ai,primitives,advanced,themes}/`、`scripts/checks/ai/`；其余情况输出 `::notice::` 说明跳过原因，而不是静默。

参考截图从 `baicie/zeus` 的**固定 SHA** 检出（`d7c82cfd…`），不是 `main`：移动的参考集会让目标漂移而门禁仍然通过。

### 2.5 `ci.yml` 接入

```yaml
ai-workbench:
  uses: ./.github/workflows/ai-workbench.yml
```

独立于 `test` job，Workbench-only 改动不必支付 DataGrid benchmark 的成本。

## 3. 修复过程中发现的产品缺陷

跑真实构建时暴露了两个既有缺陷，都已修复：

### B-7（P2）模型选择器在"重选当前模式"时不关闭

`main.ts` 的 `setMode` 有一个提前返回分支：

```ts
if (next === mode && next === 'host') {
  if (dock.activeId() !== 'host') dock.claim(hostComposer)
  renderPickerLabel()
  return // ← 跳过了下面的 setPickerOpen(false)
}
```

读者打开选择器、点"Agent"（他已经在 Agent），菜单**保持打开**，看起来像点击无效。修复是在该分支补 `setPickerOpen(false)`。有 20 次切换的断言覆盖不到它，因为往返切换从不命中"重选当前模式"。

### B-8（P2）门禁自己写错了调用约定

第一版门禁用 `fill()` + `press('Enter')` 发消息，时间线始终为空。Host composer 是自定义元素，监听真实键盘事件，`fill` 绕过了它。改为 `keyboard.type` + `keyboard.press('Enter')` 后通过——与 `check-ai-workbench-p0.ts` 的做法一致。这不是产品缺陷，但说明"新门禁必须先能在本地跑通再进 CI"。

## 4. 测试与实测

### 4.1 单元测试

| 文件                                           | 用例 | 覆盖                                                                                        |
| ---------------------------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| `scripts/checks/__tests__/ai-browsers.spec.ts` | 11   | 默认值、空值、未知名、去重、未安装、`onMissing` 两种语义、`PLAYWRIGHT_BROWSERS_PATH` 与 `0` |

```text
Tests  11 passed (11)
```

### 4.2 五个门禁的实测结果（本机，Chromium，真实引擎）

| 门禁                        | 结果                                       |
| --------------------------- | ------------------------------------------ |
| `check:ai-workbench-p0`     | PASS，16 项检查（agent + replay 两个面）   |
| `check:ai-workbench-byok`   | PASS，含 vault、流式、Stop、错误状态、重载 |
| `check:ai-workbench-csp`    | PASS，5 项                                 |
| `check:ai-workbench-visual` | PASS，20 项几何与状态断言                  |
| `check:ai-workbench-build`  | **三引擎 × 两个构建面全绿**                |

`check:ai-workbench-build` 的 production 面逐项：

```text
ok   20 Agent ↔ My model switches keep one composer
ok   New chat leaves one empty composer
ok   Enter sends the typed message once
ok   one send produces one message
ok   a streaming reply can be stopped
ok   reload returns to a usable Agent surface
ok   reload finds the stored vault locked
ok   the vault re-unlocks with the passphrase
ok   reload comes back to a usable surface
ok   language switch relabels the shell
ok   the language choice persists across a reload
ok   language switch back restores English
ok   no page exceptions
```

demo 面：

```text
ok   the replay build says it is a replay
ok   the published build keeps one composer per mode
ok   the published build replays a recorded thread
ok   the published Agent surface disables new chat
ok   My model is still usable in the published build
ok   no page exceptions
```

### 4.3 失败即失败，不是 PASS

逐条对照 R6-B 的第 5 条要求：

| 情况         | 现在的行为                                  | 依据                              |
| ------------ | ------------------------------------------- | --------------------------------- |
| 步骤失败     | 非零退出，CI 红                             | 无 `\|\| true`，`set -o pipefail` |
| 超时         | job `timeout-minutes` + Playwright 动作超时 | 明确值，不是默认                  |
| 无结果       | `report.length > 0` 与实际引擎集合比对      | 见 §2.2                           |
| 未安装浏览器 | `requireBrowsers` 抛错                      | 见 §2.1，有单测                   |
| 未知引擎名   | 抛错                                        | 有单测                            |
| 空选择       | 抛错                                        | 有单测                            |

## 5. 未执行 / 未验证

| 项                                     | 原因                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 在 GitHub Actions 上实际跑一次新工作流 | 需要 push，本次未获授权                                                                                   |
| `visual` 的变更过滤在真实 PR 上生效    | 逻辑本地可推演，`paths` 行为以 GitHub 为准                                                                |
| `live` 的 environment 审批链           | 需要在仓库设置里创建 `ai-workbench-live` environment 与四个 secret，属于运维动作                          |
| Windows runner                         | 新门禁不纳入 Windows：Playwright 的 WebKit 在 Windows 上不可用，且既有 `unit-test-windows` 已覆盖平台差异 |
| Firefox/WebKit 下的全部 20 次切换      | 只跑了 Chromium（`build` 门禁跑了三引擎，P0/BYOK 的 20 次切换只跑 Chromium）                              |

`build` 门禁三引擎、P0/BYOK 单引擎，是有意的成本选择：`build` 覆盖的是构建形态差异（最可能按引擎不同），P0/BYOK 覆盖的是交互契约（引擎无关）。CI 里两者都跑三引擎，本地验证时按需收窄。

## 6. 对 0.2.0 RC 的放行判断

**R6-B 代码就绪，离线可证。** 合并前需要：

1. 新工作流在 GitHub 上跑通一次（P0/BYOK/CSP/build 全绿）。
2. `visual` 在至少一个改动过 UI 的 PR 上触发并产出色差对照图。
3. `ai-workbench-live` environment 与 secret 由运维建立——在此之前 `live` job 保持 dispatch-only，不影响合并门禁。

在 1 完成之前，`0.2.0-r6-integration-audit.md` 应记为「已修复，待 CI 实跑验证」。第 3 项是发布前的运维任务，不阻塞代码合并，但阻塞"真实联网验收"这一条。
