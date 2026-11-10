# AI Workbench 部署与验收

本文覆盖 AI Workbench + AI Reference Host 的生产构建、容器部署和验收边界。
本轮没有接入真实模型 Provider，也没有执行线上部署；已验证的是 Replay /
Reference 模式。

## 1. 运行模式

| 模式               | 说明                                                            | 本轮状态                                 |
| ------------------ | --------------------------------------------------------------- | ---------------------------------------- |
| Replay / Reference | 无模型密钥，按确定性事件重放，验证协议、审批、Diff 与工作区写入 | PASS（三引擎浏览器门禁）                 |
| BYOK               | 用户自带网关与密钥，浏览器直连；密钥加密存于浏览器 Vault        | PASS（Chromium/Firefox 门禁，Mock 网关） |
| Host Live Provider | Host 侧接入真实 Provider，需要运营方密钥、额度与调用授权        | NOT_RUN（无密钥/无授权）                 |

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
  `/health`，只允许 `ZEUS_AI_ORIGINS` 中的来源。`ZEUS_AI_WORKSPACE_ID` 必须
  等于验收租户 id，在线验收会把它与 `--tenant` 比对。
- `ai-workbench`：nginx 静态外壳，`/ai-host/` 反向代理到 `ai-host:8788`，
  SSE 关闭 buffering，端口 8083。

生产 ingress 必须提供 TLS 与 HSTS；`ai-host` 不应直接暴露公网写接口。
容器以 `read_only` + tmpfs 运行，`no-new-privileges` 开启。

### 3.1 上线判定：容器换了不等于线上变了

这条流水线曾经连续多次「部署成功」而线上仍是旧构建。根因有三层，改动部署脚本或
排查线上不生效时按这个顺序看：

1. **`up --remove-orphans` 不认识手工容器。** 它只清理当前 compose project 的
   orphan。线上那对容器最早是 `docker run` 起的，没有任何 compose 标签，所以既不算
   orphan 也删不掉，会一直占着 ingress 端口。更糟的是新旧 `ai-host` 挂同一个
   `/data`，两个进程写同一个 SQLite 文件。现在的做法是**按危险而非按命名**退役：
   任何其他正在运行、且挂载本部署数据目录的容器，都视为第二个写入者并被移除。
2. **tag 不是身份。** 镜像来自 TCR 时，一次中断的发布会把 tag 留在上一个提交上，
   部署会把生产**回滚**却照样报成功。构建期把提交写进了
   `org.opencontainers.image.revision` 标签，部署时逐镜像比对。
3. **没人检查 ingress 实际在服务什么。** 部署末尾新增一步：请求公开域名的
   `build-info.json`，断言其中的 `uiCommit` 等于本次提交。该步骤由仓库变量
   `ZEUS_PUBLIC_SITE_URL` 开关，未配置时整步跳过。

ingress（Caddy）是运维自己的配置，CI **不**改写它：端口从 `18091` 换到 `8083`、
容器名从 `-r44` 换成正式名，都属于需要人确认的动作。CI 的职责是把不一致**报出来**，
而不是背着运维改配置。因此第一次切换到新容器仍需手动执行一次，之后流水线才能自证。

手动切换时注意一个 Docker 陷阱：`Caddyfile` 是**单文件 bind mount**，挂载绑定的是
**inode 而不是路径**。`sed -i` / `mv` 会创建新 inode，容器里看到的仍是旧文件，于是
`caddy reload` 加载的是旧配置、`validate` 也永远通过——改了却毫无反应，且看不出任何
错误。正确做法是原地覆盖（`> file`、`tee`、`cat new > file`），或把新文件
`docker cp` 进容器可写目录后从那里 reload：

```bash
cp /home/ubuntu/caddy/Caddyfile /home/ubuntu/caddy/Caddyfile.bak-$(date +%F-%H%M%S)
sed 's#127.0.0.1:18091#127.0.0.1:8083#' /home/ubuntu/caddy/Caddyfile > /tmp/cf.new
sudo tee /home/ubuntu/caddy/Caddyfile < /tmp/cf.new > /dev/null   # 保留 inode
docker cp /home/ubuntu/caddy/Caddyfile caddy:/tmp/Caddyfile.next
docker exec caddy caddy validate --config /tmp/Caddyfile.next --adapter caddyfile
docker exec caddy caddy reload   --config /tmp/Caddyfile.next --adapter caddyfile
```

Caddy 的 admin API（`localhost:2019`）**不能**直接改 `reverse_proxy.upstreams`：该模块
不允许此路径的 traversal，会返回 `invalid traversal path`。不要在这上面绕弯路。

### 3.2 TCR 镜像源

`TCR_IMAGE` 填**完整仓库路径**（`host/namespace/repo`），因为 workflow 会直接给它拼
`:tag`。但 `docker login` 只认 registry 主机名：把整条路径当 registry 传会让 daemon
去请求 `<path>/v2/`，拿到 `404 no scope specify`，看起来像权限问题，实际是地址错了。
workflow 会把主机名切出来再登录。

两个仓库的变量含义不同，别填混：

| 仓库             | `TCR_IMAGE`                              | 产出                          |
| ---------------- | ---------------------------------------- | ----------------------------- |
| `baicie/zeus`    | `ccr.ccs.tencentyun.com/<ns>/zeus-admin` | 直接作镜像名                  |
| `baicie/zeus-ui` | `ccr.ccs.tencentyun.com/<ns>/zeus-ai`    | 自动拼 `-workbench` / `-host` |

TCR 个人版**首次 push 会自动建仓**，不需要预先在控制台创建仓库。凭证是控制台生成的
访问凭证，不是腾讯云 API 密钥。

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
ZEUS_ACCEPTANCE_AI_REPLAY=true \
ZEUS_ACCEPTANCE_TENANT=acceptance-2026-11-05 \
  pnpm check:deployment-acceptance \
    --manifest temp/release/deployment.json \
    --provenance temp/release/provenance.json \
    --write-mode isolated \
    --tenant acceptance-2026-11-05
```

AI Workbench 的 `build-info.json` 必须与 CI provenance 的 artifact digest 和
manifest 一致；镜像以 `@sha256:...` 固定。

AI Workbench 的 manifest commit 必须是 UI commit，而不是 Core commit。
验收器会真正加载页面、发送一条消息并确认它进入时间线；只有全部产品通过
才是 `ONLINE_ACCEPTED`，本地预演只能得到 `LOCAL_VALIDATED`。

## 5. BYOK 与 CSP

BYOK 让用户把浏览器指向自己的模型网关。工作台页面因此需要被允许连接操作员
指定的源，而默认策略仍是 `connect-src 'self'`。

操作员通过一个变量显式开通：

```bash
ZEUS_BYOK_CONNECT_SRC="https://api.openai.com https://gateway.example.com"
```

- 值只进入 `connect-src`，不影响 `script-src`、`object-src`、`base-uri`。
- 留空时渲染出的策略与未引入 BYOK 前逐字节相同。
- 入口脚本会裁剪空白、折叠重复空格，并拒绝含 `;`、`,` 或 `'` 的值——这些
  会越出指令。
- `NGINX_ENVSUBST_FILTER` 必须同时包含 `ZEUS_AI_UPSTREAM_TOKEN` 与
  `ZEUS_BYOK_CONNECT_SRC_SPACED`；漏掉后者会让模板里的 `${...}` 以字面量
  进入响应头，浏览器会丢弃整条 CSP。

不配置该变量时，BYOK 请求会被浏览器按 CSP 拦截。客户端能区分这种情况与 CORS
失败：`securitypolicyviolation` 事件会指出 `connect-src`，界面据此提示"部署的
CSP 阻止了该源"，而不是误报成 CORS。

`scripts/checks/__tests__/workbench-csp.spec.ts` 守护上述性质，包括默认严格、
变量位置、越界拒绝与 filter 同步。

## 6. 安全边界

- **Host 的 Agent 路径**：API Key 只存在于 Host 进程环境；不写入前端 bundle、
  日志或事件流。
- **BYOK 路径**：密钥由用户提供并只存在于其浏览器的加密 Vault 中，从不发往
  Host；请求从浏览器直达用户配置的网关。两条路径不共享传输、权限或数据存储。
- BYOK 请求不得伪装成 Host 的 Agent 事件，也不绕过 Host 的认证或写权限。
- Host 写操作与命令执行只在 Host 侧，浏览器不能直接执行命令。
- 审批状态、会话与事件日志持久化在 `/data`；多会话按 conversation 隔离。
- 上传附件与工作区路径必须限制在配置的 workspace 根目录内。
- 在线演示必须使用隔离测试数据；不得把真实用户文件或密钥放进演示卷。
