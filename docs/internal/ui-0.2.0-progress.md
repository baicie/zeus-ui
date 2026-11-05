# Zeus UI 0.2.0 进度台账

依据：Zeus 0.2.0 Full-Platform Design Kit v1.0（`zeus-ui` 切片 PR-02、24、25、26、
32、33、35、37）。本仓工作分支：`codex/ai-headless-ci-gates`，基于 `main@7cab4ab`。

状态：`完成` 有代码、测试或浏览器证据；`部分` 写明缺口；`未执行` 写明原因。

## 切片状态（2026-11-04）

| PR    | 主题                                     | 状态 | 证据 / 备注                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ---------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR-02 | UI / AI V2 / Registry 基线               | 完成 | `docs/internal/manual-acceptance.md`、`docs/ai-headless-v2/audit-2026-10-27.md`；M0 基线、AI 包与 registry 门禁已建立。                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| PR-24 | UI 核心组件/主题与 Native 消费           | 部分 | 主题、组件契约、registry 双模式、tarball/体积/样式隔离基线与外部 consumer 已存在；原生消费三引擎门禁在 `showcase:e2e`。剩余：A11y 手工（VoiceOver/NVDA）与 Win/Linux 矩阵。                                                                                                                                                                                                                                                                                                                                                                                      |
| PR-25 | Registry & Third-party Author SDK        | 完成 | schema v2、`zweb author check`、`zweb registry validate`、仓库外第三方 WebC 包与 output plugin 端到端；证据见 `codex/pr25-registry-sdk` 的 acceptance 报告。                                                                                                                                                                                                                                                                                                                                                                                                     |
| PR-26 | AI Headless V2 发布闭环与 A11y           | 部分 | 六个 AI 包 `ai:pack-check`、CJS/ESM/类型入口、跨 Renderer、三引擎 story E2E 已建立；`check:ai-workbench` 通过真实 Host 的聊天与审批，并新增实际 200% CSS zoom 的布局检查。剩余：VoiceOver/NVDA 手工、真实 Provider Live（需授权）。                                                                                                                                                                                                                                                                                                                              |
| PR-32 | AI Reference Host Live/Replay + Safety   | 完成 | `examples/ai-host`：标准 SSE/Command 协议、SQLite 事件与幂等账本、审批 revision、路径围栏、重启回放；6 项协议测试通过。                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| PR-33 | Native AI Workbench 正式应用             | 部分 | `examples/ai-workbench` 使用公开 controllers 与 `ai-wc`；三引擎通过聊天、SSE、审批、真实写入、多会话隔离、附件上传/回显、文件变更树、真实 Diff 审查（Host unified diff 资产）与真实只读测试报告。Host 将同 tick SSE 事件合并为单次 write，修复 WebKit 连续小包延迟导致 `message.created` 超时。A11y 自动化（axe WCAG 2.1 A/AA）、640px 宽视口与实际 200% CSS zoom 布局检查通过。剩余：真实 Live Provider 与在线部署未授权/未执行。证据 `pr33-ai-workbench-evidence-2026-11-04.md`。                                                                              |
| PR-35 | UI/AI Host & Workbench 安全/ A11y 消费者 | 部分 | Registry/封装/消费与 AI Host 的安全边界已有自动化；Admin 与 AI Workbench 均有实际 200% CSS zoom 自动检查。剩余：真实屏幕阅读器、A11y 人工门禁、Win/Linux 矩阵。                                                                                                                                                                                                                                                                                                                                                                                                  |
| PR-37 | UI 兼容版 RC 与四产品联合验收            | 部分 | 新增 `release:joint-readiness`：机读汇总两仓版本/提交、Zeus 对齐、AI pack、AI Workbench、DataGrid framework E2E、四产品本地证据、在线 URL、人工 A11y、跨平台与联合发布审批。未设置 `ZEUS_CORE_ROOT` 时自动探测兄弟仓 `../zeus`，并允许独立版本的 `@zeus-js/vite-plugin@0.0.5`；当前 `NOT_READY` 仅剩脏工作树、在线 URL、Win/Linux、VoiceOver/NVDA 与发布审批。联合门禁现已把 UI 与 Core 浏览器报告绑定到各自完整 HEAD，缺失证据为 `not_run`、非法/过期证据为 `fail`，并校验四个线上 URL 必须唯一且为 HTTPS。证据 `pr37-joint-readiness-evidence-2026-11-04.md`。 |

## 关键验证

```sh
pnpm exec tsc -p tsconfig.json --noEmit
pnpm test-unit:node
pnpm check:ai-workbench
pnpm release:joint-readiness
```

2026-11-04 结果：

- 类型检查通过。
- Node 单测 133 文件 / 1057 项通过。
- AI Workbench 在 Chromium、Firefox、WebKit 通过；报告 `temp/ai-workbench/report.json`。

## 未执行与授权

- 在线部署、TLS、公网匿名访问、真实模型 Provider 与 npm 正式发布未执行，需单独授权。
- VoiceOver/NVDA、移动端与 200% zoom 人工验收未执行。
- Windows/Linux 浏览器与 packaged consumer 矩阵未执行。

## 2026-11-04 收口复核

DataGrid 公开 `columns[].cellRenderer` 已接入生产渲染路径：普通 DOM/React 19/Vue 3
覆盖 stable-key update、focus/selection 保留、断连清理、重连和虚拟滚动回收；RFC-011
更新为 Accepted。AI Workbench 的 WebKit SSE 延迟已通过同 tick 事件合并修复，三引擎
重新通过。联合 readiness 会自动探测兄弟 `../zeus`，并把独立版本的
`@zeus-js/vite-plugin@0.0.5` 排除在 Core beta 版本约束外；当前 `NOT_READY` 仅剩脏工作树、
在线 URL、Win/Linux、VoiceOver/NVDA 与联合发布审批。

最终本地验证：`check`、`lint`、`format-check` 通过；Node 单测 1060 项、jsdom 单测
1039 项通过；`data-grid:framework-e2e` 三引擎 3 项通过；`check:ai-workbench` 三引擎通过；
`check:runtime-cleanup-browser` 与 `data-grid:framework-e2e` 的浏览器报告已更新。
