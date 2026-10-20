# CLI

Zeus Web CLI 以 `@zeus-web/cli` 发布。

CLI 负责 React/Vue 源码 Registry 工作流。

## 命令

| 命令                       | 说明                                                            |
| -------------------------- | --------------------------------------------------------------- |
| `zweb init`                | 创建 `zeus-ui.json`、`src/lib/cn.ts` 和 `src/styles/zeus.css`。 |
| `zweb add <components>`    | 将 Registry 组件源码复制到你的项目中。                          |
| `zweb list`                | 列出可用的 Registry 组件。                                      |
| `zweb diff <components>`   | 检查本地文件与 Registry 的变化。                                |
| `zweb update <components>` | 更新已跟踪的组件源码。                                          |
| `zweb remove <components>` | 删除已跟踪源码并保护本地修改。                                  |
| `zweb doctor`              | 检查项目配置、已跟踪文件和依赖。                                |
| `zweb theme`               | 列出、检查和应用主题预设。                                      |
| `zweb ai`                  | 生成 AI 可读的元数据和使用指南。                                |
| `zweb icon`                | 管理图标元数据和代码片段。                                      |

## init

```bash
pnpm dlx @zeus-web/cli init
```

选项：

| 选项                       | 说明                                                    |
| -------------------------- | ------------------------------------------------------- |
| `--cwd <dir>`              | 使用指定的项目目录。                                    |
| `--framework <name>`       | `react` 或 `vue`。同时检测到两个框架时使用此选项。      |
| `--style <name>`           | `default`、`slate`、`zinc`、`neutral` 或 `stone`。      |
| `--css <file>`             | 要创建或更新的 CSS 文件，默认为 `src/styles/zeus.css`。 |
| `--radius <name>`          | 圆角预设。                                              |
| `--motion <name>`          | 动效预设。                                              |
| `--dark-mode <name>`       | `class`、`data` 或 `media`。                            |
| `--accent <hsl>`           | 覆盖 primary 和 ring 颜色。                             |
| `--overwrite`              | 替换生成的配置和托管文件。                              |
| `--dry-run`                | 只输出计划，不写入文件。                                |
| `--package-manager <name>` | `pnpm`、`npm`、`yarn` 或 `bun`。                        |

示例：

```bash
zweb init --framework react
zweb init --framework vue
zweb init --style slate --css src/styles/zeus.css
zweb init --radius lg --motion reduced
zweb init --dry-run
```

`zweb init` 会创建：

```txt
zeus-ui.json
src/lib/cn.ts
src/styles/zeus.css
```

## add

```bash
pnpm dlx @zeus-web/cli add button input
```

选项：

| 选项                       | 说明                                                    |
| -------------------------- | ------------------------------------------------------- |
| `--all`                    | 添加所选 Registry 中的全部组件。                        |
| `--path <dir>`             | 将组件文件写入指定的项目相对目录。                      |
| `--registry <source>`      | 使用本地 `registry.json`、Registry 目录或 HTTP(S) URL。 |
| `--yes`, `-y`              | 不再询问并安装包依赖。                                  |
| `--skip-deps`              | 只复制源码，不安装 npm 依赖。                           |
| `--cwd <dir>`              | 使用指定的项目目录。                                    |
| `--dry-run`                | 只输出计划，不写入文件。                                |
| `--overwrite`, `--force`   | 替换已有的生成文件。                                    |
| `--install`                | 安装包依赖。                                            |
| `--no-install`             | 不安装依赖。                                            |
| `--package-manager <name>` | `pnpm`、`npm`、`yarn` 或 `bun`。                        |

示例：

```bash
zweb add button --dry-run
zweb add button input
zweb add button --overwrite
zweb add button --install
zweb add --all --yes
zweb add button --path src/custom/ui
zweb add button --registry https://example.com/registry.json
```

添加 `button` 时，CLI 会展开 Registry 依赖并写入：

```txt
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
```

对于 Vue 项目：

```txt
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.vue
```

CLI 还会写入：

```txt
zeus-ui.lock.json
```

锁文件版本 2 会记录每个组件的 Registry 来源，以及 Manifest 的名称、版本和
SHA-256 完整性哈希。`diff`、`update` 和 `doctor` 会重新加载已记录的来源，
包括远程 Registry，并报告 Manifest 漂移。Registry 资源必须位于 Manifest
目录之下；越界路径、单个资源超过 5 MiB，以及跨 HTTP origin 的资源会被拒绝。
beta 阶段会直接拒绝版本 1 锁文件，需要重新生成。

## 维护已安装组件

```bash
zweb list --json
zweb diff button
zweb diff --all --json
zweb update button --dry-run
zweb update button
zweb update button --overwrite
zweb update --all
```

`diff` 对比本地文件、锁文件中记录的哈希和当前 Registry。
`update` 会恢复已跟踪但缺失的文件，并更新没有本地修改的文件。
存在本地修改时默认跳过，只有 `--overwrite`（或 `--force`）才允许覆盖。
它不会安装从未添加过的组件。

这两个命令都支持 `--cwd <dir>`、`--all` 和 `--registry <source>`；`diff`
还支持 `--json`，`update` 支持 `--dry-run`，预览时不会修改文件和锁文件。
已安装组件默认使用锁文件中记录的来源；显式 Registry 选项会覆盖所选组件的来源。

## remove

```bash
zweb remove button --dry-run
zweb remove button
zweb remove button input
zweb remove button --force
zweb remove --all
```

`remove` 读取 `zeus-ui.lock.json`，删除所选条目的已跟踪文件并更新锁文件。
即使组件已从当前 Registry 移除，仍可删除已安装的文件。支持 `--cwd <dir>`。

- 本地修改过或没有已记录哈希的文件会阻止整批删除，所有文件和锁记录保持原状，
  命令以状态码 1 结束。`--force` 才允许删除这些文件。
- 仍由其他组件跟踪的共享文件会保留；仍被其他组件依赖的 Registry 条目不能删除。
- `--all` 选择所有已跟踪条目，包括共享工具和样式。使用前请通过 `--dry-run` 查看计划。
- `--dry-run` 仅打印计划，不修改文件和锁文件字节。
- 未跟踪文件、目录、npm 依赖和项目配置保持原状。非法锁文件、项目外路径、
  经过符号链接的路径会被拒绝，`--force` 也不会绕过这些检查。

## doctor

```bash
zweb doctor
zweb doctor --cwd ./my-app --json
```

`doctor` 检查 `zeus-ui.json`、别名目录、受管理的 CSS 区块、内置及锁文件记录的
Registry，以及 `zeus-ui.lock.json` 中的已跟踪文件。缺失的 Registry 依赖、不可用
来源、缺失文件、不安全或非法的锁文件会被报告为失败；Registry Manifest 已变化、
缺失 npm 依赖、本地修改、已存在但未被锁跟踪的应用自管共享依赖会被报告为警告。
失败时状态码为 1；`--json` 返回 `checks` 数组，每项包含 `level` 和 `message`。
该命令不会修改项目。

## theme

```bash
zweb theme list --json
zweb theme tokens slate --json
zweb theme set zinc --radius lg --motion reduced --dark-mode class
```

`theme set` 更新主题配置和受管理的 CSS。支持 `--cwd`、`--radius`、`--motion`、
`--dark-mode` 和 `--accent`；应用前可通过 `theme list` 和 `theme tokens` 检查预设。

## ai

```bash
pnpm dlx @zeus-web/cli ai --cursor
```

选项：

| 选项              | 说明                                |
| ----------------- | ----------------------------------- |
| `--json`          | 生成 `zeus-web.ai.json`。           |
| `--cursor`        | 生成 `.cursor/rules/zeus-web.mdc`。 |
| `--output <file>` | 写入自定义文件。                    |
| `--overwrite`     | 替换已有文件。                      |
| `--dry-run`       | 只输出计划，不写入文件。            |
