# Zeus 0.2.0 R4.2 — AI Host / Workbench Security Closure

状态：**AI_HOST_SECURITY_READY**（本地参考实现与三浏览器 E2E；未公网部署）

不是 `FOUR_PRODUCTS_ONLINE_ACCEPTED`；没有部署 AI Host/Workbench，没有真实
Provider key，也没有声称线上 8443 验收完成。

## 安全矩阵

| 项目          | 实现                                                                                                     | 验证                                     |
| ------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 身份认证      | 所有端点除 `/health` 外要求 `Authorization: Bearer`；无 Origin 请求同样认证；Token 绑定 tenant/user/role | 无 Token 401；无 Origin + Token 200      |
| 403 / 租户    | 未知 tenant 403；跨租户 workspace/approval/stream 不可见                                                 | 双 tenant 真实 HTTP 测试                 |
| 审批 ID       | 随机 UUID，不作为授权凭证；旧可预测 `approval-1` 返回 404                                                | API 测试                                 |
| 自批          | 非 replay workspace 拒绝 proposer 自批；replay demo 明确允许                                             | 单元测试 `ZEUS_AI_APPROVAL_SELF`         |
| 审批角色      | 仅 approver/admin 可 resolve；viewer/editor 403                                                          | 真实 HTTP 测试                           |
| 一次性 / 重放 | 状态与 revision 检查；第二次 resolve 409；跨租户 404                                                     | API 测试                                 |
| 审批持久化    | workspace 隐藏 journal 原子写入；重启/重开后可恢复 pending                                               | 单元测试                                 |
| 多租户        | 每 tenant 独立 SQLite、workspace、conversation、asset、SSE clients                                       | 双 tenant 测试                           |
| SSE           | 按 tenant 隔离 clients；每 tenant 并发连接上限                                                           | 代码路径；未做慢连接压力测试             |
| 资源上限      | 请求 120/min per user；asset 数量/总大小/TTL；tool timeout                                               | 请求限流与 asset quota 测试              |
| Replay / Live | 默认 replay；live 无 Provider 配置时所有 command 503 fail closed                                         | live 模式测试                            |
| Ingress       | Workbench nginx 注入 upstream Bearer token；Host 无公网端口；Workbench 仅 loopback；限流/并发限制        | `docker compose config` + nginx 模板审查 |
| 凭据边界      | Provider/上游 Token 不进入浏览器；README 与 Vite dev proxy 都在服务端注入                                | 代码审查                                 |

## 测试结果

```text
NODE_OPTIONS=--experimental-sqlite pnpm exec vitest --run --project unit \
  examples/ai-host/__tests__/protocol.spec.ts
# 1 file, 13 tests passed
```

三浏览器 Workbench E2E（真实 Host、SSE、审批、workspace 写入）：

```text
NODE_OPTIONS=--experimental-sqlite pnpm check:ai-workbench
# chromium: chat, SSE, approval and write passed
# firefox:  chat, SSE, approval and write passed
# webkit:   chat, SSE, approval and write passed
```

Compose 拓扑：AI Host 仅 `expose: 8788`，Workbench 绑定
`127.0.0.1:8083`；`ZEUS_AI_TOKENS` 是必需 env，缺失时 Compose 直接拒绝启动。

## 未完成 / 边界

- 未部署 AI Host/Workbench；真实公网 TLS ingress、跨租户在线 SSE、费用/并发
  上限未做线上验收，状态为 `NOT_RUN`。
- 参考 Host 没有 live provider；live 模式按设计 fail closed，不能作为可用的
  付费模型演示。
- SSE 上限和慢连接/断线恢复只做了代码路径与普通 E2E，未做长时间资源耗尽
  故障注入；不得宣称已通过容量/DoS 验收。
- `ZEUS_ACCEPTANCE_AI_REPLAY` 仍只是旧验收脚本开关，不是安全边界；安全边界
  是 Bearer Token + tenant/role + workspace 隔离。
- 未执行 Docker image build；Compose 配置与 nginx 模板已检查。
