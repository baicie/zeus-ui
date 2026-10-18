# Data Grid 层边界

Data Grid 的纯状态模型与 DOM 宿主逐步分离。当前基础模型已经位于 `src/core`：

- `row-model`、`column-model`、`sort-model`、`selection-model` 管理数据与交互状态。
- `grid-virtualizer`、`column-virtualizer`、`viewport-measure-model` 计算可见范围与测量值。
- `range-update-scheduler` 合并待提交范围更新，并把帧请求、取消和 commit 回调限制在可替换边界内。
- `components/data-grid.tsx` 仍是 Web Component Host，负责读取 DOM viewport、ResizeObserver、事件、焦点与 DOM reconciliation。

## 本次切片

`createDataGridRangeUpdateScheduler` 接收数据范围更新，而不读取 DOM。它保持现有提交语义：测量任务在合并时优先、同类输入保留最早输入时间、最新滚动事件参与提交、`preserve` 标志取并集；Host 遇到已排队更新后的滚动事件会同步 flush。调度器支持注入 `requestFrame`/`cancelFrame`，因此合并与取消策略可在 Node 单测中确定性验证。

未排队的原生滚动仍在 Host 内同步计算范围，以避免给滚动热路径分配队列记录或探测帧调度器。Host 继续拥有布局读取与 DOM commit。

## 后续边界

此切片不表示完整的五层拆分已经完成。Viewport Controller 的 DOM 测量接线、renderer 的正式消费协议，以及 WC Host 与模型实例的显式生命周期绑定仍需单独迁移；在迁移前，`data-grid.tsx` 保持当前唯一生产渲染入口。
