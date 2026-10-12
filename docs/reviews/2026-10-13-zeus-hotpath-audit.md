# Zeus 滚动热路径审计

## 审计范围

本审计针对 Zeus core `v0.1.1-beta.7` 与 zeus-ui `v0.1.0-beta.26` 的 Data Grid 原生滚动路径，重点检查 scheduler、`updateRange`、virtualizer snapshot 和 keyed `For` 复用。

## 代码证据

- `packages/advanced/data-grid/src/components/data-grid.tsx:1523-1615`：原生 `scroll` 在没有待处理更新时直接调用 `updateRange`；存在待处理更新时先 `scheduler.flush()`，再在当前任务中执行 commit。因此该路径不会等待下一帧的 `requestAnimationFrame`。
- `packages/advanced/data-grid/src/components/data-grid.tsx:1366-1465`：滚动 commit 只读取已有 viewport 尺寸，复用同一水平偏移的 column snapshot，并按 scroll offset 缓存 row snapshot。
- `packages/advanced/data-grid/src/core/grid-virtualizer.ts:139-153`：row snapshot 只计算当前 range、可见 item 和 total size。
- `packages/advanced/data-grid/src/core/column-virtualizer.ts:116-183`：column range 使用二分查找；垂直滚动时 Data Grid 复用 column snapshot。
- `packages/advanced/virtual/src/core/size-cache.ts:60-64,75-83,117-123`：固定估算尺寸且没有测量覆盖时，offset、total size 和 index 查找都走常数时间路径。
- `packages/core/runtime-dom/src/list.ts:339-357`：固定槽位 keyed `For` 只更新已有 record 的 item signal，不创建 keyed map、不移动 DOM、不检查 focus。

## 真实 trace

证据文件：Nyala `/tmp/nyprof/jank.json`，Chromium、Zeus beta26 bundle、`10k x 50`，三个 Zeus 记录，每个记录 20 个 scroll commit。

| 阶段                                    |     典型中位数 |
| --------------------------------------- | -------------: |
| `inputTime -> handlerStartTime`         | `12.6-12.7 ms` |
| `rangeStartTime -> rangeCalculatedTime` |       `0.1 ms` |
| `commitStartTime -> commitEndTime`      |   `1.3-1.5 ms` |
| `createdNodeCount` / `removedNodeCount` |        `0 / 0` |
| `rowWrapperAllocationCount`             |           `23` |

滚动 commit 的 range 约为 15 行、13 列。Zeus 的 `updateRange`、range 计算、snapshot 比较和 DOM 固定槽位更新均已在 `handlerStartTime` 之后完成；约 12.6 ms 的等待发生在 scroll 输入时间戳与 handler 入口之间。

随后用 capture-phase `scroll` listener 做了同一 `10k x 50` Chromium 对照采集（native、Zeus 各三次，22 个 segment/次）。Zeus sample segment 的中位数 / p95 如下：

| 阶段                                    |         中位 |          p95 |
| --------------------------------------- | -----------: | -----------: |
| `inputEndTime -> eventDispatchTime`     |    `16.3 ms` |    `17.5 ms` |
| `eventDispatchTime -> handlerStartTime` |       `0 ms` |     `0.1 ms` |
| `handlerStartTime -> rangeStartTime`    |       `0 ms` |     `0.1 ms` |
| range 计算                              |     `0.1 ms` |     `0.2 ms` |
| commit                                  | `1.8-2.0 ms` | `2.1-5.6 ms` |
| commit 后首次可见                       |   `0-0.1 ms` |     `0.2 ms` |

首个 Zeus sample 的 `eventTimestamp` 与 `inputEndTime` 同步，而 `eventDispatchTime` 与 `handlerStartTime` 同步，说明等待发生在浏览器派发 scroll 事件之前；scroll listener 本身没有额外排队。

## 结论

当前证据不支持修改 Zeus core scheduler、`SizeCache`、row/column snapshot 或 keyed `For` 复用来解决约 11.5 ms 的端到端差异。继续修改这些路径会增加回归风险，而无法触及主要等待区间。

该证据将 Chromium 中的主要等待定位为宿主滚动事件派发（约一帧），而不是 Zeus scheduler、range 或 DOM commit。仍需在 macOS WKWebView 和 Windows WebView2 采集同一分段，才能决定平台门禁是否应单独建模；在此之前不应为规避等待而修改 Zeus 生产代码或降低 Z1 阈值。
