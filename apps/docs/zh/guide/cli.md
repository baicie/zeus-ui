# CLI

Zeus Web CLI 以 `@zeus-web/cli` 发布。

CLI 负责 React/Vue 源码 Registry 工作流。

## 命令

| 命令                    | 说明                                                            |
| ----------------------- | --------------------------------------------------------------- |
| `zweb init`             | 创建 `zeus-ui.json`、`src/lib/cn.ts` 和 `src/styles/zeus.css`。 |
| `zweb add <components>` | 将 Registry 组件源码复制到你的项目中。                          |
| `zweb ai`               | 生成 AI 可读的元数据和使用指南。                                |
| `zweb icon`             | 管理图标元数据和代码片段。                                      |

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

| 选项                       | 说明                             |
| -------------------------- | -------------------------------- |
| `--cwd <dir>`              | 使用指定的项目目录。             |
| `--dry-run`                | 只输出计划，不写入文件。         |
| `--overwrite`              | 替换已有的生成文件。             |
| `--install`                | 安装包依赖。                     |
| `--no-install`             | 不安装依赖。                     |
| `--package-manager <name>` | `pnpm`、`npm`、`yarn` 或 `bun`。 |

示例：

```bash
zweb add button --dry-run
zweb add button input
zweb add button --overwrite
zweb add button --install
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
