# Zeus UI 发版指南

Zeus UI 是一个 monorepo，包含 36 个 npm 包，所有包的版本必须保持同步。本文档介绍 Zeus UI 的完整发版流程。

---

## 一、核心发版模型

Zeus UI 采用 **workspace-fixed** 模式，通过 `@baicie/release` 统一管理发版：

- 所有 `@zeus-web/*` 包共享同一个版本；
- 不使用 changesets，版本通过命令行或交互式选择；
- 发版脚本自动完成版本更新、质量检查、git commit 和 tag；
- 非 dry-run 的 `release.yml` 在准备好版本后，以 `v<version>` tag 为 ref 触发独立的 `publish.yml` run，并传递 version、npm dist-tag 和 release commit SHA。

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

## 二、本地发版流程

### 交互式发版（推荐）

```bash
pnpm release
```

`@baicie/release` 会引导完成以下步骤：

1. **选择版本**：交互式选择 patch / minor / major / beta / custom
2. **确认 Git 工作区**：确保没有未提交的更改
3. **确认发布**：交互式确认
4. **更新版本**：所有包和 root `package.json` 写入新版本
5. **质量检查**：依次执行 precheck 命令
6. **生成发版计划**：显示本次发布的包列表和 npm 状态
7. **提交并推送**：git add → git commit → git tag → git push

> **注意**：`pnpm release` 在交互模式下需要 TTY。如果无交互环境（如某些 CI），需显式传入版本。

### 显式指定版本

```bash
# 直接指定版本
pnpm release 0.2.0

# 指定 beta 版本
pnpm release 0.2.0-beta.0 --tag beta

# 指定 bump 类型
pnpm release --bump minor
```

### dry-run

```bash
pnpm release 0.2.0 --dry
```

dry-run 会执行完整流程（更新版本、precheck、publish dry-run），但不修改远程。验证后需还原本地：

```bash
git checkout -- .
```

### 最终发布校验

`release:final` 必须显式传入目标版本。当前包版本仍为 `0.0.0` 时附加
`--allow-zero`：

```bash
pnpm release:final 0.2.0-beta.0 --allow-zero
```

如果当前包版本已经是非零版本，则运行：

```bash
pnpm release:final 0.2.0
```

`--allow-zero` 只允许校验前的工作区包保持 `0.0.0`，目标版本本身仍必须是合法的非零 semver。

---

## 三、CI 发版流程

Zeus UI 使用两套 GitHub Actions workflow 通过两个相互校验的 run 完成发版：

### Release Workflow（`release.yml`）

通过 `workflow_dispatch` 手动触发，且只允许从 `main` 运行。无 token 权限的 `validate-context` job 会显式验证 ref；从其他分支触发会红灯失败，而不是所有 job 绿色跳过。checkout 后还会验证 `HEAD` 仍等于 dispatch SHA，若 `main` 已前移则失败并要求重新触发。dry-run 和真实发版由两个 job 隔离：dry-run job 只有 `contents: read`，并禁用 checkout 凭据持久化；只有非 dry-run release job 获得 `contents: write`，配置 Git 身份后完成 git commit 和 `v<version>` tag。两个 job 都不接触 npm token。非 dry-run 成功后，`dispatch-publish` job 用 `v<version>` 作为 workflow ref 触发独立的 publish run，并传入 version、npm dist-tag 和 `release_sha`。这样 npm provenance 中的 `GITHUB_REF` 与 `GITHUB_SHA` 对应真实发布 tag 和 release commit。仓库级并发组确保不同版本不会同时修改 `main`。

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

`publish.yml` 同时支持 `workflow_dispatch` 和受约束的 reusable `workflow_call`。正常发版路径由 `release.yml` 在 `v<version>` tag 上触发独立的 `workflow_dispatch` run。publish 首先显式验证事件 `GITHUB_REF/GITHUB_SHA` 与 version、`release_sha` 一致；上下文错误会让 run 失败，而不是绿色跳过。即使 `Release` environment 审批期间 tag 被移动，publish 仍按不可变 `release_sha` 检出，并再次验证 `v<version>` 指向同一提交。全新 checkout 不包含被忽略的 `dist/`，所以 publish job 会先运行 `pnpm build`、`pnpm check:build-output` 和 `pnpm release:verify:pack`，确认 36 个包的产物与 tarball 后才使用传入的 npm dist-tag 发布。

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

真实 publish 按仓库和 npm dist-tag 串行执行，使用 frozen lockfile 安装依赖，checkout 不持久化 Git 凭据，并在 fresh build 与 tarball 校验通过后发布，避免并发完成顺序回退 dist-tag 或发布缺失产物。

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
- `v<version>` tag 已推送到远程，且指向对应的 release commit。

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
# 交互式发版（推荐）
pnpm release

# 指定版本发版
pnpm release 0.1.0
pnpm release 0.1.0-beta.0 --tag beta

# bump 类型发版
pnpm release --bump minor

# dry-run
pnpm release 0.1.0 --dry

# 最终发布校验（当前包版本仍为 0.0.0）
pnpm release:final 0.1.0-beta.0 --allow-zero

# 发版 + 立即发布（CI 不走 publish.yml）
pnpm release 0.1.0 --publish

# 查看发版计划
pnpm release:plan --tag latest

# 验证包就绪状态
pnpm release:verify --strict

# 发布 dry-run
pnpm ci-publish --version 0.1.0-beta.0 --tag beta --dry-run

# 发布
pnpm ci-publish --version 0.1.0-beta.0 --tag beta

# dry-run 后还原本地改动
git checkout -- .
```

---

## 七、故障处理

### npm 401 Unauthorized

确保仓库 Actions secret 中设置了 `NPM_PUBLISH_TOKEN`，并已创建 workflow 使用的 `Release` environment。release workflow 不接收 npm token；独立 publish run 只读取 `NPM_PUBLISH_TOKEN`。其他 workflow 通过 reusable `workflow_call` 调用时也必须显式映射该 secret。

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

### dry-run 后本地有改动

正常行为。验证完成后：

```bash
git checkout -- .
```

### Release workflow 失败

release job 失败时，根据错误信息定位 precheck 或版本准备步骤；`dispatch-publish` 不会启动。dispatch 成功后会出现独立的 Publish to NPM run；该 run 失败时直接重新运行它，无需创建额外 tag。

---

## 八、发版前检查清单

### 本地验证

```bash
git status
pnpm install --frozen-lockfile
pnpm release:final 0.2.0-beta.0 --allow-zero
git diff  # 确认改动符合预期
git checkout -- .  # 验证完成后还原
```

### 推送

CI 中的 `release.yml` 只允许从 `main` 运行，并会自动完成 commit + `v<version>` tag + push，本地无需额外操作。release job 成功后，`dispatch-publish` 会在该 tag 上触发独立的 `publish.yml` run，以保证 npm provenance 指向真实 release commit。

### CI 确认

1. Release workflow 的 release job 和 `dispatch-publish` job 是否执行成功（commit/tag 已推送并触发发布）
2. 独立的 Publish to NPM run 是否执行成功（事件 ref/SHA、version、dist-tag 与 release 输出一致）
3. npm 确认包已上线（`npm view @zeus-web/react versions --json`）
