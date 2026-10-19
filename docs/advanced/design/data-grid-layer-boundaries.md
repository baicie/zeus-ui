# Data Grid 层边界

Data Grid 的纯状态模型与 DOM 宿主逐步分离。当前基础模型已经位于 `src/core`：

- `row-model`、`column-model`、`sort-model`、`selection-model` 管理数据与交互状态。
- `grid-virtualizer`、`column-virtualizer`、`viewport-measure-model` 计算可见范围与测量值。
- `range-update-scheduler` 合并待提交范围更新，并把帧请求、取消和 commit 回调限制在可替换边界内。
- `components/data-grid.tsx` 仍是 Web Component Host，负责读取 DOM viewport、ResizeObserver、事件、焦点与 DOM reconciliation。

## 本次切片

`createDataGridRangeUpdateScheduler` 接收数据范围更新，而不读取 DOM。它保持现有提交语义：测量任务在合并时优先、同类输入保留最早输入时间、最新滚动事件参与提交、`preserve` 标志取并集；Host 遇到已排队更新后的滚动事件会同步 flush。调度器支持注入 `requestFrame`/`cancelFrame`，因此合并与取消策略可在 Node 单测中确定性验证。

未排队的原生滚动仍在 Host 内同步计算范围，以避免给滚动热路径分配队列记录或探测帧调度器。Host 继续拥有布局读取与 DOM commit。

本次 U-003 续接切片新增 `createDataGridViewportController`。它只拥有 viewport 的 DOM 连接边界：`connect(element)` 建立尺寸读取和可选 `ResizeObserver`，`getClientSize()` 返回当前布局尺寸，`disconnect()` 解除 observer、清除元素引用并使旧连接的回调失效。行高、行数和 fallback 规则仍由 `viewport-measure-model` 负责；范围计算和 DOM commit 仍由 Host 调度。这样 WC Host 的 viewport ref 可以把连接与断开作为显式生命周期操作，observer 不再是 Host 内部的隐式状态。

Renderer 目前保持 `createDataGridCellRendererAdapter` 的框架中立协议：`reconcile` 只接收可见 cell slot，稳定的 row/column key 复用同一 handle，renderer 或容器变化先执行旧 handle 的 `dispose`。容器是泛型值，core 不读取 DOM，也不解析 VNode；浏览器 `Element` 只由上层 Host adapter 传入。`clear()` 释放当前可见 handle 但保留 adapter 可重连，`dispose()` 才会永久关闭 adapter。

WC Host 的连接边界由 `createDataGridHostAdapter` 显式拥有。它只协调三个生命周期操作：连接/断开 viewport、取消 `DataGridRangeUpdateScheduler` 的待处理 commit、以及在断开时调用 renderer `clear()`。它不会计算 range、读取布局或解析框架节点；这些职责分别属于 viewport controller、headless model/scheduler 和 renderer adapter。Data Grid 的生产 ref 现在通过该 adapter 连接 Host，因此 Host 的 DOM 回调不再直接持有调度器取消细节。

`createDataGridHostAdapter` 的 `disconnect()` 会尝试执行全部清理，即使其中一个 collaborator 抛错也会继续清理，最后重新抛出首个错误。断开后重新 `connect()` 是合法的；这对应 custom element 在 DOM 中移除后再次插入的生命周期。

## Framework consumer 验证

框架 renderer 的生命周期证据位于 `packages/advanced/data-grid/__tests__/framework-cell-renderer-consumer.spec.ts`：

- React 19 与 Vue 3 覆盖 mount、稳定 key update、DOM/focus identity、clear、dispose 和 reconnect。
- React Portal 与 Vue Teleport 由各自 renderer adapter 管理 target；宿主断开时先卸载 framework root，再清理 adapter 自己创建的 target。
- 外部 target 及其非 framework 子节点在 adapter cleanup 后继续保留。
- `examples/data-grid-react18-consumer` 使用真实 React 18.3.1 / React DOM 18.3.1，独立覆盖 keyed update、root disposal 和 reconnect。

浏览器 fixture `e2e/advanced/data-grid/framework-renderer-browser.spec.ts` 在 Chromium、Firefox 和 WebKit 验证 mount/update、断开清理、外部 Portal/Teleport target 保留及重连；CI 通过 `pnpm data-grid:framework-e2e` 运行三引擎矩阵。

## 后续边界

此切片不表示完整的五层拆分已经完成。Data Grid 仍由 `data-grid.tsx` 提供唯一生产渲染入口，公开的 `cellRenderer` 字段尚未冻结为稳定 ABI；React/Vue 节点仍必须通过显式 adapter 管理，不能写入 WC property、Manifest 或普通 Slot。
