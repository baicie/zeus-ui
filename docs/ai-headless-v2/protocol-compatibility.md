# AI Headless V2 协议兼容与迁移策略（AI2-112）

> 实现：`packages/ai-core/src/protocol/compat.ts`；测试：`packages/ai-core/__tests__/compat.spec.ts`。

## 版本号

| 对象             | 字段                       | 当前值 | 含义                                           |
| ---------------- | -------------------------- | ------ | ---------------------------------------------- |
| DomainEvent 信封 | `schemaVersion`            | `2`    | 破坏性变更计数器，客户端只接受支持列表内的版本 |
| Command 信封     | `schemaVersion`            | `2`    | 同上，Host 拒绝未知版本                        |
| Snapshot         | `schemaVersion` + checksum | `2`    | checksum 覆盖整个规范化状态                    |

同一个 stream 内不得混用版本。Host 升级到新版本时必须开新 stream，或先下发新版本快照。

## 什么算破坏性变更

需要提升 `schemaVersion`：

- 删除字段、改字段类型、改枚举含义；
- 改变已有事件的语义（例如 `message.completed` 不再表示终态）；
- 改变规范化状态的形状或 checksum 投影（快照不再可比较）。

不需要提升版本，只能做加法：

- 给实体或 payload 加**可选**字段（客户端会保留但不依赖它）；
- 新增事件类型，并按下一节声明兼容性。

## 新事件类型：`compat` 标记

信封可带 `compat: 'required' | 'ignorable'`（缺省视为 `required`）。

| 客户端认识该类型？ | `compat`    | 行为                                                                      |
| ------------------ | ----------- | ------------------------------------------------------------------------- |
| 认识               | 任意        | 正常校验与应用；`compat` 不能让已知类型跳过校验                           |
| 不认识             | `ignorable` | 只确认 seq（游标前进），不读、不存 payload，发出 `extension-ignored` 诊断 |
| 不认识             | `required`  | 隔离并停流（`desynced`），等待已知版本的快照                              |

这样旧客户端既不会因为新增遥测之类的事件卡住，也不会去猜测一个声称「必须理解」的事件的含义。

## 快照兼容

- `__tests__/fixtures/snapshots/s{1,2,3}.v2.json` 是由 S1/S2/S3 录制流导出的快照。
- 测试要求：它们能被当前代码载入，且今天重放同一事件流得到的 checksum 与录制值相同。
- 改动规范化状态（新增集合、索引或改 checksum 算法）会让这组测试失败，此时必须：提升快照 `schemaVersion`、重新录制 fixture，并在发布说明中标为破坏性变更。不允许只更新 fixture 而不提升版本。

## 迁移

当前只有 v2，没有需要迁移的旧版本（V1 的 Chat/AgentConsole 数据不是 V2 协议，见 `legacy-decision.md` 与 `@zeus-web/ai-core` 的 legacy adapter）。引入 v3 时：

1. 客户端先同时支持 v2、v3（`SUPPORTED_EVENT_SCHEMA_VERSIONS`）；
2. Host 对新 stream 发 v3，旧 stream 继续发 v2 直到结束；
3. 快照不做静默升级：v2 快照要么由 Host 重新生成 v3 快照，要么客户端从头重放。
