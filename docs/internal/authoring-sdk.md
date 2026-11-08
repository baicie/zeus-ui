# 第三方作者 SDK（PR-25）

本文件定义仓库外组件作者与插件作者的稳定契约。它是**公开契约**，随 `@zeus-web/registry` 的 `./author` 入口发布；任何破坏性变化都必须提升 `authorContractVersion`。

## 两种产品能力必须分开描述

Zeus Web 有两种完全不同的组件分发方式，文档、CLI 输出与验收报告都不得把它们混为一谈：

| 模式                  | 分发物                         | 归属                    | 升级方式                          |
| --------------------- | ------------------------------ | ----------------------- | --------------------------------- |
| CLI registry 源码复制 | `.tsx` / `.vue` 模板           | 复制到 app，归 app 所有 | `zweb update`，冲突时保留本地修改 |
| **CE 包发行模式**     | `dist/wc/*`、CEM、DTS、wrapper | npm 包，归作者所有      | 改 `package.json` 版本并重新安装  |

`zweb add` 只会复制源码，它**不是** custom element 的实现方式。CE 包只能由 `@zeus-js/bundler-plugin` + `@zeus-js/output-wc` 在作者仓库里构建得到。任何把「源码复制」描述成「CE 的唯一实现」的说法都是错误的。

## 契约版本

| 常量                        | 值                                  | 含义                                           |
| --------------------------- | ----------------------------------- | ---------------------------------------------- |
| `authorContractVersion`     | `1`                                 | `package.json#zeus.contractVersion` 必须等于它 |
| `pluginApiVersion`          | `1`                                 | 输出插件 API 版本                              |
| `authorZeusBaselineVersion` | 与工作区安装的 `@zeus-js/zeus` 一致 | 未安装 Zeus 时 `zweb author check` 的对照基线  |
| `reservedTagPrefix`         | `zw-`                               | 保留给 Zeus Web 官方包，第三方不得使用         |

不兼容变化必须显式失败：registry manifest 的 `schemaVersion` 不是 `2` 时，`validateRegistry` 与 `zweb registry validate` 直接报错并给出迁移提示，不做静默升级。

## 组件包必须声明的形状

```jsonc
{
  "name": "@acme/counter-element",
  "version": "0.1.0",
  "type": "module",
  "files": ["dist"],
  "exports": {
    ".": { "types": "./dist/wc/index.d.ts", "import": "./dist/wc/index.js" },
    "./wc/auto": "./dist/wc/auto.js",
    "./custom-elements.json": "./dist/custom-elements.json",
    "./zeus.components.json": "./dist/zeus.components.json",
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js",
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue/index.js",
    },
  },
  "peerDependencies": { "@zeus-js/zeus": "0.1.1-beta.20" },
  "dependencies": {
    "@zeus-js/output-react-wrapper": "0.1.1-beta.20",
    "@zeus-js/output-vue-wrapper": "0.1.1-beta.20",
    "@zeus-js/runtime-dom": "0.1.1-beta.20",
    "@zeus-js/web-c-runtime": "0.1.1-beta.20",
  },
  "zeus": {
    "kind": "component-package",
    "contractVersion": 1,
    "zeusVersion": "0.1.1-beta.20",
    "plugins": [],
  },
}
```

规则：

- `exports` 的四个必需入口（`.`、`./wc/auto`、`./custom-elements.json`、`./zeus.components.json`）缺一即失败；`.` 必须同时声明 `types` 与 `import`。
- 有 `./react` / `./vue` 时，必须声明对应的 wrapper 运行时依赖与版本。
- `files` 只允许 `dist` 及其子路径。源码、`node_modules`、构建脚本不得进入发布包。
- `peerDependencies["@zeus-js/zeus"]` 必须是**精确版本**，不接受 `^` / `~` / range。beta 阶段版本漂移必须显式失败。
- `zeus.kind` 只能是 `component-package` 或 `output-plugin`。

## 诊断码

`validateComponentPackage` / `validateOutputPluginMetadata` / `validateRegistry` 返回：

```ts
interface AuthorDiagnostic {
  code: string // 稳定机器码
  path: string // JSON path，如 exports["./wc/auto"]
  message: string
}
```

| 码                                     | 触发条件                                                                |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `ZEUS_AUTHOR_PACKAGE_META`             | `package.json` 不是对象                                                 |
| `ZEUS_AUTHOR_PACKAGE_NAME`             | 包名不合法                                                              |
| `ZEUS_AUTHOR_PACKAGE_EXPORTS`          | 缺少必需导出、导出 target 不是 `./` 相对路径、根导出缺 `types`/`import` |
| `ZEUS_AUTHOR_PACKAGE_FILES`            | `files` 缺失或包含 `dist` 之外的条目                                    |
| `ZEUS_AUTHOR_WRAPPER_MISSING`          | 声明了 wrapper 导出却缺少对应依赖                                       |
| `ZEUS_AUTHOR_PACKAGE_PEER`             | `@zeus-js/zeus` peer 不是精确版本                                       |
| `ZEUS_AUTHOR_PACKAGE_VERSION_MISMATCH` | 消费者安装的 Zeus 版本与 peer pin 不一致                                |
| `ZEUS_AUTHOR_FILE_MISSING`             | 导出指向的文件不存在                                                    |
| `ZEUS_AUTHOR_MANIFEST_SCHEMA`          | `zeus.components.json` 的 `schemaVersion` 不是 `1`                      |
| `ZEUS_AUTHOR_CEM_SCHEMA`               | `custom-elements.json` 的 `schemaVersion` 不是 `1.0.0`                  |
| `ZEUS_AUTHOR_MANIFEST_TAG`             | tag 格式非法、使用 `zw-` 前缀、或重复                                   |
| `ZEUS_AUTHOR_MANIFEST_COMPONENT`       | 组件条目缺 name/exportName                                              |
| `ZEUS_AUTHOR_CEM_DRIFT`                | CEM 与 `zeus.components.json` 的 events / slots / cssParts 不一致       |
| `ZEUS_AUTHOR_PLUGIN_META`              | `zeus` 块缺失或字段类型错误                                             |
| `ZEUS_AUTHOR_PLUGIN_ID`                | 插件 id 格式非法或重复                                                  |
| `ZEUS_AUTHOR_PLUGIN_VERSION`           | 插件版本不是 semver                                                     |
| `ZEUS_AUTHOR_PLUGIN_API_VERSION`       | `apiVersion` 与 `pluginApiVersion` 不匹配                               |
| `ZEUS_AUTHOR_PLUGIN_CAPABILITY`        | `capabilities` 为空或含非法项                                           |
| `ZEUS_AUTHOR_PLUGIN_OUTPUT`            | `outputs` 为空或含非法 artifact 名                                      |
| `ZEUS_AUTHOR_PLUGIN_OUTPUT_CONFLICT`   | 两个插件声明同一个输出属主                                              |
| `ZEUS_AUTHOR_PLUGIN_ORDER`             | `order` 不是整数                                                        |

## 输出插件契约

插件是**构建时可信代码**，拥有完整 Node 权限。SDK 只校验声明与产物属主，不做沙箱；安全说明不得称其为沙箱。

```ts
// package.json#zeus
{
  "kind": "output-plugin",
  "contractVersion": 1,
  "zeusVersion": "0.1.1-beta.20",
  "plugins": [
    {
      "id": "@acme/zeus-output-report",
      "version": "0.1.0",
      "apiVersion": 1,
      "capabilities": ["manifest:read"],
      "outputs": ["assets"],
      "order": 100
    }
  ]
}
```

插件实现只允许使用公开入口 `@zeus-web/registry/author` 与 `ctx.manifest`：

```ts
import { createAuthorPluginAsset } from '@zeus-web/registry/author'

export function acmeOutputReport() {
  return {
    name: '@acme/zeus-output-report',
    generateBundle(context: { manifest: unknown }) {
      return [
        createAuthorPluginAsset({
          id: '@acme/zeus-output-report',
          version: '0.1.0',
          fileName: 'acme.report.json',
          manifest: context.manifest,
        }),
      ]
    },
  }
}
```

`createAuthorPluginReport` / `createAuthorPluginAsset` 会把 manifest 归一化为稳定形状（events / slots / parts / hostAttributes 排序），`apiVersion` 不匹配时抛出错误，`fileName` 必须匹配 `^[a-z0-9][a-z0-9._-]*$`。

## CLI

```bash
zweb author check                 # 校验当前目录包
zweb author check ./dist-pkg --json
zweb author check --zeus-version 0.1.1-beta.20
zweb registry validate            # 校验 ./registry.json
zweb registry validate ./registry.json --json
```

两者在失败时 `exitCode = 1`，`--json` 输出 `{ valid, diagnostics: [{ code, path, message }] }`，可直接接入编辑器与 CI。

`zweb author check` 通过 `exports` 映射定位 `zeus.components.json` 与 `custom-elements.json`（作者通常把产物放在 `dist/`），并在 `node_modules` 中向上查找已安装的 `@zeus-js/zeus` 版本；找不到时使用契约基线并在报告中标注。

## 发布安全与许可

- **来源**：只从你信任的 registry 或 npm scope 安装。`zweb add --registry <url>` 支持 HTTP(S)，但 CLI 会记录 sha256（`zeus-ui.lock.json` 的 `registryHashes`），后续变更可见。
- **完整性**：`zeus-ui.lock.json` 记录 `fileHashes` 与 `registryHashes`；本地修改后 `zweb update` 不会静默覆盖，需要显式 `--overwrite`。
- **版本锁定**：第三方包必须精确 pin `@zeus-js/zeus` peer；`zweb author check` 在消费者版本漂移时失败。
- **许可**：registry manifest `schemaVersion: 2` 要求 `license`（SPDX 形状）与至少一个 `authors` 条目；包本身沿用 `package.json#license`。
- **插件权限**：输出插件在构建期执行任意代码。安装前审查源码，不要在不信任的 CI 上加载未知插件。

## 升级策略

- `authorContractVersion` / `pluginApiVersion` 只在破坏性变化时递增；递增后旧包会被明确拒绝，不会静默兼容。
- `zeus.components.json` 与 `custom-elements.json` 的 `schemaVersion` 独立演进，同样显式拒绝。
- registry manifest 当前为 `schemaVersion: 2`（新增 `license`、`authors`）。`1` 不再被接受。

## 验收方式

```bash
pnpm build
pnpm --filter @zeus-web/cli build
pnpm check:author-consumer
```

`check:author-consumer` 会在仓库外的临时空目录里完成：创建一个第三方 WebC 包（WC + React + Vue wrapper + CEM + DTS）、挂一个第三方输出插件、运行 `zweb author check`（通过 + 版本冲突失败）、`npm pack` 校验发布形状，最后在独立 consumer 中注册元素、渲染、派发事件、投影 slot 并挂载 React/Vue wrapper。
