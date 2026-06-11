# Zeus UI 发版指南

Zeus UI 是一个 monorepo，包含 30 个 npm 包，所有包的版本必须保持同步。本文档介绍 Zeus UI 的完整发版流程。

---

## 一、核心发版模型

Zeus UI 采用 **workspace-fixed** 模式，通过 `@baicie/release` 统一管理发版：

- 所有 `@zeus-web/*` 包共享同一个版本；
- 不使用 changesets，版本通过命令行或交互式选择；
- 发版脚本自动完成版本更新、质量检查、git commit 和 tag；
- CI 在检测到 `default@*` tag 后自动执行 npm publish。

### 包结构

| 目录                   | 包数量 | 说明                                                                                 |
| ---------------------- | ------ | ------------------------------------------------------------------------------------ |
| `packages/`            | 10     | 核心包（react、vue、cli、icons、themes、registry、headless、utils、ai、zeus-compat） |
| `packages/primitives/` | 20     | 基础组件包（button、dialog、input、select 等）                                       |

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

---

## 三、CI 发版流程

Zeus UI 使用两套 GitHub Actions workflow 协同完成发版：

### Release Workflow（`release.yml`）

通过 `workflow_dispatch` 手动触发，执行版本更新、质量门禁、git commit 和 tag。

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

触发方式：GitHub Actions 页面 → Release workflow → 输入 version 和 tag。

> dry_run 默认为 `true`，先执行 dry-run 验证。

### Publish Workflow（`publish.yml`）

在检测到 `default@*` tag push 时自动触发，执行真实 npm publish。

```yaml
name: Publish to NPM

on:
  push:
    tags:
      - 'default@*'
```

---

## 四、publishOnly 补发

如果 CI publish 因网络或 provenance 问题失败，可以重新触发。

### 方式一：通过 GitHub Actions 重新触发

进入 `publish.yml` 的失败 job，点击 "Re-run all jobs"。

### 方式二：手动执行

```bash
# dry-run
pnpm ci-publish --dry-run

# 真实发布
pnpm ci-publish
```

### 前提条件

- 所有包的 `package.json` 版本已更新；
- `default@<version>` tag 已推送到远程。

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

# 发版 + 立即发布（CI 不走 publish.yml）
pnpm release 0.1.0 --publish

# 查看发版计划
pnpm release:plan --tag latest

# 验证包就绪状态
pnpm release:verify --strict

# 发布 dry-run
pnpm ci-publish --dry-run

# 发布
pnpm ci-publish

# dry-run 后还原本地改动
git checkout -- .
```

---

## 七、故障处理

### npm 401 Unauthorized

检查 token 配置：

```bash
echo $NODE_AUTH_TOKEN
echo $NPM_TOKEN
```

确保 GitHub Actions 中设置了 `secrets.NPM_TOKEN` 或 `secrets.NPM_PUBLISH_TOKEN`。

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
pnpm ci-publish --no-skip-existing
```

### dry-run 后本地有改动

正常行为。验证完成后：

```bash
git checkout -- .
```

### Release workflow 失败

根据错误信息定位失败步骤（precheck 中哪条命令失败）。

---

## 八、发版前检查清单

### 本地验证

```bash
git status
pnpm install --frozen-lockfile
pnpm release 0.2.0 --dry
git diff  # 确认改动符合预期
git checkout -- .  # 验证完成后还原
```

### 推送

CI 中的 `release.yml` 会自动完成 commit + tag + push，本地无需额外操作。`default@*` tag 推送后 `publish.yml` 会自动触发。

### CI 确认

1. `release.yml` 是否执行成功（commit/tag 已推送）
2. `publish.yml` 是否触发（等待 1-2 分钟）
3. npm 确认包已上线（`npm view @zeus-web/react versions --json`）
