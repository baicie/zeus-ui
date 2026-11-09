# R5.2 — Zeus UI 发布契约报告

日期：2026-11-09
状态：**READY_FOR_RC_CUT_REVIEW**（代码门禁已关闭；正式发布仍需要人工审批与外部环境）

本文件只记录代码与门禁状态，不授权发布、打 Tag 或修改 dist-tag。

## 1. 基线

| 项目                       | 值                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| UI main HEAD（审查基线）   | `77f52c8be2310f6f88057c416011db75c0a70758`                                                              |
| Core main HEAD（审查基线） | `d93b4a0c3a346d51ae515286dea28158bfe0b643`                                                              |
| UI PR-A 分支               | `fix/r52-rc-channel-and-immutable-pairing` @ `24e1288`                                                  |
| PR-A / PR-B                | [#131](https://github.com/baicie/zeus-ui/pull/131) / [#132](https://github.com/baicie/zeus-ui/pull/132) |
| UI PR-B 分支               | `fix/r52-registry-atomic-snapshots` @ `11bfe09`                                                         |
| 本机 Node                  | 24.16.0（`package.json` engines 要求 `^22.18.0 \|\| >=24.11.0`）                                        |

两个仓库的 `main` 在本次审查期间均未移动；所有分支都从 `origin/main` 新建，未直接修改 `main`。

## 2. 已确认问题与修复状态

### 2.1 P1 — RC 无法按契约发布（已修复，PR-A）

`release.yml` / `publish.yml` 的 `tag` 选项与 `Verify release channel` 只接受
`beta|latest`，任何 `*-*` 版本都被强制映射到 `beta`。Core RC 计划要求
`0.2.0-rc.0` 发布到 `rc`，因此 UI 侧在当前 main 上**无法**完成 RC 发布。

更严重的是，`@baicie/release@0.4.0` 的 `resolveDistTag()` 只在 `--tag` 缺省时
按版本推断 tag；显式传入的 tag 会被原样使用。因此 `pnpm release 0.2.0-rc.0
--tag latest` 会把 npm 默认安装目标指向 release candidate。原 workflow 的
shell `case` 恰好拦住了它，但 CLI 本身没有防线。

修复：

- `scripts/release/channel.ts` 成为唯一 channel 规则：stable → `latest`，
  `-rc.` → `rc`，`-beta.` → `beta`，`-canary.` → `canary`；未知 prerelease
  标识符直接拒绝，而不是回落到 `latest`。
- `scripts/commands/release.ts` 与 `scripts/commands/publish.ts` 在调用
  `@baicie/release` 之前校验 `--tag`，所以命令行走不到错误 channel。
- 两个 workflow 暴露 `rc` 选项并在 shell 中执行同一规则；
  `check-release-workflows.ts` 以 `releaseChannelScript()` 逐字断言该脚本。
- `scripts/checks/release/check-release-channel.ts` 供 workflow 与本地复用。

### 2.2 P1 — “版本字符串”冒充 Core 配对（已修复，PR-A）

原 `publish.yml` 只验证 `version`、`tag`、`release_sha` 与 tag 指向，对
**Core 侧 commit** 没有任何约束；operator 只要在 dispatch 表单里填
`0.2.0-rc.0`，就能让 UI 发布一个从未与 Core RC 配对过的版本。

修复引入不可变配对记录 `release-pairing/<version>.json`
（`zeus-ui.release-pairing/v1`）：

- `check-release-pairing.ts` 从 `uiCommit` 的 **git object database** 读取该
  文件（`git cat-file blob <sha>:<path>`），checkout 之后写入的文件无效。
- 记录必须声明 `uiVersion`、`uiCommit`、`coreVersion`、`coreCommit`、
  `channel`；`coreVersion` 必须等于 `uiVersion`（同一版本线）。
- 门禁重新解析 `baicie/zeus` 的 `v<coreVersion>`（`commits/{ref}` 端点，兼容
  annotated tag），必须指向记录的 `coreCommit`；tag 不存在、指向别处或返回
  非 40 位 SHA 一律失败。
- UI 工作区中每个 `@zeus-js/*` pin 必须等于 `coreVersion`。唯一例外是
  `@zeus-js/vite-plugin`（`0.0.5`），它不在 Core 固定发布组内，与现有
  `check-zeus-beta-alignment.ts` 的 `INDEPENDENT_PACKAGE_VERSIONS` 一致；
  该例外本身也被固定，漂移同样失败。
- `beta` 是契约前的开发通道，允许没有记录；`rc` 与 `latest` 必须有。
- `release.yml` 在**创建 tag 之前**运行配对门禁，并把 `coreCommit` 作为 job
  output；`dispatch-publish` 再次解析 Core tag 后才派发；`publish.yml` 在
  `pnpm release:verify:pack` 之后、唯一会写 registry 的步骤之前再次校验。

### 2.3 P1 — Registry 资源双读导致 lock 与文件不一致（已修复，PR-B）

`add.ts` 原本对每个资源读取两次：`writePlans` 读一次写文件，
`createRegistryHashes` 再读一次算 hash。远程 Registry 在两次请求之间变更时，
写入的是 A，lock 记录的是 B，随后 `diff` 报告 `locally-modified`，`update`
拒绝更新。

修复：

- 每次操作通过 `RegistrySnapshotCache` 对每个资源只捕获一次；写盘的文本与
  lock 的 `registryHashes` 来自同一份快照。
- 快照在**任何写操作之前**解析完成，下载失败不会开始破坏性覆盖。
- 失败读取不进入缓存，因此瞬时故障可以重试。
- `diff` 与后续 `update` 复用同一缓存，`update` 写出的 `registrySource` 就是
  它 hash 的文本。
- lock 仍为 v2，无 schema 变更，无迁移需求。

### 2.4 P1 — 远程 Registry 无界读取与越界重定向（已修复，PR-B）

`readLimitedUrl` 先用 `response.text()` 完整缓冲，再检查大小；重定向由 fetch
自动跟随，registry root 检查发生在下载之后。

修复：

- 有界流式读取：累计字节超 5 MiB 立即中止，覆盖缺少 `Content-Length` 的
  chunked 响应。
- `redirect: 'manual'` 逐跳跟随，**每次请求前**校验目标：跨 origin、协议降级、
  越出 registry root、缺少 `Location`、超过 5 跳全部失败，且不下载被拒目标。
- 支持 `AbortSignal` 与 15s 显式超时。
- 拒绝 URL 中的凭据；默认拒绝私网/回环地址（SSRF 防护）。回环地址作为本地
  开发场景保留；LAN 地址需显式设置 `ZEUS_REGISTRY_ALLOW_PRIVATE_HOSTS=1`。
- 编码路径（`%2e%2e`）、绝对路径、反斜杠等在发请求前被 `assertSafeRegistrySourcePath`
  拒绝。

### 2.5 P1 — Registry 故障会被当作“版本尚未发布”（已修复，PR-A）

`@baicie/release@0.4.0` 的 `skipExisting` 通过 `npm view <name>@<version> version`
的**退出码**判断版本是否存在。registry 故障、token 过期、DNS 失败与非零退出码
无法区分，于是发布循环会把已发布版本当成“不存在”再次发布；npm 返回 409，而 CLI
把 409 归为可重试错误，一次故障会演变成重试风暴而不是明确失败。

新增 `check-publish-preflight.ts`，在 `publish.yml` 的 `Capture latest dist-tag
baseline` 之前运行：

- HTTP 200 → `PUBLISHED`（重试必须跳过）；
- 显式 404 → `ABSENT`（重试必须发布）；
- 其他（401/403/5xx/网络错误）→ `FAILED`，整个发布不启动；
- 版本与 channel 不一致时直接拒绝；
- 只发 GET，从不写 registry；报告 `temp/release/publish-preflight.json` 即
  部分发布后的恢复清单，作为 artifact 保留。

### 2.6 P2 — 未在本轮修改的项

- `capture-published-latest.ts` 对 404 返回 `published: false`，其余非 2xx 抛错，
  已经 fail closed；未改。
- `update.ts` 的 `writeUpdatePlans` 在磁盘写入失败时会让整个命令失败且不更新
  lock（`updateComponentsLockFromPlans` 在其后），行为正确；未改。
- `scripts/checks/release/check-release-workflows.ts` 的 `UPLOAD_ARTIFACT_ACTION_REF`
  固定到 `ea165f8d…`（v4），与仓库既有 `actions/upload-artifact@v4` 用法一致，
  现在同时被 pin 检查覆盖。

## 3. 代码变更与证据路径

PR-A（`fix/r52-rc-channel-and-immutable-pairing`）：

| 文件                                                             | 作用                                              |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| `scripts/release/channel.ts`                                     | channel 单一权威规则                              |
| `scripts/commands/channel-guard.ts`                              | CLI 侧 `--tag` 守卫                               |
| `scripts/commands/release.ts` / `publish.ts`                     | 在 `@baicie/release` 前执行守卫                   |
| `scripts/checks/release/check-release-channel.ts`                | workflow/本地共用的 channel 检查                  |
| `scripts/checks/release/check-release-pairing.ts`                | 不可变配对门禁                                    |
| `release-pairing/README.md`                                      | 配对记录的格式与创建流程                          |
| `.github/workflows/release.yml`                                  | `rc` 选项、channel shell、配对门禁、Core tag 复核 |
| `.github/workflows/publish.yml`                                  | `core_commit` 输入、配对门禁、发布前 channel 守卫 |
| `scripts/checks/release/check-release-workflows.ts`              | 以上全部断言                                      |
| `scripts/checks/__tests__/release/channel.spec.ts`               | channel 失败优先回归                              |
| `scripts/checks/__tests__/release/check-release-pairing.spec.ts` | 配对失败优先回归                                  |
| `scripts/checks/__tests__/release-scripts.spec.ts`               | workflow 契约同步更新                             |

PR-B（`fix/r52-registry-atomic-snapshots`）：

| 文件                                               | 作用                                        |
| -------------------------------------------------- | ------------------------------------------- |
| `packages/cli/src/registry-source.ts`              | 有界流式读取、逐跳重定向校验、SSRF 默认拒绝 |
| `packages/cli/src/commands/add.ts`                 | `RegistrySnapshotCache`，写盘与 hash 同源   |
| `packages/cli/src/commands/diff.ts`                | 复用快照缓存                                |
| `packages/cli/__tests__/registry-snapshot.spec.ts` | 供应链回归矩阵                              |

## 4. 测试命令与实际结果

在 Node 24.16.0、pnpm 10.33.4 下执行：

```
pnpm exec vitest --project unit --run scripts/checks/__tests__/release/
pnpm exec vitest --project unit --run scripts/checks/__tests__/release-scripts.spec.ts
pnpm exec vitest --project unit --run packages/cli/__tests__/
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec tsx scripts/checks/release/check-phase24-release.ts
pnpm exec tsx scripts/checks/contract/check-product-contract.ts
pnpm exec tsx scripts/checks/cli/check-cli-add.ts
pnpm exec tsx scripts/checks/cli/check-cli-update-diff.ts
pnpm exec prettier --check <changed files>
pnpm exec eslint <changed files>
```

实际结果：

- `scripts/checks/__tests__/release/` — 57 passed
- `release-scripts.spec.ts` — 6 passed
- `packages/cli/__tests__/` — 157 passed
- `tsc --noEmit` — 通过
- `check-phase24-release` — `Phase 24 release check passed.`
- `check-product-contract` — `Product contract check passed.`
- `check-cli-add` — `CLI add check passed.`
- `check-cli-update-diff` — `CLI update/diff check passed.`
- prettier / eslint — 通过

任务要求的最小回归集覆盖情况：

| 场景                                          | 测试                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------- |
| beta → beta                                   | `channel.spec.ts` `maps 0.1.0-beta.35 to beta`                        |
| rc → rc                                       | `maps 0.2.0-rc.0 to rc`                                               |
| stable → latest                               | `maps 0.2.0 to latest`                                                |
| rc → latest 必须失败                          | `rejects publishing a release candidate to latest`                    |
| stable → rc 必须失败                          | `rejects publishing a stable version to rc or beta`                   |
| 同一资源先返回 A 后返回 B，文件与 hash 仍一致 | `registry-snapshot.spec.ts` 第 1 例                                   |
| 缺 Content-Length 且超上限                    | `rejects a response without Content-Length…`                          |
| 重定向到另一个 origin                         | `rejects a redirect to another origin…`                               |
| 重定向越出允许目录                            | `rejects a redirect that leaves the registry root…`                   |
| Registry 文件不存在/损坏/非法                 | `rejects a missing or corrupt registry manifest`                      |
| 本地 symlink 指向项目外                       | `rejects a local symlink that points outside the registry root`       |
| 中途下载失败不写 lock                         | `does not write a lock entry when the registry asset is missing`      |
| 重复 add/update 幂等                          | 既有 `packages/cli/__tests__/update.spec.ts`、`add.spec.ts`           |
| 用户修改文件不被静默覆盖                      | 既有 `update.spec.ts` `does not overwrite local modifications`        |
| UI 版本与审批记录不符                         | `check-release-pairing.spec.ts` `rejects a mismatched UI version`     |
| 错误 Core SHA                                 | `rejects a record bound to a different Core commit than the Core tag` |

## 4.1 隔离 npm Registry 实证

用 Verdaccio 6.11.1（`127.0.0.1:4873`，独立存储，无 uplink，与
registry.npmjs.org 完全隔离）和真实 `0.2.0-rc.0` 候选 tarball 验证：

| 场景                                         | 实际结果                                                         |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `npm publish --tag rc`                       | 成功，`rc` dist-tag 指向 `0.2.0-rc.0`                            |
| 重复发布同版本                               | `EPUBLISHCONFLICT`，npm 拒绝覆盖                                 |
| `check-publish-preflight.ts` 对可达 registry | `49 packages: 0 published, 46 absent, 0 failed`，PASS            |
| `check-publish-preflight.ts` 对宕机 registry | `46 failed`，FAIL，发布不启动                                    |
| `check-release-pairing.ts` 对真实 git 记录   | 从对象库读到自洽记录后，正确列出 160 个未对齐的 `@zeus-js/*` pin |

**关键实证**：首次发布时即使显式传 `--tag rc`，npm 仍会把 `latest` 一并指向
`0.2.0-rc.0`（四个被测包 dist-tags 均为
`{"latest":"0.2.0-rc.0","rc":"0.2.0-rc.0"}`）。这不是本仓库的 bug，但说明
“RC 发布绝不意外修改 npm latest”无法只靠 `--tag` 保证——首次发布后必须由
受保护的 `repair:latest-tags` 修复，或对首次发布单独处理。该风险已记入
Core 报告与 `isolated-registry-drill.ts` 的 finding。

## 5. 未执行测试及原因

| 项目                                                  | 原因                                                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 真实 GitHub Actions 运行（release.yml / publish.yml） | 需要推送分支并在受保护 `Release` environment 下 dispatch；无授权，标记 `BLOCKED_BY_ENVIRONMENT` |
| 真实 npm 发布与 dist-tag 写入                         | 操作红线禁止；`OFFLINE_REHEARSAL_PASS` 由 Core 侧隔离 Registry 演练覆盖                         |
| `pnpm site:check` / `showcase:ci` 全量                | 与本轮发布契约改动无耦合，且耗时长；CI 会执行                                                   |
| macOS/Windows/Linux 三平台矩阵                        | 仅本机 macOS arm64；其余为 `NOT_RUN`                                                            |

## 6. RC 版本与 Core/UI 配对矩阵

| Core            | UI              | channel  | 配对记录 | 状态                             |
| --------------- | --------------- | -------- | -------- | -------------------------------- |
| `0.2.0-rc.0`    | `0.2.0-rc.0`    | `rc`     | 必需     | 契约已实现，记录待 RC cut 时提交 |
| `0.1.1-beta.20` | `0.1.0-beta.35` | `beta`   | 可省略   | 当前 main 状态，仍可发布         |
| `0.2.0`         | `0.2.0`         | `latest` | 必需     | 契约已实现                       |

配对记录不能早于 Core commit 与 UI commit 同时定稿；`release-pairing/README.md`
给出了两步 amend 的落盘流程，门禁会在 `uiCommit` 未自洽时持续报错。

## 7. 剩余问题

- **P0**：无。
- **P1**：UI 依赖的 `@zeus-js/*` 仍固定在 `0.1.1-beta.20`；RC cut 时必须由
  `pnpm zeus:align-beta`（或等价流程）对齐到 `0.2.0-rc.0` 并提交配对记录。
  这是发布步骤，不是代码缺陷。
- **P2**：`capture-published-latest.ts` 未对 registry 响应体大小设上限；与
  PR-B 的远程抓取加固同类，但该脚本只在发布 workflow 内以固定 npm registry
  运行，风险低，未在本轮改动。
- **P2**：`check-release-workflows.ts` 断言了 workflow 的具体 shell 文本，规则
  变化时需要同步三处（`channel.ts`、shell、checker）；已由单测覆盖，属于可接受
  的重复。

## 8. 环境/授权阻塞

- 创建 Draft PR 需要推送分支：允许（不涉及发布）。
- 触发 `release.yml` / `publish.yml`：禁止，需维护者授权。
- 生成真实 Core tag `v0.2.0-rc.0`：禁止，需维护者授权。

## 9. 下一阶段建议

1. 合并 PR-A 与 PR-B 到 UI `main`。
2. Core RC 合并并打 `v0.2.0-rc.0` 后，在 UI 执行 pin 对齐并提交
   `release-pairing/0.2.0-rc.0.json`。
3. 用 `pnpm check:release-pairing --version 0.2.0-rc.0 --release-sha <sha>`
   本地预检，再走受保护的 release workflow。
