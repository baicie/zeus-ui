# PR-24 验收报告：主题、样式隔离、跨框架契约冻结、消费矩阵

- 分支：`codex/ui-0.2.0-progress`（worktree `temp/worktrees/ui-progress`）
- 基线：`2570497`（PR-02 M0 Zeus UI baseline 合并点）之后的全部工作
- 日期：2026-11-01
- 环境：macOS arm64，Node 22.12.0（`engines` 要求 `^22.18.0 || >=24.11.0`，本机默认 shell 不满足，仅告警），pnpm 10.33.4，Vitest 4.1.9

本报告的每个数字都来自下面列出的实际命令。无法执行的项目标 `NOT_RUN`，并写明原因与覆盖缺口。

## 1. 提交

| 提交      | 内容                                                                |
| --------- | ------------------------------------------------------------------- |
| `f17e522` | `refactor(zeus-compat)`: DOM context 协议归 zeus-compat 所有        |
| `92acc27` | `feat(themes)`: 主题契约在包与 registry 之间冻结                    |
| `0d1c2bc` | `test(contract)`: 跨宿主与 a11y 契约矩阵                            |
| `199c429` | `build(checks)`: UI tarball、体积与样式隔离基线                     |
| `3a7f93c` | `docs(internal)`: 主题分发、人工验收脚本、Zeus 契约提案、themes API |

## 2. 交付项与状态

| #   | 任务                                             | 状态    | 证据                                                                  |
| --- | ------------------------------------------------ | ------- | --------------------------------------------------------------------- |
| 1   | Zeus 导入面收敛                                  | DONE    | 组件源码 68 处 `@zeus-js/zeus`，0 处深路径；`check:zeus-imports` PASS |
| 2   | 主题契约（token / 暗色 / RTL / CSP / part 对齐） | DONE    | `themes.spec.ts` 24 项；见 §4.1                                       |
| 3   | 跨宿主契约矩阵（Native/React/Vue/WC）            | DONE    | `e2e/contract/cross-host-contract.spec.ts`，10 项全过                 |
| 4   | jsdom a11y 与键盘脚本                            | DONE    | `e2e/contract/a11y-keyboard.spec.ts`，8 项全过                        |
| 5   | 200% 缩放与 RTL 人工验收                         | NOT_RUN | 脚本已写：`docs/internal/manual-acceptance.md`；见 §6                 |
| 6   | 按需 CSS 与两种分发模式差异                      | DONE    | `docs/internal/theming-and-distribution.md`                           |
| 7   | tarball 矩阵、体积、样式隔离                     | DONE    | `check:ui-tarball-baseline`，30 包；见 §5                             |
| 8   | 全量验证与报告                                   | DONE    | 见 §3                                                                 |

## 3. 验证结果

| 命令                                | 结果                                               |
| ----------------------------------- | -------------------------------------------------- |
| `pnpm check`（tsc）                 | PASS                                               |
| `pnpm lint`（eslint）               | PASS                                               |
| `pnpm format-check`（prettier）     | PASS，`All matched files use Prettier code style!` |
| `check:product-contract`            | PASS                                               |
| `check:zeus-imports`                | PASS                                               |
| `check:bundle-size`                 | PASS，46 个包                                      |
| `check:build-output`                | PASS，46 个包                                      |
| `check:exports`                     | PASS                                               |
| `check-release-tarballs`            | PASS，46 个包                                      |
| `check-release-readiness`           | PASS，46 个可发布包                                |
| `check:ui-tarball-baseline`（新增） | PASS，30 个 UI 包，样式隔离违规 0                  |
| `vitest --project unit --run`       | PASS，133 文件 / 1065 测试                         |
| `vitest --project unit-jsdom --run` | PASS，135 文件 / 1052 测试                         |
| `vitest --project e2e --run`        | PASS，16 文件 / 245 测试                           |
| 「主题 + CLI」子集单测              | PASS，15 文件 / 154 测试                           |

e2e 首次全量运行时 `e2e/ai/performance.spec.ts` 的 2–6 项超时阈值用例失败（`expected 21222.3 to be less than 20000`，以及 React/Vue 30 次挂载循环的基线比较）。单独重跑该文件 12/12 通过，随后全量重跑 245/245 通过。结论：**性能阈值用例对同机并发敏感**，不是本次改动引入的回归；记录于此以免后续误判。

### 3.1 未执行的项目

| 项目                                                    | 状态    | 原因                                                                              |
| ------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| `test-e2e:ai`（Playwright 三浏览器）                    | NOT_RUN | 未安装 Playwright 浏览器二进制；本机沙箱不能监听本地端口                          |
| `showcase:e2e`、`data-grid:framework-e2e`、`docs:build` | NOT_RUN | 同上（需要起 dev server）                                                         |
| 200% 缩放 / RTL 视觉验收                                | NOT_RUN | 需要真实浏览器排版；jsdom 无布局引擎。脚本见 `docs/internal/manual-acceptance.md` |
| `pnpm test-unit`（聚合脚本）                            | NOT_RUN | 会先跑 `build:examples`（构建全部示例），耗时超出本次窗口；已按项目单独执行并通过 |
| 远端 CI / PR 状态                                       | NOT_RUN | 本轮未推送远端                                                                    |

## 4. 关键结果

### 4.1 主题契约

- `packages/themes/src/palettes.ts` 成为唯一颜色权威源；5 个内置主题 CSS 由 `scripts/emit-theme-css.ts` 生成。
- 每个主题块包含：19 个语义颜色 token、9 个 `--zw-*` 原生别名、19 个 `--zeus-*` registry 别名、`color-scheme`。
- 修复了两处既有漂移：CSS 与 TS 注册表的颜色值不一致（`slate` / `neutral` 等），以及 `--zw-*` 只覆盖 7 个而 token 有 9 个。
- 暗色策略从「只有 `.dark`」扩展到 `class` / `data` / `media` 三种，包 CSS 与 CLI 写出的 registry globals 都支持。
- `themes.spec.ts` 断言：生成结果与磁盘 CSS 字节级一致、registry 与 palette 同步、别名族齐全、data/media 策略输出、拆分不丢选择器、无物理布局属性。

### 4.2 跨宿主契约

四个宿主（Native JSX / React / Vue / 裸 WC）对 6 个组件（Input / Select / Dialog / FormField / Popover / DataGrid）断言一致：

- `part` 列表：Input 为 `['root','prefix','control','suffix','message']`；
- 事件 payload 键：Input 的 `value-change` → `['nativeEvent','value']`，Select 的 `value-change` → `['nativeEvent','value','values']`，Dialog 的 `open-change` → `['nativeEvent','open']`；DataGrid 的 `selection-change` 四宿主键集合相同（断言为相等而非固定值）；
- Select 的 `role=combobox` / `aria-expanded` / `data-state`，DataGrid 的 `role=grid` 与 `aria-rowcount` / `aria-colcount`。

过程中确认了三条宿主行为（已写进 harness 注释，供后续集成方参考）：

1. Dialog 的 `open` 是受控属性，`setAttribute('open')` 不触发 `open-change`，必须通过 trigger 交互或 `setOpen`。
2. Popover / FormField 的子元素要等根元素 `componentOnReady()` 之后才能解析 DOM context。
3. DataGrid 必须在 `append` 之前写入 `columns` / `rows`，并在 `ready` 后再等一帧才会绘制。

### 4.3 jsdom a11y 与键盘

- Input：`aria-invalid` / `aria-label` / 原生 `required` 正确落到 `[data-slot='input']`。
- Select：ArrowDown 打开并激活首项、再按切换、Escape 关闭不提交、Enter 提交（四宿主 `value` 均为 `'b'`）。
- Dialog：打开后焦点进入面板、`role=dialog` + `aria-modal=true`、Escape 关闭并把焦点还给 trigger。
- FormField：label 的 `for` 等于自动生成的 control id，`aria-describedby` 同时含 description 与 message id，`aria-invalid` / `aria-required` 由字段同步到控件。
- DataGrid：单一漫游 tab stop（`tabindex='0'` 只有 1 个），ArrowRight 把焦点移到下一列。

## 5. 实测体积（`temp/ui-tarball-baseline.json`）

| 包                     | tarball | 解包后 | wc gzip | react gzip | vue gzip |
| ---------------------- | ------: | -----: | ------: | ---------: | -------: |
| `@zeus-web/input`      |  8.9 kB |  60 kB |  2.9 kB |     0.5 kB |   0.5 kB |
| `@zeus-web/select`     | 23.4 kB | 143 kB |  7.1 kB |     0.5 kB |   0.5 kB |
| `@zeus-web/dialog`     | 17.0 kB | 225 kB | 12.2 kB |     2.2 kB |   2.3 kB |
| `@zeus-web/form-field` | 13.8 kB | 160 kB |  8.7 kB |     1.6 kB |   1.6 kB |
| `@zeus-web/data-grid`  | 99.0 kB | 564 kB | 15.4 kB |     0.7 kB |   0.6 kB |
| `@zeus-web/themes`     | 15.8 kB | 118 kB |       — |          — |        — |

30 个 UI 包的完整数据在 `temp/ui-tarball-baseline.json`。所有包的 `nonDistFiles` 为空（tarball 里没有源码、测试或脚本）。`themes` 的 CSS 合计 97.6 kB（gzip 26.4 kB）。

样式隔离：`components.css` 的 189 条规则全部以 `zw-*` 或根级 token 选择器开头，违规 0。

## 6. 覆盖缺口

| 缺口                                               | 原因                           | 影响                                                      |
| -------------------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| 200% 缩放下无横向滚动 / 焦点环裁剪 / Dialog 溢出   | 需真实排版引擎                 | 只能靠人工脚本覆盖；脚本已写明 6 项检查与通过标准         |
| RTL 下的自定义元素视觉                             | 同上                           | 同上；`popover` / `dropdown-menu` 的 placement 已知不镜像 |
| Popover / Dropdown 的 RTL 定位                     | 实现使用物理坐标               | **产品技术债**，本 PR 只记录，未修复                      |
| 浏览器内真实键盘（Tab 顺序、`focus-visible` 渲染） | jsdom 无焦点视觉               | jsdom 只验证程序化 focus 与 keydown 处理                  |
| Playwright 三浏览器 E2E                            | 浏览器未安装、沙箱不能监听端口 | 需要 CI 或本地装浏览器后补跑                              |

## 7. Zeus 契约提案（合并窗口内不改 zeus 仓）

详见 [zeus-contract-proposals.md](../internal/zeus-contract-proposals.md)。两条高优先级：

- **Z-1**：`prop:selection-mode` 被编译成字面量 `"selection-mode"` 属性，元素读不到 `selectionMode`；建议编译期报错或做 kebab→camel 归一化。
- **Z-2**：`onValueChange` 被编译成监听 `valuechange`，自定义元素派发的是 `value-change`，静默不触发；`on:value-change` 是编译错误。建议支持 `on:<event-name>`。

另有 Z-3～Z-6（事件委托范围、自定义元素属性的 equality 短路、`componentOnReady` 时序契约、导入面已收敛的验收记录）。

## 8. 合并决策建议

可以合并：主题契约、跨宿主矩阵、a11y/键盘脚本、tarball 基线与文档均已验证，且 `check:ui-tarball-baseline` 可作为后续回归门。

需要另开任务：RTL 下 `popover` / `dropdown-menu` 的 placement 镜像（产品技术债）；Z-1 / Z-2 的 zeus 仓改动（跨仓）。
