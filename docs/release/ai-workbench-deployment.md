# AI Workbench 部署与验收

本文覆盖 AI Workbench + AI Reference Host 的生产构建、容器部署和验收边界。
本轮没有接入真实模型 Provider，也没有执行线上部署；已验证的是 Replay /
Reference 模式。

## 1. 运行模式

| 模式               | 说明                                                            | 本轮状态                 |
| ------------------ | --------------------------------------------------------------- | ------------------------ |
| Replay / Reference | 无模型密钥，按确定性事件重放，验证协议、审批、Diff 与工作区写入 | PASS（三引擎浏览器门禁） |
| Live Provider      | 接入真实模型 Provider，需要密钥、额度与调用授权                 | NOT_RUN（无密钥/无授权） |

Workbench 只是 Zeus Native 应用外壳，业务协议复用 `@zeus-web/ai-core`、
`@zeus-web/ai-adapters` 与 `@zeus-web/ai-wc` 的公开接口；不得另起一套 AI UI
绕过这些包。

## 2. 构建

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @zeus-web/example-ai-workbench build
```

默认构建使用同源 `/ai-host`，由反向代理转发。跨源部署时：

```bash
ZEUS_AI_HOST_ORIGIN=https://ai-api.example.com \
  pnpm --filter @zeus-web/example-ai-workbench build
```

并把 workbench 的浏览器 origin 写入 Host 的 `ZEUS_AI_ORIGINS`。

## 3. 容器

```bash
cd examples/ai-host
docker compose up -d --build
```

compose 启动：

- `ai-host`：Node 24，非 root，SQLite 与 workspace 位于 `/data` 卷，健康检查
  `/health`，只允许 `ZEUS_AI_ORIGINS` 中的来源。
- `ai-workbench`：nginx 静态外壳，`/ai-host/` 反向代理到 `ai-host:8788`，
  SSE 关闭 buffering，端口 8083。

生产 ingress 必须提供 TLS 与 HSTS；`ai-host` 不应直接暴露公网写接口。
容器以 `read_only` + tmpfs 运行，`no-new-privileges` 开启。

## 4. 验收

浏览器门禁：

```bash
pnpm check:ai-workbench
```

覆盖聊天、SSE、审批、工作区写入、附件、多会话隔离、Diff、Test Report、
三引擎与可访问性扫描。报告写入 `temp/ai-workbench/report.json`，带
`sourceCommit`。

真实部署后由 Core 的独立验收器执行：

```bash
pnpm check:deployment-acceptance --manifest temp/release/deployment.json
```

AI Workbench 的 manifest commit 必须是 UI commit，而不是 Core commit。
验收器会真正加载页面、发送一条消息并确认它进入时间线；只有全部产品通过
才是 `ONLINE_ACCEPTED`，本地预演只能得到 `LOCAL_VALIDATED`。

## 5. 安全边界

- API Key 只存在于 Host 进程环境；不写入前端 bundle、日志或事件流。
- Host 写操作与命令执行只在 Host 侧，浏览器不能直接执行命令。
- 审批状态、会话与事件日志持久化在 `/data`；多会话按 conversation 隔离。
- 上传附件与工作区路径必须限制在配置的 workspace 根目录内。
- 在线演示必须使用隔离测试数据；不得把真实用户文件或密钥放进演示卷。
