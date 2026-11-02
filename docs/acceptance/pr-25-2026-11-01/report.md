# PR-25 验收报告：Registry & Third-party Author SDK

- 分支：`codex/pr25-registry-sdk`（worktree `temp/worktrees/pr25-registry-sdk`）
- 基线：`e95f519`（`codex/ui-0.2.0-progress`，含 PR-02 与 PR-24 全部成果）
- 日期：2026-11-02
- 环境：macOS arm64，Node 22.12.0（`engines` 要求 `^22.18.0 || >=24.11.0`，本机不满足，仅告警），pnpm 10.33.4，Vitest 4.1.9，rolldown 1.1.2，Zeus `0.1.1-beta.20`

本报告的每个数字都来自下面列出的实际命令。未执行项标 `NOT_RUN` 并写明原因。

## 1. 交付项与状态

| #   | 任务                                                       | 状态 | 证据                                                                    |
| --- | ---------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| 1   | 第三方作者稳定契约（schema 版本、元数据、part/event/slot） | DONE | `packages/registry/src/author.ts`；`author-contract.spec.ts` 19 项      |
| 2   | 发布安全验证（files 白名单、精确 peer pin、CEM 漂移）      | DONE | 同上；`zweb author check`                                               |
| 3   | Registry manifest schema 升级与显式拒绝旧版本              | DONE | `schema.ts` schemaVersion 2；`zweb registry validate`                   |
| 4   | 仓库外空目录创建第三方 WebC 包并消费                       | DONE | `scripts/checks/cli/check-author-consumer.ts`，见 §4                    |
| 5   | 第三方 Output plugin 在外部 consumer 运行                  | DONE | 同上；`createAuthorPluginAsset` 走 `@zeus-web/registry/author` 公开入口 |
| 6   | 版本冲突被检测                                             | DONE | `ZEUS_AUTHOR_PACKAGE_VERSION_MISMATCH`，见 §4                           |
| 7   | registry 更新不静默覆盖用户修改                            | DONE | 既有 `update.spec.ts` 两项；见 §5                                       |
| 8   | 区分源码复制模式与 CE 包发行模式                           | DONE | `docs/internal/authoring-sdk.md`；`apps/docs/guide/registry.md`（中英） |
| 9   | 输入校验错误路径（非法 schema / 缺失字段 / 重复 / 版本）   | DONE | 19 + 12 项单测；诊断携带 JSON path                                      |

## 2. 提交

| 提交 | 内容 |
| ---- | ---- |
| TBD  | TBD  |

## 3. 验证结果

| 命令 | 结果 |
| ---- | ---- |
| `pnpm check`（tsc） | PASS，EXIT 0 |
| `pnpm lint`（eslint） | PASS，EXIT 0 |
| `pnpm format-check`（prettier） | PASS，`All matched files use Prettier code style!` |
| `pnpm check:registry` | PASS，`@zeus-web/registry check passed.` |
| `pnpm check:product-contract` | PASS（含 `check:components`、advanced contract） |
| `pnpm check:cli-consumer` | PASS，react / vue / file-registry 三个 consumer |
| `pnpm check:cli-init` / `check:cli-add` / `check:cli-update-diff` | PASS |
| `pnpm check:author-consumer`（新增） | PASS，见 §4 |
| `pnpm check:exports` / `check:build-output` | PASS |
| `pnpm check:zeus-imports` / `check:workspace-overrides` | PASS |
| `pnpm check:component-coverage` | PASS（2 条 headless-only warning，既有） |
| `pnpm check:showcase-metadata` / `check:showcase-implementation` | PASS |
| `pnpm check:product-layers` / `check:ui-package` | PASS |
| `pnpm check:zeus-beta-alignment` | PASS，`0.1.1-beta.20, peer 0.1.1-beta.20` |
| `pnpm docs:check` | PASS（generated / i18n / docs / public-docs / playground / docs tsc） |
| `pnpm release:verify` | PASS，46 个可发布包 |
| `vitest --project unit --run` | PASS，135 文件 / 1096 测试 |
| `vitest --project unit-jsdom --run` | PASS，137 文件 / 1083 测试 |
| `vitest --project e2e --run` | 244/245 通过；1 项 `a11y-keyboard` dialog 用例失败，单独重跑该文件 8/8 通过（同机并发敏感，非本次回归） |
| `vitest run packages/cli/__tests__ packages/registry/__tests__` | PASS，34 文件 / 360 测试 |
| `pnpm build`（全量） | PASS，EXIT 0 |

### 3.1 新增测试

| 文件 | 用例数 |
| ---- | ------ |
| `packages/registry/__tests__/author-contract.spec.ts` | 19 |
| `packages/cli/__tests__/author.spec.ts` | 12 |

覆盖的错误路径：缺少必需导出（含 `exports["./wc/auto"]` path）、peer 非精确 pin、版本不匹配（消息含双方版本）、`zw-` 保留前缀、重复 tag（`components[1].tag`）、CEM 事件/part 漂移、manifest/CEM 未支持 schema、wrapper 运行时依赖缺失、导出文件缺失、`files` 白名单缺失或泄漏 `src`、插件 apiVersion 不匹配、输出属主冲突、重复插件 id、registry schemaVersion 1 拒绝、license/authors 缺失、author URL 非 http(s)、item 诊断路径。

## 4. 外部第三方包端到端

`pnpm check:author-consumer` 在仓库外的临时空目录完成：

1. 创建 `@acme/counter-element` 包源码（`src/index.tsx` 用 `defineElement` + `Host` + `Slot`）。
2. 用 `@zeus-js/bundler-plugin` + `output-wc` / `output-react-wrapper` / `output-vue-wrapper` 构建，产出 `dist/wc/*`、`dist/react/*`、`dist/vue/*`、`custom-elements.json`、`zeus.components.json`。
3. 第三方输出插件 `@acme/zeus-output-report` 只通过 `@zeus-web/registry/author` 的 `createAuthorPluginAsset` + `ctx.manifest` 生成 `dist/acme.report.json`。
4. `zweb author check` 通过；`--zeus-version 0.1.0-beta.1` 时以 `ZEUS_AUTHOR_PACKAGE_VERSION_MISMATCH` 失败。
5. `npm pack` 的 tarball 只含 `dist/`（25 个条目，sha256 见输出），不含 `src/`、`node_modules/`。
6. 独立 consumer 解包安装后：

| 宿主  | 断言                                                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------------------- |
| 裸 WC | 元素升级、`count=3` 渲染、`part="button"`、host `data-slot`、命名 slot 投影、`acme-change` 事件 detail 含 `nativeEvent` |
| Vue   | wrapper 挂载元素、文本 `7`、命名 slot 投影 `vue-slot`                                                                   |
| React | wrapper 挂载元素、文本 `11`                                                                                             |

## 5. 既有保护（回归）

- `update.spec.ts`：本地修改后 `zweb update` 保留 `local edit`；`--overwrite` 才覆盖。
- `registry-maintenance.spec.ts`：锁定 registry 源下的 diff/update 与本地修改保护。

## 6. 覆盖缺口

| 缺口               | 状态    | 原因                                                   |
| ------------------ | ------- | ------------------------------------------------------ |
| 浏览器内三引擎验证 | NOT_RUN | 本机未安装 Playwright 浏览器二进制，且不能监听本地端口 |
| 真实 npm 发布      | NOT_RUN | 任务禁止发布；用 `npm pack` tarball 代替安装来源       |
| SSR 下第三方包     | NOT_RUN | 超出本切片范围（PR-16 已覆盖官方包 SSR）               |
