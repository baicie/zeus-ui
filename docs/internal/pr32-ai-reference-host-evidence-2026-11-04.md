# PR-32/33：AI Reference Host 与 Native Workbench 证据

日期：2026-11-04（Asia/Shanghai）

## 交付

- `examples/ai-host`：独立 Node 服务，标准 `Command`、SSE `ai-event`、快照与工作区接口。
- `node:sqlite` 持久化事件与幂等账本；重启后按 `Last-Event-ID` 继续。
- 写操作只能经 `approval.resolve` 完成；每次审批校验 revision 与终态。
- 工作区路径围栏：绝对路径、`..`、NUL 与控制字符拒绝；文件与批量大小受限。
- `examples/ai-workbench`：Zeus Native 页面，使用公开 `ai-core` controllers 与 `ai-wc` 元素。
- `ai-core` 新增 adapter `onOpen` 信号，使空流或慢流也能进入 `live`。
- 三引擎门禁 `check:ai-workbench`，启动真实 Host + Vite，覆盖聊天、SSE、审批与真实写入。

## 验证

```sh
pnpm exec vitest --run --project unit examples/ai-host/__tests__/protocol.spec.ts
pnpm check:ai-workbench
```

结果：

- Host 协议 6 项通过：幂等重试、key 冲突、重启回放、路径围栏、审批 revision、SSE 端到端。
- Chromium / Firefox / WebKit：连接 `live`、发送消息显示、审批出现、Approve 后文件写入且审批清空。
- 报告：`temp/ai-workbench/report.json`。

## 未执行 / 授权边界

- 真实在线部署、TLS、反向代理与公网匿名访问未执行。
- 真实模型 Provider、费用与凭证未配置；当前为本地/Replay 参考 Host，不冒充 Live。
- VoiceOver/NVDA 与移动端手工验收未执行。
- 生产对象存储、多租户与高可用不在本次参考 Host 范围。
