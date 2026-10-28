# `@zeus-web/ai-adapters`

Zeus AI Headless V2 的传输适配器（AI2-111）。两个实现都满足 `@zeus-web/ai-core` 的 `AiHostAdapter`，不依赖 DOM、UI 框架或供应商 SDK；`fetch` / `WebSocket` 在调用时查找或由调用方注入，因此在 SSR 中 import 安全。

- 包状态：**Proposed / 实验性**，`private`。

## SSE：`createSseHostAdapter({ baseUrl, fetch?, headers?, reconnect?, sleep? })`

| 操作          | HTTP                                                                                  |
| ------------- | ------------------------------------------------------------------------------------- |
| `execute`     | `POST /commands`，返回 `CommandAck`；Host 拒绝以 `accepted: false` 返回               |
| `subscribe`   | `GET /streams/:id/events?after=N`，`Last-Event-ID: N`，SSE `data:` 为一个 DomainEvent |
| `getSnapshot` | `GET /snapshots?kind=&id=`                                                            |
| `loadAsset`   | `GET /assets/:id`                                                                     |

## WebSocket：`createWebSocketHostAdapter({ url, createSocket?, reconnect?, requestTimeoutMs?, loadAsset? })`

单连接复用命令、订阅和快照，帧格式见 `src/websocket.ts` 文件头。资产不走 socket，需要时传入 `loadAsset`。

## 共同语义

- **错误码**：抛出的 `AiTransportError` 表示「没有拿到权威回答」（`network` / `http` / `aborted` / `protocol` / `stream-mismatch` / `closed` / `timeout` / `reconnect-exhausted` / `unsupported`），`retryable` 指示能否用同一个 `idempotencyKey` 重试。Host 的拒绝永远是 Ack，不是异常。
- **Cursor 与重连**：订阅从 `afterSeq` 开始；断线后指数退避重连，从最后一个校验通过的 seq 续订。
- **序号校验**：重复 seq 丢弃；跳号时从最后一个好 seq 重新请求，让 Host 补发，而不是跳过；其它 stream 的事件直接报错。Store 仍会再次校验。
- **Abort**：`signal` 中止时订阅静默结束，请求以 `aborted` 失败。
- **凭据**：适配器不保存密钥；`headers()` 每次请求调用一次，由应用提供短期 token。
