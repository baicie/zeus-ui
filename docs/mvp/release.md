# Zeus UI 发版指南

Zeus UI 是一个 monorepo，包含 36 个 npm 包，所有包的版本必须保持同步。本文档介绍 Zeus UI 的完整发版流程。

---

## 一、核心发版模型

Zeus UI 采用 **workspace-fixed** 模式，通过 `@baicie/release` 统一管理发版：

- 所有 `@zeus-web/*` 包共享同一个版本；
- 不使用 changesets，版本通过命令行或交互式选择；
- 目标版本文件先在 `release/<version>` 分支准备并通过 Pull Request 合并到 `main`；
- 非 dry-run 的 `release.yml` 使用 `--skipGit` 复验已合并版本，只创建或复用同一 SHA 的 `v<version>` tag，不会创建 commit 或推送 `main`；
- tag 就绪后，`release.yml` 以该 tag 为 ref 触发独立的 `publish.yml` run，并传递 version、npm dist-tag 和已合并的 `main` commit SHA。

### 包结构

| 目录                   | 包数量 | 说明                                                                                     |
| ---------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `packages/`            | 11     | 基础包（react、vue、cli、icons、themes、registry、headless、utils、ai、ui、zeus-compat） |
| `packages/primitives/` | 20     | 基础组件包（button、dialog、input、select 等）                                           |
| `packages/advanced/`   | 5      | 高级包（agent-console、chat、data-grid、revogrid-adapter、virtual）                      |

所有发布包必须满足：

- 包名以 `@zeus-web/` 开头；
- license 为 `MIT`；
- 包含 `exports`、`files: ['dist']`、`scripts.build`。

---

## 二、版本 PR 准备流程

### 准备版本 PR（推荐）

```bash
git switch -c release/0.2.0-beta.0
pnpm release 0.2.0-beta.0 --tag beta --skipGit
pnpm release:final 0.2.0-beta.0
pnpm release:plan --tag beta
```

检查根 `package.json` 和全部 36 个发布包的版本，提交这些版本文件并创建 PR。等待 required checks 全部通过并合并后，才从 `main` dispatch Release workflow。禁止在受保护的 `main` 上运行会提交或推送 Git 的非 dry-run `pnpm release`。

`--skipGit` 模式会完成以下步骤：

1. **确认 Git 工作区**：开始准备前没有未提交的更改
2. **更新版本**：所有包和 root `package.json` 写入目标版本
3. **质量检查**：依次执行 precheck 命令
4. **跳过 Git 写入**：不创建 commit、tag，也不推送分支
5. **保留版本文件**：将这些改动作为单独 PR 提交

### 底层交互式命令（不用于正式发版）

直接运行 `pnpm release` 会进入需要 TTY 的交互模式，并可能执行默认的 Git commit、tag 和 push。该模式仅用于本地工具调试，不是受保护仓库的正式发版路径。

### 显式指定版本

```bash
# 准备稳定版版本文件，不执行 Git 写入
pnpm release 0.2.0 --tag latest --skipGit

# 准备 beta 版本文件，不执行 Git 写入
pnpm release 0.2.0-beta.0 --tag beta --skipGit
```

### dry-run

```bash
pnpm release 0.2.0 --dry
```

dry-run 会执行完整流程（更新版本、precheck、publish dry-run），但不修改远程。正式版本分支应保留目标版本文件并通过 PR 合并；纯验证应在临时 worktree 中运行，避免覆盖同一工作树里的其他改动。

### 最终发布校验

`release:final` 必须显式传入目标版本。当前纠正版运行：

```bash
pnpm release:final 0.1.0-beta.2
```

一般情况下，只有当前 workspace 包版本仍为 `0.0.0` 时才附加
`--allow-zero`：

```bash
pnpm release:final <version> --allow-zero
```

`--allow-zero` 只允许校验前的工作区包保持 `0.0.0`，目标版本本身仍必须是合法的非零 semver。

---

## 三、CI 发版流程

Zeus UI 使用两套 GitHub Actions workflow 通过两个相互校验的 run 完成发版：

### Release Workflow（`release.yml`）

通过 `workflow_dispatch` 手动触发，且只允许从 `main` 运行。无 token 权限的 `validate-context` job 会显式验证 ref；从其他分支触发会红灯失败，而不是所有 job 绿色跳过。checkout 后先验证 `HEAD` 等于 dispatch SHA。dry-run 和真实发版由两个 job 隔离：dry-run job 只有 `contents: read`，两者都禁用 checkout 凭据持久化；非 dry-run release job 使用 `--skipGit` 验证版本 PR 已合并且验证前后工作区都保持干净。只有 `Tag release` 步骤接收步骤级 `GH_TOKEN`，依赖安装和仓库 release 脚本无法复用 `contents: write` 凭据。

发布通道同样会被双重校验：预发布版本必须使用 `beta`，稳定版本必须使用 `latest`。`validate-context` 在任何 Git 写操作前检查，publish 在接触 npm 前重复同一规则。

耗时校验结束后，`Tag release` 通过 GitHub refs API 重新查询远端 `main`，只有远端仍等于 `GITHUB_SHA` 才继续。远端不存在版本 tag 时通过 API 创建轻量 `refs/tags/v<version>`；tag 已存在时只允许它直接指向同一 SHA，从而支持安全重跑，不同 SHA 会立即失败。workflow 不调用 `git push`，不会创建 commit 或推送 `main`，也不会 force、删除或替换 tag。release workflow 不接收 npm token。

tag 成功后，`dispatch-publish` job 用 `v<version>` 作为 workflow ref 触发独立的 publish run，并传入 version、npm dist-tag 和 `release_sha`。这样 npm provenance 中的 `GITHUB_REF` 与 `GITHUB_SHA` 对应真实发布 tag 和已通过 PR 合并的 `main` commit。仓库级并发组确保同一时间只有一个正式 release run。

release 和 publish workflow 使用的第三方 Actions 均固定到完整 commit SHA，避免高权限发版链路受可移动版本标签影响。

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version, for example 0.1.0-beta.0 or 0.1.0'
        required: true
        type: string
      tag:
        description: npm dist-tag
        required: true
        default: beta
        type: choice
        options:
          - beta
          - latest
      dry_run:
        description: Run with --dry-run (no commit, no publish)
        required: true
        default: true
        type: boolean
```

触发方式：GitHub Actions 页面 → Release workflow → 选择 `main` → 输入 version 和 tag。

> dry_run 默认为 `true`，先执行 dry-run 验证。

### Publish Workflow（`publish.yml`）

`publish.yml` 同时支持 `workflow_dispatch` 和受约束的 reusable `workflow_call`。正常发版路径由 `release.yml` 在 `v<version>` tag 上触发独立的 `workflow_dispatch` run。publish 首先显式验证事件 `GITHUB_REF/GITHUB_SHA` 与 version、`release_sha` 一致；上下文错误会让 run 失败，而不是绿色跳过。按不可变 `release_sha` 检出后，它会刷新固定的远端 `main` refspec，并在安装依赖前执行 `git merge-base --is-ancestor --`，证明发布提交已经进入受保护的 `main`。全新 checkout 不包含被忽略的 `dist/`，所以 publish job 会先运行 `pnpm build`、`pnpm check:build-output` 和 `pnpm release:verify:pack`；真正写入 npm 前再次查询远端版本 tag，确认仍直接指向 `release_sha`，然后才使用传入的 npm dist-tag 发布。

```yaml
name: Publish to NPM

on:
  workflow_call:
    inputs:
      version:
        required: true
        type: string
      tag:
        required: true
        type: string
      release_sha:
        required: true
        type: string
    secrets:
      NPM_PUBLISH_TOKEN:
        required: true
  workflow_dispatch:
    inputs:
      version:
        required: true
        type: string
      tag:
        required: true
        type: choice
        options:
          - beta
          - latest
      release_sha:
        required: true
        type: string
```

`release.yml` 中的 `dispatch-publish` job 在 release job 成功后，以版本 tag 为 ref 触发独立 run：

```yaml
dispatch-publish:
  needs: release
  if: ${{ github.ref == 'refs/heads/main' && inputs.dry_run == false }}
  runs-on: ubuntu-latest
  permissions:
    actions: write
    contents: read
  steps:
    - run: |
        gh workflow run publish.yml \
          --ref "v$VERSION" \
          --raw-field version="$VERSION" \
          --raw-field tag="$TAG" \
          --raw-field release_sha="$RELEASE_SHA"
```

真实 publish 按仓库和 npm dist-tag 串行执行，使用 frozen lockfile 安装依赖，checkout 不持久化 Git 凭据，并在 fresh build 与 tarball 校验通过后发布，避免并发完成顺序回退 dist-tag 或发布缺失产物。正式触发前，`Release` environment 必须配置 required reviewer，且启用的 `refs/tags/v*` tag ruleset 必须禁止更新和删除版本 tag；workflow 内的发布前复核用于缩短竞态窗口，ruleset 才是 tag 不可变性的仓库级保证。

publish workflow 在 beta 发布前会快照 npm 上 canonical `latest`，发布后将该值传给 published verifier，确保 beta 只推进 `beta` 而不漂移 `latest`。稳定版使用 `latest` 通道时，期望的 `latest` 就是当前发布版本。

---

## 四、publishOnly 补发

如果 CI publish 因网络或 provenance 问题失败，可以重新触发。

### 方式一：通过 GitHub Actions 重新触发

进入独立的 Publish to NPM workflow run，点击 "Re-run all jobs"。该 run 已绑定原始版本 tag 和输入；`skipExisting` 会跳过本次版本中已经发布成功的包。

### 方式二：手动执行

```bash
# dry-run
pnpm ci-publish --version 0.2.0-beta.0 --tag beta --dry-run

# 真实发布
pnpm ci-publish --version 0.2.0-beta.0 --tag beta
```

### 前提条件

- 所有包的 `package.json` 版本已更新；
- `v<version>` tag 已推送到远程，且指向对应的、已通过 PR 合并的 `main` commit。

### 跳过已存在版本

默认开启 `skipExisting`，如果版本已在 npm 存在会自动跳过。

---

## 五、Zeus Canary 与 Zeus UI 兼容性

Zeus UI 作为 Zeus 的下游项目，通过 canary 机制验证兼容性。

### Canary 发布（上游 Zeus 仓库）

当 Zeus 仓库 push 到特定分支（main、feat/**、fix/** 等）时，会自动发布 canary 版本并触发 Zeus UI 兼容检查。

### Zeus UI 兼容检查（`zeus-canary-compat.yml`）

触发方式：

- **自动**：Zeus 仓库 canary 发布后通过 `repository_dispatch` 触发
- **手动**：GitHub Actions 页面 → Zeus Canary Compatibility workflow
- **定时**：每天 02:17 UTC

检查流程：

1. 安装指定版本的 `@zeus-js/*` 包（支持 exact version 或 `canary` tag）
2. `pnpm check:workspace-overrides`
3. `pnpm check:zeus-baseline`
4. `pnpm zeus:relax-peer-ranges`
5. `pnpm check:zeus-imports`
6. `pnpm check`
7. `pnpm lint`
8. `pnpm test-unit`
9. `pnpm vitest run --project canary`
10. `pnpm build`
11. `pnpm check:exports`
12. `pnpm check:build-output`

---

## 六、常见命令速查

```bash
# 在 release 分支准备版本文件（正式路径）
pnpm release 0.1.0-beta.0 --tag beta --skipGit

# dry-run
pnpm release 0.1.0 --dry

# 当前纠正版最终发布校验
pnpm release:final 0.1.0-beta.2

# 仅当当前 workspace 包版本仍为 0.0.0 时使用
pnpm release:final <version> --allow-zero

# 查看发版计划
pnpm release:plan --tag beta

# 验证包就绪状态
pnpm release:verify --strict

# 发布 dry-run
pnpm ci-publish --version 0.1.0-beta.0 --tag beta --dry-run
```

非 dry-run 的 `pnpm release`、`pnpm release --publish` 和 `pnpm ci-publish` 是底层维护命令，不用于受保护仓库的正式发版。正式发布必须由版本 PR、`release.yml` 和 tag-scoped `publish.yml` 完成。纯验证如需丢弃临时版本改动，应使用临时 worktree，避免误删其他本地工作。

---

## 七、故障处理

### npm 401 Unauthorized

确保仓库 Actions secret 中设置了 `NPM_PUBLISH_TOKEN`，workflow 使用的 `Release` environment 至少配置一名 required reviewer，并启用禁止更新或删除 `refs/tags/v*` 的 tag ruleset。release workflow 不接收 npm token；独立 publish run 只读取 `NPM_PUBLISH_TOKEN`。其他 workflow 通过 reusable `workflow_call` 调用时也必须显式映射该 secret。

### npm provenance 失败

确认 workflow 有以下权限：

```yaml
permissions:
  contents: read
  id-token: write
```

### 版本已存在

如果部分包已在 npm 发布，其他包发布时默认跳过（`skipExisting: true`）。如果需要强制发布：

```bash
pnpm ci-publish --version 0.1.0 --tag latest --no-skip-existing
```

### 首次预发布同时产生 `latest`

npm registry 要求每个包始终存在 `latest`。首次使用 `beta` 发布包时，registry 可能让 `beta` 和 `latest` 同时指向该首个预发布版本；不得删除 `latest`、unpublish 或发布占位稳定版。后续 beta 只推进 `beta`，`latest` 保持原值，直到首个稳定版使用 `latest` 发布。

因此发布纠正版 `0.1.0-beta.2` 后的预期是 `beta = 0.1.0-beta.2`、
`latest = 0.1.0-beta.0`。已经发布的 `0.1.0-beta.1` 必须保持不可变，不得覆盖、删除或
重新发布。

### dry-run 后本地有改动

正常行为。正式版本分支应检查并保留目标版本文件；纯验证应使用临时 worktree，验证完成后删除该 worktree。不要在包含其他工作的目录中批量还原文件。

### Release workflow 失败

release job 失败时，根据错误信息定位版本不一致、工作区改动、precheck 或远端 `main` 前移。tag 尚未创建时，修复必须通过新 PR 合并后重新 dispatch。tag 已在同一 SHA 创建时可以安全重跑 Release；不同 SHA 的同名 tag 必须保留并人工调查，禁止覆盖或删除。dispatch 成功后会出现独立的 Publish to NPM run；该 run 失败时直接重新运行它，无需创建额外 tag。

---

## 八、发版前检查清单

### 本地验证

```bash
git status
pnpm install --frozen-lockfile
pnpm release 0.2.0-beta.0 --tag beta --skipGit
pnpm release:final 0.2.0-beta.0
pnpm release:plan --tag beta
git diff  # 确认根目录和 36 个发布包版本符合预期
```

### 合并版本 PR

将版本文件提交到 `release/<version>` 分支，创建 PR，等待 required checks 全部通过并合并。`main` 的版本变更只允许来自该已审核 PR。

随后从更新后的 `main` 先运行 dry-run，再运行正式 Release。`release.yml` 只推送不可变版本 tag；release job 成功后，`dispatch-publish` 会在该 tag 上触发独立的 `publish.yml` run，以保证 npm provenance 指向已合并的 `main` commit。

### CI 确认

1. Release workflow 的 release job 和 `dispatch-publish` job 是否执行成功（tag 指向已合并的 `main` SHA 并触发发布）
2. 独立的 Publish to NPM run 是否执行成功（事件 ref/SHA、version、dist-tag 与 release 输出一致）
3. 36 个 npm 包是否都存在目标版本，且 `beta` 指向目标版本、`latest` 保持发布前快照的 canonical 值
4. 执行以下发布后校验：

```bash
pnpm release:verify:published \
  --version 0.1.0-beta.2 \
  --tag beta \
  --expected-latest 0.1.0-beta.0 \
  --release-sha <merged-main-sha>
```

该命令会逐包校验 `beta` 与 `latest`，解码 SLSA provenance v1，并确认 subject npm purl 的 `sha512` 与 `dist.integrity` 一致。它还要求 workflow repository/path/ref 分别对应 `https://github.com/baicie/zeus-ui`、`.github/workflows/publish.yml` 和版本 tag，resolved source URI 对应同一版本 tag，且 `gitCommit` 等于合并后的 `main` SHA。元数据校验通过后，命令继续执行现有隔离消费 smoke，覆盖所有可安全导入的根入口、25 个 `/react` 与 `/vue` 子入口、TypeScript、Vite bundle、runtime 和 CLI。
